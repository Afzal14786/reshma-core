import { User } from '../users/user.model';
import { IUser } from '../users/interface/user.interface';
import { RegisterInput } from './dtos/register.dto';
import { LoginInput } from './dtos/login.dto';
import { AppError } from '@shared/utils/app-error';
import { HTTP_STATUS } from '@shared/constant/http-codes';
import logger from '@config/logger';
import { redisClient } from '@config/redis';
import jwt from 'jsonwebtoken';
import env from '@config/env';
import crypto from 'crypto';
import { NotificationService } from '../notifications/notification.service';
import { signAccessToken } from './auth.utils';

/**
 * Authentication Service (Domain Layer)
 * * * ARCHITECTURE NOTE:
 * This class encapsulates the core business logic of the authentication flow. 
 * It is deliberately agnostic to HTTP constraints (Request/Response objects). 
 * It interacts exclusively with MongoDB (Persistence), Redis (Caching/Blacklisting), 
 * and the Notification Service (Queues).
 */
export class AuthService {
    
    /**
     * Phase 1 of Registration: Captures user intent and issues an OTP.
     * * * DESIGN DECISION: Safe Collision Recovery
     * If a user registers but closes their browser before entering the OTP, their 
     * account exists in a 'limbo' (unverified) state. If they attempt to register 
     * again tomorrow, we do NOT throw a 'Conflict' error. Instead, we safely overwrite 
     * their previous credentials and issue a fresh OTP, optimizing the UX.
     */
    public static async registerLocal(data: RegisterInput): Promise<{ user: IUser, message: string }> {
        let targetUser = await User.findOne({ email: data.email });
        
        if (targetUser) {
            // Hard block if the account is already verified and active
            if (targetUser.isEmailVerified) {
                logger.warn(`Registration failed: Verified email already exists`, { email: data.email });
                throw new AppError(HTTP_STATUS.CONFLICT, "An account with this email already exists");
            }
            
            // Safe Collision Recovery for unverified accounts
            targetUser.firstname = data.firstname;
            targetUser.lastname = data.lastname;
            targetUser.password = data.password; 
            if (data.phone) targetUser.phone = data.phone;
            
            await targetUser.save();
            logger.info(`Updated existing unverified user during registration`, { userId: targetUser._id });
        } else {
            // New account initialization (Utilizing conditional spreads for strict exactOptionalPropertyTypes)
            const userData = {
                firstname: data.firstname,
                lastname: data.lastname,
                email: data.email,
                password: data.password,
                authProvider: 'LOCAL' as const,
                isEmailVerified: false,
                ...(data.phone && { phone: data.phone }) 
            };
            targetUser = await User.create(userData);
            logger.info(`New unverified user created`, { userId: targetUser._id });
        }

        // Generate a cryptographically secure 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        
        // Cache in Redis with a strict 10-minute (600s) TTL
        await redisClient.setEx(`otp:${targetUser.email}`, 600, otp);
        
        // Hand off to the background worker to dispatch the HTML email
        await NotificationService.sendOtpEmail(targetUser.email, targetUser.firstname, otp);
        
        return { 
            user: targetUser, 
            message: "Registration initiated. Please check your email for the verification OTP." 
        };
    }

    /**
     * Phase 2 of Registration: Verifies the OTP and activates the account.
     * * * SECURITY NOTE: Replay Attack Mitigation
     * The instant an OTP is successfully validated, it is permanently deleted 
     * from Redis to prevent attackers from reusing intercepted OTPs.
     */
    public static async verifyEmailOtp(email: string, otp: string): Promise<IUser> {
        const storedOtp = await redisClient.get(`otp:${email}`);
        
        if (!storedOtp || storedOtp !== otp) {
            logger.warn(`Failed OTP verification attempt`, { email });
            throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid or expired OTP. Please request a new one.');
        }

        // Activate the account in the database
        const user = await User.findOneAndUpdate(
            { email },
            { isEmailVerified: true },
            { new: true }
        );

        if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, 'User not found.');

        // Replay Attack Prevention
        await redisClient.del(`otp:${email}`);
        
        // Trigger the asynchronous onboarding sequence (Email + In-App Dashboard Alert)
        await NotificationService.triggerWelcome(user._id, user.email, user.firstname);
        
        logger.info(`User email verified successfully`, { userId: user._id });
        return user;
    }

    /**
     * Authenticates an existing, fully verified user.
     */
    public static async loginLocal(data: LoginInput): Promise<IUser> {
        // The password field has 'select: false' in the Schema. We must explicitly request it here.
        const user = await User.findOne({ email: data.email }).select('+password');
        
        if (!user || !(await user.comparePassword(data.password))) {
            logger.warn(`Failed login attempt`, { email: data.email });
            // Generic error message prevents bad actors from enumerating valid emails
            throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Incorrect email or password.');
        }

        // Infrastructure Gatekeepers
        if (!user.isEmailVerified) throw new AppError(HTTP_STATUS.FORBIDDEN, 'Please verify your email address before logging in.');
        if (!user.isActive) throw new AppError(HTTP_STATUS.FORBIDDEN, 'This account has been deactivated. Please contact support.');

        // Update session telemetry without triggering heavy pre-save hooks
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        logger.info(`User logged in successfully`, { userId: user._id });
        return user;
    }

    /**
     * Rehydrates an expired Access session using a valid Refresh Token.
     */
    public static async refreshSession(refreshToken: string): Promise<string> {
        try {
            const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
            
            const user = await User.findById(decoded.id);
            if (!user) throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'The user belonging to this token no longer exists.');
            if (!user.isActive) throw new AppError(HTTP_STATUS.FORBIDDEN, 'This account has been deactivated.');

            // Issue a fresh 15-minute Access Token
            return signAccessToken(user._id);
        } catch (error) {
            throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token. Please log in again.');
        }
    }

    /**
     * Terminates a session by blacklisting the Refresh Token in Redis.
     * * * ARCHITECTURE NOTE:
     * Because JWTs are stateless, they cannot be 'deleted' from the server. 
     * We push the token signature to a Redis blacklist with a TTL matching 
     * its natural expiration time. The auth middleware will check this list.
     */
    public static async logoutUser(refreshToken: string): Promise<void> {
        try {
            const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
            
            if (decoded.exp) {
                const timeToLive = decoded.exp - Math.floor(Date.now() / 1000);
                if (timeToLive > 0) {
                    await redisClient.setEx(`blacklist:${refreshToken}`, timeToLive, 'revoked');
                    logger.info(`Refresh token blacklisted successfully`, { tokenSnippet: refreshToken.substring(0, 15) });
                }
            }
        } catch (error) {
            logger.warn(`Attempted to blacklist invalid or expired refresh token during logout`);
        }
    }
}
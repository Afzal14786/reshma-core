import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../utils/app-error';
import { HTTP_STATUS } from '../constant/http-codes';

/**
 * Multer Memory Storage Configuration
 * * ARCHITECTURE NOTE:
 * We use `memoryStorage` instead of `diskStorage`. This prevents I/O bottlenecks 
 * and ensures the server remains entirely stateless (Cloud-Native/12-Factor App compliant).
 */
const storage = multer.memoryStorage();

/**
 * Security Firewall: File Type Validation
 * Prevents execution of malicious scripts or massive PDFs.
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only accept standard web image formats
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
};

/**
 * The Upload Instance
 * Implements strict boundaries to prevent memory exhaustion (OOM) attacks.
 */
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // Strict 10MB hard limit per file
    },
});

/**
 * Pre-configured Middlewares for specific routes
 */
export const uploadProductImage = upload.array('images', 5);
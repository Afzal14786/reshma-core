import { IUser } from '@modules/users/interface/user.interface';

// * ARCHITECTURE NOTE:
// By default, the Express Request object knows nothing about our custom User models.
// We use TypeScript Declaration Merging to inject our strictly-typed `IUser` interface 
// into the global Express namespace. This allows us to use `req.user._id` safely in 
// all of our controllers with full IntelliSense support.

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
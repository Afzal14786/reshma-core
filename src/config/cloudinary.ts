import { v2 as cloudinary } from 'cloudinary';
import env from './env';

/**
 * Cloudinary Media Pipeline
 * * ARCHITECTURE NOTE:
 * We wrap the Cloudinary SDK in Promise-based utilities. This isolates the external 
 * dependency, making it easier to mock during testing or swap to AWS S3 in the future.
 */

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a raw memory buffer directly to Cloudinary via streams.
 * Automatically converts images to .webp for high-performance frontend rendering.
 */
export const uploadBufferToCloudinary = (fileBuffer: Buffer, folderName: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `reshma-core/${folderName}`,
                format: 'webp', // Force WebP conversion for extreme bandwidth savings
                quality: 'auto', // Cloudinary AI determines the best compression ratio
            },
            (error, result) => {
                if (error || !result) {
                    return reject(new Error(error?.message || 'Failed to upload image to Cloudinary'));
                }
                resolve(result.secure_url);
            }
        );

        // End the stream with the buffer data
        uploadStream.end(fileBuffer);
    });
};

/**
 * Extracts the public_id from a secure Cloudinary URL.
 * Required to delete images when a product is permanently removed.
 */
export const extractPublicId = (secureUrl: string): string => {
    const splitUrl = secureUrl.split('/');
    const fileWithExtension = splitUrl.pop() || '';
    const folderPath = splitUrl.slice(splitUrl.indexOf('reshma-core')).join('/');
    const publicId = fileWithExtension.split('.')[0];
    
    return `${folderPath}/${publicId}`;
};

/**
 * Deletes an asset from Cloudinary.
 */
export const deleteFromCloudinary = async (secureUrl: string): Promise<void> => {
    try {
        const publicId = extractPublicId(secureUrl);
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error(`[Cloudinary] Failed to delete asset: ${secureUrl}`, error);
        // We do not throw here. If an image fails to delete, we log it, but we 
        // shouldn't crash the main database transaction.
    }
};

export default cloudinary;
import multer from "multer";
import { Request } from "express";
import { AppError } from "../utils/app-error";
import { HTTP_STATUS } from "../constant/http-codes";
import { fileTypeFromBuffer } from "file-type";

/**
 * Multer Memory Storage Configuration
 * * ARCHITECTURE NOTE:
 * We use `memoryStorage` instead of `diskStorage`. This prevents I/O bottlenecks
 * and ensures the server remains entirely stateless (Cloud-Native/12-Factor App compliant).
 */
const storage = multer.memoryStorage();

/**
 * Security Firewall: File Type Validation using Magic Bytes
 *
 * ENHANCEMENT (Phase 1.3):
 * - Reads the actual file buffer (magic bytes) to detect the REAL MIME type.
 * - Rejects if the detected type does not match the client-declared type.
 * - Prevents attackers from uploading executables disguised as images.
 */
const fileFilter = async (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Allowed MIME types (based on actual content)
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ];

  // Read the Magic Bytes (first 4-8 bytes) of the uploaded file
  let detectedType;
  try {
    detectedType = await fileTypeFromBuffer(file.buffer);
  } catch {
    // If detection fails, treat as invalid
    return cb(
      new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Unable to detect file type. Please upload a valid image.",
      ),
    );
  }

  // Validation Logic
  if (!detectedType) {
    return cb(
      new AppError(
        HTTP_STATUS.BAD_REQUEST,
        "Unable to detect file type. Please upload a valid image.",
      ),
    );
  }

  // Check if detected MIME is allowed
  if (!allowedMimeTypes.includes(detectedType.mime)) {
    return cb(
      new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid file content. Detected '${detectedType.mime}', but only JPEG, PNG, and WebP are allowed.`,
      ),
    );
  }

  //    Strict mode: Ensure client's declared type matches actual content
  //    This prevents attackers from claiming one type while uploading another.
  if (detectedType.mime !== file.mimetype) {
    return cb(
      new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `File content mismatch. Detected '${detectedType.mime}', but declared '${file.mimetype}'.`,
      ),
    );
  }

  // All checks passed
  cb(null, true);
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
    files: 5, // Maximum number of files per request
  },
});

/**
 * Pre-configured Middlewares for specific routes
 */
export const uploadProductImage = upload.array("images", 5);

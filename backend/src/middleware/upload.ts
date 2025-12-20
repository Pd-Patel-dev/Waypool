/**
 * Multer upload middleware for file uploads
 * Handles multipart/form-data with memory storage
 */

import multer from "multer";
import { Request } from "express";

// Configure multer for file uploads (memory storage)
// Files are stored in memory as Buffer objects
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Only ${allowedMimeTypes.join(", ")} are allowed.`
        )
      );
    }
  },
});

// Middleware for identity document uploads
// Accepts 'front' (required) and 'back' (optional) fields
export const uploadIdDocs = upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
]);

// Keep old export name for backward compatibility
export const uploadIdentityDocuments = uploadIdDocs;

// Extend Express Request type to include files
export interface MulterRequest extends Request {
  files?:
    | { [fieldname: string]: Express.Multer.File[] }
    | Express.Multer.File[]
    | undefined;
}


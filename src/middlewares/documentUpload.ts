import path from 'path';

import multer from 'multer';

import { AppError } from '../errors/AppError';

const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export const documentUpload = multer({
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      callback(new AppError(400, 'Only PDF, JPG and PNG files are allowed'));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  storage: multer.memoryStorage()
});

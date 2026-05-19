import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';

type UploadedFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

type PublicUploadedFile = {
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export async function uploadDocumentFile(file: UploadedFile): Promise<{ file: PublicUploadedFile }> {
  ensureCloudinaryConfigured();

  const result = await uploadToCloudinary(file);

  return {
    file: {
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: result.secure_url
    }
  };
}

function ensureCloudinaryConfigured(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(503, 'Document upload storage is not configured');
  }

  cloudinary.config({
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    secure: true
  });
}

function uploadToCloudinary(file: UploadedFile): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: env.CLOUDINARY_UPLOAD_FOLDER,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
}

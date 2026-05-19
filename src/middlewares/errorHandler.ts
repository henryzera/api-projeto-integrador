import { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { MongoServerError } from 'mongodb';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Invalid request data',
      details: error.flatten()
    });
  }

  if (error instanceof MulterError) {
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      message: error.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Invalid file upload',
      details: {
        code: error.code
      }
    });
  }

  if (error instanceof MongoServerError && error.code === 11000) {
    return res.status(409).json({
      message: 'Resource already exists'
    });
  }

  logger.error('unhandled_request_error', { error });

  return res.status(500).json({
    message: 'Internal server error',
    ...(env.NODE_ENV === 'development' ? { details: error } : {})
  });
};

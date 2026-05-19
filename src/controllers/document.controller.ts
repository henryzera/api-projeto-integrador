import { Request, Response } from 'express';

import { AppError } from '../errors/AppError';
import {
  addDocument,
  editDocument,
  getDocumentsSummary,
  listDocuments,
  removeDocument
} from '../services/document.service';
import { uploadDocumentFile } from '../services/storage.service';

export async function getDocumentsSummaryController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const summary = await getDocumentsSummary(req.user.objectId);

  return res.status(200).json(summary);
}

export async function listDocumentsController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const documents = await listDocuments(req.user.objectId);

  return res.status(200).json(documents);
}

export async function createDocumentController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const document = await addDocument(req.user.objectId, req.body);

  return res.status(201).json(document);
}

export async function uploadDocumentController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  if (!req.file) {
    throw new AppError(400, 'File is required');
  }

  const uploadedFile = await uploadDocumentFile({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname,
    size: req.file.size
  });

  return res.status(201).json(uploadedFile);
}

export async function updateDocumentController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  const document = await editDocument(req.user.objectId, String(req.params.id), req.body);

  return res.status(200).json(document);
}

export async function deleteDocumentController(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Authentication token is required');
  }

  await removeDocument(req.user.objectId, String(req.params.id));

  return res.status(204).send();
}

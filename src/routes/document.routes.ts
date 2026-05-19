import { Router } from 'express';

import {
  createDocumentController,
  deleteDocumentController,
  getDocumentsSummaryController,
  listDocumentsController,
  updateDocumentController
} from '../controllers/document.controller';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createDocumentSchema,
  documentParamsSchema,
  updateDocumentSchema
} from '../schemas/document.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/summary', asyncHandler(getDocumentsSummaryController));
router.get('/', asyncHandler(listDocumentsController));
router.post('/', validateRequest({ body: createDocumentSchema }), asyncHandler(createDocumentController));
router.patch(
  '/:id',
  validateRequest({ body: updateDocumentSchema, params: documentParamsSchema }),
  asyncHandler(updateDocumentController)
);
router.delete('/:id', validateRequest({ params: documentParamsSchema }), asyncHandler(deleteDocumentController));

export default router;

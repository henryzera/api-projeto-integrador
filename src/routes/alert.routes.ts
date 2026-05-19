import { Router } from 'express';

import {
  listAlertsController,
  markAlertAsReadController,
  resolveAlertController
} from '../controllers/alert.controller';
import { validateRequest } from '../middlewares/validateRequest';
import { alertParamsSchema, listAlertsQuerySchema } from '../schemas/alert.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', validateRequest({ query: listAlertsQuerySchema }), asyncHandler(listAlertsController));
router.patch('/:id/read', validateRequest({ params: alertParamsSchema }), asyncHandler(markAlertAsReadController));
router.patch('/:id/resolve', validateRequest({ params: alertParamsSchema }), asyncHandler(resolveAlertController));

export default router;

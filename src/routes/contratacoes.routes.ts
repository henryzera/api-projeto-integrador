import { Router } from 'express';

import {
  getChecklistController,
  updateChecklistController
} from '../controllers/checklist.controller';
import {
  getContratacaoByIdController,
  listContratacoesController
} from '../controllers/contratacoes.controller';
import { validateRequest } from '../middlewares/validateRequest';
import { updateChecklistSchema } from '../schemas/checklist.schemas';
import { contratacaoParamsSchema, listContratacoesQuerySchema } from '../schemas/contratacoes.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listContratacoesQuerySchema }),
  asyncHandler(listContratacoesController)
);
router.get(
  '/:id',
  validateRequest({ params: contratacaoParamsSchema }),
  asyncHandler(getContratacaoByIdController)
);
router.get(
  '/:id/checklist',
  validateRequest({ params: contratacaoParamsSchema }),
  asyncHandler(getChecklistController)
);
router.put(
  '/:id/checklist',
  validateRequest({ params: contratacaoParamsSchema, body: updateChecklistSchema }),
  asyncHandler(updateChecklistController)
);

export default router;

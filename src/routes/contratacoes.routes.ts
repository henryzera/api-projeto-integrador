import { Router } from 'express';

import {
  getChecklistController,
  updateChecklistController
} from '../controllers/checklist.controller';
import {
  getContratacaoByIdController,
  listContratacoesController
} from '../controllers/contratacoes.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(listContratacoesController));
router.get('/:id', asyncHandler(getContratacaoByIdController));
router.get('/:id/checklist', asyncHandler(getChecklistController));
router.put('/:id/checklist', asyncHandler(updateChecklistController));

export default router;

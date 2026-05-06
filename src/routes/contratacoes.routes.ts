import { Router } from 'express';

import {
  getContratacaoByIdController,
  listContratacoesController
} from '../controllers/contratacoes.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(listContratacoesController));
router.get('/:id', asyncHandler(getContratacaoByIdController));

export default router;

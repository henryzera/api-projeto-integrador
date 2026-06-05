import type { ObjectId } from 'mongodb';

import type {
  ChecklistItem,
  ChecklistRecord,
  ChecklistWithId,
  ParticipationStatus,
  PublicChecklist
} from '../models/checklist.model';
import { findChecklist, upsertChecklist } from '../repositories/checklist.repository';
import type { UpdateChecklistInput } from '../schemas/checklist.schemas';
import { buildRequiredDocuments } from '../utils/checklistDefaults';
import { getContratacaoById } from './contratacoes.service';

const defaultParticipationStatus: ParticipationStatus = 'preparing';

export async function getChecklist(
  userId: ObjectId,
  contratacaoId: string,
  userCnae?: string
): Promise<PublicChecklist> {
  await getContratacaoById(contratacaoId, userCnae);

  const existing = await findChecklist(userId, contratacaoId);

  if (existing) {
    return serializeChecklist(existing);
  }

  return buildDefaultPublicChecklist(contratacaoId);
}

export async function updateChecklist(
  userId: ObjectId,
  contratacaoId: string,
  payload: UpdateChecklistInput,
  userCnae?: string
): Promise<PublicChecklist> {
  await getContratacaoById(contratacaoId, userCnae);

  const existing = await findChecklist(userId, contratacaoId);
  const now = new Date();

  const baseItems = existing ? existing.items : buildDefaultItems();
  const baseStatus = existing ? existing.participationStatus : defaultParticipationStatus;
  const createdAt = existing ? existing.createdAt : now;

  const items = applyItemsPatch(baseItems, payload.items);
  const participationStatus = payload.participationStatus ?? baseStatus;

  const record: ChecklistRecord = {
    userId,
    contratacaoId,
    participationStatus,
    items,
    createdAt,
    updatedAt: now
  };

  const saved = await upsertChecklist(record);

  return serializeChecklist(saved);
}

function applyItemsPatch(
  baseItems: ChecklistItem[],
  patch?: UpdateChecklistInput['items']
): ChecklistItem[] {
  if (!patch || patch.length === 0) {
    return baseItems;
  }

  const patchById = new Map(patch.map((item) => [item.id, item.checked]));

  return baseItems.map((item) =>
    patchById.has(item.id) ? { ...item, checked: patchById.get(item.id) ?? item.checked } : item
  );
}

function buildDefaultItems(): ChecklistItem[] {
  return buildRequiredDocuments().map((label, index) => ({
    id: `doc-${index + 1}`,
    label,
    checked: false,
    required: true
  }));
}

function buildDefaultPublicChecklist(contratacaoId: string): PublicChecklist {
  return {
    contratacaoId,
    participationStatus: defaultParticipationStatus,
    items: buildDefaultItems(),
    updatedAt: new Date().toISOString()
  };
}

function serializeChecklist(checklist: ChecklistWithId): PublicChecklist {
  return {
    contratacaoId: checklist.contratacaoId,
    participationStatus: checklist.participationStatus,
    items: checklist.items,
    updatedAt: checklist.updatedAt.toISOString()
  };
}

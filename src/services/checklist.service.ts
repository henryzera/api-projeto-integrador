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
import { buildHabilitacaoItems } from '../utils/checklistBuilder';
import { getContratacaoById } from './contratacoes.service';

const defaultParticipationStatus: ParticipationStatus = 'preparing';

export async function getChecklist(
  userId: ObjectId,
  contratacaoId: string,
  userCnae?: string
): Promise<PublicChecklist> {
  const contratacao = await getContratacaoById(contratacaoId, userCnae);
  const derivedItems = buildDefaultItems(contratacao);

  const existing = await findChecklist(userId, contratacaoId);

  if (existing) {
    return serializeChecklist({
      ...existing,
      items: mergeChecklistItems(derivedItems, existing.items)
    });
  }

  return buildDefaultPublicChecklist(contratacaoId, derivedItems);
}

export async function updateChecklist(
  userId: ObjectId,
  contratacaoId: string,
  payload: UpdateChecklistInput,
  userCnae?: string
): Promise<PublicChecklist> {
  const contratacao = await getContratacaoById(contratacaoId, userCnae);
  const derivedItems = buildDefaultItems(contratacao);

  const existing = await findChecklist(userId, contratacaoId);
  const now = new Date();

  const baseItems = existing ? mergeChecklistItems(derivedItems, existing.items) : derivedItems;
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

function buildDefaultItems(contratacao: Record<string, unknown>): ChecklistItem[] {
  return buildHabilitacaoItems(contratacao).map((item) => ({
    id: item.id,
    label: item.label,
    checked: false,
    required: item.required
  }));
}

function mergeChecklistItems(
  derivedItems: ChecklistItem[],
  storedItems: ChecklistItem[]
): ChecklistItem[] {
  const storedById = new Map(storedItems.map((item) => [item.id, item]));

  return derivedItems.map((item) => {
    const stored = storedById.get(item.id);

    return stored ? { ...item, checked: stored.checked } : item;
  });
}

function buildDefaultPublicChecklist(
  contratacaoId: string,
  derivedItems: ChecklistItem[]
): PublicChecklist {
  return {
    contratacaoId,
    participationStatus: defaultParticipationStatus,
    items: derivedItems,
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

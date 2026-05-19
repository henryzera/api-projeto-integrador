import type { ObjectId } from 'mongodb';

import { AppError } from '../errors/AppError';
import type {
  CompanyDocumentRecord,
  CompanyDocumentWithId,
  DocumentGroup,
  DocumentStatus,
  PublicCompanyDocument
} from '../models/document.model';
import {
  countDocumentsByUser,
  createDocument,
  deleteDocumentById,
  findDocumentsByUser,
  insertDocuments,
  updateDocumentById
} from '../repositories/document.repository';
import type { CreateDocumentInput, UpdateDocumentInput } from '../schemas/document.schemas';

const documentCategories: Record<string, string> = {
  'habilitacoes-juridicas': 'Habilitacoes Juridicas',
  'qualificacao-tecnica': 'Qualificacao Tecnica',
  'regularidade-fiscal': 'Regularidade Fiscal'
};

export async function getDocumentsSummary(userId: ObjectId) {
  const documents = await getSeededDocuments(userId);
  const statuses = documents.map(resolveDocumentStatus);
  const okCount = statuses.filter((status) => status === 'ok').length;
  const pendingCount = statuses.filter((status) => status === 'attention' || status === 'pending').length;
  const expiredCount = statuses.filter((status) => status === 'expired').length;
  const categoriesCount = new Set(documents.map((document) => document.categoryId)).size;

  return {
    healthPercent: documents.length === 0 ? 100 : Math.round((okCount / documents.length) * 100),
    categoriesCount,
    pendingCount,
    expiredCount
  };
}

export async function listDocuments(userId: ObjectId): Promise<{ groups: DocumentGroup[] }> {
  const documents = await getSeededDocuments(userId);
  const groupsByCategory = new Map<string, CompanyDocumentWithId[]>();

  for (const document of documents) {
    const currentGroup = groupsByCategory.get(document.categoryId) ?? [];
    currentGroup.push(document);
    groupsByCategory.set(document.categoryId, currentGroup);
  }

  const groups = Array.from(groupsByCategory.entries()).map(([categoryId, items]) => {
    const serializedDocuments = items.map(serializeDocument);
    const okCount = serializedDocuments.filter((document) => document.status === 'ok').length;

    return {
      id: categoryId,
      title: items[0]?.categoryTitle ?? getCategoryTitle(categoryId),
      summary: `${okCount} de ${items.length} em dia`,
      documents: serializedDocuments
    };
  });

  return {
    groups
  };
}

export async function addDocument(userId: ObjectId, input: CreateDocumentInput): Promise<{ document: PublicCompanyDocument }> {
  const now = new Date();
  const document = await createDocument({
    categoryId: input.categoryId,
    categoryTitle: input.categoryTitle ?? getCategoryTitle(input.categoryId),
    createdAt: now,
    expiresAt: input.expiresAt ?? null,
    fileUrl: input.fileUrl ?? null,
    name: input.name,
    status: input.status ?? (input.fileUrl ? 'ok' : 'pending'),
    updatedAt: now,
    userId
  });

  return {
    document: serializeDocument(document)
  };
}

export async function editDocument(
  userId: ObjectId,
  id: string,
  input: UpdateDocumentInput
): Promise<{ document: PublicCompanyDocument }> {
  const updates: Partial<CompanyDocumentRecord> = {
    ...input,
    ...(input.categoryId && !input.categoryTitle
      ? {
          categoryTitle: getCategoryTitle(input.categoryId)
        }
      : {}),
    updatedAt: new Date()
  };

  const document = await updateDocumentById(userId, id, updates);

  if (!document) {
    throw new AppError(404, 'Document not found');
  }

  return {
    document: serializeDocument(document)
  };
}

export async function removeDocument(userId: ObjectId, id: string): Promise<void> {
  const deleted = await deleteDocumentById(userId, id);

  if (!deleted) {
    throw new AppError(404, 'Document not found');
  }
}

export function resolveDocumentStatus(document: Pick<CompanyDocumentRecord, 'expiresAt' | 'fileUrl' | 'status'>): DocumentStatus {
  const now = new Date();

  if (document.expiresAt && document.expiresAt.getTime() < now.getTime()) {
    return 'expired';
  }

  if (!document.fileUrl && document.status !== 'ok') {
    return 'pending';
  }

  if (document.expiresAt && document.expiresAt.getTime() <= addDays(now, 30).getTime()) {
    return 'attention';
  }

  return document.status ?? 'ok';
}

async function getSeededDocuments(userId: ObjectId): Promise<CompanyDocumentWithId[]> {
  const documentsCount = await countDocumentsByUser(userId);

  if (documentsCount === 0) {
    await insertDocuments(buildSeedDocuments(userId));
  }

  return findDocumentsByUser(userId);
}

function serializeDocument(document: CompanyDocumentWithId): PublicCompanyDocument {
  return {
    id: document._id.toString(),
    expiresAt: document.expiresAt ?? null,
    fileUrl: document.fileUrl ?? null,
    name: document.name,
    status: resolveDocumentStatus(document),
    updatedAt: document.updatedAt
  };
}

function buildSeedDocuments(userId: ObjectId): CompanyDocumentRecord[] {
  const now = new Date();

  return [
    {
      categoryId: 'habilitacoes-juridicas',
      categoryTitle: documentCategories['habilitacoes-juridicas'],
      createdAt: now,
      expiresAt: null,
      fileUrl: null,
      name: 'Contrato social consolidado',
      status: 'ok',
      updatedAt: addDays(now, -12),
      userId
    },
    {
      categoryId: 'regularidade-fiscal',
      categoryTitle: documentCategories['regularidade-fiscal'],
      createdAt: now,
      expiresAt: addDays(now, 18),
      fileUrl: null,
      name: 'CND Receita Federal',
      status: 'ok',
      updatedAt: addDays(now, -20),
      userId
    },
    {
      categoryId: 'regularidade-fiscal',
      categoryTitle: documentCategories['regularidade-fiscal'],
      createdAt: now,
      expiresAt: addDays(now, -5),
      fileUrl: null,
      name: 'Certificado de Regularidade do FGTS',
      status: 'expired',
      updatedAt: addDays(now, -45),
      userId
    },
    {
      categoryId: 'regularidade-fiscal',
      categoryTitle: documentCategories['regularidade-fiscal'],
      createdAt: now,
      expiresAt: null,
      fileUrl: null,
      name: 'Certidao municipal de regularidade',
      status: 'pending',
      updatedAt: addDays(now, -3),
      userId
    },
    {
      categoryId: 'qualificacao-tecnica',
      categoryTitle: documentCategories['qualificacao-tecnica'],
      createdAt: now,
      expiresAt: addDays(now, 140),
      fileUrl: null,
      name: 'Atestado de capacidade tecnica',
      status: 'ok',
      updatedAt: addDays(now, -8),
      userId
    }
  ];
}

function getCategoryTitle(categoryId: string): string {
  return documentCategories[categoryId] ?? titleize(categoryId);
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

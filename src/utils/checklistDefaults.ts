import { buildHabilitacaoItems } from './checklistBuilder';

export function buildRequiredDocuments(contratacao: Record<string, unknown> = {}): string[] {
  return buildHabilitacaoItems(contratacao).map((item) => item.label);
}

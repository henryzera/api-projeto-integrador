const cnaeKeywordMap: Record<string, string[]> = {
  '43': ['construcao', 'obra', 'manutencao predial', 'reforma', 'engenharia'],
  '47': ['material', 'fornecimento', 'comercio', 'equipamento', 'mercadoria'],
  '56': ['alimentacao', 'refeicao', 'lanche', 'cozinha', 'buffet'],
  '62': ['software', 'sistema', 'tecnologia', 'informatica', 'desenvolvimento', 'suporte'],
  '63': ['dados', 'portal', 'internet', 'processamento', 'informacao'],
  '70': ['consultoria', 'gestao', 'planejamento', 'assessoria'],
  '73': ['publicidade', 'marketing', 'comunicacao', 'campanha'],
  '81': ['limpeza', 'conservacao', 'jardinagem', 'servicos combinados'],
  '82': ['administrativo', 'apoio', 'call center', 'escritorio']
};

export function calculateCompatibilityScore(contratacao: Record<string, unknown>, cnae?: string): number {
  const normalizedCnae = cnae?.replace(/\D/g, '');
  const cnaePrefix = normalizedCnae?.slice(0, 2);
  const keywords = cnaePrefix ? cnaeKeywordMap[cnaePrefix] ?? [] : [];
  const searchableText = normalizeText([
    getString(contratacao.objetoCompra),
    getString(contratacao.modalidadeNome),
    getNestedString(contratacao, 'orgaoEntidade', 'razaoSocial'),
    getNestedString(contratacao, 'unidadeOrgao', 'nomeUnidade')
  ].join(' '));

  let score = keywords.length > 0 ? 45 : 50;
  const matches = keywords.filter((keyword) => searchableText.includes(normalizeText(keyword))).length;

  score += Math.min(matches * 15, 45);

  if (getString(contratacao.situacaoCompraNome).toLowerCase().includes('divulg')) {
    score += 5;
  }

  if (getString(contratacao.dataEncerramentoProposta)) {
    score += 5;
  }

  return Math.max(0, Math.min(score, 100));
}

function getNestedString(document: Record<string, unknown>, key: string, nestedKey: string): string {
  const nested = document[key];

  if (!nested || typeof nested !== 'object') {
    return '';
  }

  return getString((nested as Record<string, unknown>)[nestedKey]);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

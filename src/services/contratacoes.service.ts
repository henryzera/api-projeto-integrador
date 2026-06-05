import { AppError } from '../errors/AppError';
import {
  countContratacoes,
  findContratacaoById,
  findContratacoesPool
} from '../repositories/contratacoes.repository';
import type { ListContratacoesQuery } from '../schemas/contratacoes.schemas';
import { buildRequiredDocuments } from '../utils/checklistDefaults';
import { calculateCompatibilityScore } from '../utils/contratacaoCompatibility';

const meiEppEstimatedValueLimit = 81_000;

// Teto do POOL de candidatos buscados do filtro para ordenar por compatibilidade
// ANTES de paginar. Limitacao MVP documentada: a ordenacao por compatibilidade so
// e exata dentro dos primeiros `compatibilityPoolLimit` candidatos (ordenados por
// data no Mongo). Acima desse teto, itens fora do pool nao concorrem na ordenacao
// por score, embora `total` continue refletindo a contagem real do filtro.
const compatibilityPoolLimit = 300;

export async function listContratacoes(input: ListContratacoesQuery, userCnae?: string) {
  const filter = buildContratacoesFilter(input);
  const cnae = input.cnae ?? userCnae;

  const [total, pool] = await Promise.all([
    countContratacoes(filter),
    findContratacoesPool(filter, compatibilityPoolLimit)
  ]);

  if (total === 0 && (await countContratacoes({})) === 0) {
    // Caminho de seed (banco vazio): mantemos o comportamento atual, ordenando e
    // paginando sobre os dados de seed.
    const seedData = filterSeedContratacoes(input);
    const orderedSeed = sortByCompatibility(
      seedData.map((contratacao) => toContratacaoListItem(contratacao, cnae)),
      cnae
    );

    return {
      total: seedData.length,
      limit: input.limit,
      skip: input.skip,
      data: orderedSeed.slice(input.skip, input.skip + input.limit)
    };
  }

  // Ordena o POOL inteiro por compatibilidade ANTES de paginar e so entao aplica
  // skip/limit sobre o pool ordenado.
  const orderedPool = sortByCompatibility(
    pool.map((contratacao) => toContratacaoListItem(contratacao, cnae)),
    cnae
  );

  return {
    total,
    limit: input.limit,
    skip: input.skip,
    data: orderedPool.slice(input.skip, input.skip + input.limit)
  };
}

type ContratacaoListItem = ReturnType<typeof toContratacaoListItem>;

function sortByCompatibility(items: ContratacaoListItem[], cnae?: string): ContratacaoListItem[] {
  if (!cnae) {
    return items;
  }

  return [...items].sort((a, b) => {
    const scoreDiff = (b.compatibilityScore ?? 0) - (a.compatibilityScore ?? 0);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const deadlineDiff = compareDeadlines(a.dataEncerramentoProposta, b.dataEncerramentoProposta);

    if (deadlineDiff !== 0) {
      return deadlineDiff;
    }

    return String(a.numeroCompra ?? '').localeCompare(String(b.numeroCompra ?? ''));
  });
}

function compareDeadlines(a: unknown, b: unknown): number {
  const dateA = parseDate(a);
  const dateB = parseDate(b);

  if (dateA && dateB) {
    return dateA.getTime() - dateB.getTime();
  }

  if (dateA) {
    return -1;
  }

  if (dateB) {
    return 1;
  }

  return 0;
}

export async function getContratacaoById(id: string, userCnae?: string) {
  const document = await findContratacaoById(id);

  if (!document) {
    const seedDocument = seedContratacoes.find((contratacao) => contratacao._id === id);

    if (seedDocument) {
      return toContratacaoDetail(seedDocument, userCnae);
    }

    throw new AppError(404, 'Document not found');
  }

  return toContratacaoDetail(document, userCnae);
}

function buildContratacoesFilter(input: ListContratacoesQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const andFilters: Record<string, unknown>[] = [];

  if (input.uf ?? input.ufSigla) {
    const uf = input.uf ?? input.ufSigla ?? '';

    andFilters.push({
      $or: [
        { 'unidadeOrgao.ufSigla': buildExactCaseInsensitiveRegex(uf) },
        { uf: buildExactCaseInsensitiveRegex(uf) }
      ]
    });
  }

  if (input.municipio ?? input.municipioNome) {
    const municipio = input.municipio ?? input.municipioNome ?? '';
    const regex = buildCaseInsensitiveRegex(municipio);

    andFilters.push({
      $or: [
        { 'unidadeOrgao.municipioNome': regex },
        { municipioNome: regex }
      ]
    });
  }

  if (input.modalidadeNome) {
    filter.modalidadeNome = buildCaseInsensitiveRegex(input.modalidadeNome);
  }

  if (input.status ?? input.situacaoCompraNome) {
    filter.situacaoCompraNome = buildCaseInsensitiveRegex(input.status ?? input.situacaoCompraNome ?? '');
  }

  if (input.valorMin !== undefined || input.valorMax !== undefined) {
    const valorFilter: Record<string, number> = {};

    if (input.valorMin !== undefined) {
      valorFilter.$gte = input.valorMin;
    }

    if (input.valorMax !== undefined) {
      valorFilter.$lte = input.valorMax;
    }

    filter.valorTotalEstimado = valorFilter;
  }

  if (input.q) {
    const regex = buildCaseInsensitiveRegex(input.q);

    andFilters.push({
      $or: [
        { objetoCompra: regex },
        { numeroCompra: regex },
        { modalidadeNome: regex },
        { situacaoCompraNome: regex },
        { 'orgaoEntidade.razaoSocial': regex },
        { 'unidadeOrgao.nomeUnidade': regex },
        { 'unidadeOrgao.municipioNome': regex },
        { municipioNome: regex },
        { codigoIbge: regex },
        { uf: regex }
      ]
    });
  }

  if (input.meOnly) {
    andFilters.push({
      $or: [
        { exclusivaMeEpp: true },
        { exclusivoME: true },
        { tratamentoDiferenciado: buildCaseInsensitiveRegex('ME') },
        { valorTotalEstimado: { $lt: meiEppEstimatedValueLimit } }
      ]
    });
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  return filter;
}

function toContratacaoListItem(contratacao: Record<string, unknown>, cnae?: string) {
  const municipioNome = getMunicipioNome(contratacao);
  const ufSigla = getUfSigla(contratacao);
  const codigoIbge = getCodigoIbge(contratacao);
  const linksOficiais = buildOfficialLinks(contratacao);

  return {
    _id: getId(contratacao),
    anoCompra: contratacao.anoCompra ?? null,
    codigoIbge,
    dataAtualizacao: contratacao.dataAtualizacao ?? contratacao.dataAtualizacaoGlobal ?? null,
    numeroCompra: contratacao.numeroCompra ?? null,
    objetoCompra: contratacao.objetoCompra ?? null,
    modalidadeNome: contratacao.modalidadeNome ?? null,
    municipioNome,
    situacaoCompraNome: contratacao.situacaoCompraNome ?? null,
    dataEncerramentoProposta: contratacao.dataEncerramentoProposta ?? null,
    uf: ufSigla ? String(ufSigla).toLowerCase() : null,
    valorTotalEstimado: contratacao.valorTotalEstimado ?? null,
    compatibilityScore: calculateCompatibilityScore(contratacao, cnae),
    linkOficial: linksOficiais[0]?.url ?? null,
    linksOficiais,
    orgaoEntidade: {
      razaoSocial: getNestedValue(contratacao, 'orgaoEntidade', 'razaoSocial')
    },
    unidadeOrgao: {
      nomeUnidade: getNestedValue(contratacao, 'unidadeOrgao', 'nomeUnidade'),
      municipioNome,
      ufSigla,
      codigoIbge
    }
  };
}

function toContratacaoDetail(contratacao: Record<string, unknown>, cnae?: string) {
  const municipioNome = getMunicipioNome(contratacao);
  const ufSigla = getUfSigla(contratacao);
  const codigoIbge = getCodigoIbge(contratacao);
  const linksOficiais = buildOfficialLinks(contratacao);

  return {
    ...contratacao,
    _id: getId(contratacao),
    codigoIbge,
    compatibilityScore: calculateCompatibilityScore(contratacao, cnae),
    dadosOrgao: {
      cnpj: getNestedValue(contratacao, 'orgaoEntidade', 'cnpj'),
      razaoSocial: getNestedValue(contratacao, 'orgaoEntidade', 'razaoSocial'),
      unidade: getNestedValue(contratacao, 'unidadeOrgao', 'nomeUnidade'),
      municipio: municipioNome,
      uf: ufSigla,
      codigoIbge
    },
    datasImportantes: {
      aberturaProposta: contratacao.dataAberturaProposta ?? null,
      encerramentoProposta: contratacao.dataEncerramentoProposta ?? null,
      publicacaoPncp: contratacao.dataPublicacaoPncp ?? null,
      ultimaAtualizacao: contratacao.dataAtualizacaoGlobal ?? contratacao.dataAtualizacao ?? null
    },
    documentosExigidos: buildRequiredDocuments(contratacao),
    elegibilidade: buildElegibilidade(contratacao),
    linkOficial: linksOficiais[0]?.url ?? null,
    linksOficiais,
    municipioNome,
    requisitos: buildRequirements(contratacao),
    resumoSimplificado: buildResumoSimplificado(contratacao),
    statusOportunidade: getStatusOportunidade(contratacao),
    uf: ufSigla ? String(ufSigla).toLowerCase() : null,
    valorEstimado: contratacao.valorTotalEstimado ?? contratacao.valorTotalHomologado ?? null
  };
}

function buildOfficialLinks(contratacao: Record<string, unknown>) {
  const candidates = [
    {
      key: 'linkSistemaOrigem',
      label: 'Portal de origem',
      type: 'sistema_origem'
    },
    {
      key: 'linkProcessoEletronico',
      label: 'Processo eletronico',
      type: 'processo_eletronico'
    },
    {
      key: 'linkPncp',
      label: 'Portal PNCP',
      type: 'pncp'
    },
    {
      key: 'linkPNCP',
      label: 'Portal PNCP',
      type: 'pncp'
    }
  ];

  const links = candidates
    .map(({ key, label, type }) => {
      const value = contratacao[key];

      if (typeof value !== 'string' || !value.trim()) {
        return null;
      }

      return {
        label,
        type,
        url: value.trim()
      };
    })
    .filter((link): link is { label: string; type: string; url: string } => Boolean(link));

  return Array.from(new Map(links.map((link) => [link.url, link])).values());
}

function buildRequirements(contratacao: Record<string, unknown>): string[] {
  const requirements = [
    getNestedValue(contratacao, 'amparoLegal', 'nome'),
    contratacao.modalidadeNome,
    contratacao.modoDisputaNome,
    contratacao.informacaoComplementar
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  return requirements.length > 0 ? requirements : ['Consultar edital e termo de referencia no link oficial'];
}

const modalidadeGlossario: Array<{ keywords: string[]; descricao: string }> = [
  {
    keywords: ['pregao'],
    descricao:
      'Pregao eletronico: a disputa acontece online e vence quem oferecer o menor preco dentro das regras do edital.'
  },
  {
    keywords: ['dispensa'],
    descricao:
      'Dispensa eletronica: compra de menor valor com processo simplificado; o orgao seleciona a proposta mais vantajosa.'
  },
  {
    keywords: ['concorrencia'],
    descricao:
      'Concorrencia: modalidade para contratacoes de maior valor ou complexidade, com analise detalhada de propostas e habilitacao.'
  },
  {
    keywords: ['inexigibilidade'],
    descricao:
      'Inexigibilidade: contratacao direta quando ha fornecedor unico ou inviabilidade de competicao.'
  },
  {
    keywords: ['leilao'],
    descricao: 'Leilao: usado para venda de bens, vence quem oferecer o maior lance.'
  },
  {
    keywords: ['concurso'],
    descricao: 'Concurso: escolha de trabalho tecnico, cientifico ou artistico mediante premiacao.'
  }
];

function describeModalidade(modalidadeNome: string): string {
  const normalized = normalizeSimpleText(modalidadeNome);
  const match = modalidadeGlossario.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (match) {
    return match.descricao;
  }

  return modalidadeNome
    ? `Modalidade ${modalidadeNome}: consulte o edital para entender as regras de participacao e julgamento.`
    : 'Modalidade nao informada: consulte o edital para entender as regras de participacao.';
}

function humanizeDeadline(value: unknown): string | null {
  const deadline = parseDate(value);

  if (!deadline) {
    return null;
  }

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(deadline);
  const diffDays = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  if (deadline.getTime() < Date.now()) {
    return `O prazo para envio de proposta encerrou em ${formatted}.`;
  }

  if (diffDays <= 0) {
    return `O prazo para envio de proposta encerra hoje (${formatted}). Corra!`;
  }

  if (diffDays === 1) {
    return `O prazo para envio de proposta encerra amanha (${formatted}).`;
  }

  return `Voce tem cerca de ${diffDays} dias para enviar a proposta (encerra em ${formatted}).`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    style: 'currency'
  }).format(value);
}

function buildResumoSimplificado(contratacao: Record<string, unknown>): string[] {
  const resumo: string[] = [];
  const objeto = typeof contratacao.objetoCompra === 'string' ? contratacao.objetoCompra.trim() : '';

  if (objeto) {
    resumo.push(`O que o orgao quer contratar: ${objeto}.`);
  }

  const modalidadeNome = typeof contratacao.modalidadeNome === 'string' ? contratacao.modalidadeNome.trim() : '';
  resumo.push(describeModalidade(modalidadeNome));

  resumo.push(
    'Amparo legal: este processo segue a Lei 14.133/2021, a Nova Lei de Licitacoes, que define como o governo compra de empresas privadas de forma transparente.'
  );

  const deadlineText = humanizeDeadline(contratacao.dataEncerramentoProposta);

  if (deadlineText) {
    resumo.push(deadlineText);
  }

  const valor = Number(contratacao.valorTotalEstimado ?? contratacao.valorTotalHomologado ?? 0);

  if (valor > 0) {
    resumo.push(`Valor estimado da contratacao: ${formatCurrency(valor)}.`);
  }

  return resumo;
}

function buildElegibilidade(contratacao: Record<string, unknown>): {
  exclusivaMeEpp: boolean;
  dentroLimiteMei: boolean;
  mensagem: string;
} {
  const tratamento = normalizeSimpleText(
    typeof contratacao.tratamentoDiferenciado === 'string' ? contratacao.tratamentoDiferenciado : ''
  );
  const exclusivaMeEpp =
    contratacao.exclusivaMeEpp === true ||
    contratacao.exclusivoME === true ||
    tratamento.includes('me') ||
    tratamento.includes('epp');
  const valor = Number(contratacao.valorTotalEstimado ?? contratacao.valorTotalHomologado ?? 0);
  const dentroLimiteMei = valor <= meiEppEstimatedValueLimit;
  const mensagem = dentroLimiteMei
    ? 'Compativel com seu porte: o valor esta dentro do limite anual do MEI.'
    : 'Acima do limite do MEI, avalie como ME/EPP ou em sociedade para participar.';

  return {
    dentroLimiteMei,
    exclusivaMeEpp,
    mensagem
  };
}

function normalizeSimpleText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getStatusOportunidade(contratacao: Record<string, unknown>): string {
  const status = typeof contratacao.situacaoCompraNome === 'string'
    ? contratacao.situacaoCompraNome
    : typeof contratacao.status === 'string'
      ? contratacao.status
      : 'Indefinida';
  const deadline = parseDate(contratacao.dataEncerramentoProposta);

  if (deadline && deadline.getTime() < Date.now()) {
    return 'Encerrada';
  }

  return status;
}

function getNestedValue(document: Record<string, unknown>, key: string, nestedKey: string): unknown {
  const nested = document[key];

  if (!nested || typeof nested !== 'object') {
    return null;
  }

  return (nested as Record<string, unknown>)[nestedKey] ?? null;
}

function getMunicipioNome(contratacao: Record<string, unknown>): unknown {
  return getNestedValue(contratacao, 'unidadeOrgao', 'municipioNome') ?? contratacao.municipioNome ?? null;
}

function getUfSigla(contratacao: Record<string, unknown>): string | null {
  const uf = getNestedValue(contratacao, 'unidadeOrgao', 'ufSigla') ?? contratacao.uf ?? null;

  return typeof uf === 'string' && uf.trim() ? uf.trim().toUpperCase() : null;
}

function getCodigoIbge(contratacao: Record<string, unknown>): unknown {
  return (
    getNestedValue(contratacao, 'unidadeOrgao', 'codigoIbge') ??
    getNestedValue(contratacao, 'unidadeOrgao', 'codigoMunicipioIbge') ??
    contratacao.codigoIbge ??
    contratacao.codigoMunicipioIbge ??
    null
  );
}

function getId(document: Record<string, unknown>): string {
  return String(document._id);
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function buildCaseInsensitiveRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value), 'i');
}

function buildExactCaseInsensitiveRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterSeedContratacoes(input: ListContratacoesQuery): Array<Record<string, unknown>> {
  const q = input.q?.toLowerCase();
  const uf = input.uf ?? input.ufSigla;
  const municipio = input.municipio ?? input.municipioNome;
  const status = input.status ?? input.situacaoCompraNome;

  return seedContratacoes.filter((contratacao) => {
    if (uf && getUfSigla(contratacao) !== uf) {
      return false;
    }

    if (municipio && !String(getMunicipioNome(contratacao)).toLowerCase().includes(municipio.toLowerCase())) {
      return false;
    }

    if (status && !String(contratacao.situacaoCompraNome).toLowerCase().includes(status.toLowerCase())) {
      return false;
    }

    if (input.meOnly && Number(contratacao.valorTotalEstimado ?? 0) >= meiEppEstimatedValueLimit) {
      return false;
    }

    const valorEstimado = Number(contratacao.valorTotalEstimado ?? 0);

    if (input.valorMin !== undefined && valorEstimado < input.valorMin) {
      return false;
    }

    if (input.valorMax !== undefined && valorEstimado > input.valorMax) {
      return false;
    }

    if (q) {
      const text = [
        contratacao.objetoCompra,
        contratacao.numeroCompra,
        contratacao.modalidadeNome,
        getNestedValue(contratacao, 'orgaoEntidade', 'razaoSocial'),
        getNestedValue(contratacao, 'unidadeOrgao', 'nomeUnidade'),
        getMunicipioNome(contratacao),
        getCodigoIbge(contratacao),
        getUfSigla(contratacao)
      ]
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    }

    return true;
  });
}

const seedContratacoes: Array<Record<string, unknown>> = [
  {
    _id: '664a00000000000000000001',
    anoCompra: 2026,
    numeroCompra: '90001',
    objetoCompra: 'Contratacao de empresa para desenvolvimento e manutencao de sistema web para gestao municipal',
    modalidadeNome: 'Pregao - Eletronico',
    situacaoCompraNome: 'Divulgada no PNCP',
    dataAberturaProposta: '2026-06-03T08:00:00',
    dataEncerramentoProposta: '2026-06-12T10:00:00',
    dataPublicacaoPncp: '2026-05-18T09:00:00',
    dataAtualizacaoGlobal: '2026-05-18T09:30:00',
    valorTotalEstimado: 85000,
    orgaoEntidade: {
      cnpj: '10565165000110',
      razaoSocial: 'Prefeitura do Recife'
    },
    unidadeOrgao: {
      municipioNome: 'Recife',
      nomeUnidade: 'Secretaria de Transformacao Digital',
      ufSigla: 'PE'
    },
    amparoLegal: {
      nome: 'Lei 14.133/2021, Art. 28, I'
    },
    modoDisputaNome: 'Aberto'
  },
  {
    _id: '664a00000000000000000002',
    anoCompra: 2026,
    numeroCompra: '90002',
    objetoCompra: 'Fornecimento de materiais de escritorio e suprimentos para unidades administrativas',
    modalidadeNome: 'Dispensa Eletronica',
    situacaoCompraNome: 'Aberta',
    dataAberturaProposta: '2026-06-01T08:00:00',
    dataEncerramentoProposta: '2026-06-06T17:00:00',
    dataPublicacaoPncp: '2026-05-17T09:00:00',
    dataAtualizacaoGlobal: '2026-05-18T11:30:00',
    valorTotalEstimado: 42000,
    orgaoEntidade: {
      cnpj: '10298432000102',
      razaoSocial: 'Camara Municipal do Recife'
    },
    unidadeOrgao: {
      municipioNome: 'Recife',
      nomeUnidade: 'Diretoria Administrativa',
      ufSigla: 'PE'
    },
    amparoLegal: {
      nome: 'Lei 14.133/2021'
    },
    modoDisputaNome: 'Aberto'
  },
  {
    _id: '664a00000000000000000003',
    anoCompra: 2026,
    numeroCompra: '90003',
    objetoCompra: 'Servico de limpeza, conservacao e apoio operacional em predios publicos',
    modalidadeNome: 'Pregao - Eletronico',
    situacaoCompraNome: 'Divulgada no PNCP',
    dataAberturaProposta: '2026-06-04T08:00:00',
    dataEncerramentoProposta: '2026-06-18T09:00:00',
    dataPublicacaoPncp: '2026-05-16T09:00:00',
    dataAtualizacaoGlobal: '2026-05-18T08:30:00',
    valorTotalEstimado: 180000,
    orgaoEntidade: {
      cnpj: '00394544000185',
      razaoSocial: 'Ministerio da Saude'
    },
    unidadeOrgao: {
      municipioNome: 'Recife',
      nomeUnidade: 'Unidade Recife',
      ufSigla: 'PE'
    },
    amparoLegal: {
      nome: 'Lei 14.133/2021, Art. 28, I'
    },
    modoDisputaNome: 'Aberto'
  }
];

export type HabilitacaoItem = {
  id: string;
  label: string;
  required: boolean;
};

const atestadoTecnicoThreshold = 80_000;

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function isExclusivaMeEpp(contratacao: Record<string, unknown>): boolean {
  if (contratacao.exclusivaMeEpp === true || contratacao.exclusivoME === true) {
    return true;
  }

  const tratamento = normalizeText(getString(contratacao.tratamentoDiferenciado));

  return tratamento.includes('me') || tratamento.includes('epp');
}

export function buildHabilitacaoItems(contratacao: Record<string, unknown>): HabilitacaoItem[] {
  const items: HabilitacaoItem[] = [
    { id: 'cnpj-ativo', label: 'CNPJ ativo e regular', required: true },
    { id: 'regularidade-federal', label: 'Regularidade fiscal federal', required: true },
    { id: 'fgts', label: 'Regularidade do FGTS', required: true },
    { id: 'cndt', label: 'Regularidade trabalhista (CNDT)', required: true }
  ];

  const modalidade = normalizeText(getString(contratacao.modalidadeNome));
  const situacao = normalizeText(getString(contratacao.situacaoCompraNome));
  const objeto = normalizeText(getString(contratacao.objetoCompra));
  const valor = getNumber(contratacao.valorTotalEstimado);

  const isEletronico =
    modalidade.includes('pregao') ||
    modalidade.includes('eletron') ||
    situacao.includes('eletron');

  if (isEletronico) {
    items.push({
      id: 'proposta-eletronica',
      label: 'Cadastro e proposta no sistema eletrônico',
      required: true
    });
  }

  const isServico =
    objeto.includes('servico') || objeto.includes('obra') || objeto.includes('manutencao');

  if (valor > atestadoTecnicoThreshold || isServico) {
    items.push({
      id: 'atestado-tecnico',
      label: 'Atestado de capacidade técnica',
      required: true
    });
  }

  if (!isExclusivaMeEpp(contratacao)) {
    items.push({
      id: 'declaracao-mei',
      label: 'Declaração de enquadramento como MEI/ME/EPP',
      required: true
    });
  }

  items.push({
    id: 'portfolio',
    label: 'Atestado/portfólio complementar',
    required: false
  });

  return items;
}

// Compatibilidade entre uma contratacao (edital) e o CNAE de atuacao do MEI/ME.
//
// FORMULA DO SCORE (0-100):
//   - Base 50 quando NAO ha CNAE informado (neutro: nao da para inferir aderencia).
//   - Quando ha CNAE informado, partimos de uma base menor (35) e somamos pontos
//     conforme as palavras-chave/sinonimos da categoria CNAE aparecem no texto
//     pesquisavel da contratacao (objeto, modalidade, orgao, unidade, municipio):
//       score = 35 + min(matches * 13, 65)
//     ou seja, com >= 5 termos batendo o score satura em 100, e com 0 termos
//     o score fica em 35 (CNAE conhecido mas nenhum sinal de aderencia).
//   - Se o CNAE informado nao esta mapeado (prefixo desconhecido), caimos no
//     neutro 50, pois nao temos vocabulario para avaliar aderencia.
//
// Foram REMOVIDOS os bonus antigos de "+5 por situacao divulgada" e "+5 por ter
// data de encerramento", pois nao refletem compatibilidade real com a atividade
// economica — eram sinais de disponibilidade/estado do edital, nao de aderencia.
//
// Normalizacao: todo texto (objeto da compra e palavras-chave) e normalizado para
// minusculas e sem acentos antes do matching por substring.

const cnaeKeywordMap: Record<string, string[]> = {
  // Agropecuaria / pesca
  '01': ['agricultura', 'plantio', 'cultivo', 'hortifruti', 'agropecuaria', 'lavoura', 'sementes', 'mudas'],
  '02': ['florestal', 'silvicultura', 'reflorestamento', 'madeira'],
  '03': ['pesca', 'aquicultura', 'pescado'],
  // Industria / fabricacao
  '10': ['alimentos', 'fabricacao de alimentos', 'panificacao', 'laticinios', 'industria alimenticia'],
  '13': ['textil', 'tecido', 'fiacao', 'malha'],
  '14': ['confeccao', 'vestuario', 'roupa', 'uniforme', 'fardamento'],
  '15': ['calcado', 'couro', 'sapato'],
  '16': ['madeira', 'marcenaria', 'movel de madeira'],
  '18': ['grafica', 'impressao', 'editora', 'encadernacao'],
  '25': ['metalurgia', 'serralheria', 'estrutura metalica', 'solda', 'caldeiraria'],
  '31': ['mobiliario', 'movel', 'moveis', 'estofado'],
  '32': ['fabricacao diversa', 'brinquedo', 'instrumento', 'joia'],
  '33': ['manutencao', 'reparacao', 'instalacao de maquinas', 'conserto'],
  // Construcao
  '41': ['construcao', 'edificacao', 'obra', 'predial', 'civil', 'reforma'],
  '42': ['infraestrutura', 'pavimentacao', 'saneamento', 'rodovia', 'obra de arte', 'rede'],
  '43': ['construcao', 'obra', 'manutencao predial', 'reforma', 'engenharia', 'instalacao eletrica', 'instalacao hidraulica', 'pintura', 'acabamento'],
  // Comercio
  '45': ['veiculo', 'automovel', 'peca', 'autopecas', 'pneu', 'concessionaria'],
  '46': ['atacado', 'distribuicao', 'distribuidora', 'fornecimento', 'representacao comercial'],
  '47': ['material', 'fornecimento', 'comercio', 'equipamento', 'mercadoria', 'varejo', 'suprimento', 'insumo', 'aquisicao'],
  // Transporte / logistica
  '49': ['transporte', 'frete', 'logistica', 'carga', 'rodoviario', 'fretamento', 'locacao de veiculo'],
  '52': ['armazenagem', 'deposito', 'estocagem', 'logistica'],
  '53': ['correio', 'entrega', 'malote', 'courier', 'encomenda'],
  // Alimentacao / hospedagem
  '55': ['hospedagem', 'hotel', 'pousada', 'hospedaria'],
  '56': ['alimentacao', 'refeicao', 'lanche', 'cozinha', 'buffet', 'coffee break', 'merenda', 'catering'],
  // TI / informacao / comunicacao
  '58': ['edicao', 'publicacao', 'livro', 'software de prateleira'],
  '59': ['video', 'producao audiovisual', 'filmagem', 'fotografia'],
  '60': ['radio', 'televisao', 'emissora'],
  '61': ['telecomunicacao', 'telefonia', 'internet', 'link de dados', 'banda larga', 'rede de comunicacao'],
  '62': ['software', 'sistema', 'tecnologia', 'informatica', 'desenvolvimento', 'suporte', 'aplicativo', 'programacao', 'ti', 'fabrica de software'],
  '63': ['dados', 'portal', 'internet', 'processamento', 'informacao', 'hospedagem de site', 'data center', 'nuvem'],
  // Servicos profissionais
  '64': ['financeiro', 'credito', 'servico bancario'],
  '66': ['seguro', 'corretagem', 'previdencia'],
  '68': ['imovel', 'imobiliario', 'locacao de imovel', 'administracao predial'],
  '69': ['juridico', 'advocacia', 'contabilidade', 'contabil', 'auditoria', 'assessoria contabil'],
  '70': ['consultoria', 'gestao', 'planejamento', 'assessoria', 'administracao'],
  '71': ['engenharia', 'arquitetura', 'projeto', 'topografia', 'laudo tecnico', 'ensaio'],
  '72': ['pesquisa', 'desenvolvimento cientifico', 'inovacao'],
  '73': ['publicidade', 'marketing', 'comunicacao', 'campanha', 'propaganda', 'pesquisa de mercado'],
  '74': ['design', 'fotografia', 'traducao', 'atividade profissional', 'decoracao'],
  '75': ['veterinaria', 'clinica veterinaria', 'animal'],
  // Administrativo / apoio
  '77': ['locacao', 'aluguel', 'leasing', 'locacao de equipamento', 'locacao de maquina'],
  '78': ['recrutamento', 'recursos humanos', 'mao de obra', 'terceirizacao', 'agenciamento'],
  '79': ['agencia de viagem', 'turismo', 'passagem', 'viagem'],
  '80': ['vigilancia', 'seguranca', 'monitoramento', 'portaria', 'vigia'],
  '81': ['limpeza', 'conservacao', 'jardinagem', 'servicos combinados', 'higienizacao', 'dedetizacao', 'paisagismo'],
  '82': ['administrativo', 'apoio', 'call center', 'escritorio', 'recepcao', 'telemarketing', 'digitacao', 'organizacao de evento'],
  // Educacao / saude / social
  '85': ['educacao', 'ensino', 'treinamento', 'capacitacao', 'curso', 'escola', 'aula'],
  '86': ['saude', 'medico', 'hospitalar', 'clinica', 'odontologico', 'enfermagem', 'exame', 'laboratorio'],
  '87': ['assistencia social', 'cuidador', 'acolhimento', 'institucional'],
  '88': ['servico social', 'assistencia', 'creche'],
  // Cultura / lazer / outros servicos
  '90': ['cultural', 'arte', 'espetaculo', 'teatro', 'musica', 'artistico'],
  '93': ['esporte', 'recreacao', 'lazer', 'academia', 'evento esportivo'],
  '95': ['reparacao', 'conserto', 'manutencao de equipamento', 'assistencia tecnica'],
  '96': ['servico pessoal', 'lavanderia', 'estetica', 'barbearia', 'cabeleireiro']
};

const fallbackKeywords: string[] = [];

export function calculateCompatibilityScore(contratacao: Record<string, unknown>, cnae?: string): number {
  const normalizedCnae = cnae?.replace(/\D/g, '');

  if (!normalizedCnae) {
    // Sem CNAE: nao ha como inferir aderencia -> score neutro.
    return 50;
  }

  const cnaePrefix = normalizedCnae.slice(0, 2);
  const keywords = cnaeKeywordMap[cnaePrefix] ?? fallbackKeywords;

  if (keywords.length === 0) {
    // CNAE informado mas prefixo nao mapeado -> neutro (sem vocabulario).
    return 50;
  }

  const searchableText = normalizeText(
    [
      getString(contratacao.objetoCompra),
      getString(contratacao.modalidadeNome),
      getNestedString(contratacao, 'orgaoEntidade', 'razaoSocial'),
      getNestedString(contratacao, 'unidadeOrgao', 'nomeUnidade'),
      getString(contratacao.municipioNome),
      getString(contratacao.informacaoComplementar)
    ].join(' ')
  );

  const matches = keywords.filter((keyword) => searchableText.includes(normalizeText(keyword))).length;
  const score = 35 + Math.min(matches * 13, 65);

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

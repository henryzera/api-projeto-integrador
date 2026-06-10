// Mascaramento de dados sensiveis para LOGS. O objetivo e minimizar a exposicao
// de PII (dados pessoais) e segredos em logs estruturados, atendendo aos
// requisitos de minimizacao/anonimizacao da LGPD e de boas praticas de
// seguranca (nunca registrar credenciais, tokens ou documentos em claro).
//
// Estas funcoes sao puramente para LOGS/observabilidade — nao alteram os dados
// persistidos nem as respostas da API.

// Mascara um e-mail preservando a primeira letra do usuario e o dominio.
// Ex.: "joao.silva@empresa.com" -> "j***@empresa.com"
export function maskEmail(value: string): string {
  const trimmed = value.trim();
  const atIndex = trimmed.indexOf('@');

  if (atIndex <= 0) {
    return maskGeneric(trimmed);
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const visible = local.slice(0, 1);

  return `${visible}***${domain}`;
}

// Mascara um CNPJ/documento numerico preservando apenas os 2 ultimos digitos.
// Ex.: "12345678000190" -> "************90"
export function maskDocument(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.length <= 2) {
    return '*'.repeat(digits.length);
  }

  return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
}

// Mascara um token/segredo preservando apenas um prefixo curto para correlacao.
// Ex.: "a1b2c3d4e5..." -> "a1b2****"
export function maskToken(value: string): string {
  if (value.length <= 4) {
    return '****';
  }

  return `${value.slice(0, 4)}****`;
}

// Mascaramento generico: mostra a primeira letra e oculta o restante.
export function maskGeneric(value: string): string {
  if (value.length <= 1) {
    return '*';
  }

  return `${value.slice(0, 1)}***`;
}

// Chaves consideradas sensiveis. A comparacao e case-insensitive e por
// substring para cobrir variacoes (ex.: passwordHash, resetToken, authorization).
const sensitiveKeyPatterns = [
  'password',
  'senha',
  'token',
  'authorization',
  'cookie',
  'secret',
  'jwt',
  'passwordhash'
];

const emailKeyPatterns = ['email'];
const documentKeyPatterns = ['cnpj', 'cpf', 'document'];

function classifyKey(key: string): 'secret' | 'email' | 'document' | null {
  const lower = key.toLowerCase();

  if (sensitiveKeyPatterns.some((pattern) => lower.includes(pattern))) {
    return 'secret';
  }

  if (emailKeyPatterns.some((pattern) => lower.includes(pattern))) {
    return 'email';
  }

  if (documentKeyPatterns.some((pattern) => lower.includes(pattern))) {
    return 'document';
  }

  return null;
}

// Percorre recursivamente um objeto/array de metadados de log e mascara os
// valores cujas CHAVES sejam sensiveis. Limita a profundidade para evitar
// recursao excessiva em estruturas inesperadas.
export function maskSensitiveMeta(input: unknown, depth = 0): unknown {
  if (depth > 6 || input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => maskSensitiveMeta(item, depth + 1));
  }

  if (typeof input === 'object') {
    // Erros sao preservados (sao tratados pelo serializer do logger).
    if (input instanceof Error) {
      return input;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const classification = classifyKey(key);

      if (classification && typeof value === 'string') {
        result[key] =
          classification === 'email'
            ? maskEmail(value)
            : classification === 'document'
              ? maskDocument(value)
              : maskToken(value);
        continue;
      }

      result[key] = maskSensitiveMeta(value, depth + 1);
    }

    return result;
  }

  return input;
}

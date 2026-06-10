import { RequestHandler } from 'express';

// Sanitizacao manual contra NoSQL injection (operadores do MongoDB).
//
// Implementamos manualmente em vez de usar `express-mongo-sanitize` porque
// aquele pacote ainda nao e compativel com o Express 5: ele tenta reatribuir
// `req.query`, que no Express 5 e um getter somente-leitura, lancando erro em
// runtime. A abordagem abaixo remove (em vez de reatribuir) chaves perigosas
// in-place, preservando a referencia dos objetos.
//
// Removemos chaves que:
//   - comecam com `$` (operadores Mongo: $gt, $ne, $where, etc.)
//   - contem `.` (notacao de caminho aninhado que pode burlar filtros)
//
// Defesa em profundidade: a maioria das rotas ja valida entrada com Zod
// (.strict()), mas esta camada protege qualquer entrada que eventualmente vire
// filtro/documento Mongo sem passar por um schema rigido.

function sanitizeValue(value: unknown, depth = 0): void {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      sanitizeValue(item, depth + 1);
    }

    return;
  }

  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete record[key];
      continue;
    }

    sanitizeValue(record[key], depth + 1);
  }
}

export const sanitizeMongo: RequestHandler = (req, _res, next) => {
  // body e params sao objetos mutaveis comuns; sanitizamos in-place.
  sanitizeValue(req.body);
  sanitizeValue(req.params);

  // req.query no Express 5 e somente-leitura (getter): nao podemos reatribuir,
  // mas podemos mutar o objeto retornado in-place removendo chaves perigosas.
  if (req.query && typeof req.query === 'object') {
    sanitizeValue(req.query);
  }

  return next();
};

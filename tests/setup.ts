// Variaveis de ambiente minimas para que src/config/env.ts valide com sucesso
// durante os testes (sem exigir banco real). Definidas antes de qualquer import
// de modulo da aplicacao.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-with-at-least-32-characters-long';
process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017';
process.env.MONGO_DB_NAME = process.env.MONGO_DB_NAME ?? 'test_db';
process.env.MONGO_COLLECTION = process.env.MONGO_COLLECTION ?? 'contratacoes_limpas';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'error';

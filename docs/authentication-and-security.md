# Autenticacao JWT, seguranca e integracao com o front

Este documento descreve as alteracoes feitas na API Express/TypeScript e no aplicativo Expo/React Native para suportar cadastro, login, endpoint `/me`, protecao das rotas de licitacoes e consumo autenticado no front.

## Visao geral

Fluxo atual:

```text
Usuario -> Front Expo -> API Express -> MongoDB Atlas
```

A API usa o MongoDB Atlas para duas coisas:

- `ETL.contratacoes_brutas`: dados brutos de licitacoes vindos do ETL.
- `ETL.users`: usuarios cadastrados pela API.

## Backend

Principais arquivos adicionados ou alterados:

- `src/config/env.ts`: carrega e valida variaveis de ambiente com Zod.
- `src/database/mongo.ts`: cliente MongoDB unico e reutilizavel.
- `src/controllers/*`: controladores HTTP, responsaveis por request/response.
- `src/services/*`: regras de negocio e orquestracao dos casos de uso.
- `src/repositories/*`: acesso ao MongoDB Atlas.
- `src/schemas/*`: validacao e normalizacao com Zod.
- `src/middlewares/*`: autenticacao, erro, validacao e rate limit.
- `src/models/*`: tipos de dominio.
- `src/mappers/*`: conversao de documentos internos para respostas publicas.
- `src/routes/*`: declaracao das rotas e composicao dos middlewares.
- `src/app.ts`: middlewares de seguranca, rotas publicas e rotas protegidas.

Arquitetura aplicada:

```text
src/
  controllers/   entrada HTTP e resposta
  services/      regra de negocio
  repositories/  persistencia no MongoDB
  schemas/       validacao dos dados de entrada
  middlewares/   autenticacao e infraestrutura HTTP
  routes/        definicao dos endpoints
  models/        tipos de dominio
  mappers/       conversao para dados publicos
  utils/         funcoes auxiliares reutilizaveis
```

## Endpoints

Rotas publicas:

```http
GET /health
POST /auth/register
POST /auth/login
```

Rotas autenticadas:

```http
GET /me
POST /auth/logout
GET /contratacoes?limit=5
GET /contratacoes/:id
```

Para acessar rotas autenticadas, envie:

```http
Authorization: Bearer <token>
```

## Cadastro

Request:

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "usuario@email.com",
  "firstName": "Nome",
  "lastName": "Sobrenome",
  "cnpj": "12345678000195",
  "cnae": "6201501",
  "password": "SenhaTeste1",
  "confirmPassword": "SenhaTeste1"
}
```

Response:

```json
{
  "token": "jwt...",
  "user": {
    "id": "...",
    "email": "usuario@email.com",
    "firstName": "Nome",
    "lastName": "Sobrenome",
    "cnpj": "12345678000195",
    "cnae": "6201501"
  }
}
```

## Login

O login aceita email ou CNPJ no campo `identifier`.

```json
{
  "identifier": "usuario@email.com",
  "password": "SenhaTeste1"
}
```

## Logout

O logout invalida o JWT atual no backend ate a expiracao original do token.

```http
POST /auth/logout
Authorization: Bearer <token>
```

Response:

```http
204 No Content
```

## Validacoes e seguranca

A API nao confia nos dados enviados pelo front. As protecoes aplicadas foram:

- Zod no backend para validar `register`, `login`, `/contratacoes` query params e IDs.
- `strict()` nos schemas de auth para rejeitar campos inesperados.
- Hash de senha com `bcryptjs`, usando 12 rounds.
- JWT assinado com `JWT_SECRET`, `issuer`, `audience` e expiracao.
- Middleware `requireAuth` exigindo `Bearer token`.
- Revogacao de JWT no logout usando `jti` e colecao Mongo com TTL.
- Usuario publico sem `passwordHash` nas respostas.
- Indices unicos em `emailNormalized` e `cnpj`.
- `helmet` para headers HTTP de seguranca.
- `cors` configuravel por `CORS_ORIGIN`.
- limite de payload JSON em `100kb`.
- rate limit em memoria para requests gerais e endpoints de auth.
- tratamento centralizado de erros.

## Variaveis de ambiente da API

Use `.env.example` como base:

```env
PORT=3000
CORS_ORIGIN=*
MONGO_URI=mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/?appName=<app>
MONGO_DB_NAME=ETL
MONGO_COLLECTION=contratacoes_brutas
MONGO_USERS_COLLECTION=users
MONGO_REVOKED_TOKENS_COLLECTION=revoked_tokens
JWT_SECRET=<gere-um-segredo-com-pelo-menos-32-caracteres>
JWT_EXPIRES_IN=1h
JWT_ISSUER=api-projeto-integrador
JWT_AUDIENCE=front-projeto-integrador
```

Nunca versionar `.env`.

## Frontend

Principais arquivos adicionados ou alterados:

- `src/config/api.ts`: URL base da API.
- `src/services/api.ts`: cliente HTTP centralizado.
- `src/services/auth.ts`: login, cadastro e `/me`.
- `src/services/contratacoes.ts`: listagem autenticada de licitacoes.
- `src/store/AuthContext.tsx`: estado global de auth.
- `src/store/authStorage.ts`: persistencia do token com `expo-secure-store`.
- `src/validation/auth.ts`: validacao local com Zod para UX.
- `src/screens/LoginScreen.tsx`: login real integrado.
- `src/screens/RegisterScreen.tsx`: cadastro real integrado.
- `src/screens/HomeScreen.tsx`: carrega usuario e licitacoes autenticadas.
- `src/navigation/index.tsx`: alterna telas conforme usuario autenticado.

No front, a validacao com Zod melhora a experiencia, mas a protecao real continua sendo a validacao do backend.

## Variavel de ambiente do front

Use `.env.example` como base:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Em celular fisico, `localhost` aponta para o proprio celular, nao para seu Mac. Nesse caso, use o IP local da sua maquina:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3000
```

## Como rodar

API:

```bash
cd /Users/emanuelhenry/Documents/Henry/ws-study/api-projeto-integrador
npm run dev
```

Front:

```bash
cd /Users/emanuelhenry/Documents/Henry/ws-study/front-projeto-integrador
npm run start
```

## Testes manuais

Sem token, deve bloquear:

```bash
curl "http://localhost:3000/contratacoes?limit=1"
```

Com token:

```bash
curl "http://localhost:3000/me" \
  -H "Authorization: Bearer <token>"
```

```bash
curl "http://localhost:3000/contratacoes?limit=5" \
  -H "Authorization: Bearer <token>"
```

## Validacoes executadas

Backend:

```bash
npm run build
npm audit --audit-level=moderate
```

Frontend:

```bash
npx tsc --noEmit
npm run lint
```

Observacao: o `npm audit` do front ainda aponta uma vulnerabilidade moderada transitiva em `postcss` dentro da cadeia do Expo/Metro. O `npm audit fix --force` sugerido pelo npm faria downgrade agressivo do Expo, entao nao foi aplicado automaticamente.

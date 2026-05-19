# Contexto Geral Para Integracao Do Front

Este documento resume o que foi implementado na API para o app Projeto Integrador e como o front deve consumir cada recurso.

## Base Da API

Producao:

```txt
https://api-projeto-integrador-hcu8.onrender.com
```

Local:

```txt
http://localhost:3000
```

Todas as rotas privadas usam:

```http
Authorization: Bearer <token>
```

Erros seguem o formato:

```json
{
  "message": "Mensagem amigavel",
  "details": {}
}
```

## O Que Foi Implementado

- Autenticacao JWT com `register`, `login`, `/me` e `logout`.
- Logout com revogacao de token em blacklist no MongoDB.
- `PATCH /me` para atualizar perfil da empresa e preferencias.
- Listagem e detalhe de contratacoes com filtros, paginacao e `compatibilityScore`.
- Fallback em memoria para contratacoes caso a colecao real esteja vazia, sem gravar mocks na colecao do ETL.
- Modulo de documentos com summary, agrupamento por categoria e CRUD.
- Seeds automaticos de documentos por usuario na primeira consulta.
- Modulo de alertas com geracao automatica a partir de documentos e oportunidades.
- Alertas com status `open`, `read` e `resolved`.
- Indices Mongo para usuarios, tokens revogados, documentos e alertas.

## Variaveis De Ambiente

```env
APP_NAME=api-projeto-integrador
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*
LOG_LEVEL=info
MONGO_URI=mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/?appName=<app>
MONGO_DB_NAME=ETL
MONGO_COLLECTION=contratacoes_brutas
MONGO_USERS_COLLECTION=users
MONGO_DOCUMENTS_COLLECTION=user_documents
MONGO_ALERTS_COLLECTION=user_alerts
MONGO_REVOKED_TOKENS_COLLECTION=revoked_tokens
MONGO_CONNECT_RETRIES=5
MONGO_CONNECT_RETRY_DELAY_MS=2000
JWT_SECRET=<segredo-com-pelo-menos-32-caracteres>
JWT_EXPIRES_IN=1h
JWT_ISSUER=api-projeto-integrador
JWT_AUDIENCE=front-projeto-integrador
```

## Fluxo De Auth

### Cadastro

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "user@email.com",
  "firstName": "Nome",
  "lastName": "Sobrenome",
  "cnpj": "12345678000190",
  "cnae": "6201501",
  "password": "Senha123",
  "confirmPassword": "Senha123"
}
```

Resposta `201`:

```json
{
  "token": "jwt",
  "user": {
    "id": "string",
    "email": "user@email.com",
    "firstName": "Nome",
    "lastName": "Sobrenome",
    "cnpj": "12345678000190",
    "cnae": "6201501",
    "createdAt": "2026-05-19T00:00:00.000Z",
    "updatedAt": "2026-05-19T00:00:00.000Z",
    "notificationPreferences": {
      "documentAlerts": true,
      "email": true,
      "proposalAlerts": true,
      "push": true,
      "daysBeforeDeadline": 3
    }
  }
}
```

### Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "identifier": "user@email.com",
  "password": "Senha123"
}
```

Resposta `200`: mesmo formato do cadastro.

### Restaurar Sessao

```http
GET /me
Authorization: Bearer <token>
```

Use no boot do app quando existir token salvo. Se retornar `401`, apagar token local e mandar para login.

### Atualizar Perfil

```http
PATCH /me
Authorization: Bearer <token>
Content-Type: application/json
```

Campos aceitos, todos opcionais:

```json
{
  "firstName": "Nome",
  "lastName": "Sobrenome",
  "email": "novo@email.com",
  "cnpj": "12345678000190",
  "cnae": "6201501",
  "notificationPreferences": {
    "documentAlerts": true,
    "email": true,
    "proposalAlerts": true,
    "push": false,
    "daysBeforeDeadline": 5
  }
}
```

Resposta:

```json
{
  "user": {
    "id": "string",
    "email": "novo@email.com",
    "firstName": "Nome",
    "lastName": "Sobrenome",
    "cnpj": "12345678000190",
    "cnae": "6201501",
    "createdAt": "ISODate",
    "updatedAt": "ISODate",
    "notificationPreferences": {}
  }
}
```

### Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

Resposta `204 No Content`.

Mesmo se retornar `401`, o front deve limpar token e usuario localmente.

## Contratacoes

### Listar

```http
GET /contratacoes?limit=12&skip=0&q=software&uf=PE&municipio=Recife&status=Divulgada&meOnly=true
Authorization: Bearer <token>
```

Query params aceitos:

- `limit`: padrao `12`, maximo `100`.
- `skip`: padrao `0`.
- `q`: busca textual.
- `uf`: sigla, exemplo `PE`.
- `municipio`: exemplo `Recife`.
- `cnae`: opcional; se nao enviado, usa o CNAE do token.
- `meOnly`: `true` ou `false`.
- `status`: filtra `situacaoCompraNome`.

Resposta:

```json
{
  "data": [
    {
      "_id": "string",
      "anoCompra": 2026,
      "numeroCompra": "90001",
      "objetoCompra": "Contratacao de empresa para desenvolvimento...",
      "modalidadeNome": "Pregao - Eletronico",
      "situacaoCompraNome": "Divulgada no PNCP",
      "dataEncerramentoProposta": "ISODate",
      "valorTotalEstimado": 85000,
      "compatibilityScore": 80,
      "orgaoEntidade": {
        "razaoSocial": "Prefeitura do Recife"
      },
      "unidadeOrgao": {
        "nomeUnidade": "Secretaria de Transformacao Digital",
        "municipioNome": "Recife",
        "ufSigla": "PE"
      }
    }
  ],
  "limit": 12,
  "skip": 0,
  "total": 1
}
```

### Detalhe

```http
GET /contratacoes/:id
Authorization: Bearer <token>
```

O detalhe devolve os campos originais do Mongo e acrescenta:

- `compatibilityScore`
- `dadosOrgao`
- `datasImportantes`
- `documentosExigidos`
- `requisitos`
- `statusOportunidade`
- `valorEstimado`

## Documentos

### Resumo

```http
GET /documents/summary
Authorization: Bearer <token>
```

Resposta:

```json
{
  "healthPercent": 60,
  "categoriesCount": 3,
  "pendingCount": 2,
  "expiredCount": 1
}
```

### Listar Agrupado

```http
GET /documents
Authorization: Bearer <token>
```

Na primeira chamada, a API cria documentos seed para o usuario caso ele ainda nao tenha nenhum.

Resposta:

```json
{
  "groups": [
    {
      "id": "regularidade-fiscal",
      "title": "Regularidade Fiscal",
      "summary": "1 de 3 em dia",
      "documents": [
        {
          "id": "string",
          "name": "CND Receita Federal",
          "status": "attention",
          "updatedAt": "ISODate",
          "expiresAt": "ISODate",
          "fileUrl": "https://example.com/documentos/cnd-federal.pdf"
        }
      ]
    }
  ]
}
```

Status possiveis:

- `ok`
- `attention`
- `expired`
- `pending`

### Criar

```http
POST /documents
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "categoryId": "regularidade-fiscal",
  "categoryTitle": "Regularidade Fiscal",
  "name": "Certidao municipal",
  "expiresAt": "2026-08-01T00:00:00.000Z",
  "fileUrl": "https://example.com/arquivo.pdf",
  "status": "ok"
}
```

Resposta `201`:

```json
{
  "document": {
    "id": "string",
    "name": "Certidao municipal",
    "status": "ok",
    "updatedAt": "ISODate",
    "expiresAt": "ISODate",
    "fileUrl": "https://example.com/arquivo.pdf"
  }
}
```

### Atualizar

```http
PATCH /documents/:id
Authorization: Bearer <token>
Content-Type: application/json
```

Aceita os mesmos campos do `POST`, todos opcionais.

### Remover

```http
DELETE /documents/:id
Authorization: Bearer <token>
```

Resposta `204 No Content`.

## Alertas

### Listar

```http
GET /alerts?view=list&from=2026-05-01&to=2026-05-31&status=open&priority=1
Authorization: Bearer <token>
```

Query params aceitos:

- `view`: `list` ou `calendar`.
- `from`: data `YYYY-MM-DD`.
- `to`: data `YYYY-MM-DD`.
- `priority`: numero de `1` a `5`.
- `status`: `open`, `read` ou `resolved`.

Resposta:

```json
{
  "data": [
    {
      "id": "string",
      "title": "Entrega de proposta",
      "description": "Prazo encerra em 24 horas",
      "date": "2026-05-20",
      "kind": "proposalCritical",
      "priority": 1,
      "status": "open",
      "relatedType": "contratacao",
      "relatedId": "string"
    }
  ]
}
```

Kinds possiveis:

- `documentExpired`
- `info`
- `proposalCritical`
- `proposalSafe`
- `proposalSoon`

Os alertas sao sincronizados automaticamente na listagem:

- documentos vencidos geram `documentExpired`;
- documentos pendentes ou proximos do vencimento geram `info`;
- propostas proximas do encerramento geram `proposalCritical`, `proposalSoon` ou `proposalSafe`;
- editais compativeis com o CNAE geram `info`.

### Marcar Como Lido

```http
PATCH /alerts/:id/read
Authorization: Bearer <token>
```

Resposta:

```json
{
  "alert": {
    "id": "string",
    "status": "read"
  }
}
```

### Resolver

```http
PATCH /alerts/:id/resolve
Authorization: Bearer <token>
```

Resposta:

```json
{
  "alert": {
    "id": "string",
    "status": "resolved"
  }
}
```

## Health

```http
GET /health
```

Resposta:

```json
{
  "app": "api-projeto-integrador",
  "environment": "production",
  "mongo": "connected",
  "status": "ok",
  "uptime": 123,
  "timestamp": "ISODate"
}
```

## Exemplos Curl

```bash
curl https://api-projeto-integrador-hcu8.onrender.com/health
```

```bash
curl -X POST https://api-projeto-integrador-hcu8.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@email.com","password":"Senha123"}'
```

```bash
curl https://api-projeto-integrador-hcu8.onrender.com/me \
  -H "Authorization: Bearer <token>"
```

```bash
curl -X PATCH https://api-projeto-integrador-hcu8.onrender.com/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notificationPreferences":{"push":false,"daysBeforeDeadline":5}}'
```

```bash
curl -X POST https://api-projeto-integrador-hcu8.onrender.com/auth/logout \
  -H "Authorization: Bearer <token>"
```

```bash
curl "https://api-projeto-integrador-hcu8.onrender.com/contratacoes?limit=12&skip=0&uf=PE&municipio=Recife" \
  -H "Authorization: Bearer <token>"
```

```bash
curl https://api-projeto-integrador-hcu8.onrender.com/documents \
  -H "Authorization: Bearer <token>"
```

```bash
curl -X POST https://api-projeto-integrador-hcu8.onrender.com/documents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"categoryId":"regularidade-fiscal","name":"Certidao municipal","fileUrl":"https://example.com/certidao.pdf"}'
```

```bash
curl "https://api-projeto-integrador-hcu8.onrender.com/alerts?from=2026-05-01&to=2026-05-31" \
  -H "Authorization: Bearer <token>"
```

## Orientacao Para O Front

- Guardar o `token` retornado por login/cadastro em storage seguro.
- No boot do app, chamar `GET /me`; em `401`, limpar sessao.
- Usar `/contratacoes` para tela Editais e `/contratacoes/:id` para detalhe.
- Usar `/documents/summary` para cards de resumo e `/documents` para a lista agrupada.
- Usar `POST/PATCH/DELETE /documents` para substituir mocks da tela Documentos.
- Usar `/alerts` tanto para lista quanto calendario, agrupando por `date` no front.
- Usar `PATCH /alerts/:id/read` quando o usuario abrir/visualizar um alerta.
- Usar `PATCH /alerts/:id/resolve` quando o usuario concluir a pendencia.
- No logout, chamar `POST /auth/logout` e limpar sessao local no `finally`, mesmo em erro.

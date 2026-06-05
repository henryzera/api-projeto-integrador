# Implementacao — Checklist, Ordenacao por Compatibilidade e Dashboard (funnel + history)

Este documento descreve as mudancas feitas no backend (`api-projeto-integrador`) para suportar
o checklist de participacao por contratacao, a ordenacao das contratacoes por compatibilidade
e a expansao do dashboard com funil e historico.

## 1. Gaps resolvidos

1. **Checklist de participacao por contratacao** — nao existia. Agora cada usuario possui um
   checklist por contratacao, com status de participacao (`preparing | submitted | won | lost`)
   e itens de documentacao exigida (marcaveis).
2. **Ordenacao por compatibilidade** — a listagem de contratacoes nao priorizava as oportunidades
   mais aderentes ao CNAE do usuario. Agora, quando ha CNAE disponivel, a pagina retornada e
   ordenada por `compatibilityScore` DESC.
3. **Dashboard sem visao de funil/historico** — o `/me/dashboard` nao agregava o progresso de
   participacao. Agora retorna `funnel` (contagem por status) e `history` (evolucao mensal).
4. **Coleta do ETL** — a coleção consumida pela API passou a ser `contratacoes_limpas`
   (saida do ETL), em vez de `contratacoes_brutas`.

## 2. Arquivos novos

| Arquivo | Descricao |
| --- | --- |
| `src/models/checklist.model.ts` | Tipos do dominio: `participationStatuses`, `ParticipationStatus`, `ChecklistItem`, `ChecklistRecord`, `ChecklistWithId`, `PublicChecklist`. |
| `src/repositories/checklist.repository.ts` | Acesso a coleção (`env.MONGO_CHECKLISTS_COLLECTION`), `ensureChecklistIndexes` (indice unico `{ userId, contratacaoId }`), `findChecklist`, `findChecklistsByUser`, `upsertChecklist`. |
| `src/schemas/checklist.schemas.ts` | Validacao Zod: `checklistParamsSchema`, `updateChecklistSchema` (campos opcionais com `.refine` exigindo ao menos um). |
| `src/services/checklist.service.ts` | Regras de negocio: `getChecklist`, `updateChecklist` (merge parcial + upsert). Valida a existencia da contratacao via `getContratacaoById`. |
| `src/controllers/checklist.controller.ts` | `getChecklistController` e `updateChecklistController`. |
| `src/utils/checklistDefaults.ts` | Util compartilhado `buildRequiredDocuments()` (lista unica de 5 documentos, usada pelo service de contratacoes e pelo checklist para nao divergir). |

## 3. Arquivos alterados

| Arquivo | Mudanca |
| --- | --- |
| `src/services/contratacoes.service.ts` | Passou a importar `buildRequiredDocuments` do util compartilhado (removida a duplicata local). Adicionada ordenacao por compatibilidade na `listContratacoes` (caminho normal e seed). |
| `src/services/dashboard.service.ts` | Adicionados `funnel` e `history` ao retorno do dashboard, agregando os checklists do usuario. Nenhum campo existente foi removido. |
| `src/routes/contratacoes.routes.ts` | Registradas as rotas `GET /:id/checklist` e `PUT /:id/checklist` (com `asyncHandler`). |
| `src/config/env.ts` | Adicionada `MONGO_CHECKLISTS_COLLECTION` (default `contratacao_checklists`). |
| `src/server.ts` | Registrado `ensureChecklistIndexes()` no `Promise.all` de inicializacao, junto aos demais `ensure*Indexes`. |
| `.env.example` | `MONGO_COLLECTION` alterado para `contratacoes_limpas`; adicionado `MONGO_CHECKLISTS_COLLECTION`. |
| `.env` | Mesmas alteracoes do `.env.example`. |

## 4. Contrato dos endpoints de checklist

Ambos os endpoints exigem autenticacao (`Authorization: Bearer <token>`) e estao sob o
prefixo `/contratacoes` (ja protegido por `requireAuth`). O `:id` deve ser um ObjectId valido
de uma contratacao existente — caso contrario, retorna `404`.

### GET /contratacoes/:id/checklist

Retorna o checklist do usuario para a contratacao. No primeiro acesso retorna um checklist
DEFAULT (nao persiste ate o PUT). Os itens default derivam de `buildRequiredDocuments()`
(5 documentos), com `id` estavel (`doc-1`..`doc-5`), todos `required: true` e `checked: false`.

Resposta `200`:

```json
{
  "contratacaoId": "664a00000000000000000001",
  "participationStatus": "preparing",
  "items": [
    { "id": "doc-1", "label": "CNPJ ativo e regular", "checked": false, "required": true },
    { "id": "doc-2", "label": "Documento de habilitacao juridica da empresa", "checked": false, "required": true },
    { "id": "doc-3", "label": "Regularidade fiscal federal, estadual e municipal quando aplicavel", "checked": false, "required": true },
    { "id": "doc-4", "label": "Certificado de Regularidade do FGTS quando exigido", "checked": false, "required": true },
    { "id": "doc-5", "label": "Atestado de capacidade tecnica quando previsto no edital", "checked": false, "required": true }
  ],
  "updatedAt": "2026-06-05T00:00:00.000Z"
}
```

- `participationStatus` ∈ `"preparing" | "submitted" | "won" | "lost"` (default `"preparing"`).
- `updatedAt`: string ISO.

### PUT /contratacoes/:id/checklist

Atualiza (ou cria via upsert) o checklist. Body validado com Zod: todos os campos sao opcionais,
mas pelo menos um (`participationStatus` ou `items`) deve estar presente.

Body:

```json
{
  "participationStatus": "submitted",
  "items": [
    { "id": "doc-1", "checked": true },
    { "id": "doc-3", "checked": true }
  ]
}
```

Comportamento:
- `items` faz **merge parcial**: atualiza o `checked` apenas dos `id` enviados e preserva o resto
  (labels e itens nao enviados permanecem). Ids desconhecidos sao ignorados.
- Se o checklist ainda nao existir no banco, ele e criado a partir do default e o patch e
  aplicado (upsert).
- `participationStatus`, se enviado, substitui o status atual.

Resposta `200`: o checklist COMPLETO atualizado, no mesmo shape do GET.

```json
{
  "contratacaoId": "664a00000000000000000001",
  "participationStatus": "submitted",
  "items": [
    { "id": "doc-1", "label": "CNPJ ativo e regular", "checked": true, "required": true },
    { "id": "doc-2", "label": "Documento de habilitacao juridica da empresa", "checked": false, "required": true },
    { "id": "doc-3", "label": "Regularidade fiscal federal, estadual e municipal quando aplicavel", "checked": true, "required": true },
    { "id": "doc-4", "label": "Certificado de Regularidade do FGTS quando exigido", "checked": false, "required": true },
    { "id": "doc-5", "label": "Atestado de capacidade tecnica quando previsto no edital", "checked": false, "required": true }
  ],
  "updatedAt": "2026-06-05T12:34:56.000Z"
}
```

Erros possiveis: `400` (validacao Zod / id invalido), `401` (sem token), `404` (contratacao inexistente).

## 5. Ordenacao por compatibilidade

Na `listContratacoes`, quando ha um CNAE disponivel (query `cnae` ou `req.user.cnae`), os itens
retornados sao ordenados por `compatibilityScore` DESC. Criterios de desempate (estaveis):
1. `compatibilityScore` decrescente;
2. `dataEncerramentoProposta` crescente (prazo mais proximo primeiro; itens sem data vao ao fim);
3. `numeroCompra` ascendente (comparacao lexicografica).

A ordenacao e aplicada tanto no caminho normal (dados do Mongo) quanto no caminho de seed.

**Limitacao (aceitavel para o MVP):** a ordenacao por score e feita **apos** a busca paginada,
ou seja, reordena apenas os itens da pagina corrente — nao o dataset completo. Para ordenacao
global por score seria necessario calcular o score no banco (pipeline de agregacao) ou
materializar o score na coleção. Documentado tambem como comentario em
`src/services/contratacoes.service.ts`.

## 6. Novo formato do `/me/dashboard`

O dashboard mantem todos os campos anteriores e acrescenta `funnel` e `history`:

```jsonc
{
  "contratacoesCount": 12,
  "documentHealthPercent": 80,
  "expiredDocumentsCount": 1,
  "openAlertsCount": 3,
  "pendingDocumentsCount": 2,

  "funnel": { "preparing": 4, "submitted": 2, "won": 1, "lost": 1 },
  "history": [
    { "month": "2026-04", "preparing": 1, "submitted": 0, "won": 0, "lost": 0, "total": 1 },
    { "month": "2026-05", "preparing": 3, "submitted": 2, "won": 1, "lost": 1, "total": 7 }
  ]
}
```

- `funnel`: contagem dos checklists do usuario por `participationStatus`.
- `history`: checklists agrupados pelo mes (`YYYY-MM`) de `updatedAt` (fallback `createdAt`),
  ordenados cronologicamente, com contagem por status e `total` por mes.
- A agregacao usa `findChecklistsByUser(userId)` (novo metodo do repositorio de checklist).

## 7. Variaveis de ambiente novas

| Variavel | Default | Descricao |
| --- | --- | --- |
| `MONGO_CHECKLISTS_COLLECTION` | `contratacao_checklists` | Coleção Mongo dos checklists por usuario/contratacao. |

Alem disso, `MONGO_COLLECTION` agora aponta para `contratacoes_limpas` (saida do ETL) nos
arquivos `.env` e `.env.example`.

## 8. Como testar

Pre-requisitos: `npm install`, MongoDB acessivel via `MONGO_URI`, e um token JWT valido
(login via `/auth`). Suba a API com `npm run dev` (ou `npm run build && npm start`).

### curl

```bash
TOKEN="<jwt-do-usuario>"
ID="<objectId-de-uma-contratacao>"
BASE="http://localhost:3000"

# 1. Obter o checklist (default no primeiro acesso)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/contratacoes/$ID/checklist" | jq

# 2. Atualizar status e marcar itens (cria via upsert se ainda nao existir)
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "participationStatus": "submitted", "items": [ { "id": "doc-1", "checked": true } ] }' \
  "$BASE/contratacoes/$ID/checklist" | jq

# 3. Conferir o dashboard com funnel e history
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/me/dashboard" | jq

# 4. Listagem ordenada por compatibilidade (CNAE vem do token; pode forcar via query)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/contratacoes?limit=12" | jq '.data[].compatibilityScore'
```

### Thunder Client / Insomnia / Postman

1. Crie uma requisicao `GET {{base}}/contratacoes/{{id}}/checklist` com header
   `Authorization: Bearer {{token}}` e verifique o shape default.
2. Crie um `PUT {{base}}/contratacoes/{{id}}/checklist` com body JSON
   `{ "items": [ { "id": "doc-2", "checked": true } ] }` e confirme o merge parcial.
3. Envie um body vazio `{}` e confirme o erro `400` (a validacao exige ao menos um campo).
4. Use um `:id` inexistente e confirme o `404`.
5. Chame `GET {{base}}/me/dashboard` e confira `funnel` e `history`.

### Validacao de build

```bash
npm run typecheck   # zero erros de TypeScript
npm run build       # gera dist/ sem erros
```

## P0 — Correcoes de alinhamento ao MVP

Esta secao documenta os ajustes P0 que aproximam a API do escopo do MVP:
recuperacao de senha, filtro por faixa de valor, checklist correlacionado ao
edital e traducao "mastigada" do detalhe.

### Variaveis de ambiente novas

| Variavel | Default | Descricao |
| --- | --- | --- |
| `MONGO_PASSWORD_RESETS_COLLECTION` | `password_resets` | Colecao que armazena os tokens de reset (hash + expiracao). Possui indice TTL em `expiresAt` e indice em `tokenHash`. |

O indice e criado automaticamente no boot (`ensurePasswordResetIndexes` em `server.ts`).

### Recuperacao de senha (sem e-mail)

Projeto academico sem infraestrutura de e-mail. O token de reset e gerado com
`crypto.randomBytes(32)`, armazenamos apenas o **hash SHA-256** na colecao
`password_resets` com expiracao de **15 minutos**. Tokens anteriores do mesmo
usuario sao invalidados a cada nova solicitacao. O token e sempre logado no nivel
`info` (`password_reset_token_generated`) e, **apenas quando `NODE_ENV !== 'production'`**,
tambem retornado no corpo da resposta (`resetToken`) para viabilizar o teste.

Ambas as rotas usam o mesmo rate-limit das demais rotas de auth (20 req / 15 min).

#### `POST /auth/forgot-password`

Recebe e-mail OU CNPJ. Sempre responde `200` para nao vazar a existencia da conta.

Request:

```json
{ "identifier": "empresa@exemplo.com" }
```

Response (`200`, em desenvolvimento):

```json
{
  "message": "Se a conta existir, enviamos as instrucoes de redefinicao.",
  "resetToken": "<token hex de 64 caracteres>",
  "expiresInMinutes": 15
}
```

Em producao o campo `resetToken` e omitido.

#### `POST /auth/reset-password`

Valida o token (hash + nao expirado), aplica a **mesma politica de senha forte do
cadastro** (minimo 8 caracteres, com minuscula, maiuscula e numero), atualiza o
hash bcrypt da senha do usuario e **consome** o token (deleta todos os resets do
usuario).

Request:

```json
{ "token": "<token recebido>", "newPassword": "NovaSenha123" }
```

Response (`200`):

```json
{ "message": "Senha redefinida com sucesso." }
```

Erros: `400` para token invalido/expirado e `400` para senha fraca (validacao Zod).

### Filtro por faixa de valor em `GET /contratacoes`

A listagem passa a aceitar `valorMin` e `valorMax` (numeros em R$, `>= 0`,
opcionais). O filtro e aplicado em `valorTotalEstimado` (`$gte valorMin` /
`$lte valorMax`) tanto na consulta ao MongoDB quanto no recorte dos dados de seed.
Os filtros existentes (`modalidadeNome`, `cnae`, `uf`, `municipio`, `status`,
`meOnly`, `q`) e a ordenacao por compatibilidade continuam funcionando.

Exemplo:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/contratacoes?valorMin=50000&valorMax=120000" | jq '.data[].valorTotalEstimado'
```

### Checklist correlacionado ao edital

O checklist deixou de usar 5 itens fixos. Agora os itens de habilitacao sao
derivados da contratacao por `buildHabilitacaoItems` (`src/utils/checklistBuilder.ts`):

- **Base (sempre):** `cnpj-ativo`, `regularidade-federal`, `fgts`, `cndt`.
- **Pregao/eletronico** (modalidade contem "Pregao"/"Eletron"): adiciona
  `proposta-eletronica` (required).
- **Valor alto (> R$ 80.000) ou objeto de servico/obra/manutencao:** adiciona
  `atestado-tecnico` (required).
- **Nao exclusivo ME/EPP:** adiciona `declaracao-mei` (required).
- **Sempre opcional:** `portfolio` (required: false).

IDs estaveis em kebab-case. O shape de `PublicChecklist` permanece inalterado
(`{ contratacaoId, participationStatus, items[{id,label,checked,required}], updatedAt }`).
Os itens ja marcados pelo usuario sao preservados via merge por `id`, e novos
itens derivados do edital aparecem automaticamente. O campo `documentosExigidos`
do detalhe usa os mesmos labels (`buildRequiredDocuments` deriva de
`buildHabilitacaoItems`), garantindo consistencia entre detalhe e checklist.

### Novos campos no detalhe (`GET /contratacoes/:id`)

`toContratacaoDetail` passa a retornar (alem dos campos ja existentes como
`requisitos` e `datasImportantes`):

- **`resumoSimplificado: string[]`** — 3 a 6 frases em linguagem simples:
  objeto da compra, explicacao da modalidade (glossario com fallback generico),
  amparo legal explicado (Lei 14.133/2021), prazo de encerramento humanizado
  ("Voce tem cerca de X dias...") e valor estimado formatado em R$.
- **`elegibilidade: { exclusivaMeEpp, dentroLimiteMei, mensagem }`** —
  `exclusivaMeEpp` true quando `exclusivaMeEpp`/`exclusivoME`/tratamento
  diferenciado indicar ME/EPP; `dentroLimiteMei` true quando
  `valorTotalEstimado <= 81000`; `mensagem` orienta o MEI ("Compativel com seu
  porte" ou "Acima do limite do MEI, avalie como ME/EPP...").

### Como testar (curl)

```bash
BASE="http://localhost:3000"

# 1. Solicitar reset (dev retorna resetToken no corpo)
RESET=$(curl -s -X POST "$BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"empresa@exemplo.com"}')
echo "$RESET" | jq
TOKEN_RESET=$(echo "$RESET" | jq -r '.resetToken')

# 2. Redefinir a senha
curl -s -X POST "$BASE/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN_RESET\",\"newPassword\":\"NovaSenha123\"}" | jq

# 3. Filtro por faixa de valor
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/contratacoes?valorMin=50000&valorMax=120000" | jq '.data[].valorTotalEstimado'

# 4. Detalhe com resumo simplificado e elegibilidade
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/contratacoes/$ID" \
  | jq '{resumoSimplificado, elegibilidade, documentosExigidos, requisitos}'

# 5. Checklist correlacionado ao edital
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/contratacoes/$ID/checklist" \
  | jq '.items[] | {id, label, required}'
```

## PLANO-MVP — Execução (Backend)

Esta seção documenta as mudanças do PLANO-MVP aplicadas no backend
(`api-projeto-integrador`). Todas as alterações respeitam as convenções
existentes (camadas controller→service→repository, validação com Zod via o
middleware `validateRequest`, `asyncHandler` nas rotas, coleções via `env.*`).

### 1.2 — Match de compatibilidade efetivo

**`src/utils/contratacaoCompatibility.ts`**

- O mapa de palavras-chave por prefixo CNAE (2 dígitos) foi ampliado de ~9 para
  ~55 divisões, cobrindo agropecuária, indústria/fabricação, construção,
  comércio (atacado/varejo/veículos), transporte/logística, alimentação/
  hospedagem, TI/telecom/informação, serviços profissionais (jurídico,
  engenharia, consultoria, publicidade), administrativo/apoio (limpeza,
  vigilância, locação, RH), educação, saúde, cultura e serviços pessoais. Cada
  categoria traz uma lista de sinônimos.
- Todo o texto (objeto da compra, modalidade, órgão, unidade, município,
  informação complementar) e as palavras-chave são normalizados (minúsculas +
  remoção de acentos) antes do matching por substring.
- **Nova fórmula do score (0–100):**
  - Sem CNAE informado → `50` (neutro: não há como inferir aderência).
  - CNAE informado mas com prefixo não mapeado → `50` (sem vocabulário).
  - CNAE informado e mapeado → `score = 35 + min(matches * 13, 65)`, onde
    `matches` é o número de palavras-chave da categoria encontradas no texto.
    Com ≥ 5 termos o score satura em 100; com 0 termos fica em 35 (CNAE
    conhecido, sem sinal de aderência).
  - **Removidos** os bônus antigos de `+5 por situação divulgada` e
    `+5 por ter data de encerramento` — eram sinais de estado/disponibilidade
    do edital, não de compatibilidade com a atividade econômica.
- A assinatura `calculateCompatibilityScore(contratacao, cnae?)` foi mantida.

**`src/services/contratacoes.service.ts` — ordenação ANTES de paginar**

- Antes a ordenação por score acontecia depois da paginação (reordenava só a
  página). Agora `listContratacoes` busca um **POOL** de candidatos do filtro via
  `findContratacoesPool(filter, compatibilityPoolLimit)` (ordenados por data no
  Mongo), calcula o score de cada um, ordena DESC por score (desempate por
  `dataEncerramentoProposta` mais próxima e depois `numeroCompra`) e só então
  aplica `skip`/`limit` sobre o pool ordenado.
- `total` reflete a contagem real do filtro (`countContratacoes`), independente
  do pool.
- **Limitação do teto do pool:** `compatibilityPoolLimit = 300`. A ordenação por
  compatibilidade é exata apenas dentro dos primeiros 300 candidatos (ordenados
  por data). Itens além desse teto não concorrem na ordenação por score, embora
  apareçam na contagem `total`. O caminho de seed (banco vazio) foi mantido.

### 2.1 — Validação das rotas `/contratacoes`

- `src/routes/contratacoes.routes.ts` agora usa o mesmo middleware
  `validateRequest` das demais rotas:
  - `GET /` → `validateRequest({ query: listContratacoesQuerySchema })`.
  - `GET /:id`, `GET /:id/checklist`, `PUT /:id/checklist` → validam `params`
    com `contratacaoParamsSchema` (que usa o novo `objectIdSchema`).
  - `PUT /:id/checklist` valida também o `body` com `updateChecklistSchema`.
- Novo `objectIdSchema` em `src/schemas/contratacoes.schemas.ts`: valida ObjectId
  de 24 hex (regex `^[0-9a-fA-F]{24}$` + `ObjectId.isValid`). ID inválido agora
  retorna **400** (antes podia chegar a 500 via `new ObjectId(id)`).
- Os controllers (`contratacoes.controller.ts`, `checklist.controller.ts`)
  deixaram de fazer `.parse()` interno — leem `req.query`/`req.params`/`req.body`
  já validados pelo middleware, evitando dupla validação inconsistente.

### 2.2 — Índices na coleção de contratações

- Novo `ensureContratacoesIndexes()` em
  `src/repositories/contratacoes.repository.ts`, criando índices em:
  `dataEncerramentoProposta`, `valorTotalEstimado`, `unidadeOrgao.ufSigla` e um
  índice de **TEXTO** (`contratacoes_text`) sobre `objetoCompra`,
  `modalidadeNome`, `situacaoCompraNome`, `orgaoEntidade.razaoSocial`,
  `unidadeOrgao.nomeUnidade`, `unidadeOrgao.municipioNome`.
- Registrado no boot (`src/server.ts`) junto dos demais `ensure*Indexes`. Como a
  coleção é populada por serviço externo (ETL), a criação é **tolerante a
  falha**: cada índice é criado em `try/catch` e qualquer erro é logado
  (`contratacoes_index_failed` / `contratacoes_text_index_failed`) sem derrubar
  o boot. No `server.ts` os `ensure*Indexes` rodam com `Promise.allSettled`.

### 2.4 — Alertas melhores

- `src/services/alert.service.ts`:
  - **Removido o teto fixo de 50** contratações. Agora buscamos um pool maior
    (`alertPoolLimit = 300`) via `findContratacoesPool`, aplicando filtro de
    relevância no Mongo por UF do usuário quando disponível
    (`buildRelevanceFilter`) e filtro por compatibilidade de CNAE em memória.
  - Alertas de prazo (`buildProposalAlertRecords`) só são gerados para editais
    com compatibilidade ≥ `proposalRelevanceThreshold` (50); avisos de novos
    editais compatíveis (`buildCompatibleNoticeAlertRecords`) usam limiar 60.
  - Ambas as gerações foram extraídas como **funções puras testáveis** (recebem
    a lista de contratações, `userId`, `cnae` e `now`).
  - **Datas em UTC explícito:** `parseDate` agora interpreta strings de
    data-hora sem timezone (ex.: `2026-06-12T10:00:00`, comuns do ETL/PNCP) como
    UTC (sufixo `Z`), evitando ambiguidade com o timezone do servidor. Strings
    com TZ explícito (`Z` ou `±HH:MM`) são respeitadas.
  - **Idempotência** mantida via `sourceKey` (`proposal:<id>`,
    `compatible:<id>`, `document:<id>`) + upsert em `upsertAlertBySourceKey`.

### 2.5 — Boot resiliente sem Mongo

- `src/server.ts`: o `app.listen` agora sobe **independentemente** da conexão
  com o Mongo. Se a conexão inicial falhar, logamos `mongodb_initial_connection_failed`
  e agendamos reconexão em background (`scheduleMongoReconnect`, a cada 5s, com
  `unref()` para não segurar o processo). Não há mais `exit(1)` por falha de
  conexão inicial.
- `src/database/mongo.ts`: `getMongoCollection` retorna rápido se já há conexão;
  caso contrário tenta (re)conectar uma vez e, ao falhar, lança
  `AppError(503, 'Database temporarily unavailable...')` — tratado pelo
  `errorHandler` como resposta amigável, em vez de derrubar o processo.
- `/health` continua reportando `mongo: connected | disconnected` via `pingMongo`.
- O caminho de seed (coleção vazia, mas conectada) foi preservado.

### 3.2 — CORS restritivo em produção

- `src/app.ts`: se `NODE_ENV === 'production'` **e** `CORS_ORIGIN === '*'`,
  emitimos um aviso proeminente no log (`cors_insecure_wildcard_in_production`)
  orientando a configurar `CORS_ORIGIN` com a lista de origens confiáveis.
  Optou-se por **avisar** (não recusar boot) para não quebrar o deploy atual.

### 3.3 — Recuperação de senha por e-mail (plugável)

- Novas variáveis **opcionais** em `src/config/env.ts`: `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` (`true|false`) e
  `PASSWORD_RESET_URL_BASE`.
- Novo `src/services/email.service.ts` (usa `nodemailer`): `isEmailEnabled()`
  (true quando HOST/PORT/USER/PASS/FROM estão presentes), `sendEmail()` e
  `buildPasswordResetLink()`.
- `src/services/auth.service.ts#requestPasswordReset`: se o SMTP estiver
  configurado, envia o link (ou o token, se `PASSWORD_RESET_URL_BASE` não estiver
  definido) por e-mail. Caso o e-mail seja enviado com sucesso, o `resetToken`
  **não** é retornado na resposta. Sem SMTP, mantém o **fallback** atual
  (retorna `resetToken` apenas fora de produção + log). Endpoints inalterados.

### 3.1 — Testes automatizados

- Adicionados **Vitest + Supertest** como devDependencies. `npm test` agora roda
  `vitest run` (placeholder removido); `npm run test:watch` para modo watch.
- Config em `vitest.config.ts` (ambiente node, `tests/setup.ts` define env vars
  mínimas para `src/config/env.ts` validar sem DB real).
- Cobertura (`tests/`):
  - `compatibility.test.ts` — `calculateCompatibilityScore` (sem CNAE, CNAE não
    mapeado, piso 35, boost por matches, teto 100, faixa 0–100).
  - `alert.test.ts` — funções puras de alertas (`buildProposalAlertRecords`,
    `buildCompatibleNoticeAlertRecords`, limiar de compatibilidade, janela de
    prazo, cap de 10, idempotência via `sourceKey`), `buildRelevanceFilter` e
    `parseDate` (UTC explícito).
  - `contratacoes.route.test.ts` — Supertest na rota real: 401 sem token e
    **400** em `GET /contratacoes/:id` com id inválido (mockando o repositório
    de tokens revogados para não exigir Mongo).

**Como rodar os testes:**

```bash
cd api-projeto-integrador
npm test          # roda toda a suíte uma vez (vitest run)
npm run test:watch # modo watch
```

Os testes não exigem um MongoDB real — o acesso ao banco é mockado onde
necessário e as funções de domínio testadas são puras.

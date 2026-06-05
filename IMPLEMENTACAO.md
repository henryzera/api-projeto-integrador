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

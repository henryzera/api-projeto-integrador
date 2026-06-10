# Segurança e Privacidade da API

Este documento consolida o atendimento aos **6 requisitos de segurança** da
disciplina, aplicados à API (`api-projeto-integrador`). Para cada requisito
explicamos **o conceito**, **o que já existia**, **o que foi implementado
agora** (com referências `arquivo:linha` e como testar) e **o que falta / não
foi possível** (e o motivo).

> A API é um servidor Node.js/TypeScript (Express 5) em arquitetura em camadas
> (rotas → controllers → services → repositories → MongoDB), com validação Zod,
> `asyncHandler` e middlewares. As referências de linha abaixo correspondem ao
> estado do código no momento desta entrega.

---

## Sumário executivo

| # | Requisito | Status |
|---|-----------|--------|
| 1 | Gestão de autenticação e de senhas | **Atendido** (reforçado) |
| 2 | Dados em repouso / anonimização | **Atendido** (repouso = infra; minimização/masking em código) |
| 3 | Atendimento à LGPD (direitos do titular) | **Atendido** (endpoints implementados) |
| 4 | Disponibilidade e proteção contra ataques | **Atendido** (reforçado) |
| 5 | Backup e continuidade de operação | **Documentado (infra)** — depende de Atlas/Render |
| 6 | Gestão de fornecedores | **Atendido** (auditoria + inventário documentados) |

**Validação:** `npm run build`, `npm run typecheck` e `npm test` passam com
zero erros — 31 testes verdes (ver "Como validar" ao final).

---

## Requisito 1 — Gestão de autenticação e de senhas

### O que é / por que importa
Autenticação e senhas são a primeira linha de defesa. Senhas precisam ser
armazenadas de forma irreversível (hash com *salt* e custo alto), as sessões
devem ser verificáveis e revogáveis, e o login deve resistir a força bruta e a
enumeração de contas.

### O que já havia sido feito
- **Hash de senha com bcrypt, custo 12** — `src/services/auth.service.ts:24`
  (`passwordHashRounds = 12`), aplicado no registro (`:56`) e no reset (`:176`).
- **Política de senha forte via Zod** — `src/schemas/auth.schemas.ts:12-18`
  (mín. 8 / máx. 128 caracteres, exige minúscula, maiúscula e número).
- **JWT com issuer/audience/jti/expiração** — `src/services/jwt.service.ts:16-26`
  (assinatura com `issuer`, `audience`, `jwtid` aleatório, `subject` e
  `expiresIn`); verificação valida `issuer`/`audience` e a presença de
  `exp`/`jti`/`sub` (`:28-47`).
- **Blacklist de tokens (logout)** — coleção `revoked_tokens` com índice TTL
  por `expiresAt`: `src/repositories/revoked-token.repository.ts:11-39`. O
  `requireAuth` checa revogação a cada request:
  `src/middlewares/auth.middleware.ts:19`.
- **Recuperação de senha** — token aleatório de 32 bytes
  (`src/services/auth.service.ts:119`) **hasheado com SHA-256** antes de
  persistir (`:33-35`, `:120`), com **TTL de 15 min**
  (`passwordResetExpiresInMinutes = 15`, `:25`) e índice TTL em
  `src/repositories/password-reset.repository.ts:11-18`.
- **Mensagens anti-enumeração** — `forgot-password` responde sempre a mesma
  mensagem, exista ou não a conta (`src/services/auth.service.ts:104`,`:112-117`);
  login retorna "Invalid credentials" genérico para usuário inexistente e
  senha errada (`:85-93`).
- **Rate limit nas rotas de auth** — `authLimiter` 20 req / 15 min
  (`src/routes/auth.routes.ts:18-22`).

### O que foi implementado agora
- **Reforço anti-força-bruta no login**: um **rate limiter dedicado e mais
  estrito** no `/auth/login` — `loginLimiter` de **10 tentativas / 5 min por
  IP** — `src/routes/auth.routes.ts:29-33`, aplicado antes do `authLimiter` na
  rota de login (`:36`).
  - **Decisão de design:** optamos pelo limiter dedicado em vez de bloqueio por
    conta numa coleção TTL (`login_attempts`). Motivos: (a) evita uma
    dependência de banco no caminho crítico de login; (b) mantém os testes
    determinísticos e sem mock adicional; (c) combinado com bcrypt+rate limit
    já entrega defesa robusta. O bloqueio por conta com TTL fica documentado
    como evolução futura, caso se queira mitigar *password spraying*
    distribuído por múltiplos IPs.
- **Consentimento (LGPD)**: campo `acceptedTermsAt` no registro — ver Req. 3.

### Como testar
- Tentar logar 11 vezes seguidas no mesmo IP em até 5 min retorna `429` com
  `Too many login attempts...`.
- Testes existentes de auth/JWT continuam verdes (`tests/contratacoes.route.test.ts`
  exercita `requireAuth` e a verificação de token).

### O que falta / não foi possível
- **MFA / 2FA** e **bloqueio por conta com lockout temporário** não foram
  implementados (escopo/risco de quebrar testes). Ficam como evolução.

---

## Requisito 2 — Dados em repouso / anonimização

### O que é / por que importa
Dados sensíveis devem ser protegidos quando armazenados (em repouso) e nunca
expostos além do necessário (minimização). Logs também são um vetor comum de
vazamento de PII (dados pessoais).

### Criptografia em repouso — responsabilidade de infraestrutura
A **criptografia em repouso é provida pelo MongoDB Atlas** (serviço
gerenciado), que cifra os volumes de armazenamento (encryption-at-rest) de
forma transparente — **não é algo controlado por este código**. A conexão é
sempre via **TLS**: o cliente usa `mongodb+srv://...` e
`ServerApiVersion.v1` em `src/database/mongo.ts:47-56` (o Atlas exige TLS por
padrão). Portanto, o trânsito (in-transit) e o repouso (at-rest) são cobertos
pela plataforma; ao código cabe a **minimização** e a **não-exposição**.

### O que já havia sido feito
- **Mapper de usuário com allow-list** — `src/mappers/user.mapper.ts`
  (`toPublicUser`) monta explicitamente o objeto de saída e **nunca** inclui
  `passwordHash` nem `emailNormalized`. Todas as respostas de usuário passam
  por ele (login/registro/`/me`).
- **Error handler que não vaza** — `src/middlewares/errorHandler.ts:30-35`:
  erros não tratados viram `500` genérico; detalhes do erro só aparecem em
  `development`.

### O que foi implementado agora
- **Reforço do `toPublicUser`** com comentário de allow-list explícita e o novo
  campo de consentimento — `src/mappers/user.mapper.ts:4-9`. Continua sem
  `passwordHash`.
- **Util de mascaramento para logs** — `src/utils/maskSensitive.ts` (novo):
  - `maskEmail` (`j***@empresa.com`), `maskDocument` (CNPJ → `************90`),
    `maskToken` (prefixo + `****`) e `maskSensitiveMeta` (varre recursivamente
    o objeto de meta e mascara valores cujas chaves sejam sensíveis: `password`,
    `senha`, `token`, `authorization`, `cookie`, `secret`, `jwt`, `email`,
    `cnpj`, `cpf`, `document`).
  - **Aplicado de forma central no logger** — `src/utils/logger.ts:1`,`:31-37`:
    todo `meta` passa por `maskSensitiveMeta` antes de serializar, cobrindo
    automaticamente `requestLogger`, `errorHandler` e qualquer `logger.*` em
    services.
- **`requestLogger` não loga query string** — `src/middlewares/requestLogger.ts:8-19`
  registra apenas o `pathname`, evitando vazar, por ex., o token de redefinição
  de senha que possa vir em `?token=...`.

### Dados pessoais armazenados e por quê (minimização)
| Dado | Coleção | Finalidade | Sensibilidade |
|------|---------|------------|---------------|
| Nome (firstName/lastName) | `users` | Identificação do usuário no app | PII |
| E-mail (`email`/`emailNormalized`) | `users` | Login, recuperação de senha, notificações | PII |
| CNPJ | `users` | Identificação da empresa, regras de habilitação | PII empresarial |
| CNAE | `users` | Cálculo de compatibilidade de editais | Não sensível |
| `passwordHash` (bcrypt) | `users` | Autenticação | Segredo (nunca exposto) |
| `acceptedTermsAt` | `users` | Registro de consentimento (LGPD) | Metadado |
| Documentos da empresa | `user_documents` | Checklist de habilitação | PII empresarial |
| Checklists / Alertas | `contratacao_checklists` / `user_alerts` | Acompanhamento de licitações | Derivado |

Só coletamos o necessário para a finalidade (matching de editais e gestão de
habilitação). Não há coleta de dados sensíveis especiais (saúde, biometria etc.).

### Como testar
- `tests/maskSensitive.test.ts` cobre as funções de mascaramento (6 testes).
- `tests/profile.route.test.ts` verifica que `GET /me/data-export` **não vaza**
  `passwordHash`.

### O que falta / não foi possível
- **Criptografia em nível de campo (CSFLE/Queryable Encryption)** não foi
  adotada — exigiria gestão de KMS/chaves na infraestrutura. O at-rest do Atlas
  é considerado suficiente para o escopo.

---

## Requisito 3 — Atendimento à LGPD (direitos do titular)

### O que é / por que importa
A LGPD assegura ao titular os direitos de **acesso**, **portabilidade**,
**eliminação** (esquecimento) e exige **base legal** e **consentimento** para o
tratamento. A aplicação precisa oferecer mecanismos para exercer esses direitos.

### O que foi implementado agora
- **`GET /me/data-export` (autenticado)** — direitos de **acesso** e
  **portabilidade**: retorna em JSON todos os dados pessoais do titular
  (perfil + documentos + checklists + alertas).
  - Rota: `src/app.ts:69` (protegida por `requireAuth`).
  - Controller: `src/controllers/profile.controller.ts:8-21` (envia
    `Content-Disposition: attachment` → download `meus-dados.json`).
  - Service: `src/services/profile.service.ts:17-57` (agrega via `Promise.all`,
    serializa `_id`/`userId` para string e reusa `toPublicUser` — sem
    `passwordHash`).
- **`DELETE /me` (autenticado)** — direito ao **esquecimento**: apaga a conta e
  faz **cascata** (documentos, checklists, alertas, password_resets) e **revoga
  o token atual**. Idempotente. Responde `200` com confirmação.
  - Rota: `src/app.ts:72`.
  - Controller: `src/controllers/profile.controller.ts:23-35`.
  - Service: `src/services/profile.service.ts:59-102` — revoga o JTI atual
    primeiro (best-effort), depois `deleteMany` nas coleções e `deleteOne` no
    usuário; tudo idempotente (não falha se não houver registros).
  - Repositórios de cascata adicionados:
    `deleteDocumentsByUser` (`src/repositories/document.repository.ts:78-83`),
    `deleteChecklistsByUser` (`src/repositories/checklist.repository.ts:32-37`),
    `deleteAlertsByUser` (`src/repositories/alert.repository.ts:57-62`),
    `deleteUserById` (`src/repositories/user.repository.ts:70-76`),
    `deletePasswordResetsByUser` (já existia).
- **Consentimento / minimização**: campo `acceptedTermsAt` no modelo
  (`src/models/user.model.ts:7-9`), aceito no registro via `acceptTerms`
  (`src/schemas/auth.schemas.ts:23-26`) e gravado em
  `src/services/auth.service.ts:60`. É **opcional** no schema (para não quebrar
  integrações antigas), mas o **frontend já captura o consentimento**: a tela de
  cadastro exibe um checkbox obrigatório "Li e concordo com os Termos de Uso e a
  Política de Privacidade" e envia `acceptTerms: true`
  (`front-projeto-integrador/src/screens/RegisterScreen.tsx`,
  `src/validation/auth.ts`, `src/services/auth.ts`). Assim, o aceite é
  registrado com data/hora para todo novo cadastro.

### Mapeamento LGPD
| Direito (LGPD) | Como é atendido |
|----------------|------------------|
| Acesso (art. 18, II) | `GET /me/data-export` |
| Portabilidade (art. 18, V) | `GET /me/data-export` (JSON estruturado) |
| Eliminação / esquecimento (art. 18, VI) | `DELETE /me` (cascata) |
| Consentimento (art. 7º, I / art. 8º) | `acceptedTermsAt` no registro |
| Correção (art. 18, III) | `PATCH /me` (já existente) |

**Bases legais (sugeridas):** execução de contrato/serviço (matching de
editais e gestão de habilitação) e consentimento (aceite dos termos).
**Retenção:** dados mantidos enquanto a conta existir; eliminados sob `DELETE /me`.
Tokens de reset e tokens revogados têm expiração automática (índices TTL).

### Como testar
- `tests/profile.route.test.ts` (4 testes): export retorna perfil sem
  `passwordHash`; delete faz cascata e retorna `200`; ambos exigem auth (401
  sem token).
- Exemplos de `curl` na seção "Como validar".

### O que falta / não foi possível
- **UI de gestão de consentimento granular** (opt-in por finalidade) e
  **trilha de auditoria de acessos a dados** não foram implementadas (escopo).
- Captura de consentimento no cadastro: **concluída** — o app envia
  `acceptTerms: true` via checkbox obrigatório (loop LGPD fechado ponta a ponta).

---

## Requisito 4 — Disponibilidade e proteção contra ataques digitais

### O que é / por que importa
A aplicação deve resistir a abusos (DoS, brute force), a injeções e a vetores
comuns do **OWASP Top 10**, e degradar de forma controlada (sem derrubar o
processo) quando uma dependência (banco) falha.

### O que já havia sido feito
- **Helmet** (headers de segurança) — `src/app.ts:46`.
- **CORS** configurável, com aviso forte se `*` em produção —
  `src/app.ts:28-48`.
- **Body size limit 100kb** (JSON e urlencoded) — `src/app.ts:49-50`.
- **Validação Zod** em todas as rotas, inclusive `/contratacoes`
  (`src/schemas/*.schemas.ts`, aplicada via `validateRequest`).
- **Rate limit** (global e de auth) — `src/middlewares/rateLimiter.ts`;
  limiter global aplicado em `src/app.ts:55-62`.
- **Error handler** que não vaza e trata Zod/Mongo — `src/middlewares/errorHandler.ts`.
- **Graceful shutdown** (SIGTERM/SIGINT, timeout forçado) — `src/server.ts:91-148`.
- **Boot resiliente** — sobe o HTTP independentemente do Mongo, com reconexão
  em background e `503` tratado quando o banco está fora — `src/server.ts:82-89`,
  `src/database/mongo.ts:58-78`.
- **Driver Mongo parametrizado** (anti-injeção) — filtros usam objetos/`ObjectId`
  e `compression` está habilitado (`src/app.ts:47`).

### O que foi implementado agora
- **Rate limiter GLOBAL explícito** — já aplicado a todas as rotas
  (`src/app.ts:55-62`, 300 req / 15 min) e reforçado com comentário; as rotas
  de auth somam limiters mais estritos (Req. 1).
- **Sanitização anti-NoSQL-injection** — `src/middlewares/sanitizeMongo.ts`
  (novo), registrado globalmente em `src/app.ts:52`:
  - Remove **in-place** chaves que começam com `$` (operadores Mongo: `$gt`,
    `$ne`, `$where`...) ou contêm `.` (notação de caminho) de `req.body`,
    `req.params` e `req.query`.
  - **Por que sanitização manual e não `express-mongo-sanitize`?** Aquele
    pacote é **incompatível com Express 5**, pois tenta **reatribuir**
    `req.query`, que no Express 5 é um *getter* somente-leitura (lança erro em
    runtime). Nossa abordagem **remove** chaves (não reatribui), preservando a
    referência dos objetos. É **defesa em profundidade**: a maioria das rotas
    já valida com Zod `.strict()`.

### Mapeamento ao OWASP Top 10 (2021)
| OWASP | Proteção nesta API |
|-------|--------------------|
| A01 Broken Access Control | `requireAuth` + escopo por `userId` em todos os repos; `ObjectId.isValid` |
| A02 Cryptographic Failures | bcrypt (senhas), SHA-256 (reset token), TLS (Atlas), JWT assinado |
| A03 Injection | Zod `.strict()` + `sanitizeMongo` + filtros parametrizados |
| A04 Insecure Design | Boot resiliente, rate limits, mensagens anti-enumeração |
| A05 Security Misconfiguration | Helmet, CORS restrito (aviso em `*`), body limit, env validado por Zod |
| A06 Vulnerable Components | `npm audit` + `package-lock` (ver Req. 6) |
| A07 Auth Failures | bcrypt, JWT issuer/audience/jti, blacklist, rate limit de login |
| A08 Data Integrity Failures | JWT verificado; índices únicos (email/CNPJ/jti) |
| A09 Logging Failures | Logger estruturado com **masking de PII** (Req. 2) |
| A10 SSRF | Sem fetch de URLs fornecidas pelo usuário no servidor |

### Como testar
- `tests/contratacoes.route.test.ts` valida `401` sem token e `400` (não `500`)
  para `ObjectId` inválido.
- `npm test` (31 testes) cobre auth, alertas, compatibilidade, masking e LGPD.

### O que falta / não foi possível
- **WAF / proteção de borda e auto-scaling** dependem da plataforma (Render).
- O rate limit é **em memória por instância** (adequado ao plano free de
  instância única); num cenário multi-instância, recomenda-se um *store*
  compartilhado (ex.: Redis).

---

## Requisito 5 — Backup e continuidade de operação

> **Status: Documentado (infra).** Este item é **majoritariamente
> documentação/estratégia**, pois backup e *disaster recovery* (DR) dependem de
> **acesso à infraestrutura** (MongoDB Atlas e Render) que **não faz parte deste
> repositório de código** — não temos acesso ao painel do Atlas nem do Render
> aqui. Abaixo, a estratégia recomendada e um script de exemplo.

### O que é / por que importa
Continuidade garante que, após falha (corrupção de dados, exclusão acidental,
incidente), seja possível restaurar o serviço dentro de objetivos de tempo
(RTO) e de perda de dados (RPO) aceitáveis.

### Estratégia recomendada (MongoDB Atlas + Render)
- **Backups contínuos automáticos do Atlas** com **Point-in-Time Recovery
  (PITR)** habilitado (disponível em clusters dedicados M10+). Em clusters
  compartilhados (free/shared), usar **snapshots** na cadência disponível.
- **Retenção sugerida:** snapshots diários por 7 dias, semanais por 4 semanas,
  mensais por 12 meses (ajustar conforme criticidade/custo).
- **RPO sugerido:** ≤ 1h (com PITR, próximo de segundos). **RTO sugerido:** ≤ 1h
  para restauração de cluster.
- **Teste de restauração periódico** (trimestral): restaurar um snapshot num
  cluster/ambiente isolado e validar a integridade (smoke test da API contra a
  cópia restaurada).
- **Health checks do Render:** `healthCheckPath: /health` já configurado em
  `render.yaml:8`; o endpoint reporta `mongo: connected|disconnected`
  (`src/routes/health.routes.ts`). O Render reinicia a instância em caso de
  falha de health check.
- **Cópia lógica adicional** (opcional, para snapshots pontuais antes de
  migrações): `mongodump`/`mongorestore` — ver script abaixo.

### Runbook de restauração (resumo)
1. Identificar o incidente e a janela de dados a recuperar (timestamp do PITR).
2. No Atlas, acionar *Restore* (PITR ou snapshot) para um **novo cluster**
   (não sobrescrever o de produção até validar).
3. Apontar uma instância de *staging* da API para o cluster restaurado
   (`MONGO_URI`) e rodar o smoke test (`/health`, login, listagem).
4. Validada a integridade, promover o cluster restaurado (atualizar `MONGO_URI`
   no Render) e reiniciar o serviço.
5. Pós-incidente: registrar causa-raiz e revisar RTO/RPO atingidos.

### Script de exemplo (entregue)
- `scripts/backup.sh` (novo) — wrapper de `mongodump`/`mongorestore` com `--gzip`
  e `--oplog`. **É apenas referência** (não foi executado; requer
  `mongodb-database-tools` e uma `MONGO_URI` real).
  - `MONGO_URI=... ./scripts/backup.sh dump`
  - `MONGO_URI=... ./scripts/backup.sh restore ./backups/<timestamp>`

### O que falta / não foi possível
- **Configurar de fato** PITR, retenção, alarmes e o teste de restauração
  exige **acesso ao painel do Atlas/Render** — fora do alcance do código.
- Não há, neste repositório, automação agendada de backup (seria um cron no
  Atlas ou um job no Render).

---

## Requisito 6 — Gestão de fornecedores

### O que é / por que importa
A aplicação depende de terceiros (infra, libs, serviços). É preciso conhecê-los,
saber **quais dados compartilhamos**, sua postura de segurança e manter as
**dependências** sem vulnerabilidades conhecidas (gestão de cadeia de suprimentos
de software).

### Auditoria de dependências (executada nesta entrega)
Comandos: `npm audit` e `npm audit --omit=dev`.

**Antes:** 7 vulnerabilidades (1 crítica, 1 alta, 5 moderadas).

**Correções aplicadas (seguras, sem `--force`):**
- `npm audit fix` → corrigiu **`qs`** (moderada, transitiva via Express).
- Upgrade manual **`nodemailer` ^6 → ^8.0.11** (corrigiu a **alta**: SMTP
  command injection / DoS no addressparser). Verificado: `build` e `typecheck`
  passam — a API usada (`createTransport`/`sendMail` em
  `src/services/email.service.ts`) é estável entre as versões.

**Resultado após correções:** **5 vulnerabilidades** (1 crítica, 4 moderadas),
**todas em dependências de desenvolvimento** (toolchain do `vitest`:
`vitest`, `vite`, `esbuild`, `vite-node`, `@vitest/mocker`). Não afetam o
runtime de produção (o `render.yaml` faz `npm prune --omit=dev` no build).

**Pendência documentada:** a correção dessas 5 exige **`vitest` 4.x** (major,
*breaking change* no test runner). Conforme orientação, **não** rodamos
`npm audit fix --force`. Recomenda-se um upgrade controlado do `vitest` (com
revalidação dos testes) numa tarefa dedicada.

### Inventário de fornecedores / terceiros (sub-processadores LGPD)
| Fornecedor | Papel | Dados compartilhados | Postura / observações |
|------------|-------|----------------------|------------------------|
| **MongoDB Atlas** | Banco de dados gerenciado | Todos os dados da app (usuários, documentos, checklists, alertas) | Sub-processador. Encryption-at-rest + TLS; backups/PITR (Req. 5) |
| **Render** | Hospedagem da API | Tráfego/logs da aplicação; variáveis de ambiente (segredos) | Sub-processador de processamento; health checks; deploy via `render.yaml` |
| **Expo / EAS** | Build e distribuição do app mobile | Não recebe dados de usuário (apenas build do cliente) | Fornecedor de build |
| **Serviço de streaming / ETL** | Popula `contratacoes_limpas` (dados públicos PNCP) | Dados **públicos** de licitações (não-pessoais) | Coleção populada externamente; índices tolerantes a falha |
| **Provedor SMTP** (opcional) | Envio de e-mail de reset de senha | E-mail do titular | Plugável (`isEmailEnabled`); se ausente, fallback de dev |
| **Groq / Llama** | (se aplicável) apoio a tradução/resumo de edital | Texto público de editais | Não há integração ativa de IA na API neste momento |
| **Dependências npm** | Bibliotecas de runtime/dev | — | `package-lock.json` fixa versões; `npm audit` no CI/local |

### Política de gestão de dependências
- **Versões travadas** via `package-lock.json` (builds reproduzíveis;
  `npm ci` no `render.yaml:6`).
- **Auditoria** com `npm audit` (executada nesta entrega); correções não
  *breaking* aplicadas imediatamente, *breaking* avaliadas em tarefa dedicada.
- **Atualização** preferindo *minor/patch* automáticos e *majors* revisados.

### O que falta / não foi possível
- **DPAs (Data Processing Agreements)** formais com os sub-processadores e
  **due diligence** de segurança são processos contratuais/organizacionais,
  fora do escopo do código.
- Upgrade de `vitest` para eliminar as 5 vulnerabilidades dev (ver acima).

---

## Como validar

### Build, typecheck e testes (devem passar com zero erros)
```bash
cd api-projeto-integrador
npm run build      # tsc
npm run typecheck  # tsc --noEmit
npm test           # vitest run  -> 31 testes verdes
```

### Auditoria de dependências
```bash
npm audit                 # visão geral (5 vulnerabilidades dev remanescentes)
npm audit --omit=dev      # foco em produção
# NÃO use: npm audit fix --force  (introduz breaking changes / vitest 4.x)
```

### Endpoints LGPD (exemplos de curl)
Obtenha um token via login e use no header `Authorization`.
```bash
# 1) Login (ajuste identifier/senha)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"usuario@exemplo.com","password":"SuaSenha1"}' | jq -r .token)

# 2) Exportar meus dados (acesso/portabilidade) -> baixa meus-dados.json
curl -s http://localhost:3000/me/data-export \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3) Excluir minha conta (esquecimento) -> 200 com confirmação
curl -s -X DELETE http://localhost:3000/me \
  -H "Authorization: Bearer $TOKEN"

# 4) Registro com consentimento (LGPD)
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Ana","lastName":"Souza","email":"ana@exemplo.com",
       "cnpj":"11222333000181","cnae":"6201500",
       "password":"SenhaForte1","confirmPassword":"SenhaForte1",
       "acceptTerms":true}'
```

### Backup (exemplo — requer mongodb-database-tools e MONGO_URI real)
```bash
MONGO_URI="mongodb+srv://..." ./scripts/backup.sh dump
MONGO_URI="mongodb+srv://..." ./scripts/backup.sh restore ./backups/<timestamp>
```

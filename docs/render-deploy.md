# Deploy no Render

## Build e start

Use as configuracoes abaixo no Render:

- Runtime: Node
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

O projeto tambem possui `render.yaml` para Blueprint/IaC. Ele esta com `autoDeploy: false` para evitar deploy duplicado quando o GitHub Actions usar Deploy Hook.

## Variaveis de ambiente obrigatorias

Configure no Render:

```env
NODE_ENV=production
APP_NAME=api-projeto-integrador
LOG_LEVEL=info
CORS_ORIGIN=https://seu-front-em-producao.com
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=ETL
MONGO_COLLECTION=contratacoes_brutas
MONGO_USERS_COLLECTION=users
MONGO_CONNECT_RETRIES=5
MONGO_CONNECT_RETRY_DELAY_MS=2000
JWT_SECRET=<segredo-forte-com-pelo-menos-32-caracteres>
JWT_EXPIRES_IN=1h
JWT_ISSUER=api-projeto-integrador
JWT_AUDIENCE=front-projeto-integrador
```

O Render injeta `PORT` automaticamente. A API usa `process.env.PORT` com fallback para `3000`.

## CI/CD com GitHub Actions

O workflow `.github/workflows/ci.yml` executa:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm run lint`, se existir
5. `npm test`, se existir

Para deploy automatico pelo GitHub Actions:

1. Crie o serviço no Render.
2. No serviço, abra Settings e copie o Deploy Hook URL.
3. No GitHub, crie o secret `RENDER_DEPLOY_HOOK_URL`.
4. Faça push na branch `main` ou `master`.

Sem esse secret, o workflow apenas valida o projeto e pula o deploy.

Alternativa: se preferir nao usar Deploy Hook, habilite Auto-Deploy no Render como `After CI Checks Pass` e remova ou ignore o job `deploy` do workflow.

## Docker

Docker nao e necessario neste momento. O Render executa Node nativamente, o projeto ja tem `npm ci`, `npm run build`, `npm start`, healthcheck e variaveis externas.

Vale criar Dockerfile no futuro se o projeto precisar de:

- ambiente identico entre local/CI/producao;
- dependencias de sistema operacional;
- multi-servicos ou build mais complexo;
- deploy tambem em outras plataformas baseadas em container.

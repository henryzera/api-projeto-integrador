# MVP Zero Custo: Lacunas Fechadas Na API

Este documento descreve as decisoes e contratos implementados para fechar lacunas do MVP com o menor custo operacional possivel.

## Decisoes

- Upload real de documentos: Cloudinary Free.
- Limite de upload: 10 MB.
- Tipos aceitos: PDF, JPG/JPEG e PNG.
- Arquivo binario nao e salvo no MongoDB.
- Recuperacao de senha: endpoints prontos com token hash; sem SMTP por enquanto.
- Front deve ocultar o CTA "Esqueci minha senha" em producao ate existir envio de email configurado.
- Dashboard de perfil: agregado calculado em tempo real a partir de contratacoes, documentos e alertas.

## Variaveis De Ambiente Novas

```env
MONGO_PASSWORD_RESETS_COLLECTION=password_resets
RESET_PASSWORD_FRONT_URL=
RESET_PASSWORD_TOKEN_TTL_MINUTES=15
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=projeto-integrador/documents
```

Para habilitar upload no Render, criar uma conta gratuita no Cloudinary e preencher:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Sem essas variaveis, a API continua subindo, mas `POST /documents/upload` retorna `503`.

## Upload De Documento

```http
POST /documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Campo:

```txt
file=<arquivo PDF/JPG/PNG>
```

Resposta `201`:

```json
{
  "file": {
    "url": "https://...",
    "fileName": "certidao.pdf",
    "mimeType": "application/pdf",
    "size": 123456
  }
}
```

Depois do upload, o front deve usar `file.url` no `POST /documents` ou `PATCH /documents/:id`.

Exemplo curl:

```bash
curl -X POST https://api-projeto-integrador-hcu8.onrender.com/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/caminho/certidao.pdf"
```

## Dashboard Do Perfil

```http
GET /me/dashboard
Authorization: Bearer <token>
```

Resposta:

```json
{
  "contratacoesCount": 18,
  "documentHealthPercent": 80,
  "openAlertsCount": 5,
  "expiredDocumentsCount": 1,
  "pendingDocumentsCount": 2
}
```

`contratacoesCount` considera uma amostra recente de contratacoes com `compatibilityScore >= 60` para o CNAE do usuario.

## Recuperacao De Senha

Endpoints implementados:

```http
POST /auth/forgot-password
Content-Type: application/json
```

```json
{
  "identifier": "email@empresa.com"
}
```

Resposta sempre `204`.

```http
POST /auth/reset-password
Content-Type: application/json
```

```json
{
  "token": "reset-token",
  "password": "Senha123",
  "confirmPassword": "Senha123"
}
```

Resposta `204` em sucesso.

Observacao de MVP zero custo:

- A API gera token, salva hash e expira automaticamente.
- Em desenvolvimento, o token/link e logado.
- Em producao, sem SMTP, o usuario nao recebe email. Portanto o front deve ocultar o CTA ate configurarmos envio.

## Alertas Persistidos

`GET /alerts` sincroniza alertas a partir de:

- documentos vencidos, pendentes ou proximos do vencimento;
- propostas proximas do encerramento;
- contratacoes recentes compativeis com o CNAE do usuario.

A API mantem status `open`, `read` ou `resolved` porque o upsert so define status no insert.

## Contratacoes

`GET /contratacoes` e `GET /contratacoes/:id` aceitam dados em dois formatos:

- aninhado: `unidadeOrgao.ufSigla`, `unidadeOrgao.municipioNome`, `unidadeOrgao.codigoIbge`;
- achatado do streaming: `uf`, `municipioNome`, `codigoIbge`.

O front pode ler os campos normalizados de topo:

- `uf`
- `municipioNome`
- `codigoIbge`

E tambem os fallbacks em `unidadeOrgao`.

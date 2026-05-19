# Configurar Cloudinary Para Upload De Documentos

## 1. Criar Conta

Acesse:

https://cloudinary.com/

Clique em Sign up e crie uma conta gratuita.

## 2. Pegar Credenciais

Depois de entrar no painel, procure a área API Keys.

Você precisa copiar:

- Cloud name
- API Key
- API Secret

Esses três valores viram variáveis no Render.

## 3. Configurar No Render

Acesse o Render:

https://dashboard.render.com/

Entre no serviço da API Node:

api-projeto-integrador

Vá em:

Environment -> Add Environment Variable

Adicione:

CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_api_key
CLOUDINARY_API_SECRET=seu_api_secret
CLOUDINARY_UPLOAD_FOLDER=projeto-integrador/documents

Também confirme se estas existem:

MONGO_PASSWORD_RESETS_COLLECTION=password_resets
RESET_PASSWORD_TOKEN_TTL_MINUTES=15

RESET_PASSWORD_FRONT_URL pode ficar vazio por enquanto.

## 4. Fazer Redeploy

Depois de salvar as variáveis:

Manual Deploy -> Deploy latest commit

## 5. Testar Upload

Faça login na API e pegue o token.

Depois teste com um arquivo PDF ou imagem:

curl -X POST https://api-projeto-integrador-hcu8.onrender.com/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/caminho/do/arquivo.pdf"

Exemplo no Mac, se o arquivo estiver em Downloads:

curl -X POST https://api-projeto-integrador-hcu8.onrender.com/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/Users/emanuelhenry/Downloads/certidao.pdf"

## 6. Resposta Esperada

A API deve retornar 201:

{
  "file": {
    "url": "https://res.cloudinary.com/...",
    "fileName": "certidao.pdf",
    "mimeType": "application/pdf",
    "size": 123456
  }
}

## 7. Usar URL No Documento

Depois do upload, use a URL retornada para criar ou atualizar documento.

POST /documents:

{
  "categoryId": "regularidade-fiscal",
  "categoryTitle": "Regularidade Fiscal",
  "name": "Certidao municipal",
  "expiresAt": "2026-08-01T00:00:00.000Z",
  "fileUrl": "https://res.cloudinary.com/...",
  "status": "ok"
}

## Problemas Comuns

### 503 Document upload storage is not configured

Alguma variável Cloudinary está faltando no Render.

Verifique:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Depois faça redeploy.

### 400 Only PDF, JPG and PNG files are allowed

O arquivo não é PDF, JPG ou PNG.

### 413 File is too large

O arquivo passou de 10 MB.

### 401 Authentication token is required

Você esqueceu o header:

Authorization: Bearer <token>

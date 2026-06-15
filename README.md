# Card Installments App

Aplicativo web em monorepo para controlar compras de cartao de credito parceladas por usuario, cartao, categoria e mes.

## Stack

- Frontend: React 18, Vite, TypeScript
- Backend: Node.js 24, Express, TypeScript
- Banco: PostgreSQL com SQL nativo via `pg`
- Autenticacao: login e senha com JWT, sem signup publico
- Documentacao: Swagger em `/docs`
- Docker: `docker-compose.yml` com API, Web e PostgreSQL

## Rodando com Docker

```bash
cp .env.example .env
docker compose up --build
```

Acesse:

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- Swagger: http://localhost:3000/docs

Usuario inicial criado pelo seed:

- E-mail: `admin@example.com`
- Senha: `Admin@123456`

Troque essa senha no primeiro acesso ou crie outro administrador e remova o usuario padrao.

## Rodando localmente

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Seguranca aplicada

- Senhas com hash `bcrypt`
- JWT assinado por segredo configuravel
- Nao existe cadastro publico de usuarios
- Controle de acesso por papel `admin` e `user`
- Consultas parametrizadas com `pg`, evitando SQL injection
- Helmet, CORS restrito, rate limit e payload limit
- `.env` fora do Git
- Logs sem imprimir senha ou token

## Deploy

Veja o guia completo em [docs/deploy-oracle-cloud.md](docs/deploy-oracle-cloud.md).

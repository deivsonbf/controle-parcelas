# Deploy em Oracle Cloud

Este guia assume uma instancia Ubuntu na Oracle Cloud Infrastructure, Docker Compose e um dominio apontando para o IP publico da VM.

## 1. Criar a instancia

1. No painel da OCI, crie uma VM Ubuntu 24.04.
2. Libere as portas `22`, `80` e `443` na subnet/security list.
3. Conecte via SSH:

```bash
ssh ubuntu@SEU_IP_PUBLICO
```

## 2. Instalar Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
docker --version
docker compose version
```

## 3. Enviar o projeto

Opcoes comuns:

```bash
git clone URL_DO_SEU_REPOSITORIO.git
cd card-installments-app
```

Ou envie a pasta por `scp`/SFTP.

## 4. Configurar variaveis

```bash
cp .env.example .env
nano .env
```

Altere principalmente:

```env
POSTGRES_PASSWORD=uma_senha_forte
DATABASE_URL=postgres://card_app:uma_senha_forte@postgres:5432/card_installments
JWT_SECRET=um_segredo_aleatorio_com_64_ou_mais_caracteres
CORS_ORIGIN=https://seu-dominio.com
VITE_API_URL=https://seu-dominio.com/api
```

Gere um segredo seguro:

```bash
openssl rand -hex 64
```

## 5. Subir a aplicacao

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Teste:

```bash
curl http://localhost:3000/api/health
```

## 6. Proxy reverso com HTTPS

Instale Nginx e Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Crie `/etc/nginx/sites-available/card-installments`:

```nginx
server {
  listen 80;
  server_name seu-dominio.com;

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /docs {
    proxy_pass http://127.0.0.1:3000/docs;
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_set_header Host $host;
  }
}
```

Ative:

```bash
sudo ln -s /etc/nginx/sites-available/card-installments /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d seu-dominio.com
```

## 7. Primeiros passos apos deploy

1. Acesse `https://seu-dominio.com`.
2. Entre com `admin@example.com` e `Admin@123456`.
3. Crie um novo administrador com uma senha forte.
4. Remova ou desative o usuario padrao no banco ou pela API.
5. Cadastre cartoes, categorias, usuarios e compras.

## 8. Backup do PostgreSQL

```bash
docker compose exec postgres pg_dump -U card_app card_installments > backup.sql
```

Restauracao:

```bash
cat backup.sql | docker compose exec -T postgres psql -U card_app card_installments
```

## 9. Atualizacao da aplicacao

```bash
git pull
docker compose up -d --build
docker compose logs -f api
```

## Checklist de seguranca

- Use senhas fortes em `.env`.
- Nunca publique `.env`.
- Mantenha `CORS_ORIGIN` com o dominio real.
- Use HTTPS com renovacao automatica do Certbot.
- Restrinja SSH por chave e mantenha a porta `5432` fechada publicamente.
- Rode backups periodicos do volume do PostgreSQL.

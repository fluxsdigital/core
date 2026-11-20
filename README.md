# Flux Core

Base de software da Flux para operações de indústrias, distribuidoras e empresas de serviços técnicos. Código-base da Flux Software.

## Desenvolvimento local

Pré-requisitos: Node.js 24, pnpm 11.25.0 e Docker com Compose.

```sh
pnpm install --frozen-lockfile
docker compose up -d --wait postgres
cp apps/api/.env.example apps/api/.env
node -e 'console.log("JWT_SECRET="+require("node:crypto").randomBytes(32).toString("hex"))' >> apps/api/.env
pnpm db:migrate
pnpm dev
```

Abra a página **Conta** para criar um usuário e cadastrar a primeira empresa. Para recuperar senhas por e-mail, configure `SMTP_URL` e `MAIL_FROM` em `apps/api/.env`. Ao usar outro endereço para a web, atualize `APP_ORIGIN` com a origem correspondente.

| Interface   | Endereço local                      |
| ----------- | ----------------------------------- |
| Web         | http://127.0.0.1:3000               |
| API e banco | http://127.0.0.1:3333/api/v1/health |
| Swagger     | http://127.0.0.1:3000/docs          |

## Testes

Use um banco PostgreSQL local de teste com as migrações aplicadas. Os testes criam usuários e empresas com dados fictícios.

```sh
pnpm lint
pnpm build
pnpm test
pnpm --filter @flux/web exec playwright install chromium
pnpm --filter @flux/web test:e2e
```

Execute a suíte E2E com `pnpm dev` em outro terminal. `FLUX_CHROMIUM` permite selecionar um Chromium do sistema.

Para dados fictícios, configuração Linux com Docker e Nginx, migração e backup, siga [Instalação e homologação](docs/DEPLOYMENT.md). Consulte [o andamento](docs/PROGRESS.md) para os resultados de validação.

## GitHub

Ao receber um repositório privado vazio autorizado, vincule a cópia local a ele com `git remote add origin URL_DO_REPOSITORIO`. A publicação do histórico é uma ação separada.

O arquivo de entrega contém `flux-core.bundle`. Para copiar todo o histórico para uma pasta Git nova, use:

```sh
git clone flux-core.bundle flux-core-repo
cd flux-core-repo
git remote set-url origin URL_DO_REPOSITORIO
```

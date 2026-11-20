# Instalação e homologação

## Desenvolvimento

Siga o [README](../README.md) para iniciar o PostgreSQL, aplicar as migrações e rodar a API e a web. O Compose de desenvolvimento publica o PostgreSQL em `127.0.0.1:55432` e usa um volume persistente. O endpoint `/api/v1/health` confirma a conexão da API com o banco.

## Servidor Linux

O perfil de homologação usa PostgreSQL 17, migração como tarefa de inicialização, API NestJS, Next.js standalone e Nginx com TLS. O único porto publicado é `8443` no loopback do host. Para acessar a partir de outra máquina, use um túnel SSH autorizado para o host de homologação.

Prepare Docker com Compose v2, certificado e chave em `deploy/tls/server.crt` e `deploy/tls/server.key`. Para testes locais, o exemplo abaixo gera um certificado com validade curta para `localhost`.

```sh
mkdir -p deploy/tls
umask 077
openssl req -x509 -newkey rsa:2048 -nodes -days 14 \
  -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost' \
  -keyout deploy/tls/server.key -out deploy/tls/server.crt
cp .env.homolog.example .env.homolog
```

Preencha `POSTGRES_PASSWORD` e `JWT_SECRET` com valores exclusivos gerados por `openssl rand -hex 32`. O valor hexadecimal do banco pode ser usado diretamente na URL PostgreSQL. Guarde `.env.homolog` e a chave TLS no host com acesso restrito. Mantenha `APP_ORIGIN=https://localhost:8443` ao usar o certificado de exemplo. Para recuperação de senha, preencha `SMTP_URL` e `MAIL_FROM` com o serviço SMTP de homologação.

```sh
docker compose --env-file .env.homolog -f compose.homolog.yaml config --quiet
docker compose --env-file .env.homolog -f compose.homolog.yaml build api web
docker compose --env-file .env.homolog -f compose.homolog.yaml up -d --wait
curl --cacert deploy/tls/server.crt https://localhost:8443/api/v1/health
```

Abra `https://localhost:8443` com o certificado reconhecido pelo cliente. O Nginx sobrescreve o cabeçalho de IP encaminhado e a API confia em um salto somente nesse perfil. Mantenha a API interna à rede de containers ao usar essa configuração. A documentação Swagger fica ativa no ambiente de desenvolvimento.

## Dados fictícios

Com a aplicação iniciada, configure uma senha exclusiva para a conta de demonstração e execute:

```sh
read -rsp 'Senha do demo: ' DEMO_PASSWORD
export DEMO_PASSWORD
pnpm demo:seed
unset DEMO_PASSWORD
```

Em homologação, antes de executar o comando de seed, exporte `DEMO_BASE_URL=https://localhost:8443` e `NODE_EXTRA_CA_CERTS="$PWD/deploy/tls/server.crt"`. Entre com `demo@flux-core.test` e a senha informada. A empresa **Flux Demonstração** contém cliente, contato, catálogo, orçamento aprovado e ordem com prazo e checklist. O seed pode ser repetido com a mesma senha.

## Migrações e backup

Aplique migrações versionadas com `prisma migrate deploy`, chamado pela tarefa `migrate` do Compose. Faça backup antes de atualizar e confirme a operação em uma cópia restaurada.

```sh
umask 077
mkdir -p backups
backup_file="backups/flux-core-$(date +%Y%m%d-%H%M%S).dump"
docker compose --env-file .env.homolog -f compose.homolog.yaml exec -T postgres \
  pg_dump -U flux -d flux_core -Fc > "$backup_file"
test -s "$backup_file"
docker compose --env-file .env.homolog -f compose.homolog.yaml exec -T postgres \
  pg_restore --list < "$backup_file"
```

Para testar a restauração, use um banco novo e separado. Escolha outro nome se `flux_restore_check` já existir.

```sh
docker compose --env-file .env.homolog -f compose.homolog.yaml exec -T postgres \
  createdb -U flux flux_restore_check
docker compose --env-file .env.homolog -f compose.homolog.yaml exec -T postgres \
  pg_restore -U flux -d flux_restore_check --exit-on-error --no-owner --no-privileges < "$backup_file"
docker compose --env-file .env.homolog -f compose.homolog.yaml exec -T postgres \
  psql -U flux -d flux_restore_check -c 'SELECT count(*) FROM "Organization";'
```

## Checklist de implantação

- Conferir o artefato e as revisões com `git log --oneline`.
- Provisionar host e acesso de homologação, configurar segredos e certificado.
- Validar o Compose, construir as imagens e aplicar migrações.
- Testar saúde, login, recuperação SMTP, isolamento e cada fluxo operacional com dados fictícios.
- Gerar e restaurar um backup em banco separado. Definir retenção e acesso aos arquivos.
- Registrar as evidências e a aprovação de homologação antes de qualquer implantação pública.

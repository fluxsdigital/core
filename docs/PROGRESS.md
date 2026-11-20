# Progresso

## FC-01 — CONCLUÍDA

Workspace inicial vazio e sem remoto Git. Repositório local inicializado. O ambiente dispõe de Node.js e pnpm. A validação do Compose depende de uma máquina com Docker. A verificação de migração e conectividade usa PostgreSQL 17 local.

- Monorepo, layout responsivo, Swagger, Compose de desenvolvimento, esquema e migração inicial implementados.
- PostgreSQL 17 local aceitou a migração `20261120000000_organization`.
- `pnpm dev` inicializou web e API simultaneamente. Verificados a resposta de saúde, o contrato OpenAPI e o estado de conectividade exibido na web.
- `pnpm lint` e `pnpm build` passaram para os três pacotes.
- A execução do Compose segue pendente por ausência do Docker.

## FC-02 — CONCLUÍDA

- Cadastro, login, recuperação SMTP, troca de senha, sessões, perfil e associação de usuários a empresas implementados na API e na interface Conta.
- JWT de acesso com expiração curta, cookie HttpOnly e refresh opaco rotativo com hash e revogação em PostgreSQL.
- Lint e builds passaram. Dois testes de integração Jest passaram, incluindo SMTP local e reutilização de token rejeitada. A conexão frontend → API foi verificada por HTTP com cadastro, cookies e criação de empresa.
- A suíte Playwright foi escrita. O Chromium do ambiente encerrou antes de abrir a página por restrição de sockets do executor. A execução em navegador permanece pendente.

## FC-03 — CONCLUÍDA

- Permissões centralizadas por papel. O guard resolve a associação esperada no PostgreSQL e entrega o contexto validado aos domínios.
- Criação e alteração de empresa e inclusão de membros registram auditoria na mesma transação. Consulta de eventos restrita à organização e aos papéis autorizados.
- Migrações verificadas em PostgreSQL 17. Lint, build e três testes Jest passaram, incluindo controle dos quatro papéis, isolamento entre empresas, validação e auditoria.

## FC-04 — CONCLUÍDA

- Cadastros de clientes, contatos, produtos, serviços e categorias. Busca, paginação e arquivamento, com observações e arquivos por registro.
- A escrita fica disponível para proprietários, administradores e gestores. Operadores têm leitura. Registros filhos usam referências compostas com o identificador da empresa. Anexos de até 5 MB baixam como arquivo e permanecem isolados por empresa e registro.
- Lint e build passaram. Quatro testes Jest passaram. O Playwright executou os dois fluxos em Chromium headless alternativo, com aprovação de cadastro, sessão, cadastro operacional, observação, envio e download de anexo.

## FC-05 — CONCLUÍDA

- Orçamentos com produtos, serviços, quantidades, descontos e preços calculados em centavos no servidor. Rascunhos editáveis com controle de revisão e fluxo de envio, aprovação e recusa.
- PDF autenticado e conversão idempotente de orçamento aprovado em ordem de serviço.
- Lint e build passaram. Cinco testes Jest e três Playwright passaram. Os testes confirmaram valores, rejeição de transições inválidas, download e conversão concorrente para uma só OS.

## FC-06 — CONCLUÍDA

- Ordens avulsas e convertidas, responsável, prioridade, prazo, estados configuráveis, checklist, anexos, histórico e relatório de conclusão.
- Operadores atuam sobre ordens atribuídas a eles. A conclusão exige relatório e checklist finalizado. Ordens concluídas preservam o relatório e histórico.
- Lint e build passaram. Seis testes Jest e quatro Playwright passaram. A migração inclui estados iniciais e histórico para empresas e ordens já existentes.

## FC-07 — CONCLUÍDA

- Visão geral com orçamentos por status e valor, ordens abertas e concluídas, atrasos, tarefas pendentes e próximos prazos. Filtro por período aplicado no servidor.
- Proprietários e administradores ajustam nome de exibição, cor e módulos da empresa. As opções controlam a interface e os endpoints. Dependências entre módulos são validadas.
- Lint e build passaram. Sete testes Jest e cinco Playwright passaram, incluindo produção de indicadores, filtros e rejeição de acesso a módulo desativado.

## FC-08 — BLOQUEADA

O MVP foi demonstrado em execução local. A imagem e a subida integral do Compose aguardam um host com Docker funcional. O daemon testado neste executor não conseguiu criar o socket Unix, retornando `operation not permitted`.

| Verificação                   | Resultado                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatação, lint e build      | Projetos API, web e UI verificados. Build Next.js standalone produzido.                                                                                                                                        |
| Jest                          | 11 testes aprovados. Sete casos de integração com PostgreSQL, dois testes unitários de credenciais e dois testes de interface com React Testing Library.                                                       |
| Playwright                    | Cinco fluxos aprovados em Chromium headless. Conta, cadastros e anexos, orçamento e PDF, OS, painel e personalização.                                                                                          |
| OpenAPI                       | Swagger entregue pela origem web com 37 caminhos verificados.                                                                                                                                                  |
| Migrações                     | Sete migrações aplicadas em PostgreSQL 17. Segunda execução sem pendências.                                                                                                                                    |
| Compose                       | Arquivos de desenvolvimento e homologação aceitos por `docker compose config --quiet`.                                                                                                                         |
| Homologação equivalente local | Nginx 1.28 com TLS, Next.js standalone e API em modo de produção. Saúde, página e assets, regras de origem e cookies Secure verificados.                                                                       |
| Dados fictícios               | Seed executado duas vezes pela web de desenvolvimento e executado pelo Nginx/TLS em modo de produção.                                                                                                          |
| Backup                        | Backup lógico restaurado em banco separado. Ordem vinculada a orçamento confirmada.                                                                                                                            |
| Dependências                  | Corrigidos dois avisos de severidade alta detectados em dependências transitivas do Prisma. Corrigidos também dois avisos moderados nas ferramentas de teste. Auditoria final sem vulnerabilidades conhecidas. |

A revisão conferiu o escopo das consultas, as chaves estrangeiras compostas, o contexto do guard, a revogação de sessões, o armazenamento de hashes de refresh e reset, as respostas de recuperação, os limites de anexos e a separação entre origens. A proteção por empresa combina autorização da aplicação e integridade relacional. Os testes reproduzem cenários de acesso autorizado e recusas entre empresas.

As referências de segurança usadas na revisão são os guias [Recuperação de senha](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Gerenciamento de sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [Configuração do Express atrás de proxy](https://expressjs.com/en/guide/behind-proxies/).

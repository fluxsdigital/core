# Arquitetura

O pnpm gerencia os workspaces e o Turborepo orquestra os comandos. `apps/web` usa Next.js App Router e Tailwind. `apps/api` usa NestJS, expõe REST sob `/api/v1` e documenta o contrato com Swagger. `packages/ui` concentra componentes e tokens reaproveitáveis. PostgreSQL é o banco transacional. O Prisma mantém o esquema, o cliente tipado e as migrações.

O módulo inicial expõe uma verificação de saúde que consulta o banco. O modelo `Organization` estabelece o ponto de associação do domínio. Os módulos seguem os domínios operacionais de identidade, organizações, cadastros, orçamentos, ordens de serviço e relatórios.

Cada requisição a uma organização resolve a associação do usuário no servidor. Operações sobre dados de negócio usam o identificador de organização validado junto ao identificador do registro. Os testes de integração exercitam acessos entre organizações.

Nginx fornece entrada de mesma origem no perfil de homologação e encaminha as rotas da web e da API. Durante desenvolvimento, os serviços escutam em loopback.

## Permissões iniciais

| Ação                                  | Proprietário | Administrador | Gestor | Operador |
| ------------------------------------- | ------------ | ------------- | ------ | -------- |
| Consultar a empresa associada         | Sim          | Sim           | Sim    | Sim      |
| Consultar membros                     | Sim          | Sim           | Sim    | —        |
| Alterar empresa e consultar auditoria | Sim          | Sim           | —      | —        |
| Associar administrador                | Sim          | —             | —      | —        |
| Associar gestor e operador            | Sim          | Sim           | —      | —        |

Uma rota de empresa exige `AuthGuard`, `TenantGuard` e uma permissão explícita. O identificador repassado aos serviços vem da associação carregada pelo guard. Respostas 404 para quem não é membro preservam a privacidade da empresa. Dentro da empresa, permissões insuficientes retornam 403.

Os cadastros compartilham o modelo `DirectoryRecord`, discriminado por tipo. Contatos referenciam clientes. Produtos e serviços podem referenciar categorias. O PostgreSQL verifica o vínculo por chave composta de empresa e registro. O arquivamento preserva histórico e bloqueia a exclusão lógica de pais com filhos ativos.

Observações e anexos pertencem ao registro. Os arquivos ficam em PostgreSQL no MVP, com limite de 5 MB por arquivo, metadados entregues separadamente e download autenticado.

Ordens de serviço referenciam cliente, responsável e status com chaves compostas. Cada empresa nasce com três status. Proprietários e administradores podem adicionar e renomear status. A condição de conclusão de um status é escolhida na criação para preservar o significado das ordens existentes. As mutações de OS serializam checklist, anexos e conclusão no registro da ordem, mantendo o histórico transacional.

O painel calcula grupos de orçamento pela data de criação. Ordens abertas, atrasos e tarefas usam a data de criação da ordem. Ordens concluídas usam a data de conclusão. O término do intervalo da API é exclusivo. A interface converte as datas informadas no fuso do navegador para instantes ISO.

`OrganizationSettings` fornece identidade e flags com padrão explícito para empresas existentes. O guard central aplica a flag da permissão solicitada. A conversão de orçamento valida também a disponibilidade do módulo de ordens.

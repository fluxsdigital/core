# Backlog

| ID    | Descrição                                                      | Dependências | Status    | Critérios de aceite                                                                                                           |
| ----- | -------------------------------------------------------------- | ------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| FC-01 | Fundação, monorepo, Prisma e layout                            | —            | CONCLUÍDA | Web e API iniciam localmente, migração e conexão PostgreSQL funcionam, lint e build passam.                                   |
| FC-02 | Identidade, sessões, perfil e empresas                         | FC-01        | CONCLUÍDA | Cadastro, login, renovação, revogação, recuperação, alteração de senha e usuários associados a empresas funcionam nos testes. |
| FC-03 | Multi-tenancy, papéis, permissões e auditoria                  | FC-02        | CONCLUÍDA | Testes de integração verificam rejeição entre organizações e a matriz de quatro papéis.                                       |
| FC-04 | Clientes, contatos, catálogo, categorias, anexos e observações | FC-03        | CONCLUÍDA | CRUD no frontend com paginação, filtros, validação e autorização.                                                             |
| FC-05 | Orçamentos e PDF                                               | FC-04        | CONCLUÍDA | Itens, totais, estados, PDF e conversão única de orçamento aprovado em OS.                                                    |
| FC-06 | Ordens de serviço                                              | FC-05        | CONCLUÍDA | Responsável, prioridade, prazo, estados, checklist, anexos, histórico e relatório testados.                                   |
| FC-07 | Indicadores, relatórios e configuração por organização         | FC-06        | CONCLUÍDA | Indicadores reais e relatórios filtráveis, módulos e identidade configuráveis, pontos de extensão documentados.               |
| FC-08 | Qualidade, homologação e entrega                               | FC-07        | BLOQUEADA | Testes unitários, de integração e E2E, revisão, imagem, migrações, backup, dados fictícios, guia e checklist verificados.     |

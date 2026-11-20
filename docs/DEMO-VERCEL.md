# Demo visual do Flux Core na Vercel

A demo usa as telas do Flux Core com uma empresa de exemplo. Abra o painel, veja
os cadastros e consulte o orçamento de manutenção para navegar até a ordem de
serviço vinculada. A conta exibida é fictícia. Gravações e downloads ficam
indisponíveis.

## Configuração do projeto

Importe um repositório privado com o conteúdo desta pasta em um projeto novo na
Vercel. Selecione o framework Next.js, a raiz `apps/web` e Node.js 24. Habilite a
inclusão de arquivos de fora da raiz se a opção aparecer no painel. O pacote
compartilhado `packages/ui` faz parte do monorepo.

O arquivo `apps/web/vercel.json` ativa a demo durante o build. O comando de
instalação padrão da Vercel usa o pnpm do monorepo. A demo dispensa banco,
segredos, conta SMTP e servidor da API. Para um teste individual, use um
deployment Preview com acesso restrito na Vercel.

## Rodar a demo localmente

Na raiz do monorepo:

```sh
pnpm --filter @flux/web... install --frozen-lockfile
NEXT_PUBLIC_FLUX_DEMO=1 pnpm --filter @flux/web dev
```

Abra http://127.0.0.1:3000.

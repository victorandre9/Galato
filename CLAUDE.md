# Galato — notas para o Claude

Plataforma integrada (comercial, financeiro, faturamento e logística). Fase atual: demonstração com dados fictícios.
O Victor não é desenvolvedor: fale em português simples. Visão geral e decisões: `docs/arquitetura.md` (leia só a parte
do assunto da tarefa).

## Blocos do app (mexa e consulte SÓ o bloco da tarefa)

| Bloco | Tela | Regras de negócio ligadas |
|---|---|---|
| Vendedor | `apps/demo/src/screens/Seller.tsx` | `packages/domain/src/rules/` (credit, payment-terms, customers, ranking) |
| Gerente / coordenação | `apps/demo/src/screens/Manager.tsx` | ranking, abcd, financial-queue |
| Operação | `apps/demo/src/screens/Ops.tsx` | inventory, statuses, business-days |
| Motorista / logística | `apps/demo/src/screens/Driver.tsx` | statuses, dates |
| Relatórios | `apps/demo/src/screens/Reports.tsx` | abcd, ranking, format |
| Parâmetros configuráveis | — | `packages/domain/src/config/` |
| Dados de exemplo | `apps/demo/src/data/`, `api/data.ts` | — |

Componentes compartilhados: `apps/demo/src/components/`. Testes das regras: `pnpm --filter @galato/domain test`.

## Mapa do código (Graphify)

Antes de abrir arquivos para achar onde algo mora, consulte o mapa (montado sem custo de tokens no início da sessão):
`graphify query "assunto"`, `graphify explain "Função"` ou `graphify-out/GRAPH_REPORT.md`. Depois de mudar código: `graphify update .`

## Economia de publicações (Vercel)

`vercel.json` → `ignoreCommand`: mudança só em `CLAUDE.md`/`AGENTS.md`/`docs/` não gera publicação (o plano gratuito tem limite diário).

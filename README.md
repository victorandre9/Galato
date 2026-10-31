# Galato — Plataforma integrada

Comercial, financeiro, faturamento e logística da Galato Sorvetes.
Fase atual: **demonstração com dados fictícios** (sem banco de dados).

## Rodar

```bash
pnpm install
pnpm --filter @galato/demo dev      # http://localhost:5173
pnpm --filter @galato/domain test   # regras de negócio
```

## Estrutura

```
packages/domain   regras de negócio puras + parâmetros configuráveis (testadas)
apps/demo         app web responsivo (mobile + desktop), tema claro/escuro, dados mock
docs/             arquitetura, permissões, máquinas de estado, backlog
```

Decisões e arquitetura alvo: [docs/arquitetura.md](docs/arquitetura.md).

Todos os nomes, CNPJs, telefones e valores da demo são fictícios.

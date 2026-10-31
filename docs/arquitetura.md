# Galato: arquitetura e decisões

Status: **fase de demonstração**. Hoje não existe banco de dados nem backend. A demo roda inteira no navegador, com dados fictícios em memória. Este documento separa **o que a demo faz** da **arquitetura alvo** de produção, para que a demo evolua sem retrabalho.

---

## 1. Decisões (ADR resumido)

| # | Decisão | Motivo |
|---|---------|--------|
| D1 | Monorepo pnpm: `packages/domain` (regras puras) + `apps/demo` (front) | Regras de negócio ficam testáveis e reaproveitáveis no backend futuro |
| D2 | **Regras de negócio fora da UI**, em `@galato/domain` | Requisito: "não deixar regra crítica só no frontend". O backend vai importar o mesmo pacote e revalidar |
| D3 | **Nenhum valor de negócio hardcoded**: tudo em `PlatformParameters` | Curva ABCD, SLA, prazos, metas, calendário, catálogos dependem da diretoria |
| D4 | Dinheiro em **centavos inteiros** | Evitar erro de arredondamento com float |
| D5 | Datas de negócio como `YYYY-MM-DD` no fuso `America/Sao_Paulo` | Dia útil, rota do dia e "dias sem compra" dependem da data civil |
| D6 | Demo: React + Vite, store em memória, web responsiva | Link único para celular e computador, sem instalar nada |
| D7 | Produção (proposta): app Expo/React Native (vendedor/motorista) + web (gestão) + API NestJS + PostgreSQL | Offline real no celular exige banco local (SQLite) |
| D8 | Tipo do documento separado do status | Orçamento simples, orçamento e pedido são tipos; cada um tem sua máquina de estados |

## 2. Escopo da demo (o que já está pronto)

Seletor de perfil → 8 perfis. Cada tela usa as regras reais do pacote `domain`.

| Perfil | Dispositivo | O que mostra |
|---|---|---|
| Vendedor | celular | venda do dia, acumulado, anel de meta, falta, **necessário por dia útil**, rota do dia com baldes 7/14/21/28+ clicáveis, status de pedidos, quitações pendentes com SLA, ficha/check-in completo, pedido com **validação de estoque**, prazo recomendado, bloqueio financeiro que salva mas retém, comprovante de pagamento, cliente de outra carteira com visão limitada + solicitar transferência / encaminhar oportunidade, planejamento semanal |
| Gerente geral / coordenador / gerente comercial | **desktop** (responsivo no celular) | meta do dia, vendas do mês, visitas 90/120, entregas 36/60, **ranking proporcional** (dia/mês), ranking de visitas, alertas, clientes sem compra com **filtros combinados**, financeiro com SLA, pipeline de pedidos, ativos e **ativos sem giro**, carteiras (aprovar transferência, acesso temporário). Gerente comercial vê só a própria equipe |
| Financeiro | desktop | fila priorizada (dia anterior → PIX → boleto), SLA 24h, análise com as 6 respostas, liberação de crédito |
| Faturamento | desktop | quadro: liberados → a faturar → em faturamento → faturados / erros |
| Motorista | celular | checklist (gera não conformidade), **Iniciar o dia com confirmação**, entregas, comprovante (tipo configurável), não entrega com motivo obrigatório, ocorrência, EPI, **Finalizar o dia** bloqueado enquanto houver pendência |
| Coord. transportes | **desktop** | rotas extraídas do sistema / lançamento manual com PDF e conferência, KPIs, alertas logísticos, tempo real por rota com ritmo esperado, ocorrências, não conformidades, frota |

Offline na demo: o indicador "Sincronizado" no topo simula perda de conexão. Ações continuam funcionando, ficam como pendentes e sincronizam sozinhas ao reconectar.

"Hoje" da demo = último dia útil real (fim de semana recua para sexta).

## 3. Arquitetura alvo (produção)

```
 Celular (vendedor/motorista)          Web (gestão, financeiro, faturamento, logística)
 ┌──────────────────────────┐          ┌──────────────────────────┐
 │ UI (Expo / React Native) │          │ UI (React, mesma DS)     │
 │ SQLite local + sync_queue│          └───────────┬──────────────┘
 └────────────┬─────────────┘                      │
              │ HTTPS (JWT + refresh)              │
        ┌─────▼────────────────────────────────────▼─────┐
        │ API (NestJS) — RBAC no backend, @galato/domain │
        │ /sync (push/pull), comandos de estado, uploads │
        └─────┬───────────────┬──────────────┬───────────┘
              │               │              │
        PostgreSQL     Storage (URLs     Fila de integrações
        (central)      assinadas)        ERP/fiscal · estoque · roteirizador
```

### 3.1 Offline-first

1. Toda gravação vai primeiro ao SQLite do aparelho, na hora.
2. Gera item em `sync_queue` (id UUIDv7 gerado no aparelho = idempotência).
3. Sincroniza sozinho quando: internet volta, app volta ao foreground, troca/abre tela, registro salvo, intervalo periódico (backoff exponencial em erro).
4. Colunas em todo registro sincronizável: `id, created_at, updated_at, version, sync_status (synced|pending|error|conflict), last_synced_at, deleted_at`.

**Conflitos** (nunca sobrescrever em silêncio):
- Registros só de inserção (check-in, foto, comprovante, log, baixa) não conflitam.
- Edição de campos: cliente envia `base_version` + campos alterados. Mesma versão → aplica. Versão diferente com campos diferentes → merge automático. Mesmo campo com valor diferente → `conflict`, mostra as duas versões ao usuário.
- Mudança de status vai como **comando** (ex.: `confirmar_entrega`), revalidado pela máquina de estados no servidor. Se o pedido já mudou (ex.: faturado), o comando volta com erro explicado.
- Importação manual só como contingência administrativa.

### 3.2 Integrações

Adapter por sistema (ERP/fiscal, estoque, financeiro, roteirizador), atrás de interface + feature flag. Mock enquanto a API real não for validada. Cada chamada registra `last_sync, status, error, retries, origem, payload_id`. **Nenhuma integração fictícia em produção.**

## 4. Permissões (RBAC, validado no backend)

Escopo: `own` (própria carteira/rota), `team` (equipe do gestor), `all`.

| Recurso / ação | Vend. | Ger. com. | Coord. com. | Ger. geral | Financ. | Fatur. | Motor. | Coord. transp. |
|---|---|---|---|---|---|---|---|---|
| Cliente: ver completo | own (+ acesso temporário) | team | all | all | all | all | entregas | rotas |
| Cliente: ver limitado (outra carteira) | all | – | – | – | – | – | – | – |
| Cliente: editar contato/rota comercial | own | team | all | all | – | – | – | – |
| Cliente: editar dado fiscal | – | – | – | – | – | admin/ERP | – | – |
| Solicitar transferência | ✓ | – | – | – | – | – | – | – |
| Aprovar transferência / acesso temporário | – | team | all | all | – | – | – | – |
| Orçamento / pedido | own | team | all | all | ver | ver | – | – |
| Prazo acima do recomendado | parâmetro | ✓ | ✓ | ✓ | – | – | – | – |
| Data prevista de entrega | parâmetro | ✓ | ✓ | ✓ | – | – | – | – |
| Enviar comprovante | own | team | all | – | – | – | – | – |
| Responder comprovante / liberar crédito | – | – | – | – | ✓ | – | – | – |
| Faturar | – | – | – | – | – | ✓ | – | – |
| Metas, rankings | própria | team | all | all | – | – | – | – |
| Iniciar/finalizar dia, entregas, checklist, EPI | – | – | – | – | – | – | own | ver |
| Rotas, vincular motorista/veículo, importar PDF | – | – | – | – | – | – | – | ✓ |
| Ocorrências / não conformidades | – | – | – | ver | – | – | criar | tratar |
| Ativos / freezers | own (ver) | team | all | all | – | – | – | – |

## 5. Máquinas de estado

**Orçamento:** Rascunho → Pronto p/ envio → Enviado → Aguardando cliente ⇄ Negociação → Aprovado → Convertido em pedido. Saídas: Recusado, Expirado, Cancelado.

**Pedido:** Rascunho → Aguardando análise financeira → Em aprovação → Aprovado pelo crédito → Programado p/ faturamento → Enviado ao faturamento → Em faturamento → Faturado → Em rota de entrega → Em trânsito → Entregue → Concluído.
Desvios: cliente bloqueado → **Bloqueado** (salvo, nunca vai ao faturamento sozinho); Em faturamento → Erro de faturamento → reenviar; não entrega → volta a Faturado para nova rota (proposta, a validar); Cancelado.

**Solicitação de quitação:** Pendente → Em análise → Pagamento confirmado | Não identificado | Comprovante incorreto | Divergência | Reprovado | Outro motivo. Reenvio de comprovante reabre.

**Entrega:** Programada → Em trânsito → Entregue (com comprovante) | Não entregue (motivo obrigatório).

**Dia do motorista:** Não iniciado → Iniciado (confirmação) → Finalizado (confirmação + todas as entregas resolvidas).

**EPI:** Solicitado → Em análise → Aprovado → Aguardando compra → Entregue | Recusado.

**Rota:** Importada/manual (conferência) → Confirmada → Atribuída → Em andamento → Concluída | Cancelada.

## 6. Parâmetros configuráveis

Arquivo: `packages/domain/src/config/parameters.ts`. Valores atuais são só para apresentação.
Marcados **a validar com a diretoria**: janela da média ABCD (3 meses), dias para "ativo sem giro" (30), tolerância de frequência, aprovação automática de crédito, limites de desconto por papel, aprovação do planejamento semanal, comissão por indicação, limites de alertas logísticos.

## 7. Entidades (modelo de dados alvo)

users, roles, permissions, user_roles · sellers, managers · customers, customer_contacts, customer_portfolios, portfolio_transfer_requests, temporary_portfolio_access · commercial_routes, visits, checkins, checkouts, weekly_plans · products, product_categories, inventory, price_tables, payment_terms · quotes, quote_items, orders, order_items, order_status_history · financial_accounts, invoices_receivable, payment_confirmation_requests, payment_confirmation_attachments · invoices, billing · goals, sales_metrics, abc_classification_rules · assets, freezers, asset_customer_history, asset_values · vehicles, drivers, driver_workdays, vehicle_checklists, vehicle_checklist_items, nonconformities, incidents, epi_requests · delivery_routes, delivery_route_items, delivery_assignments, deliveries, delivery_proofs, route_imports · notifications, audit_logs, sync_queue, attachments, integration_runs, platform_parameters.

O schema SQL será escrito quando sair da fase de demonstração.

## 8. Backlog

**Demo (próximos passos sugeridos):** centro de notificações, tela de produtos/estoque, PDF de orçamento, histórico de auditoria visível, QR Code do freezer (abrir ativo), tela de configuração dos parâmetros.

**Produção:** Fase 1 auth/usuários/RBAC/clientes/produtos/carteira/rotas → Fase 2 dashboard vendedor, orçamento, pedido, estoque, financeiro → Fase 3 gestão, metas, visitas, ABCD → Fase 4 ativos/QR → Fase 5 motorista → Fase 6 coordenação logística, PDF de manifesto → Fase 7 integrações ERP/fiscal/estoque/roteirização.

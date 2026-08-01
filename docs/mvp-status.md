# Status do MVP

Atualizado em 2026-07-31 após fechamento do MVP web.

As sete fases abaixo agrupam os 24 passos da ordem de implementação original.

| Fase | Estado | Evidência e lacuna objetiva |
|---|---|---|
| 0. POC Codex local | concluída | Adapter isolado, sessão persistida por agente, retomada compatível por modo de acesso, cancelamento e eval opt-in. |
| 1. Fundação web e cena | concluída | React, Phaser, grade, conversões, câmera e sprites carregam no Electron. |
| 2. Navegação | concluída | A* cardinal, colisão de móveis, reservas temporárias, replanejamento local e depth por eixo Y. |
| 3. Estado persistido | concluída | SQLite, Alembic, agentes, estação agrupada, posição-base e pontos de interação persistem; o modo edição mostra mesa, cadeira, monitor e destinos válidos. |
| 4. Operação | concluída | Catálogo remoto de skills e plugins, busca, filtro por categoria, manifestos, tarefas Codex, WebSocket, histórico e aprovações existem. |
| 5. Colaboração segura | concluída | Interação visual, retorno, delegação pai-filho, limite de profundidade 2, quatro subtarefas por tarefa, prevenção de ciclos, timeout de 10 minutos, aprovação e cancelamento em cascata persistido existem. |
| 6. Fechamento web | concluída | Seleção de agente por teclado, foco visível, alerta de erro e Playwright cobrem formulário, catálogo remoto com busca/filtro, skills por clique/arraste, tarefa com aprovação, falha de concorrência, solicitação de interação e modos operação/edição contra FastAPI e Vite reais. |
| 7. Desktop | concluída para desenvolvimento | Electron inicia e encerra o backend em localhost. Empacotador distribuível fica para a release. |

## Estimativa do MVP

Cobertura funcional atual: 100% dos critérios de aceitação do MVP web. O que permanece é trabalho de release, não uma lacuna funcional do MVP:

1. Empacotar instaladores Electron com o runtime Python incluído.
2. Opcionalmente ampliar E2E com cenários de falha de rota e comparar capturas visuais em CI.

O próximo pacote, quando houver demanda de release, é o instalador distribuível.

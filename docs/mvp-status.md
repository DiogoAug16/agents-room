# Status do MVP

Atualizado em 2026-07-31 após estados de falha e E2E de interação.

As sete fases abaixo agrupam os 24 passos da ordem de implementação original.

| Fase | Estado | Evidência e lacuna objetiva |
|---|---|---|
| 0. POC Codex local | concluída | Adapter isolado, cancelamento e eval opt-in. |
| 1. Fundação web e cena | concluída | React, Phaser, grade, conversões, câmera e sprites carregam no Electron. |
| 2. Navegação | concluída | A* cardinal, colisão de móveis, reservas temporárias, replanejamento local e depth por eixo Y. |
| 3. Estado persistido | parcial | SQLite, Alembic, agentes, posição-base, pontos de interação e validação visual da estação persistem. O cenário ainda é uma ilustração estática, portanto móveis de fundo não são removidos visualmente ao mover uma estação. |
| 4. Operação | em andamento | Skills e plugins podem atribuir, pausar e remover; tarefas, WebSocket, histórico e aprovações existem. Faltam busca/filtros reais e plugins com manifestos completos. |
| 5. Colaboração segura | concluída | Interação visual, retorno, delegação pai-filho, limite de profundidade 2, quatro subtarefas por tarefa, prevenção de ciclos, timeout de 10 minutos, aprovação e cancelamento em cascata persistido existem. |
| 6. Fechamento web | em andamento | Seleção de agente por teclado, foco visível, alerta de erro e Playwright cobrem formulário, skills por clique/arraste, tarefa com aprovação, falha de tarefa concorrente, solicitação de interação e modos operação/edição contra FastAPI e Vite reais. Falta ampliar a cobertura de falha de rota da cena. |
| 7. Desktop | concluída para desenvolvimento | Electron inicia e encerra o backend em localhost. Empacotador distribuível fica para a release. |

## Estimativa do MVP

Cobertura funcional atual: aproximadamente 86% dos critérios de aceitação. As lacunas que ainda impedem o fechamento são concentradas em dois pacotes:

1. Edição de estação: mover mesa, cadeira, computador, ponto-base e pontos de interação como um grupo, com validação visual.
2. Fechamento: cobrir falha de rota e fluxo visual completo da interação, completar busca/filtros e manifestos de plugins, e empacotar a distribuição Electron.

O próximo pacote é concluir a representação visual agrupada das estações movidas.

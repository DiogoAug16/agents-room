# Status do MVP

Atualizado em 2026-07-31 após o catálogo e a gestão de plugins.

As sete fases abaixo agrupam os 24 passos da ordem de implementação original.

| Fase | Estado | Evidência e lacuna objetiva |
|---|---|---|
| 0. POC Codex local | concluída | Adapter isolado, cancelamento e eval opt-in. |
| 1. Fundação web e cena | concluída | React, Phaser, grade, conversões, câmera e sprites carregam no Electron. |
| 2. Navegação | concluída | A* cardinal, colisão de móveis, reservas temporárias, replanejamento local e depth por eixo Y. |
| 3. Estado persistido | parcial | SQLite, Alembic, agentes, posição-base, pontos de interação e validação visual da estação persistem. O cenário ainda é uma ilustração estática, portanto móveis de fundo não são removidos visualmente ao mover uma estação. |
| 4. Operação | em andamento | Skills e plugins podem atribuir, pausar e remover; tarefas, WebSocket, histórico e aprovações existem. Faltam busca/filtros reais e plugins com manifestos completos. |
| 5. Colaboração segura | parcial | Interação visual, retorno, cancelamento, aprovação e lock de escrita existem. Faltam delegação de tarefas, limites de profundidade/subtarefas e detecção de ciclos. |
| 6. Fechamento web | pendente | Faltam E2E, cobertura dos reducers/eventos, acessibilidade e tratamento visual de falhas. |
| 7. Desktop | concluída para desenvolvimento | Electron inicia e encerra o backend em localhost. Empacotador distribuível fica para a release. |

## Estimativa do MVP

Cobertura funcional atual: aproximadamente 70% dos critérios de aceitação. As lacunas que ainda impedem o fechamento são concentradas em três pacotes:

1. Edição de estação: mover mesa, cadeira, computador, ponto-base e pontos de interação como um grupo, com validação visual.
2. Delegação segura: árvore de tarefas, limites, timeout, cancelamento em cascata e prevenção de ciclos.
3. Fechamento: testes E2E, acessibilidade, estados de falha e empacotamento de distribuição.

O próximo pacote é a edição completa de estações, que mantém a topologia persistida da sala coerente com a cena.

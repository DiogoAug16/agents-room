# Agents Room interface system

## Direção

Console local de operações em um escritório diurno. A pessoa que acompanha agentes precisa ler o estado e agir sem competir visualmente com a cena isométrica.

## Paleta e profundidade

- Grafite `#121a20` e ardósia `#172229` formam as superfícies operacionais.
- Verde-água `#4cae9b` indica ação e atividade normal.
- Ocre `#d89a34` indica espera de aprovação ou cancelamento.
- Coral `#df7a7a` indica erro e indisponibilidade.
- A cena recebe a luz diurna; os painéis ficam neutros para não disputar atenção.
- Usar apenas bordas translúcidas e diferenças sutis de superfície, sem sombras decorativas.

## Escala e padrões

- Espaçamento base: 8px. Raios: 6px em controles, 7-8px em cartões e 10px em diálogos.
- Tipografia: Inter para texto e JetBrains Mono somente em metadados temporais.
- Estados de agente usam o ponto semântico do Inspector: verde-água normal, ocre bloqueado, coral erro/offline e verde claro concluído.
- Falhas aparecem acima do stream como alerta `role="alert"`, com fechamento explícito; o stream permanece `aria-live="polite"`.
- Cartão de skill separa ação de atribuir do puxador de arraste, para clique e drag-and-drop não disputarem o mesmo alvo.

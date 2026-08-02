# Agents Room

Workspace local-first para visualizar agentes Codex em um escritório isométrico 2.5D.

## Executar localmente

Em um terminal:

```bash
cd backend
PYTHONPATH=. .venv/bin/alembic upgrade head
PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Em outro terminal:

```bash
cd frontend
npm run dev
```

Abra `http://127.0.0.1:5173`.

Para a aplicação desktop, gere o frontend e execute:

```bash
python3 scripts/extract-office-assets.py
cd frontend && npm run build
cd ../electron && npm install && npm start
```

O comando de extração requer ImageMagick e deve ser executado uma vez após clonar ou alterar [office-assets.json](assets/office/manifests/office-assets.json). Os PNGs derivados não são versionados.

Valide o ciclo desktop sem exibir janela:

```bash
cd electron && npm run smoke
```

## Verificação

```bash
cd frontend && npm run build && npm test
cd frontend && npm run test:e2e
python3 -m unittest discover -s scripts -p 'test_*.py'
cd backend && PYTHONPATH=. .venv/bin/python -m unittest discover -s tests -v
cd backend && PYTHONPATH=. .venv/bin/python evals/delegation_policy_check.py
cd backend && PYTHONPATH=. RUN_CODEX_EVAL=1 .venv/bin/python evals/codex_provider_smoke.py
```

O último comando usa o Codex local em modo efêmero e somente leitura.

## Escopo atual

- React, Phaser, Zustand, TanStack Query, dnd-kit, React Hook Form, Zod e Radix UI.
- Grade isométrica, zoom, pan, seleção, foco e A* cardinal testado.
- Mapa de navegação declarativo: corredores de custo preferencial, obstáculos, assentos, aproximações, áreas de reunião e pontos ociosos. A cena nunca deriva colisão dos pixels da arte.
- Assentos de estação e sofá com reserva temporária, âncora e offset por assento; comportamentos ociosos leves retornam à estação e são cancelados por tarefas reais.
- Cenário e spritesheets fornecidos usados pela cena.
- FastAPI localhost, SQLite, Alembic, CRUD de agente/estação, associação de skill e WebSocket.
- Adapter Codex isolado, sessão Codex persistida por agente, permissões `read_only` e `workspace_write`, cancelamento e lock de escrita por projeto.
- Interação persistida entre agentes, com eventos sequenciais, A*, balão resumido e retorno visual à estação.
- Catálogo/associação de plugins e aprovações explícitas antes de tarefas com escrita.

Electron inicia e encerra o backend local automaticamente. Empacotamento distribuível fica para a fase de release.

## Depuração da cena

Em desenvolvimento, pressione `N` sobre a cena para mostrar células navegáveis, corredores, obstáculos, assentos, aproximações e a posição dos pés dos agentes. O atalho não é registrado no build de produção.

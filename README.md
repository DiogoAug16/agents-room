# Agents Room

Workspace local-first para visualizar agentes Codex em um escritório isométrico 2.5D.

## Executar localmente

Em um terminal:

```bash
cd backend
.venv/bin/alembic upgrade head
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
cd frontend && npm run build
cd ../electron && npm install && npm start
```

Valide o ciclo desktop sem exibir janela:

```bash
cd electron && npm run smoke
```

## Verificação

```bash
cd frontend && npm run build && npm test
cd backend && PYTHONPATH=. .venv/bin/python -m unittest discover -s tests -v
cd backend && PYTHONPATH=. .venv/bin/python evals/delegation_policy_check.py
cd backend && PYTHONPATH=. RUN_CODEX_EVAL=1 .venv/bin/python evals/codex_provider_smoke.py
```

O último comando usa o Codex local em modo efêmero e somente leitura.

## Escopo atual

- React, Phaser, Zustand, TanStack Query, dnd-kit, React Hook Form, Zod e Radix UI.
- Grade isométrica, zoom, pan, seleção, foco e A* cardinal testado.
- Cenário e spritesheets fornecidos usados pela cena.
- FastAPI localhost, SQLite, Alembic, CRUD de agente/estação, associação de skill e WebSocket.
- Adapter Codex isolado, permissões `read_only` e `workspace_write`, cancelamento e lock de escrita por projeto.
- Interação persistida entre agentes, com eventos sequenciais, A*, balão resumido e retorno visual à estação.
- Catálogo/associação de plugins e aprovações explícitas antes de tarefas com escrita.

Electron inicia e encerra o backend local automaticamente. Empacotamento distribuível fica para a fase de release.

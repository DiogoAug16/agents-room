# Backend POC

Phase 0 validates the Codex CLI boundary before FastAPI, SQLite and the scene are added.

```bash
cd backend
PYTHONPATH=. python3 -m unittest discover -s tests -v
PYTHONPATH=. RUN_CODEX_EVAL=1 python3 evals/codex_provider_smoke.py
```

The live eval runs an intentionally read-only, ephemeral Codex task in the workspace root. It emits only normalized summaries and does not persist the prompt response.

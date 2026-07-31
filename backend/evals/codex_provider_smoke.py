"""Opt-in live POC. Run with RUN_CODEX_EVAL=1 from backend/."""

import os
from pathlib import Path

from app.codex_provider import CodexAgentProvider


def main() -> None:
    if os.environ.get("RUN_CODEX_EVAL") != "1":
        print("Skipped: set RUN_CODEX_EVAL=1 to call the local Codex CLI.")
        return
    provider = CodexAgentProvider(Path.cwd().parent)
    assert provider.is_available(), "Codex CLI was not found"
    events = list(provider.run("Reply only with POC_OK. Do not read or modify files."))
    assert events, "Codex emitted no JSONL events"
    assert any(event.type == "thread.started" for event in events), "No session event"
    assert any(event.type == "turn.completed" for event in events), "Task did not complete"
    assert all("POC_OK" not in event.summary for event in events), "Raw response leaked"
    print("PASS: Codex CLI session, normalized events, and text redaction verified.")


if __name__ == "__main__":
    main()

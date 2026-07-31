"""Minimal, testable Codex CLI adapter used by the phase-0 proof of concept."""

from __future__ import annotations

import json
import shutil
import subprocess
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ProviderEvent:
    type: str
    summary: str
    session_id: str | None = None


class CodexAgentProvider:
    """Keeps Codex CLI details at one application boundary."""

    def __init__(self, workspace_root: Path, executable: str = "codex") -> None:
        self.workspace_root = workspace_root.resolve()
        self.executable = executable
        self._process: subprocess.Popen[str] | None = None

    def is_available(self) -> bool:
        return shutil.which(self.executable) is not None

    def command(self, prompt: str, access_mode: str = "read_only") -> list[str]:
        if not prompt.strip():
            raise ValueError("Task prompt cannot be empty")
        if access_mode not in {"read_only", "workspace_write"}:
            raise ValueError("Unsupported access mode")
        return [
            self.executable,
            "exec",
            "--json",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only" if access_mode == "read_only" else "workspace-write",
            "--cd",
            str(self.workspace_root),
            prompt,
        ]

    def run(self, prompt: str, access_mode: str = "read_only") -> Iterator[ProviderEvent]:
        if not self.is_available():
            raise RuntimeError("Codex CLI is not available on PATH")
        self._process = subprocess.Popen(
            self.command(prompt, access_mode),
            cwd=self.workspace_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert self._process.stdout is not None
        for line in self._process.stdout:
            event = self.normalize(line)
            if event:
                yield event
        if self._process.wait() != 0:
            raise RuntimeError("Codex task failed")

    def cancel(self) -> bool:
        if self._process and self._process.poll() is None:
            self._process.terminate()
            return True
        return False

    @staticmethod
    def normalize(line: str) -> ProviderEvent | None:
        try:
            raw: dict[str, Any] = json.loads(line)
        except json.JSONDecodeError:
            return None
        event_type = str(raw.get("type", "provider.unknown"))
        payload = raw.get("item") or raw.get("payload") or {}
        if not isinstance(payload, dict):
            payload = {}
        session_id = raw.get("thread_id") or payload.get("thread_id")
        # The UI receives a safe event name, not raw model text or tool output.
        summaries = {
            "thread.started": "Sessão Codex iniciada.",
            "item.started": "Codex iniciou uma etapa.",
            "item.completed": "Codex concluiu uma etapa.",
            "turn.completed": "Codex concluiu a tarefa.",
            "turn.failed": "Codex não concluiu a tarefa.",
            "error": "Codex reportou um erro.",
        }
        return ProviderEvent(
            type=event_type,
            summary=summaries.get(event_type, "Codex atualizou a execução."),
            session_id=session_id,
        )

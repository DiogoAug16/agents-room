from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import WebSocket
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import WorkspaceEvent


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, workspace_id: str, socket: WebSocket) -> None:
        await socket.accept()
        self.connections[workspace_id].add(socket)

    def disconnect(self, workspace_id: str, socket: WebSocket) -> None:
        self.connections[workspace_id].discard(socket)

    async def broadcast(self, workspace_id: str, event: dict) -> None:
        failed: list[WebSocket] = []
        for socket in self.connections[workspace_id]:
            try:
                await socket.send_json(event)
            except Exception:
                failed.append(socket)
        for socket in failed:
            self.disconnect(workspace_id, socket)


manager = ConnectionManager()


async def emit(session: Session, workspace_id: str, event_type: str, *, source_agent_id: str | None = None, target_agent_id: str | None = None, task_id: str | None = None, payload: dict | None = None) -> dict:
    sequence = (session.scalar(select(func.max(WorkspaceEvent.sequence)).where(WorkspaceEvent.workspace_id == workspace_id)) or 0) + 1
    created_at = datetime.now(timezone.utc)
    row = WorkspaceEvent(workspace_id=workspace_id, sequence=sequence, type=event_type, source_agent_id=source_agent_id, target_agent_id=target_agent_id, task_id=task_id, payload=payload or {}, created_at=created_at)
    session.add(row)
    session.commit()
    event = {"id": row.id or str(uuid4()), "type": event_type, "workspaceId": workspace_id, "sourceAgentId": source_agent_id, "targetAgentId": target_agent_id, "taskId": task_id, "sequence": sequence, "timestamp": created_at.isoformat(), "payload": payload or {}}
    await manager.broadcast(workspace_id, event)
    return event


async def replay(session: Session, workspace_id: str, after: int) -> list[dict]:
    rows = session.scalars(select(WorkspaceEvent).where(WorkspaceEvent.workspace_id == workspace_id, WorkspaceEvent.sequence > after).order_by(WorkspaceEvent.sequence)).all()
    return [{"id": row.id, "type": row.type, "workspaceId": row.workspace_id, "sourceAgentId": row.source_agent_id, "targetAgentId": row.target_agent_id, "taskId": row.task_id, "sequence": row.sequence, "timestamp": row.created_at.isoformat(), "payload": row.payload} for row in rows]

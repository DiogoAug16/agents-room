from __future__ import annotations

from copy import deepcopy

from fastapi import HTTPException


CURRENT_LAYOUT_SCHEMA_VERSION = 4


def empty_office_layout() -> dict:
    return {"schemaVersion": CURRENT_LAYOUT_SCHEMA_VERSION, "furnitureInstances": [], "furnitureGroups": [], "agentSeatAssignments": {}}


def migrate_office_layout(layout: dict | None) -> tuple[dict, bool]:
    if not layout:
        return empty_office_layout(), False
    version = layout.get("schemaVersion", 3)
    if not isinstance(version, int) or version > CURRENT_LAYOUT_SCHEMA_VERSION:
        raise HTTPException(409, "Office layout schema is not supported")
    if version == CURRENT_LAYOUT_SCHEMA_VERSION:
        return layout, False

    migrated = deepcopy(layout)
    items = migrated.setdefault("furnitureInstances", [])
    groups = migrated.setdefault("furnitureGroups", [])
    migrated.setdefault("agentSeatAssignments", {})
    if not isinstance(items, list) or not isinstance(groups, list):
        raise HTTPException(409, "Office layout schema is invalid")
    item_by_id = {item.get("id"): item for item in items if isinstance(item, dict) and isinstance(item.get("id"), str)}
    for group in groups:
        if not isinstance(group, dict) or not isinstance(group.get("id"), str) or not isinstance(group.get("instanceIds"), list):
            raise HTTPException(409, "Office layout schema is invalid")
        for item_id in group["instanceIds"]:
            if item := item_by_id.get(item_id):
                item.setdefault("groupId", group["id"])
    migrated["schemaVersion"] = CURRENT_LAYOUT_SCHEMA_VERSION
    return migrated, True

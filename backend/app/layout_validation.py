from __future__ import annotations

from fastapi import HTTPException

from .schemas import OfficeLayoutUpdate


FURNITURE_ASSET_IDS = frozenset({
    "chair.office.black.01", "desk.work.light.01", "monitor.black.01", "sofa.blue.01",
    "plant.floor.monstera.01", "plant.desk.monstera.01", "cabinet.light.01", "shelf.bookcase.01",
    "whiteboard.diagram.01", "water.dispenser.01",
})
SEAT_ASSET_IDS = frozenset({"chair.office.black.01"})
SURFACE_ASSET_IDS = frozenset({"monitor.black.01", "plant.desk.monstera.01"})


def validate_layout(body: OfficeLayoutUpdate, agent_ids: set[str]) -> dict:
    instances = body.furniture_instances
    instance_ids = {item.id for item in instances}
    if len(instance_ids) != len(instances):
        raise HTTPException(422, "Furniture instance ids must be unique")
    if unknown_assets := {item.asset_id for item in instances} - FURNITURE_ASSET_IDS:
        raise HTTPException(422, f"Unknown furniture asset: {sorted(unknown_assets)[0]}")
    by_id = {item.id: item for item in instances}

    groups = body.furniture_groups
    group_ids = {group.id for group in groups}
    if len(group_ids) != len(groups):
        raise HTTPException(422, "Furniture group ids must be unique")
    grouped_ids: set[str] = set()
    for group in groups:
        members = set(group.instance_ids)
        if len(members) != len(group.instance_ids) or not members <= instance_ids or grouped_ids & members:
            raise HTTPException(422, "Furniture groups must reference each instance once")
        if any(by_id[member].group_id != group.id for member in members):
            raise HTTPException(422, "Furniture group membership must match each instance")
        grouped_ids.update(members)

    for item in instances:
        if item.group_id and (item.group_id not in group_ids or item.id not in next(group.instance_ids for group in groups if group.id == item.group_id)):
            raise HTTPException(422, "Furniture instance group reference is invalid")
        if item.parent_id:
            host = by_id.get(item.parent_id)
            if not host or item.asset_id not in SURFACE_ASSET_IDS or host.asset_id != "desk.work.light.01" or not item.surface_offset:
                raise HTTPException(422, "Surface furniture must attach to a desk")

    assigned_seats = list(body.agent_seat_assignments.values())
    if not set(body.agent_seat_assignments) <= agent_ids or len(assigned_seats) != len(set(assigned_seats)):
        raise HTTPException(422, "Agent seat assignments are invalid")
    if any(seat_id not in by_id or by_id[seat_id].asset_id not in SEAT_ASSET_IDS for seat_id in assigned_seats):
        raise HTTPException(422, "Agent seat assignment must reference a chair")

    return {
        "schemaVersion": body.schema_version,
        "furnitureInstances": [item.model_dump(by_alias=True, exclude_none=True) for item in instances],
        "furnitureGroups": [group.model_dump(by_alias=True) for group in groups],
        "agentSeatAssignments": body.agent_seat_assignments,
    }

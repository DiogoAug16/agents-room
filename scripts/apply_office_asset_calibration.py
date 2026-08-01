#!/usr/bin/env python3
"""Apply a JSON export from /dev/asset-editor to the office asset manifest."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from generate_office_asset_calibrations import write_catalog


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "assets/office/manifests/office-assets.json"
ORIENTATIONS = {"north_east", "north_west", "south_east", "south_west"}
CARDINAL_DIRECTIONS = {"north", "south", "east", "west"}


def point(value: Any, name: str) -> dict[str, float]:
    if not isinstance(value, dict) or not all(isinstance(value.get(axis), (int, float)) for axis in ("x", "y")):
        raise ValueError(f"{name} must contain numeric x and y")
    return {"x": value["x"], "y": value["y"]}


def target_asset(assets: list[dict[str, Any]], asset_id: str, orientation: str) -> dict[str, Any]:
    for asset in assets:
        if asset.get("id") == asset_id and asset.get("orientation", "north_east") == orientation:
            return asset
        if asset.get("variantOf") == asset_id and asset.get("orientation") == orientation:
            return asset
    raise ValueError(f"No manifest asset for {asset_id} at {orientation}")


def interaction_points(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError("interactionPoints must be a list")

    parsed: list[dict[str, Any]] = []
    for index, item in enumerate(value):
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
            raise ValueError(f"interactionPoints[{index}] must include an id")
        if type(item.get("capacity")) is not int or item["capacity"] < 1:
            raise ValueError(f"interactionPoints[{index}].capacity must be a positive integer")
        actions = item.get("actionTypes")
        if not isinstance(actions, list) or not all(isinstance(action, str) and action for action in actions):
            raise ValueError(f"interactionPoints[{index}].actionTypes must be a list of strings")
        facing = item.get("facing")
        if facing is not None and facing not in CARDINAL_DIRECTIONS:
            raise ValueError(f"interactionPoints[{index}].facing must be cardinal")
        parsed.append({
            "id": item["id"],
            "offset": point(item.get("offset"), f"interactionPoints[{index}].offset"),
            "capacity": item["capacity"],
            "actionTypes": actions,
            **({"facing": facing} if facing else {}),
        })
    return parsed


def apply_calibration(manifest: dict[str, Any], calibration: dict[str, Any]) -> dict[str, Any]:
    asset_id, orientation = calibration.get("assetId"), calibration.get("orientation")
    if not isinstance(asset_id, str) or orientation not in ORIENTATIONS:
        raise ValueError("assetId and a valid orientation are required")
    target = target_asset(manifest.get("assets", []), asset_id, orientation)
    origin = point(calibration.get("origin"), "origin")
    if not 0 <= origin["x"] <= 1 or not 0 <= origin["y"] <= 1:
        raise ValueError("origin must be normalized between 0 and 1")
    footprint = [point(item, "footprint point") for item in calibration.get("footprint", [])]
    runtime: dict[str, Any] = {
        "originNormalized": origin,
        "footprint": footprint,
        "interactionPoints": interaction_points(calibration.get("interactionPoints", [])),
    }
    if calibration.get("seat") is not None:
        seat = calibration["seat"]
        if not isinstance(seat, dict) or seat.get("facing") not in CARDINAL_DIRECTIONS:
            raise ValueError("seat must include a cardinal facing")
        runtime["seat"] = {"anchor": point(seat.get("anchor"), "seat.anchor"), "approach": point(seat.get("approach"), "seat.approach"), "offset": point(seat.get("offset"), "seat.offset"), "facing": seat["facing"]}
    target["runtime"] = runtime
    crop = target["crop"]
    target["origin"] = [round(origin["x"] * crop[2]), round(origin["y"] * crop[3])]
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("calibration", type=Path)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    calibration = json.loads(args.calibration.read_text())
    updated = apply_calibration(manifest, calibration)
    args.manifest.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n")
    write_catalog(updated)
    print(f"Applied calibration to {args.manifest}")


if __name__ == "__main__":
    main()

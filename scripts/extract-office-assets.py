#!/usr/bin/env python3
"""Extract the MVP furniture catalog from the supplied modular spritesheet.

Requires ImageMagick (`magick` or `convert`), already used only at build-time.
The checkerboard is removed by edge-connected flood fill so gray furniture pixels
that are not connected to the crop edge are preserved.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from generate_office_asset_calibrations import write_catalog


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MANIFEST = ASSETS / "office/manifests/office-assets.json"


def image_tool() -> str:
    return shutil.which("magick") or shutil.which("convert") or (_ for _ in ()).throw(RuntimeError("ImageMagick is required: install `magick` or `convert`."))


def run() -> None:
    manifest = json.loads(MANIFEST.read_text())
    tool = image_tool()
    outputs: list[str] = []
    for asset in manifest["assets"]:
        x, y, width, height = asset["crop"]
        source = ASSETS / asset["source"]
        output = ASSETS / asset["output"]
        output.parent.mkdir(parents=True, exist_ok=True)
        clear_regions = [value for region in asset.get("clearRegions", []) for value in ("-region", f"{region[2]}x{region[3]}+{region[0]}+{region[1]}", "-channel", "A", "-evaluate", "set", "0", "+channel", "+region")]
        command = [tool, str(source), "-crop", f"{width}x{height}+{x}+{y}", "+repage", "-alpha", "off", "-alpha", "on", *clear_regions, "-bordercolor", "#c3c3c3", "-border", "1", "-fuzz", "20%", "-fill", "none", "-draw", "alpha 0,0 floodfill", "-shave", "1x1", "-trim", "+repage", "-bordercolor", "none", "-border", "4", str(output)]
        subprocess.run(command, check=True)
        outputs.append(str(output.relative_to(ASSETS)))
    preview = ASSETS / "office/generated/preview.png"
    subprocess.run([tool, *[str(ASSETS / path) for path in outputs], "-thumbnail", "160x160", "-background", "#20303a", "+append", str(preview)], check=True)
    write_catalog(manifest)
    print(f"Extracted {len(outputs)} assets. Preview: {preview}")


if __name__ == "__main__":
    run()

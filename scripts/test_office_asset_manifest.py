import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class OfficeAssetManifestTests(unittest.TestCase):
    def test_assets_have_unique_ids_and_tracked_sources(self):
        manifest = json.loads((ROOT / "assets/office/manifests/office-assets.json").read_text())
        assets = manifest["assets"]
        self.assertGreaterEqual(len(assets), 15)
        self.assertEqual(len({asset["id"] for asset in assets}), len(assets))
        self.assertTrue(all((ROOT / "assets" / asset["source"]).is_file() for asset in assets))
        self.assertTrue(all(asset["output"].startswith("office/generated/") for asset in assets))
        for asset in assets:
            _, _, width, height = asset["crop"]
            for x, y, region_width, region_height in asset.get("clearRegions", []):
                self.assertGreater(region_width, 0)
                self.assertGreater(region_height, 0)
                self.assertGreaterEqual(x, 0)
                self.assertGreaterEqual(y, 0)
                self.assertLessEqual(x + region_width, width)
                self.assertLessEqual(y + region_height, height)

    def test_interaction_capacity_has_one_distinct_slot_per_agent(self):
        manifest = json.loads((ROOT / "assets/office/manifests/office-assets.json").read_text())
        for asset in manifest["assets"]:
            for point in asset.get("interactionPoints", []):
                slots = point.get("offsets", [point["offset"]])
                self.assertEqual(point["capacity"], len(slots))
                self.assertEqual(len({tuple(slot) for slot in slots}), len(slots))


if __name__ == "__main__":
    unittest.main()

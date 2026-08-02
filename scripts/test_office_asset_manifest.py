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


if __name__ == "__main__":
    unittest.main()

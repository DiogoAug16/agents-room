import unittest

from apply_office_asset_calibration import apply_calibration


class CalibrationImportTests(unittest.TestCase):
    def test_applies_to_the_requested_variant_without_changing_crop(self):
        manifest = {"assets": [{"id": "chair", "orientation": "north_east", "crop": [1, 2, 100, 200]}, {"id": "chair.se", "variantOf": "chair", "orientation": "south_east", "crop": [3, 4, 120, 220]}]}
        result = apply_calibration(manifest, {"assetId": "chair", "orientation": "south_east", "origin": {"x": .5, "y": .75}, "footprint": [{"x": 0, "y": 0}], "seat": {"anchor": {"x": 0, "y": 0}, "approach": {"x": -1, "y": 0}, "offset": {"x": -2, "y": -3}, "facing": "east"}, "interactionPoints": []})
        target = result["assets"][1]
        self.assertEqual(target["crop"], [3, 4, 120, 220])
        self.assertEqual(target["origin"], [60, 165])
        self.assertEqual(target["runtime"]["seat"]["facing"], "east")

    def test_rejects_unknown_orientation(self):
        with self.assertRaises(ValueError):
            apply_calibration({"assets": []}, {"assetId": "chair", "orientation": "up", "origin": {"x": 0, "y": 0}, "footprint": []})

    def test_rejects_invalid_interaction_point(self):
        manifest = {"assets": [{"id": "chair", "orientation": "north_east", "crop": [0, 0, 100, 100]}]}
        calibration = {
            "assetId": "chair",
            "orientation": "north_east",
            "origin": {"x": 0, "y": 0},
            "footprint": [],
            "interactionPoints": [{"id": "coffee", "offset": {"x": 0, "y": 0}, "capacity": 0, "actionTypes": ["idle"]}],
        }
        with self.assertRaises(ValueError):
            apply_calibration(manifest, calibration)


if __name__ == "__main__":
    unittest.main()

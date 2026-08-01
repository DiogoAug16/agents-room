import unittest

from generate_office_asset_calibrations import calibration_data


class GeneratedCalibrationsTests(unittest.TestCase):
    def test_groups_a_variant_calibration_under_its_base_asset(self):
        result = calibration_data({"assets": [{"id": "chair.se", "variantOf": "chair", "orientation": "south_east", "runtime": {"seat": {"facing": "east"}}}]})
        self.assertEqual(result, {"chair": {"south_east": {"seat": {"facing": "east"}}}})

    def test_omits_uncalibrated_assets(self):
        self.assertEqual(calibration_data({"assets": [{"id": "chair"}]}), {})


if __name__ == "__main__":
    unittest.main()

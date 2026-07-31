import tempfile
import unittest
from pathlib import Path

from app.security import path_in_workspace


class WorkspacePathTests(unittest.TestCase):
    def test_accepts_a_path_under_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(path_in_workspace(str(root), str(root / "src")), (root / "src").resolve())

    def test_rejects_a_path_outside_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                path_in_workspace(directory, "/private/tmp/outside-workspace")

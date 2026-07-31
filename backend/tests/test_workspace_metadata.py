import subprocess
import unittest
from unittest.mock import patch

from app.workspace_metadata import current_git_branch


class WorkspaceMetadataTests(unittest.TestCase):
    @patch("app.workspace_metadata.subprocess.run")
    def test_returns_the_local_git_branch(self, run) -> None:
        run.return_value = subprocess.CompletedProcess([], 0, "main\n", "")
        self.assertEqual(current_git_branch("/workspace"), "main")
        self.assertEqual(run.call_args.kwargs["timeout"], 1)

    @patch("app.workspace_metadata.subprocess.run", side_effect=OSError)
    def test_hides_unavailable_git_metadata(self, _) -> None:
        self.assertIsNone(current_git_branch("/workspace"))


if __name__ == "__main__":
    unittest.main()

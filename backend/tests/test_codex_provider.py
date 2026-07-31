import unittest
from pathlib import Path
from unittest.mock import Mock

from app.codex_provider import CodexAgentProvider


class CodexAgentProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = CodexAgentProvider(Path.cwd(), executable="codex-test")

    def test_builds_a_read_only_non_interactive_command(self) -> None:
        command = self.provider.command("liste os arquivos")
        self.assertEqual(command[:4], ["codex-test", "exec", "--json", "--ephemeral"])
        self.assertIn("read-only", command)
        self.assertIn("--skip-git-repo-check", command)
        self.assertEqual(command[-1], "liste os arquivos")

    def test_rejects_blank_prompt(self) -> None:
        with self.assertRaises(ValueError):
            self.provider.command("  ")

    def test_rejects_unsafe_access_mode(self) -> None:
        with self.assertRaises(ValueError):
            self.provider.command("liste os arquivos", "full_access")

    def test_normalizes_events_without_exposing_model_text(self) -> None:
        event = self.provider.normalize(
            '{"type":"item.completed","thread_id":"session-1","item":{"text":"secret"}}'
        )
        self.assertEqual(event.type, "item.completed")
        self.assertEqual(event.summary, "Codex concluiu uma etapa.")
        self.assertEqual(event.session_id, "session-1")
        self.assertNotIn("secret", event.summary)

    def test_ignores_non_json_output(self) -> None:
        self.assertIsNone(self.provider.normalize("warning from terminal"))

    def test_cancels_a_running_process(self) -> None:
        process = Mock()
        process.poll.return_value = None
        self.provider._process = process
        self.assertTrue(self.provider.cancel())
        process.terminate.assert_called_once()


if __name__ == "__main__":
    unittest.main()

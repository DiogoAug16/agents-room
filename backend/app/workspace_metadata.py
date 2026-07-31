from pathlib import Path
import subprocess


def current_git_branch(project_root: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=Path(project_root),
            capture_output=True,
            check=False,
            text=True,
            timeout=1,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    branch = result.stdout.strip()
    return branch or None

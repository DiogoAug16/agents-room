from pathlib import Path


def path_in_workspace(project_root: str, candidate: str) -> Path:
    root = Path(project_root).resolve()
    resolved = Path(candidate).resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError("Path is outside the authorized workspace")
    return resolved

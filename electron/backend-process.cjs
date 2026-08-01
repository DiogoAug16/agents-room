const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

function backendCommand(root) {
  const python = process.platform === "win32" ? path.join(root, "backend", ".venv", "Scripts", "python.exe") : path.join(root, "backend", ".venv", "bin", "python");
  return { command: python, args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], cwd: path.join(root, "backend") };
}

function startBackend(root) {
  const config = backendCommand(root);
  const migration = spawnSync(config.command, ["-m", "alembic", "upgrade", "head"], { cwd: config.cwd, env: { ...process.env, PYTHONPATH: "." }, encoding: "utf8" });
  if (migration.status !== 0) throw new Error(`A migração local falhou: ${migration.stderr || migration.stdout || "erro desconhecido"}`);
  return spawn(config.command, config.args, { cwd: config.cwd, stdio: "ignore", env: { ...process.env, PYTHONPATH: "." } });
}

module.exports = { backendCommand, startBackend };

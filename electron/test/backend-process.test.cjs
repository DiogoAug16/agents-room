const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { backendCommand } = require("../backend-process.cjs");

test("uses the project virtualenv and localhost-only backend", () => {
  const command = backendCommand("/workspace/agents-room");
  assert.equal(command.cwd, "/workspace/agents-room/backend");
  assert.ok(command.command.endsWith(path.join("backend", ".venv", "bin", "python")));
  assert.deepEqual(command.args.slice(-4), ["--host", "127.0.0.1", "--port", "8000"]);
});

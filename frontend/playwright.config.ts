import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const database = join(tmpdir(), `agents-room-e2e-${process.pid}.db`);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: ".venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000", cwd: "../backend", env: { ...process.env, AGENTS_ROOM_DATABASE_URL: `sqlite:///${database}`, PYTHONPATH: "." }, url: "http://127.0.0.1:8000/health", reuseExistingServer: false },
    { command: "npm run dev", url: "http://127.0.0.1:5173", reuseExistingServer: false },
  ],
});

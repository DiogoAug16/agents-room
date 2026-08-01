import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const database = join(tmpdir(), `agents-room-e2e-${process.pid}.db`);
const backendUrl = "http://127.0.0.1:8010";
const frontendUrl = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  reporter: "list",
  use: { baseURL: frontendUrl, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: [
    { command: ".venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010", cwd: "../backend", env: { ...process.env, AGENTS_ROOM_DATABASE_URL: `sqlite:///${database}`, PYTHONPATH: "." }, url: `${backendUrl}/health`, reuseExistingServer: false },
    { command: "npm run dev -- --host 127.0.0.1 --port 5174", env: { ...process.env, VITE_BACKEND_URL: backendUrl }, url: frontendUrl, reuseExistingServer: false },
  ],
});

import { expect, test, type Page } from "@playwright/test";

async function openPanel(page: Page, name: string) {
  await page.getByLabel(name).click();
}

async function selectAgent(page: Page, name = "Ana") {
  if (!await page.getByRole("heading", { name: "Agentes" }).isVisible()) await openPanel(page, "Agentes");
  await page.locator(".workspace-drawer").getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("keeps the scene visible while drawers open and close", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveCount(1);

  await openPanel(page, "Agentes");
  await expect(page.getByRole("heading", { name: "Agentes" })).toBeVisible();
  await openPanel(page, "Tarefas");
  await expect(page.getByRole("heading", { name: "Tarefas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agentes" })).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Tarefas" })).toBeHidden();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.getByRole("heading", { name: "Ações rápidas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Ações rápidas" })).toBeHidden();
});

test("creates an agent and manages skills from contextual panels", async ({ page }) => {
  await page.goto("/");
  await openPanel(page, "Agentes");
  await page.getByRole("button", { name: "+ Agente" }).last().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Carla");
  await dialog.getByLabel("Função").fill("QA");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Carla/ })).toBeVisible();

  await selectAgent(page);
  await openPanel(page, "Skills e plugins");
  await page.getByLabel("Buscar skills").fill("Testes");
  await page.getByRole("button", { name: /Testes Qualidade/ }).click();
  await page.getByText("Estação e capacidades", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
});

test("sends a task and keeps approvals in the task drawer", async ({ page }) => {
  await page.goto("/");
  await selectAgent(page);
  await openPanel(page, "Tarefas");
  await page.getByLabel("Permissão da próxima tarefa").selectOption("workspace_write");
  await page.getByPlaceholder("Descreva uma tarefa…").fill("Revise a configuração local.");
  await page.getByRole("button", { name: "Enviar ao Codex" }).click();
  await expect(page.getByText("APROVAÇÕES")).toBeVisible();
  const reject = page.getByRole("button", { name: "Rejeitar" });
  if (await reject.count()) await reject.first().click();

  await page.getByText("Interagir", { exact: true }).click();
  await page.getByLabel("Agente de destino").selectOption({ index: 1 });
  await page.getByLabel("Resumo da interação").fill("Solicitando revisão E2E.");
  await page.getByRole("button", { name: "Solicitar interação" }).click();
  await openPanel(page, "Atividade");
  await expect(page.locator(".activity-list li").filter({ hasText: "Solicitando revisão E2E." }).first()).toBeVisible();
});

test("builds, clears and restores modular furniture without leaving edit mode controls visible", async ({ page }) => {
  await page.goto("/");
  await selectAgent(page);
  await page.locator(".side-rail").getByLabel("Modo edição").click();
  await expect(page.getByText("Modo edição")).toBeVisible();
  await openPanel(page, "Galeria de móveis");
  await page.getByRole("button", { name: "Estação dupla" }).click();
  await expect(page.getByLabel("Inspector do grupo")).toContainText("Estação");
  await page.getByRole("button", { name: "Divisória", exact: true }).click();
  await openPanel(page, "Atividade");
  await expect(page.getByText("Divisória setorial criada.")).toBeVisible();

  await page.locator(".side-rail").getByLabel("Modo edição").click();
  await expect(page.getByText("Modo edição")).toBeHidden();
});

test("opens the development asset calibration editor", async ({ page }) => {
  await page.goto("/dev/asset-editor");
  await expect(page.getByRole("heading", { name: "Cadeira executiva" })).toBeVisible();
  await page.getByLabel("Orientação").selectOption("south_east");
  await expect(page.getByLabel("Assento · Direção")).toHaveValue("east");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
});

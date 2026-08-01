import { expect, test } from "@playwright/test";

test("validates agent creation and switches room modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("2/8 agentes")).toBeVisible();

  await page.getByRole("button", { name: "+ Agente" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("A");
  await dialog.getByLabel("Função").fill("QA");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog.getByText("Informe ao menos 2 caracteres")).toBeVisible();

  await dialog.getByLabel("Nome").fill("Carla");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("3/8 agentes")).toBeVisible();

  await page.getByRole("button", { name: "Editar sala" }).click();
  await expect(page.getByText("Modo edição: arraste agentes para mover a estação")).toBeVisible();
  await page.getByRole("button", { name: "Concluir edição" }).click();
  await expect(page.getByText("Modo operação")).toBeVisible();
});

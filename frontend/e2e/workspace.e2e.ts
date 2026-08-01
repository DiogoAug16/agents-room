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

  await page.getByLabel("Agente selecionado").selectOption({ label: "Ana · Engenharia" });
  await expect(page.locator(".inspector").getByRole("heading", { name: "Ana" })).toBeVisible();
  await page.getByRole("button", { name: "FastAPI Backend · APIs locais tipadas · workspace_write", exact: true }).click();
  await expect(page.locator(".inspector").getByRole("button", { name: "Pausar" })).toBeVisible();
  await page.getByRole("button", { name: "Arrastar Testes" }).dragTo(page.locator(".inspector .skill-list").first());
  await expect(page.locator(".inspector").getByRole("button", { name: "Pausar" })).toHaveCount(2);
  await page.getByLabel("Buscar skills").fill("Interface");
  await expect(page.getByRole("button", { name: "Interface Frontend · Fluxos React e acessibilidade · workspace_write", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "FastAPI Backend · APIs locais tipadas · workspace_write", exact: true })).toBeHidden();
  await page.getByLabel("Buscar skills").fill("Testes");
  await page.getByLabel("Filtrar skills por categoria").selectOption("Qualidade");
  await expect(page.getByRole("button", { name: "Testes Qualidade · Testes e regressões · read_only", exact: true })).toBeVisible();

  await page.getByLabel("Permissão da próxima tarefa").selectOption("workspace_write");
  await page.getByPlaceholder("Descreva uma tarefa…").fill("Revise a configuração local.");
  await page.getByRole("button", { name: "Enviar ao Codex" }).click();
  const reject = page.getByRole("button", { name: "Rejeitar" });
  await expect(reject).toBeVisible();
  await page.getByPlaceholder("Descreva uma tarefa…").fill("Segunda tarefa bloqueada.");
  await page.getByRole("button", { name: "Enviar ao Codex" }).click();
  await expect(page.getByRole("alert")).toHaveText("O agente já possui uma tarefa ativa.×");
  await reject.click();
  await expect(reject).toBeHidden();

  await page.getByLabel("Agente de destino").selectOption({ label: "Bruno · Qualidade" });
  await page.getByLabel("Resumo da interação").fill("Solicitando revisão E2E.");
  await page.getByRole("button", { name: "Solicitar interação" }).click();
  await expect(page.locator(".event-panel li").filter({ hasText: "Solicitando revisão E2E." }).first()).toBeVisible();

  await page.getByRole("button", { name: "Editar sala" }).click();
  await expect(page.getByText("Modo edição: arraste agentes para mover a estação")).toBeVisible();
  await page.getByRole("button", { name: "Concluir edição" }).click();
  await expect(page.getByText("Modo operação")).toBeVisible();
});

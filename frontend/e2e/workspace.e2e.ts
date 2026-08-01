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
  await page.getByRole("button", { name: /Testes Qualidade/ }).click();
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

test("assigns a modular chair to the selected agent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: /Cadeira executiva/ }).click();
  await expect(page.getByText("Posicionando Cadeira executiva · north_east: clique no piso · setas ajustam · Shift acelera · R rotaciona · Esc cancela")).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByText("Posicionando Cadeira executiva · south_east: clique no piso · setas ajustam · Shift acelera · R rotaciona · Esc cancela")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.locator("canvas").click({ position: { x: 630, y: 450 } });
  const chair = page.getByLabel("Cadeira principal");
  await expect(chair.locator("option")).toHaveCount(2);
  await chair.selectOption({ index: 1 });
  await expect(chair).not.toHaveValue("");
  await page.getByRole("button", { name: /Bebedouro/ }).click();
  await expect(page.getByText("Posicionando Bebedouro · north_east: clique no piso · setas ajustam · Shift acelera · R rotaciona · Esc cancela")).toBeVisible();
  await page.locator("canvas").click({ position: { x: 650, y: 420 } });
  await expect(page.getByRole("button", { name: /Bebedouro.*1 na sala/ })).toBeVisible();
});

test("builds a grouped workstation for the selected agent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Montar estação" }).click();
  const chair = page.getByLabel("Cadeira principal");
  await expect(chair.locator("option")).toHaveCount(2);
  await expect(chair).not.toHaveValue("");
  const rotate = page.getByRole("button", { name: "Rotacionar" });
  await expect(rotate).toBeEnabled();
  await rotate.click();
  await page.getByRole("button", { name: /Planta de mesa/ }).click();
  await expect(page.getByRole("button", { name: /Planta de mesa.*1 na sala/ })).toBeVisible();
});

test("builds a lounge preset with a modular sofa", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Montar lounge" }).click();
  await expect(page.getByRole("button", { name: /Sofá azul.*1 na sala/ })).toBeVisible();
  await expect(page.getByText("Lounge com dois assentos criado.")).toBeVisible();
});

test("opens the development asset calibration editor", async ({ page }) => {
  await page.goto("/dev/asset-editor");
  await expect(page.getByRole("heading", { name: "Cadeira executiva" })).toBeVisible();
  await page.getByLabel("Orientação").selectOption("south_east");
  await expect(page.getByLabel("Direção do assento")).toHaveValue("east");
  await expect(page.getByLabel("Início da oclusão frontal")).toHaveValue("0.58");
  await expect(page.getByRole("button", { name: "Exportar JSON" })).toBeVisible();
});

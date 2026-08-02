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

test("builds a dual-monitor workstation for the selected agent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Limpar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Limpar sala" }).click();
  await page.getByRole("button", { name: "Montar estação dupla" }).click();
  await expect(page.getByRole("button", { name: /Monitor \+ teclado.*2 na sala/ })).toBeVisible();
  await expect(page.getByLabel("Membros do grupo").getByText("Monitor + teclado", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Estação com dois monitores criada para Ana.")).toBeVisible();
});

test("builds a grouped workstation for the selected agent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Limpar" }).click();
  const clearDialog = page.getByRole("dialog");
  await expect(clearDialog.getByRole("heading", { name: "Limpar escritório?" })).toBeVisible();
  await clearDialog.getByRole("button", { name: "Limpar sala" }).click();
  await page.getByRole("button", { name: "Montar estação", exact: true }).click();
  const chair = page.getByLabel("Cadeira principal");
  await expect(chair.locator("option")).toHaveCount(2);
  await expect(chair).not.toHaveValue("");
  await expect(page.getByLabel("Inspector do móvel")).toContainText("Mesa de trabalho");
  await expect(page.getByLabel("Inspector do móvel")).toContainText("Orientação");
  await expect(page.getByLabel("Membros do grupo")).toContainText("Mesa de trabalho");
  await expect(page.getByLabel("Membros do grupo")).toContainText("Monitor + teclado");
  await expect(page.getByLabel("Inspector do grupo").getByText("CADEIRA ASSOCIADA")).toBeVisible();
  await expect(page.getByLabel("Inspector do grupo")).toContainText("Cadeira executiva");
  await page.getByRole("button", { name: /Planta de mesa/ }).click();
  await expect(page.getByLabel("Membros do grupo")).toContainText("Planta de mesa");
  await page.getByRole("button", { name: "Focar cadeira Cadeira executiva" }).click();
  await expect(page.locator(".event-panel li").filter({ hasText: "Cadeira Cadeira executiva em foco." }).first()).toBeVisible();
  await page.getByLabel("Agente selecionado").selectOption({ label: "Bruno · Qualidade" });
  await page.getByRole("button", { name: "Selecionar Ana · Engenharia" }).click();
  await expect(page.locator(".inspector").getByRole("heading", { name: "Ana" })).toBeVisible();
  await page.getByLabel("Agente selecionado").selectOption({ label: "Bruno · Qualidade" });
  await page.locator("canvas").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Enter");
  await expect(page.locator(".inspector").getByRole("heading", { name: "Ana" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir" }).click();
  const deleteDialog = page.getByRole("dialog");
  await expect(deleteDialog.getByRole("heading", { name: "Remover móvel em uso?" })).toBeVisible();
  await expect(deleteDialog).toContainText("perderá a estação ou assento associado.");
  await deleteDialog.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByRole("button", { name: /Mesa de trabalho.*2 na sala/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cadeira executiva.*2 na sala/ })).toBeVisible();
  const ungroup = page.getByRole("button", { name: "Desagrupar" });
  await expect(ungroup).toBeEnabled();
  await ungroup.click();
  await expect(ungroup).toBeDisabled();
  const rotate = page.getByRole("button", { name: "Rotacionar" });
  await expect(rotate).toBeEnabled();
  await rotate.click();
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByRole("button", { name: /Mesa de trabalho.*3 na sala/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Planta de mesa.*3 na sala/ })).toBeVisible();
});

test("builds a lounge preset with a modular sofa", async ({ page }) => {
  await page.goto("/");
  const agentCount = await page.getByLabel("Agente selecionado").locator("option").count() - 1;
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Montar lounge" }).click();
  await expect(page.getByRole("button", { name: /Sofá azul.*1 na sala/ })).toBeVisible();
  await expect(page.getByText("Lounge com dois assentos criado.")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Restaurar layout padrão?" })).toBeVisible();
  await expect(dialog).toContainText("Isso substituirá");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: /Sofá azul.*1 na sala/ })).toBeVisible();
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  await dialog.getByRole("button", { name: "Restaurar padrão" }).click();
  await expect(page.getByText("Layout padrão restaurado para os agentes atuais.")).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`Cadeira executiva.*${agentCount} na sala`) })).toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(dialog.getByRole("heading", { name: "Limpar escritório?" })).toBeVisible();
  await expect(dialog).toContainText("Isso removerá");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Cadeira executiva.*${agentCount} na sala`) })).toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  await dialog.getByRole("button", { name: "Limpar sala" }).click();
  await expect(page.getByRole("button", { name: /Cadeira executiva.*0 na sala/ })).toBeVisible();
});

test("builds a modular meeting area", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Limpar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Limpar sala" }).click();
  await page.getByRole("button", { name: "Montar reunião" }).click();
  await expect(page.getByRole("button", { name: /Mesa de reunião em L.*1 na sala/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cadeira executiva.*1 na sala/ })).toBeVisible();
  await expect(page.getByText("Área de reunião com dois assentos criada.")).toBeVisible();
  await expect(page.getByLabel("Inspector do grupo")).toContainText("Reunião");
  await page.getByRole("button", { name: "Rotacionar" }).click();
  await expect(page.getByLabel("Inspector do móvel")).toContainText("south_east");
});

test("rotates a glass divider using a supplied orientation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: /Divisória de vidro/ }).click();
  await expect(page.getByText("Posicionando Divisória de vidro · north_east: clique no piso · setas ajustam · Shift acelera · R rotaciona · Esc cancela")).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByText("Posicionando Divisória de vidro · south_east: clique no piso · setas ajustam · Shift acelera · R rotaciona · Esc cancela")).toBeVisible();
});

test("builds a modular break area", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Limpar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Limpar sala" }).click();
  await page.getByRole("button", { name: "Montar pausa" }).click();
  await expect(page.getByRole("button", { name: /Estação de café.*1 na sala/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bebedouro.*1 na sala/ })).toBeVisible();
  await expect(page.getByText("Área de pausa com café e água criada.")).toBeVisible();
  await expect(page.getByLabel("Inspector do grupo")).toContainText("Pausa");
});

test("builds a sector partition", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Editar sala" }).click();
  await page.getByRole("button", { name: "Limpar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Limpar sala" }).click();
  await page.getByRole("button", { name: "Montar divisória" }).click();
  await expect(page.getByRole("button", { name: /Divisória de vidro.*1 na sala/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Jardineira divisória.*1 na sala/ })).toBeVisible();
  await expect(page.getByText("Divisória setorial criada.")).toBeVisible();
  await expect(page.getByLabel("Inspector do grupo")).toContainText("Setor");
});

test("opens the development asset calibration editor", async ({ page }) => {
  await page.goto("/dev/asset-editor");
  await expect(page.getByRole("heading", { name: "Cadeira executiva" })).toBeVisible();
  await page.getByLabel("Orientação").selectOption("south_east");
  await expect(page.getByLabel("Assento · Direção")).toHaveValue("east");
  await expect(page.getByLabel("Início da oclusão frontal")).toHaveValue("0.58");
  await expect(page.getByRole("button", { name: "Exportar JSON" })).toBeVisible();
  await page.getByLabel("Asset").selectOption({ label: "Sofá azul" });
  await expect(page.getByLabel("Assentos do sofá")).toBeVisible();
  await expect(page.getByLabel("Assento left · Aproximação x")).toHaveValue("0");
  await expect(page.getByLabel("Assento right · Direção")).toHaveValue("south");
  await expect(page.getByLabel("Início da oclusão frontal")).toHaveValue("0.5");
});

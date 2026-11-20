import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("cadastro, configuração da empresa e encerramento da sessão no navegador", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa de Teste");
  await page.getByLabel("E-mail").fill(`e2e-${randomUUID()}@flux.test`);
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
  await page.getByLabel("Nome da empresa").fill("Distribuidora de Teste");
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page.getByText("Distribuidora de Teste · Proprietário")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Distribuidora de Teste · Proprietário")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("cadastros operacionais, observação e anexo no navegador", async ({ page }) => {
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Analista de Teste");
  await page.getByLabel("E-mail").fill(`directory-${randomUUID()}@flux.test`);
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Nome da empresa").fill("Serviços Técnicos Teste");
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page.getByText("Serviços Técnicos Teste · Proprietário")).toBeVisible();
  await page.getByRole("link", { name: "Cadastros" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente da Flux");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.getByText("Cliente da Flux", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Observações e anexos", exact: true }).click();
  await page.getByLabel("Observação", { exact: true }).fill("Atendimento de teste.");
  await page.getByRole("button", { name: "Adicionar observação" }).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "Atendimento de teste." }),
  ).toBeVisible();
  await page.getByLabel("Arquivo (até 5 MB)").setInputFiles({
    name: "vistoria.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("dados de teste"),
  });
  await page.getByRole("button", { name: "Enviar anexo" }).click();
  await expect(page.getByText("vistoria.txt · 1 KB")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar anexo" }).click();
  expect((await downloaded).suggestedFilename()).toBe("vistoria.txt");
});

test("orçamento no navegador, PDF e conversão", async ({ page }) => {
  await page.goto("/conta");
  const email = `quote-${randomUUID()}@flux.test`;
  const password = "senha-de-teste-123";
  const request = page.request;
  const headers = { Origin: new URL(page.url()).origin };
  await request.post("/api/v1/auth/register", {
    headers,
    data: { email, password, name: "Projetista Teste" },
  });
  await request.post("/api/v1/auth/login", { headers, data: { email, password } });
  const company = await request.post("/api/v1/organizations", {
    headers,
    data: { name: "Projetos Industriais" },
  });
  expect(company.status()).toBe(201);
  const { id } = await company.json();
  await request.post(`/api/v1/organizations/${id}/directory/CUSTOMER`, {
    headers,
    data: { name: "Cliente do Orçamento" },
  });
  await request.post(`/api/v1/organizations/${id}/directory/PRODUCT`, {
    headers,
    data: { name: "Peça ABC", priceCents: 10_000 },
  });
  await page.goto("/orcamentos");
  const form = page.getByRole("heading", { name: "Novo orçamento" }).locator("..");
  await form.getByLabel("Título", { exact: true }).fill("Orçamento de substituição");
  await form.getByLabel("Cliente", { exact: true }).selectOption({ label: "Cliente do Orçamento" });
  await form.getByLabel("Item do catálogo", { exact: true }).selectOption({ label: "Peça ABC" });
  await form.getByLabel("Quantidade").fill("2");
  await form.getByLabel("Desconto (R$)").fill("20");
  await form.getByRole("button", { name: "Criar orçamento" }).click();
  await expect(page.getByRole("heading", { name: "Orçamento de substituição" })).toBeVisible();
  await expect(page.getByText(/Total R\$\s*180,00/)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF" }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^orcamento-.*\.pdf$/);
  await page.getByRole("button", { name: "Marcar como enviado" }).click();
  await page.getByRole("button", { name: "Aprovar orçamento" }).click();
  await page.getByRole("button", { name: "Gerar ordem de serviço" }).click();
  await expect(page.getByText(/Ordem de serviço criada/)).toBeVisible();
});

test("ordem no navegador com checklist e relatório final", async ({ page }) => {
  await page.goto("/conta");
  const email = `order-${randomUUID()}@flux.test`;
  const password = "senha-de-teste-123";
  const request = page.request;
  const headers = { Origin: new URL(page.url()).origin };
  await request.post("/api/v1/auth/register", {
    headers,
    data: { email, password, name: "Pessoa Técnica" },
  });
  await request.post("/api/v1/auth/login", { headers, data: { email, password } });
  const company = await request.post("/api/v1/organizations", {
    headers,
    data: { name: "Indústria de Serviço" },
  });
  expect(company.status()).toBe(201);
  const { id } = await company.json();
  await request.post(`/api/v1/organizations/${id}/directory/CUSTOMER`, {
    headers,
    data: { name: "Cliente Técnico" },
  });
  await page.goto("/ordens");
  await page.getByLabel("Título da ordem", { exact: true }).fill("Montagem industrial");
  await page.getByLabel("Cliente", { exact: true }).selectOption({ label: "Cliente Técnico" });
  await page.getByLabel("Prioridade da ordem").selectOption("HIGH");
  await page.getByLabel("Responsável").selectOption({ label: "Pessoa Técnica" });
  await page.getByRole("button", { name: "Criar ordem" }).click();
  await page.getByLabel("Tarefa", { exact: true }).fill("Conferir equipamento");
  await page.getByRole("button", { name: "Adicionar item ao checklist" }).click();
  await page.getByRole("button", { name: "Marcar como feito" }).click();
  await expect(page.getByText("Conferir equipamento · Feito")).toBeVisible();
  await page.getByLabel("Novo status", { exact: true }).selectOption("completed");
  await page.getByLabel("Relatório de conclusão", { exact: true }).fill("Montagem registrada.");
  await page.getByRole("button", { name: "Atualizar status" }).click();
  await expect(page.getByRole("heading", { name: "Relatório de conclusão" })).toBeVisible();
  await expect(page.getByText("Montagem registrada.", { exact: true })).toBeVisible();
  await page.getByText("Histórico de alterações", { exact: true }).click();
  await expect(page.getByText("Aberta → Concluída", { exact: true })).toBeVisible();
});

test("painel reflete indicadores e módulos alterados por empresa", async ({ page }) => {
  await page.goto("/conta");
  const email = `dashboard-${randomUUID()}@flux.test`;
  const password = "senha-de-teste-123";
  const request = page.request;
  const headers = { Origin: new URL(page.url()).origin };
  await request.post("/api/v1/auth/register", {
    headers,
    data: { email, password, name: "Gestão do Painel" },
  });
  await request.post("/api/v1/auth/login", { headers, data: { email, password } });
  const company = await request.post("/api/v1/organizations", {
    headers,
    data: { name: "Empresa do Painel" },
  });
  expect(company.status()).toBe(201);
  const { id } = await company.json();
  const customer = await request.post(`/api/v1/organizations/${id}/directory/CUSTOMER`, {
    headers,
    data: { name: "Cliente do Painel" },
  });
  const order = await request.post(`/api/v1/organizations/${id}/orders`, {
    headers,
    data: {
      name: "Ordem com prazo",
      customerId: (await customer.json()).id,
      priority: "HIGH",
      dueAt: "2020-01-01T12:00:00Z",
    },
  });
  expect(order.status()).toBe(201);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Ordem com prazo" })).toBeVisible();
  await page.getByLabel("Até", { exact: true }).fill("2000-01-01");
  await page.getByRole("button", { name: "Filtrar período" }).click();
  await expect(page.getByText("Sem prazos no período.")).toBeVisible();
  await page.getByText("Personalizar empresa", { exact: true }).click();
  await page.getByLabel("Nome de exibição").fill("Marca Flux Teste");
  await page.getByLabel("Cor de destaque").fill("#663399");
  await page.getByRole("checkbox", { name: "Ordens de serviço" }).uncheck();
  await page.getByRole("button", { name: "Salvar personalização" }).click();
  await expect(page.getByText("Personalização salva.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prazos das ordens abertas" })).toHaveCount(0);
  await page.getByRole("link", { name: "Ordens de serviço", exact: true }).click();
  await expect(
    page.getByText("Este módulo está desabilitado para a empresa selecionada."),
  ).toBeVisible();
});

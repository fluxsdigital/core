const { NestFactory } = require("@nestjs/core");
const { SMTPServer } = require("smtp-server");
const { randomUUID } = require("node:crypto");
require("dotenv/config");
require("reflect-metadata");

const { AppModule } = require("../dist/app.module");
const { configureApp } = require("../dist/configure-app");

let app;
let smtp;
let base;
let delivered;
const origin = "http://127.0.0.1:3000";
const password = "uma-senha-forte-123";
const newPassword = "outra-senha-forte-456";

async function request(path, { method = "GET", cookies, body, requestOrigin = origin } = {}) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(cookies ? { Cookie: cookies } : {}),
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const tokens = response.headers.getSetCookie();
  return {
    status: response.status,
    data: await response.json().catch(() => undefined),
    cookies: tokens.map((line) => line.split(";")[0]).join("; "),
    tokens,
  };
}

beforeEach(async () => {
  delivered = undefined;
  process.env.APP_ORIGIN = origin;
  process.env.JWT_SECRET = "flux-test-key-for-local-integration-only";
  process.env.MAIL_FROM = "nao-responda@flux.test";
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, _session, callback) {
      let message = "";
      stream.setEncoding("utf8");
      stream.on("data", (piece) => {
        message += piece;
      });
      stream.on("end", () => {
        delivered = message;
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(0, "127.0.0.1", resolve);
  });
  process.env.SMTP_URL = `smtp://127.0.0.1:${smtp.server.address().port}`;
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

afterEach(async () => {
  if (app) await app.close();
  if (smtp) await new Promise((resolve) => smtp.close(resolve));
});

test("registra, autentica, associa membros e mantém sessões revogáveis", async () => {
  const email = `owner-${randomUUID()}@flux.test`;
  const otherEmail = `operator-${randomUUID()}@flux.test`;
  expect((await request("auth/me")).status).toBe(401);
  expect(
    (
      await request("auth/register", {
        method: "POST",
        requestOrigin: "https://foreign.test",
        body: { email, password, name: "Gestora" },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request("auth/register", {
        method: "POST",
        body: { email, password: "short", name: "Gestora" },
      })
    ).status,
  ).toBe(400);
  const registered = await request("auth/register", {
    method: "POST",
    body: { email, password, name: "Gestora" },
  });
  expect(registered.status).toBe(201);
  expect(registered.data).not.toHaveProperty("passwordHash");

  const other = await request("auth/register", {
    method: "POST",
    body: { email: otherEmail, password, name: "Operadora" },
  });
  expect(other.status).toBe(201);
  const signIn = (address) =>
    request("auth/login", { method: "POST", body: { email: address, password } });
  const login = await signIn(email);
  expect(login.status).toBe(204);
  expect(
    login.tokens.every(
      (cookie) => cookie.includes("HttpOnly") && cookie.includes("SameSite=Strict"),
    ),
  ).toBe(true);

  const { cookies } = login;
  const organization = await request("organizations", {
    method: "POST",
    cookies,
    body: { name: "Indústria Teste" },
  });
  expect(organization.status).toBe(201);
  const id = organization.data.id;

  const operator = await signIn(otherEmail);
  expect((await request("organizations", operator)).data).toEqual([]);
  expect(
    (
      await request(`organizations/${id}`, {
        ...operator,
        method: "PATCH",
        body: { name: "Indústria" },
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(`organizations/${id}/members`, {
        cookies,
        method: "POST",
        body: { userId: other.data.id, role: "OPERATOR" },
      })
    ).status,
  ).toBe(201);
  expect((await request("organizations", operator)).data).toEqual([
    expect.objectContaining({ id, role: "OPERATOR" }),
  ]);
  expect((await request(`organizations/${id}/members`, operator)).status).toBe(403);
  expect(
    (
      await request(`organizations/${id}`, {
        cookies,
        method: "PATCH",
        body: { name: "Indústria Atualizada" },
      })
    ).status,
  ).toBe(200);
  expect(
    (await request("auth/me", { cookies, method: "PATCH", body: { name: "Nome atualizado" } })).data
      .name,
  ).toBe("Nome atualizado");

  const renewed = await request("auth/refresh", { cookies, method: "POST" });
  expect(renewed.status).toBe(204);
  expect(renewed.cookies).not.toEqual(cookies);
  expect((await request("auth/refresh", { cookies, method: "POST" })).status).toBe(401);

  const second = await signIn(email);
  const sessions = (await request("auth/sessions", renewed)).data;
  expect(sessions).toHaveLength(2);
  const secondId = sessions.find((session) => !session.current).id;
  expect(
    (
      await request(`auth/sessions/${secondId}/revoke`, {
        cookies: renewed.cookies,
        method: "POST",
      })
    ).status,
  ).toBe(204);
  expect((await request("auth/me", second)).status).toBe(401);
  expect((await request("auth/logout", { cookies: renewed.cookies, method: "POST" })).status).toBe(
    204,
  );
  expect((await request("auth/me", renewed)).status).toBe(401);
});

test("envia reset por SMTP local, consome o link uma vez e revoga sessões", async () => {
  const email = `reset-${randomUUID()}@flux.test`;
  await request("auth/register", {
    method: "POST",
    body: { email, password, name: "Recuperação" },
  });
  const login = (value) =>
    request("auth/login", { method: "POST", body: { email, password: value } });
  const prior = await login(password);
  expect(prior.status).toBe(204);

  expect((await request("auth/forgot-password", { method: "POST", body: { email } })).status).toBe(
    202,
  );
  for (let attempt = 0; attempt < 40 && !delivered; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const token = delivered?.replace(/=\r?\n/g, "").match(/redefinir-senha#([A-Za-z0-9_-]{43})/)?.[1];
  expect(token).toBeDefined();
  const reset = () =>
    request("auth/reset-password", { method: "POST", body: { token, password: newPassword } });
  expect((await reset()).status).toBe(204);
  expect((await reset()).status).toBe(401);
  expect((await request("auth/me", prior)).status).toBe(401);
  expect((await login(password)).status).toBe(401);
  const current = await login(newPassword);
  expect(current.status).toBe(204);
  expect(
    (
      await request("auth/change-password", {
        method: "POST",
        cookies: current.cookies,
        body: { currentPassword: newPassword, password },
      })
    ).status,
  ).toBe(204);
  expect((await request("auth/me", current)).status).toBe(401);
  expect((await login(password)).status).toBe(204);
});

async function createActor(name) {
  const email = `${name.toLowerCase()}-${randomUUID()}@flux.test`;
  const account = await request("auth/register", {
    method: "POST",
    body: { email, name, password },
  });
  expect(account.status).toBe(201);
  const session = await request("auth/login", { method: "POST", body: { email, password } });
  expect(session.status).toBe(204);
  return { id: account.data.id, cookies: session.cookies };
}

test("isola empresas e aplica os quatro papéis ao cadastro e à auditoria", async () => {
  const owner = await createActor("Proprietaria");
  const admin = await createActor("Administradora");
  const manager = await createActor("Gestora");
  const operator = await createActor("Operadora");
  const other = await createActor("Externo");
  const first = await request("organizations", {
    ...owner,
    method: "POST",
    body: { name: "Primeira Empresa" },
  });
  const second = await request("organizations", {
    ...other,
    method: "POST",
    body: { name: "Segunda Empresa" },
  });
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  const path = `organizations/${first.data.id}`;
  const foreign = `organizations/${second.data.id}`;
  const add = (actor, user, role) =>
    request(`${path}/members`, {
      ...actor,
      method: "POST",
      body: { userId: user.id, role },
    });
  expect((await add(owner, admin, "ADMIN")).status).toBe(201);
  expect((await add(admin, manager, "ADMIN")).status).toBe(403);
  expect((await add(admin, manager, "MANAGER")).status).toBe(201);
  expect((await add(manager, operator, "OPERATOR")).status).toBe(403);
  expect((await add(admin, operator, "OPERATOR")).status).toBe(201);

  expect((await request(path, operator)).data.role).toBe("OPERATOR");
  expect((await request(`${path}/members`, operator)).status).toBe(403);
  expect((await request(`${path}/members`, manager)).data).toHaveLength(4);
  expect((await request(`${path}/audit`, manager)).status).toBe(403);
  expect((await request(`${foreign}/audit`, admin)).status).toBe(404);
  expect((await request(`${path}/members`, other)).status).toBe(404);

  expect(
    (
      await request(path, {
        ...admin,
        method: "PATCH",
        body: { name: "Nova Razão", organizationId: second.data.id },
      })
    ).status,
  ).toBe(400);
  expect(
    (await request(foreign, { ...admin, method: "PATCH", body: { name: "Alteração" } })).status,
  ).toBe(404);
  expect(
    (await request(path, { ...admin, method: "PATCH", body: { name: "Nova Razão" } })).status,
  ).toBe(200);

  const audit = await request(`${path}/audit`, owner);
  expect(audit.data).toHaveLength(5);
  expect(audit.data[0]).toEqual(
    expect.objectContaining({ action: "company.updated", actorId: admin.id }),
  );
  expect(audit.data.every((event) => event.organizationId === first.data.id)).toBe(true);
  expect((await request(foreign, other)).data.name).toBe("Segunda Empresa");
});

test("permite CRUD operacional com vínculo local, filtros, notas e arquivo isolado", async () => {
  const owner = await createActor("Diretora");
  const other = await createActor("Externo");
  const operator = await createActor("Operadora");
  const createCompany = (actor, name) =>
    request("organizations", { ...actor, method: "POST", body: { name } });
  const company = await createCompany(owner, "Primeira Operação");
  const second = await createCompany(other, "Segunda Operação");
  const root = `organizations/${company.data.id}`;
  const paths = {
    local: `${root}/directory`,
    foreign: `organizations/${second.data.id}/directory`,
  };
  const add = (path, body, actor = owner) => request(path, { ...actor, method: "POST", body });

  expect((await add(`${root}/members`, { userId: operator.id, role: "OPERATOR" })).status).toBe(
    201,
  );
  const customer = await add(`${paths.local}/CUSTOMER`, {
    name: "Cliente Alfa",
    email: "cliente@flux.test",
  });
  expect(customer.status).toBe(201);
  const customerPath = `${paths.local}/CUSTOMER/${customer.data.id}`;
  const secondCustomer = await add(`${paths.foreign}/CUSTOMER`, { name: "Cliente Beta" }, other);
  expect(secondCustomer.status).toBe(201);
  expect(
    (
      await add(`${paths.local}/CONTACT`, {
        name: "Contato Externo",
        parentId: secondCustomer.data.id,
      })
    ).status,
  ).toBe(404);
  expect(
    (await add(`${paths.local}/CONTACT`, { name: "Contato Alfa", parentId: customer.data.id }))
      .status,
  ).toBe(201);
  expect((await request(customerPath, { ...owner, method: "DELETE" })).status).toBe(409);

  const category = await add(`${paths.local}/CATEGORY`, { name: "Ferramentas" });
  expect(category.status).toBe(201);
  expect(
    (
      await add(`${paths.local}/PRODUCT`, {
        name: "Produto X",
        priceCents: 1250,
        code: "SKU-A",
        parentId: category.data.id,
      })
    ).status,
  ).toBe(201);
  const service = await add(`${paths.local}/SERVICE`, { name: "Visita", priceCents: 5000 });
  expect(service.status).toBe(201);
  expect((await request(`${paths.local}/PRODUCT?q=sku-a&page=1&size=1`, operator)).data.total).toBe(
    1,
  );
  expect(
    (await add(`${paths.local}/PRODUCT`, { name: "Bloqueado", priceCents: 100 }, operator)).status,
  ).toBe(403);
  expect((await request(`${paths.foreign}/CUSTOMER`, owner)).status).toBe(404);
  expect(
    (
      await request(`${paths.foreign}/CUSTOMER/${customer.data.id}`, {
        ...other,
        method: "PUT",
        body: { name: "Troca indevida" },
      })
    ).status,
  ).toBe(404);
  expect(
    (await request(`${paths.local}/SERVICE/${service.data.id}`, { ...owner, method: "DELETE" }))
      .status,
  ).toBe(204);
  expect((await request(`${paths.local}/SERVICE`, owner)).data.total).toBe(0);

  const note = await add(`${customerPath}/notes`, { content: "Contato prefere e-mail." });
  expect(note.status).toBe(201);
  const noteId = note.data.id;
  expect((await request(`${customerPath}/notes?q=prefere`, operator)).data.items).toHaveLength(1);
  expect(
    (
      await request(`${customerPath}/notes/${noteId}`, {
        ...owner,
        method: "PUT",
        body: { content: "Prefere telefone." },
      })
    ).status,
  ).toBe(200);

  const file = new FormData();
  file.set("file", new Blob(["anexo de teste"]), "teste.txt");
  const attached = await add(`${customerPath}/attachments`, file);
  expect(attached.status).toBe(201);
  expect(attached.data).not.toHaveProperty("data");
  const attachmentPath = `${customerPath}/attachments/${attached.data.id}`;
  expect((await request(attachmentPath, other)).status).toBe(404);
  const fetchFile = await fetch(`${base}/api/v1/${attachmentPath}`, {
    headers: { Cookie: operator.cookies },
  });
  expect(fetchFile.status).toBe(200);
  expect(fetchFile.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await fetchFile.text()).toBe("anexo de teste");
  expect(
    (await request(attachmentPath, { ...owner, method: "PUT", body: { name: "Novo nome.txt" } }))
      .status,
  ).toBe(200);
  expect((await request(attachmentPath, { ...owner, method: "DELETE" })).status).toBe(204);
  expect((await request(attachmentPath, operator)).status).toBe(404);
});

test("calcula orçamento, gera PDF e converte aprovação em uma única ordem", async () => {
  const actor = await createActor("Orcamentista");
  const secondActor = await createActor("Externa");
  const add = (path, body) => request(path, { ...actor, method: "POST", body });
  const organization = await add("organizations", { name: "Orçamentos de Teste" });
  const namespace = `organizations/${organization.data.id}`;
  const customer = await add(`${namespace}/directory/CUSTOMER`, { name: "Cliente PDF" });
  const product = await add(`${namespace}/directory/PRODUCT`, {
    name: "Equipamento",
    priceCents: 12_500,
  });
  const service = await add(`${namespace}/directory/SERVICE`, {
    name: "Instalação",
    priceCents: 9_800,
  });
  const body = {
    name: "Instalação industrial",
    customerId: customer.data.id,
    lines: [
      { itemId: product.data.id, quantity: 2, discountCents: 500 },
      { itemId: service.data.id, quantity: 1 },
    ],
  };
  expect(
    (
      await add(`${namespace}/quotes`, {
        ...body,
        lines: [{ ...body.lines[0], discountCents: 30_000 }],
      })
    ).status,
  ).toBe(400);
  const created = await add(`${namespace}/quotes`, body);
  expect(created.status).toBe(201);
  expect(created.data).toEqual(
    expect.objectContaining({
      status: "DRAFT",
      subtotalCents: 34_800,
      discountCents: 500,
      totalCents: 34_300,
    }),
  );
  expect(created.data.lines[1].kind).toBe("SERVICE");
  const path = `${namespace}/quotes/${created.data.id}`;
  expect((await request(path, secondActor)).status).toBe(404);
  const convert = () => add(`${path}/convert`);
  const status = (value) =>
    request(`${path}/status`, { ...actor, method: "PATCH", body: { status: value } });
  expect((await convert()).status).toBe(409);
  expect((await status("APPROVED")).status).toBe(409);
  const edited = await request(path, { ...actor, method: "PUT", body: { ...body, revision: 0 } });
  expect(edited.status).toBe(200);
  expect(
    (await request(path, { ...actor, method: "PUT", body: { ...body, revision: 0 } })).status,
  ).toBe(409);
  expect((await status("SENT")).status).toBe(200);
  expect((await status("APPROVED")).status).toBe(200);
  const conversions = await Promise.all([convert(), convert()]);
  expect(conversions.map((order) => order.status)).toEqual([201, 201]);
  expect(conversions[0].data.id).toBe(conversions[1].data.id);
  const pdf = await fetch(`${base}/api/v1/${path}/pdf`, { headers: { Cookie: actor.cookies } });
  expect(pdf.status).toBe(200);
  expect(pdf.headers.get("content-type")).toBe("application/pdf");
  expect(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
  ).toBe("%PDF-");
});

test("execução de OS valida responsável, checklist, anexos e conclusão", async () => {
  const owner = await createActor("Encarregada");
  const operator = await createActor("Tecnico");
  const external = await createActor("OutraEmpresa");
  const post = (path, body) => request(path, { ...owner, method: "POST", body });
  const org = await post("organizations", { name: "Serviços Industriais" });
  const root = `organizations/${org.data.id}`;
  await post(`${root}/members`, { userId: operator.id, role: "OPERATOR" });
  const customer = await post(`${root}/directory/CUSTOMER`, { name: "Cliente da Ordem" });
  const orders = `${root}/orders`;
  expect((await request(`${orders}/statuses`, operator)).data).toHaveLength(3);
  const custom = await post(`${orders}/statuses`, { name: "Validação técnica", terminal: false });
  expect(custom.status).toBe(201);
  const values = {
    name: "Inspeção",
    customerId: customer.data.id,
    priority: "HIGH",
    dueAt: "2026-12-10T15:00:00.000Z",
  };
  expect((await post(orders, { ...values, assignedUserId: external.id })).status).toBe(404);
  const result = await post(orders, values);
  expect(result.status).toBe(201);
  const path = `${orders}/${result.data.id}`;
  const status = (actor, value, report) =>
    request(`${path}/status`, { ...actor, method: "PATCH", body: { status: value, report } });
  expect((await status(operator, custom.data.key)).status).toBe(403);
  expect((await request(path, external)).status).toBe(404);
  expect(
    (
      await request(path, {
        ...owner,
        method: "PUT",
        body: {
          name: values.name,
          priority: "URGENT",
          assignedUserId: operator.id,
          dueAt: values.dueAt,
        },
      })
    ).status,
  ).toBe(200);
  expect((await status(operator, custom.data.key)).status).toBe(200);
  const task = await post(`${path}/tasks`, { name: "Verificar relatório fotográfico" });
  expect(task.status).toBe(201);
  expect((await status(operator, "completed", "Vistoria executada")).status).toBe(409);
  expect(
    (
      await request(`${path}/tasks/${task.data.id}`, {
        ...operator,
        method: "PATCH",
        body: { done: true },
      })
    ).status,
  ).toBe(200);
  const file = new FormData();
  file.set("file", new Blob(["relatório fotográfico"]), "evidencia.txt");
  const attachment = await request(`${path}/attachments`, {
    ...operator,
    method: "POST",
    body: file,
  });
  expect(attachment.status).toBe(201);
  expect((await request(`${path}/attachments/${attachment.data.id}`, external)).status).toBe(404);
  expect((await status(operator, "completed")).status).toBe(400);
  expect((await status(operator, "completed", "Vistoria executada")).status).toBe(200);
  const detail = (await request(path, owner)).data;
  expect(detail).toEqual(
    expect.objectContaining({
      statusKey: "completed",
      completionReport: "Vistoria executada",
      assignedUserId: operator.id,
      priority: "URGENT",
      dueAt: values.dueAt,
    }),
  );
  expect(detail.history).toHaveLength(7);
  expect(detail.history[0].details).toEqual({ from: "Validação técnica", to: "Concluída" });
  expect(detail.attachments).toHaveLength(1);
  expect((await status(owner, "open")).status).toBe(409);
  expect((await request(`${orders}?status=completed&priority=URGENT`, owner)).data.total).toBe(1);
});

test("reporta indicadores filtráveis e aplica módulos e identidade por organização", async () => {
  const owner = await createActor("Responsavel");
  const external = await createActor("Externo");
  const operator = await createActor("Operador");
  const post = (path, body) => request(path, { ...owner, method: "POST", body });
  const company = await post("organizations", { name: "Empresa dos Indicadores" });
  const other = await request("organizations", {
    ...external,
    method: "POST",
    body: { name: "Empresa Externa" },
  });
  const root = `organizations/${company.data.id}`;
  const otherRoot = `organizations/${other.data.id}`;
  const setup = {
    displayName: "Marca de Teste",
    accentColor: "#113355",
    directoryEnabled: true,
    quotesEnabled: true,
    ordersEnabled: false,
  };
  await post(`${root}/members`, { userId: operator.id, role: "OPERATOR" });

  const customer = await post(`${root}/directory/CUSTOMER`, { name: "Cliente do Painel" });
  const service = await post(`${root}/directory/SERVICE`, {
    name: "Serviço Técnico",
    priceCents: 7500,
  });
  const order = await post(`${root}/orders`, {
    name: "Serviço atrasado",
    priority: "HIGH",
    customerId: customer.data.id,
    dueAt: "2000-01-01T10:00:00Z",
  });
  await post(`${root}/orders/${order.data.id}/tasks`, { name: "Fazer inspeção final" });
  const quote = await post(`${root}/quotes`, {
    name: "Orçamento do Painel",
    customerId: customer.data.id,
    lines: [{ itemId: service.data.id, quantity: 1 }],
  });
  await request(`${root}/quotes/${quote.data.id}/status`, {
    ...owner,
    method: "PATCH",
    body: { status: "SENT" },
  });
  await request(`${root}/quotes/${quote.data.id}/status`, {
    ...owner,
    method: "PATCH",
    body: { status: "APPROVED" },
  });

  const report = (await request(`${root}/dashboard`, owner)).data;
  expect(report.orders).toEqual(
    expect.objectContaining({ open: 1, completed: 0, overdue: 1, pendingTasks: 1 }),
  );
  expect(report.orders.deadlines[0].id).toBe(order.data.id);
  expect(report.quotes.find(({ status }) => status === "APPROVED")).toEqual({
    status: "APPROVED",
    count: 1,
    totalCents: 7500,
  });
  expect((await request(`${root}/dashboard?to=2000-01-02T00:00:00Z`, owner)).data.orders.open).toBe(
    0,
  );
  expect((await request(`${root}/dashboard`, external)).status).toBe(404);

  const change = (actor, body) => request(`${root}/settings`, { ...actor, method: "PUT", body });
  expect((await change(operator, setup)).status).toBe(403);
  expect((await change(owner, { ...setup, directoryEnabled: false })).status).toBe(400);
  expect((await change(owner, setup)).status).toBe(200);
  expect((await request(`${root}/settings`, operator)).data).toEqual(setup);
  expect((await request(`${root}/orders`, owner)).status).toBe(403);
  expect((await post(`${root}/quotes/${quote.data.id}/convert`)).status).toBe(403);
  expect((await request(`${root}/dashboard`, owner)).data.orders).toBeNull();
  expect((await request(`${otherRoot}/orders`, external)).status).toBe(200);
  expect((await request(`${otherRoot}/settings`, external)).data).toEqual(
    expect.objectContaining({ ordersEnabled: true, accentColor: "#174877" }),
  );
});

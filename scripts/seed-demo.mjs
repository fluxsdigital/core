const endpoint = new URL(process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3000");
if (
  !["http:", "https:"].includes(endpoint.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
) {
  throw new Error("Use uma origem local para os dados fictícios.");
}
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12 || password.length > 128) {
  throw new Error("Configure DEMO_PASSWORD com 12 a 128 caracteres.");
}
const account = { email: "demo@flux-core.test", password };
const cookies = new Map();

async function call(path, method = "GET", body, allowed = []) {
  const response = await fetch(new URL(`/api/v1/${path}`, endpoint), {
    method,
    redirect: "error",
    headers: {
      Origin: endpoint.origin,
      Cookie: Array.from(cookies.values()).join("; "),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  for (const header of response.headers.getSetCookie()) {
    const token = header.split(";")[0];
    cookies.set(token.split("=")[0], token);
  }
  const payload = await response.json().catch(() => undefined);
  if (!response.ok && !allowed.includes(response.status)) {
    throw new Error(`${method} ${path}: HTTP ${response.status} ${payload?.message ?? ""}`);
  }
  return payload;
}

async function ensure(path, titleField, title, body) {
  const items = (await call(`${path}?q=${encodeURIComponent(title)}&size=100`)).items;
  return items.find((item) => item[titleField] === title) ?? call(path, "POST", body);
}

await call("auth/register", "POST", { ...account, name: "Camila Demonstração" }, [409]);
await call("auth/login", "POST", account);
try {
  const companyName = "Flux Demonstração";
  const companies = await call("organizations");
  const company =
    companies.find(({ name }) => name === companyName) ??
    (await call("organizations", "POST", { name: companyName }));
  const root = `organizations/${company.id}`;
  const addRecord = (kind, name, values) =>
    ensure(`${root}/directory/${kind}`, "name", name, { name, ...values });

  const customer = await addRecord("CUSTOMER", "Metalúrgica Aurora", {
    email: "operacao@aurora.example",
  });
  await addRecord("CONTACT", "Renata Costa", {
    parentId: customer.id,
    email: "renata@aurora.example",
  });
  const group = await addRecord("CATEGORY", "Manutenção industrial");
  const product = await addRecord("PRODUCT", "Kit de vedações", {
    code: "KIT-V01",
    priceCents: 45_000,
    parentId: group.id,
  });
  const service = await addRecord("SERVICE", "Inspeção em campo", {
    code: "SERV-I01",
    priceCents: 125_000,
    parentId: group.id,
  });

  const quoteTitle = "Inspeção e troca de vedações";
  const quote = await ensure(`${root}/quotes`, "title", quoteTitle, {
    name: quoteTitle,
    customerId: customer.id,
    lines: [
      { itemId: product.id, quantity: 2, discountCents: 5_000 },
      { itemId: service.id, quantity: 1 },
    ],
  });
  const quotePath = `${root}/quotes/${quote.id}`;
  if (quote.status === "DRAFT") await call(`${quotePath}/status`, "PATCH", { status: "SENT" });
  if (quote.status === "DRAFT" || quote.status === "SENT")
    await call(`${quotePath}/status`, "PATCH", { status: "APPROVED" });
  const order = await call(`${quotePath}/convert`, "POST");
  const orderPath = `${root}/orders/${order.id}`;
  const detail = await call(orderPath);
  if (!detail.status.terminal) {
    const user = await call("auth/me");
    if (!detail.dueAt || !detail.assignedUserId) {
      await call(orderPath, "PUT", {
        name: quoteTitle,
        assignedUserId: user.id,
        priority: "HIGH",
        dueAt: detail.dueAt ?? new Date(Date.now() + 72 * 3_600_000).toISOString(),
      });
    }
    const task = "Registrar fotos da intervenção";
    if (!detail.tasks.some(({ label }) => label === task))
      await call(`${orderPath}/tasks`, "POST", { name: task });
  }
  console.log(`Dados fictícios disponíveis em ${companyName}. Acesse com ${account.email}.`);
} finally {
  await call("auth/logout", "POST");
}

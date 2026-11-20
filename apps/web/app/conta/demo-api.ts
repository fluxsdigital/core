import { directoryKinds, type Kind, type RecordItem } from "../cadastros/directory-types";

import type { Quote, Status as QuoteStatus } from "../orcamentos/quotes";
import type { Detail, Priority, Status as OrderStatus } from "../ordens/orders";
import type { Company, Settings } from "../workspace/workspace";

export const demoEnabled = process.env.NEXT_PUBLIC_FLUX_DEMO === "1";

const company: Company = {
  id: "flux-demo",
  name: "Flux Demonstração",
  role: "OWNER",
  settings: {
    displayName: "Flux Demonstração",
    accentColor: "#174877",
    logoUrl: null,
    directoryEnabled: true,
    quotesEnabled: true,
    ordersEnabled: true,
  },
};
const user = { id: "demo-user", name: "Marina Costa", email: "marina@example.test" };
const members = [{ user, role: "OWNER" }];
const customers = [
  {
    id: "cliente-1",
    kind: "CUSTOMER",
    name: "Metalúrgica Horizonte",
    email: "contato@example.test",
  },
  { id: "cliente-2", kind: "CUSTOMER", name: "Distribuidora Vale Norte" },
] satisfies RecordItem[];
const records = [
  ...customers,
  { id: "contato-1", kind: "CONTACT", name: "André Lima", parentId: customers[0].id },
  { id: "produto-1", kind: "PRODUCT", name: "Kit de vedação industrial", priceCents: 49000 },
  { id: "servico-1", kind: "SERVICE", name: "Inspeção e manutenção de bombas", priceCents: 325000 },
  { id: "categoria-1", kind: "CATEGORY", name: "Manutenção industrial" },
] satisfies RecordItem[];

const day = 86400000;
const createdAt = new Date(Date.now() - 2 * day).toISOString();
const dueAt = new Date(Date.now() + 4 * day).toISOString();
const statuses = [
  { key: "OPEN", label: "Aberta", terminal: false },
  { key: "IN_PROGRESS", label: "Em andamento", terminal: false },
  { key: "COMPLETED", label: "Concluída", terminal: true },
];
const quoteId = "orcamento-1";
const order: DemoOrder = {
  id: "b2eeec00-0000-4000-8000-000000000001",
  title: "Manutenção da linha de bombeamento",
  createdAt,
  status: statuses[1],
  statusKey: "IN_PROGRESS",
  priority: "HIGH",
  assignedUserId: user.id,
  dueAt,
  completionReport: null,
  completedAt: null,
  customer: { name: customers[0].name },
  assignee: { user },
  quoteId,
  attachments: [],
  tasks: [
    { id: "tarefa-1", label: "Conferir histórico de manutenção", done: true },
    { id: "tarefa-2", label: "Registrar medições de operação", done: false },
  ],
  history: [{ id: "historico-1", action: "order.from_quote", createdAt }],
};
const serviceLine: Quote["lines"][number] = {
  position: 1,
  kind: "SERVICE",
  itemId: "servico-1",
  label: "Inspeção e manutenção de bombas",
  quantity: 1,
  unitPriceCents: 325000,
  discountCents: 0,
  totalCents: 325000,
};
const productLine: Quote["lines"][number] = {
  ...serviceLine,
  kind: "PRODUCT",
  itemId: "produto-1",
  label: "Kit de vedação industrial",
  quantity: 3,
  unitPriceCents: 49000,
  totalCents: 147000,
};
const quotes: DemoQuote[] = [
  {
    id: quoteId,
    createdAt,
    title: "Manutenção da linha de bombeamento",
    status: "APPROVED",
    customerId: customers[0].id,
    customerName: customers[0].name,
    revision: 1,
    subtotalCents: 325000,
    discountCents: 0,
    totalCents: 325000,
    lines: [serviceLine],
    order: { id: order.id },
  },
  {
    id: "orcamento-2",
    createdAt,
    title: "Reposição de peças de vedação",
    status: "SENT",
    customerId: customers[1].id,
    customerName: customers[1].name,
    revision: 1,
    subtotalCents: 147000,
    discountCents: 0,
    totalCents: 147000,
    lines: [productLine],
    order: null,
  },
];

type DemoQuote = Quote & { createdAt: string };
type DemoOrder = Detail & { createdAt: string };
type DemoState = {
  settings: Settings;
  quotes: DemoQuote[];
  orders: DemoOrder[];
  statuses: OrderStatus[];
  records: RecordItem[];
};

const storageKey = "flux-core-demo-v1";
export const demoChangeEvent = "flux-core-demo-change";

function initialState(): DemoState {
  return structuredClone({
    settings: company.settings,
    quotes,
    orders: [
      order,
      {
        ...order,
        id: "b2eeec00-0000-4000-8000-000000000002",
        title: "Calibração do painel de pressão",
        dueAt: new Date(Date.now() - day).toISOString(),
        statusKey: "OPEN",
        status: statuses[0],
        quoteId: null,
        tasks: [{ id: "tarefa-3", label: "Conferir instrumentos em campo", done: false }],
        history: [{ id: "historico-2", action: "order.created", createdAt }],
      },
    ],
    statuses,
    records,
  });
}

function readState(): DemoState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // The sample is still available when browser storage cannot be read.
  }
  return initialState();
}

function writeState(state: DemoState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    throw new DemoError(
      507,
      "Não foi possível salvar no navegador. Verifique o espaço disponível.",
    );
  }
  window.dispatchEvent(new Event(demoChangeEvent));
}

function withDemoLock<T>(work: () => T): T | Promise<T> {
  return navigator.locks ? navigator.locks.request(storageKey, work) : work();
}

export function resetDemo() {
  return withDemoLock(() => writeState(initialState()));
}

export function demoCompany() {
  return { ...company, settings: readState().settings };
}

class DemoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function requireData(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DemoError(status, message);
}

type Payload = Record<string, unknown>;

function nameOf(value: unknown, field = "título") {
  const name = typeof value === "string" ? value.trim() : "";
  requireData(name.length >= 2 && name.length <= 150, `Informe um ${field} de 2 a 150 caracteres.`);
  return name;
}

function paginate<T>(items: T[], query: URLSearchParams, matches: (item: T) => string) {
  const search = (query.get("q") ?? "").trim().toLocaleLowerCase("pt-BR");
  const page = Math.max(1, Number(query.get("page")) || 1);
  const size = Math.max(1, Number(query.get("size")) || 10);
  const filtered = items.filter((item) =>
    matches(item).toLocaleLowerCase("pt-BR").includes(search),
  );
  return {
    items: filtered.slice((page - 1) * size, page * size),
    total: filtered.length,
    page,
    size,
  };
}

function inPeriod(date: string, query: URLSearchParams) {
  const from = query.get("from");
  const to = query.get("to");
  return (!from || date >= from) && (!to || date < to);
}

function isOverdue(order: DemoOrder, now: string) {
  return !order.status.terminal && !!order.dueAt && order.dueAt < now;
}

function dashboard(state: DemoState, query: URLSearchParams) {
  const now = new Date().toISOString();
  const open = state.orders.filter(
    (item) => !item.status.terminal && inPeriod(item.createdAt, query),
  );
  return {
    quotes: state.settings.quotesEnabled
      ? (["DRAFT", "SENT", "APPROVED", "REJECTED"] as const).map((status) => {
          const matches = state.quotes.filter(
            (quote) => quote.status === status && inPeriod(quote.createdAt, query),
          );
          return {
            status,
            count: matches.length,
            totalCents: matches.reduce((total, quote) => total + quote.totalCents, 0),
          };
        })
      : null,
    orders: state.settings.ordersEnabled
      ? {
          open: open.length,
          completed: state.orders.filter(
            (item) => item.completedAt && inPeriod(item.completedAt, query),
          ).length,
          overdue: open.filter((item) => isOverdue(item, now)).length,
          pendingTasks: open.reduce(
            (total, item) => total + item.tasks.filter((task) => !task.done).length,
            0,
          ),
          deadlines: open
            .flatMap((item) =>
              item.dueAt
                ? [
                    {
                      ...item,
                      dueAt: item.dueAt,
                      _count: { tasks: item.tasks.filter((task) => !task.done).length },
                    },
                  ]
                : [],
            )
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
            .slice(0, 8),
        }
      : null,
  };
}

const transitions: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

function priceQuote(state: DemoState, data: Payload) {
  const customer = state.records.find(
    (item) => item.kind === "CUSTOMER" && item.id === data.customerId,
  );
  requireData(customer, "Selecione um cliente do cadastro.");
  requireData(Array.isArray(data.lines) && data.lines.length > 0, "Adicione ao menos um item.");
  const lines = (data.lines as Payload[]).map((line, index) => {
    const item = state.records.find((record) => record.id === line.itemId);
    requireData(
      item && (item.kind === "PRODUCT" || item.kind === "SERVICE") && item.priceCents != null,
      "Selecione um item válido do catálogo.",
    );
    const quantity = Number(line.quantity);
    const discountCents = Number(line.discountCents ?? 0);
    const gross = item.priceCents * quantity;
    requireData(
      Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(gross),
      "Informe uma quantidade válida.",
    );
    requireData(
      Number.isSafeInteger(discountCents) && discountCents >= 0 && discountCents <= gross,
      "O desconto deve estar entre zero e o total do item.",
    );
    return {
      position: index + 1,
      kind: item.kind,
      itemId: item.id,
      label: item.name,
      quantity,
      unitPriceCents: item.priceCents,
      discountCents,
      totalCents: gross - discountCents,
    };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  const discountCents = lines.reduce((sum, line) => sum + line.discountCents, 0);
  requireData(Number.isSafeInteger(subtotalCents), "O valor do orçamento ultrapassa o limite.");
  return {
    title: nameOf(data.name),
    customerId: customer.id,
    customerName: customer.name,
    lines,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}

function history(action: string, details?: Detail["history"][number]["details"]) {
  return { id: crypto.randomUUID(), action, createdAt: new Date().toISOString(), details };
}

function orderFields(data: Payload) {
  const priority = data.priority as Priority;
  requireData(
    ["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority),
    "Selecione uma prioridade válida.",
  );
  requireData(
    !data.assignedUserId || data.assignedUserId === user.id,
    "Selecione um responsável válido.",
  );
  const dueAt = typeof data.dueAt === "string" ? data.dueAt : null;
  requireData(!dueAt || Number.isFinite(Date.parse(dueAt)), "Informe um prazo válido.");
  return {
    title: nameOf(data.name),
    priority,
    dueAt,
    assignedUserId: data.assignedUserId ? user.id : null,
    assignee: data.assignedUserId ? { user } : null,
  };
}

function createOrder(state: DemoState, customerName: string, data: Payload, quote?: DemoQuote) {
  const status = state.statuses.find((item) => item.key === "OPEN")!;
  const entry: DemoOrder = {
    ...orderFields(data),
    id: crypto.randomUUID(),
    status,
    statusKey: status.key,
    customer: { name: customerName },
    createdAt: new Date().toISOString(),
    completionReport: null,
    completedAt: null,
    quoteId: quote?.id ?? null,
    attachments: [],
    tasks: quote
      ? [{ id: crypto.randomUUID(), label: "Conferir itens do orçamento", done: false }]
      : [],
    history: [history(quote ? "order.from_quote" : "order.created")],
  };
  state.orders.unshift(entry);
  return entry;
}

function quoteRequest(
  state: DemoState,
  method: string,
  id: string,
  action: string,
  data: Payload,
  query: URLSearchParams,
) {
  requireData(state.settings.quotesEnabled, "Módulo de orçamentos desabilitado.", 403);
  if (!id && method === "GET") {
    return paginate(
      state.quotes.filter(
        (quote) =>
          (!query.has("status") || quote.status === query.get("status")) &&
          inPeriod(quote.createdAt, query),
      ),
      query,
      (quote) => `${quote.title} ${quote.customerName}`,
    );
  }
  if (!id && method === "POST") {
    const quote: DemoQuote = {
      ...priceQuote(state, data),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: "DRAFT",
      revision: 1,
      order: null,
    };
    state.quotes.unshift(quote);
    return quote;
  }
  const quote = state.quotes.find((entry) => entry.id === id);
  requireData(quote, "Orçamento não encontrado.", 404);
  if (!action && method === "GET") return quote;
  if (!action && method === "PUT") {
    requireData(
      quote.status === "DRAFT" && quote.revision === data.revision,
      "O rascunho foi alterado. Abra o orçamento novamente.",
      409,
    );
    Object.assign(quote, priceQuote(state, data), { revision: quote.revision + 1 });
    return quote;
  }
  if (action === "status" && method === "PATCH") {
    const next = data.status as QuoteStatus;
    requireData(
      transitions[quote.status].includes(next),
      "Esta mudança de status não é permitida.",
      409,
    );
    quote.status = next;
    return quote;
  }
  if (action === "convert" && method === "POST") {
    requireData(state.settings.ordersEnabled, "Módulo de ordens desabilitado.", 403);
    requireData(quote.status === "APPROVED", "Aprove o orçamento antes de gerar a ordem.", 409);
    if (quote.order) return quote.order;
    const linked = createOrder(
      state,
      quote.customerName,
      { name: quote.title, priority: "NORMAL" },
      quote,
    );
    quote.order = { id: linked.id };
    return linked;
  }
  throw new DemoError(404, "Operação indisponível na demonstração.");
}

function orderRequest(
  state: DemoState,
  method: string,
  id: string,
  action: string,
  itemId: string,
  data: Payload,
  query: URLSearchParams,
) {
  requireData(state.settings.ordersEnabled, "Módulo de ordens desabilitado.", 403);
  if (id === "statuses") {
    if (method === "GET") return state.statuses;
    const label = nameOf(data.name, "nome");
    if (method === "POST") {
      const status = { key: crypto.randomUUID(), label, terminal: data.terminal === true };
      state.statuses.push(status);
      return status;
    }
    if (method === "PUT") {
      const status = state.statuses.find((entry) => entry.key === action);
      requireData(status, "Status não encontrado.", 404);
      status.label = label;
      state.orders
        .filter((entry) => entry.statusKey === status.key)
        .forEach((entry) => {
          entry.status = status;
        });
      return status;
    }
  }
  if (!id && method === "GET") {
    const now = new Date().toISOString();
    const scope = query.get("scope");
    return paginate(
      state.orders.filter((item) => {
        if (query.has("status") && query.get("status") !== item.statusKey) return false;
        if (query.has("priority") && query.get("priority") !== item.priority) return false;
        if (scope === "completed") return !!item.completedAt && inPeriod(item.completedAt, query);
        if (!inPeriod(item.createdAt, query)) return false;
        if (scope === "open") return !item.status.terminal;
        if (scope === "overdue") return isOverdue(item, now);
        if (scope === "pending")
          return !item.status.terminal && item.tasks.some((task) => !task.done);
        return true;
      }),
      query,
      (item) => `${item.title} ${item.customer.name}`,
    );
  }
  if (!id && method === "POST") {
    const customer = state.records.find(
      (entry) => entry.kind === "CUSTOMER" && entry.id === data.customerId,
    );
    requireData(customer, "Selecione um cliente do cadastro.");
    return createOrder(state, customer.name, data);
  }
  const entry = state.orders.find((item) => item.id === id);
  requireData(entry, "Ordem de serviço não encontrada.", 404);
  if (!action && method === "GET") return entry;
  requireData(!entry.status.terminal, "A ordem já foi concluída.", 409);
  if (!action && method === "PUT") {
    Object.assign(entry, orderFields(data));
    entry.history.unshift(history("order.updated"));
    return entry;
  }
  if (action === "status" && method === "PATCH") {
    const status = state.statuses.find((item) => item.key === data.status);
    requireData(status && status.key !== entry.statusKey, "Selecione um novo status.");
    const report = typeof data.report === "string" ? data.report.trim() : "";
    requireData(!status.terminal || report, "Informe o relatório de conclusão.");
    entry.history.unshift(
      history("order.status_changed", { from: entry.status.label, to: status.label }),
    );
    entry.status = status;
    entry.statusKey = status.key;
    if (status.terminal) {
      entry.completedAt = new Date().toISOString();
      entry.completionReport = report;
    }
    return entry;
  }
  if (action === "tasks") {
    if (!itemId && method === "POST") {
      const task = { id: crypto.randomUUID(), label: nameOf(data.name, "nome"), done: false };
      entry.tasks.push(task);
      entry.history.unshift(history("order.task_added", { name: task.label }));
      return task;
    }
    if (itemId && method === "PATCH") {
      const task = entry.tasks.find((item) => item.id === itemId);
      requireData(task && typeof data.done === "boolean", "Item do checklist não encontrado.", 404);
      task.done = data.done;
      entry.history.unshift(history("order.task_checked", { task: task.label, to: task.done }));
      return task;
    }
  }
  throw new DemoError(404, "Operação indisponível na demonstração.");
}

function directoryRequest(
  state: DemoState,
  method: string,
  kind: Kind,
  id: string,
  collection: string,
  data: Payload,
  query: URLSearchParams,
) {
  requireData(Object.hasOwn(directoryKinds, kind), "Tipo de cadastro inválido.", 404);
  if (method === "GET" && (collection === "notes" || collection === "attachments"))
    return paginate([], query, () => "");
  if (method === "GET" && !id) {
    return paginate(
      state.records.filter((item) => item.kind === kind),
      query,
      (item) => item.name,
    );
  }
  const current = state.records.find((item) => item.kind === kind && item.id === id);
  if (id) requireData(current, "Cadastro não encontrado.", 404);
  if (method === "GET" && current) return current;
  if (method === "DELETE" && current && !collection) {
    const linked =
      state.quotes.some(
        (quote) => quote.customerId === id || quote.lines.some((line) => line.itemId === id),
      ) || state.records.some((entry) => entry.parentId === id);
    requireData(!linked, "Este cadastro está vinculado a outros registros.", 409);
    state.records = state.records.filter((entry) => entry.id !== id);
    return null;
  }
  if (!collection && ((!id && method === "POST") || (current && method === "PUT"))) {
    const record: RecordItem = {
      id: current?.id ?? crypto.randomUUID(),
      kind,
      name: nameOf(data.name, "nome"),
    };
    for (const field of ["email", "phone", "description", "code", "parentId"] as const) {
      if (typeof data[field] === "string") record[field] = data[field];
    }
    if (kind === "PRODUCT" || kind === "SERVICE") {
      const price = Number(data.priceCents);
      requireData(Number.isSafeInteger(price) && price >= 0, "Informe um preço válido.");
      record.priceCents = price;
    }
    if (current)
      Object.assign(current, record, {
        email: record.email ?? null,
        phone: record.phone ?? null,
        description: record.description ?? null,
        code: record.code ?? null,
        parentId: record.parentId ?? null,
      });
    else state.records.unshift(record);
    return record;
  }
  throw new DemoError(404, "Operação indisponível na demonstração.");
}

function dispatch(state: DemoState, endpoint: string, method: string, data: Payload) {
  const [path, search] = endpoint.split("?", 2);
  const query = new URLSearchParams(search);
  if (method === "GET") {
    if (path === "organizations") return [{ ...company, settings: state.settings }];
    if (path === "auth/me") return user;
    if (path === "auth/sessions") return [];
  }
  const [root, organizationId, resource, id = "", action = "", itemId = ""] = path.split("/");
  requireData(
    root === "organizations" && organizationId === company.id,
    "Operação indisponível na demonstração.",
    404,
  );
  if (resource === "members" && method === "GET") return members;
  if (resource === "dashboard" && method === "GET") return dashboard(state, query);
  if (resource === "settings" && method === "PUT") {
    const logo = data.logoUrl;
    requireData(
      !logo ||
        (typeof logo === "string" &&
          logo.length <= 360_000 &&
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)),
      "Escolha um logo PNG, JPEG ou WebP de até 256 KB.",
    );
    requireData(
      typeof data.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(data.accentColor),
      "Selecione uma cor válida.",
    );
    state.settings = {
      displayName: data.displayName ? nameOf(data.displayName, "nome") : null,
      logoUrl: typeof logo === "string" ? logo : null,
      accentColor: data.accentColor,
      directoryEnabled: data.directoryEnabled === true,
      quotesEnabled: data.quotesEnabled === true,
      ordersEnabled: data.ordersEnabled === true,
    };
    return state.settings;
  }
  if (resource === "quotes") return quoteRequest(state, method, id, action, data, query);
  if (resource === "orders") return orderRequest(state, method, id, action, itemId, data, query);
  if (resource === "directory") {
    requireData(
      state.settings.directoryEnabled ||
        (method === "GET" && ["CUSTOMER", "PRODUCT", "SERVICE"].includes(id) && !action),
      "Módulo de cadastros desabilitado.",
      403,
    );
    return directoryRequest(state, method, id as Kind, action, itemId, data, query);
  }
  throw new DemoError(404, "Operação indisponível na demonstração.");
}

export async function demoResponse(endpoint: string, method: string, body?: object) {
  try {
    const run = () => {
      const state = readState();
      const result = dispatch(state, endpoint, method, (body ?? {}) as Payload);
      if (method !== "GET") writeState(state);
      return Response.json(result);
    };
    return method === "GET" ? run() : await withDemoLock(run);
  } catch (error) {
    if (!(error instanceof DemoError)) throw error;
    return Response.json({ message: error.message }, { status: error.status });
  }
}

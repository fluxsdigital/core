export const directoryKinds = {
  CUSTOMER: "Clientes",
  CONTACT: "Contatos",
  PRODUCT: "Produtos",
  SERVICE: "Serviços",
  CATEGORY: "Categorias",
};

export type Kind = keyof typeof directoryKinds;
export type RecordItem = {
  id: string;
  name: string;
  kind: Kind;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  priceCents?: number | null;
  code?: string | null;
  parentId?: string | null;
};

export function directoryPath(id: string, kind: Kind) {
  return `organizations/${id}/directory/${kind}`;
}

export const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

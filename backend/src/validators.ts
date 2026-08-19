const blockedDomains = [
  "amazon.",
  "amazon.com.br",
  "shopee.",
  "shopee.com.br",
  "mercadolivre.com",
  "mercadolivre.com.br",
  "mercado-livre.com",
];

export function parsePositiveInt(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} deve ser um numero inteiro maior que zero.`);
  }
  return parsed;
}

export function assertRequiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} e obrigatorio.`);
  }
  return value.trim();
}

export function isBlockedSupplierLink(link: string) {
  try {
    const hostname = new URL(link).hostname.toLowerCase().replace(/^www\./, "");
    return blockedDomains.some((domain) => hostname.includes(domain));
  } catch {
    return true;
  }
}

export function assertAllowedSupplierLink(link: unknown) {
  const normalized = assertRequiredText(link, "Link do fornecedor");
  if (isBlockedSupplierLink(normalized)) {
    throw new Error("Links de Amazon, Shopee e Mercado Livre nao sao permitidos.");
  }
  return normalized;
}

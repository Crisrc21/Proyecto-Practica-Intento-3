function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRut(value) {
  const normalized = text(String(value ?? ""))
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
  return normalized || null;
}

export function createBemmboCustomersRepository(client) {
  return {
    async list() {
      const result = await client.listCustomers();
      return result.items.map((customer) => ({
        id: normalizeRut(customer?.fiscalId) ?? text(customer?.id),
        nombre: text(customer?.name) || "Información no disponible",
        rut: normalizeRut(customer?.fiscalId) ?? "",
        tipo: "B2B",
        informacionParcial: result.partialErrorCount > 0
      }));
    }
  };
}

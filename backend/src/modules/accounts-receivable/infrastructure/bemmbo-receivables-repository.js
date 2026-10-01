function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value) {
  const match = text(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function normalizeRut(value) {
  const normalized = text(String(value ?? ""))
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
  return normalized || null;
}

function normalizeNumber(value) {
  const normalized = text(String(value ?? "")).toUpperCase();
  return normalized || null;
}

function numberAliases(value) {
  const normalized = normalizeNumber(value);
  if (!normalized) return [];
  const aliases = new Set([normalized]);
  if (/^\d+$/.test(normalized)) aliases.add(normalized.replace(/^0+(?=\d)/, ""));
  return [...aliases];
}

function documentTypeLabel(documentType) {
  const labels = {
    INVOICE: "Factura Electrónica 33",
    EXEMPT_INVOICE: "Factura Exenta Electrónica 34",
    CREDIT_NOTE: "Nota de Crédito Electrónica 61",
    DEBIT_NOTE: "Nota de Débito Electrónica 56",
    FEE_INVOICE: "Honorarios",
    ELECTRONIC_PURCHASE: "Factura de compra",
    REIMBURSEMENT: "Reembolso"
  };
  return labels[documentType] ?? "Otro documento";
}

function isNullified(document) {
  return [document?.status, document?.fiscalStatus, document?.documentConfirmationStatus]
    .some((status) => text(status).toUpperCase() === "NULLIFIED");
}

function referenceNumbers(document) {
  const references = Array.isArray(document?.references) ? document.references : [];
  return [
    document?.referenceNumber,
    ...references.flatMap((reference) => [
      reference?.referenceNumber,
      reference?.FolioRef,
      reference?.folioRef,
      reference?.number,
      reference?.NroDocRef
    ])
  ].map(normalizeNumber).filter(Boolean);
}

function referenceReason(document) {
  const references = Array.isArray(document?.references) ? document.references : [];
  return references.map((reference) => text(reference?.RazonRef)).find(Boolean) ?? "";
}

function matchesNumber(document, reference) {
  const documentAliases = numberAliases(document?.number);
  const referenceAliases = numberAliases(reference);
  return documentAliases.some((alias) => referenceAliases.includes(alias));
}

function findRelatedDocument(note, documents) {
  const noteRut = normalizeRut(note?.customerFiscalId);
  const references = referenceNumbers(note);
  if (!noteRut || references.length === 0) return null;

  const candidates = documents.filter(
    (document) =>
      document !== note &&
      normalizeRut(document?.customerFiscalId) === noteRut &&
      references.some((reference) => matchesNumber(document, reference))
  );

  return candidates.length === 1 ? candidates[0] : null;
}

function paymentCondition(emissionDate, dueDate) {
  if (!emissionDate || !dueDate) return "Contra Pago";
  const days = Math.round(
    (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${emissionDate}T00:00:00Z`)) /
      86400000
  );
  if (days === 0) return "Contado";
  if ([15, 30, 45, 60].includes(days)) return `${days} días`;
  return "Contra Pago";
}

function mapPayments(document) {
  return (Array.isArray(document?.movements) ? document.movements : [])
    .map((movement, index) => ({
      id: `${text(document?.id) || "document"}-movement-${index}`,
      fechaPago: dateOnly(movement?.date),
      monto: Math.max(0, amount(movement?.amountAssigned)),
      tipo: "Pago"
    }))
    .filter((payment) => payment.fechaPago && payment.monto > 0);
}

function mapCreditNote(note) {
  const reason = referenceReason(note);
  return {
    id: text(note?.id),
    numero: text(note?.number),
    fecha: dateOnly(note?.emissionDate),
    monto: Math.max(0, amount(note?.totalAmount)),
    motivo: /anul/i.test(reason) ? "Anulación total" : "Ajuste comercial",
    observacion: reason || undefined
  };
}

function mapDebitNote(note) {
  const reason = referenceReason(note);
  return {
    id: text(note?.id),
    numero: text(note?.number),
    fecha: dateOnly(note?.emissionDate),
    monto: Math.max(0, amount(note?.availableAmount)),
    motivo: "Otro",
    observacion: reason || undefined
  };
}

function mapBaseDocument(document) {
  const fechaEmision = dateOnly(document?.emissionDate);
  const fechaVencimiento = dateOnly(document?.dueByDate) || fechaEmision;
  const totalAmount = Math.max(0, amount(document?.totalAmount));

  return {
    id: text(document?.id),
    numero: text(document?.number),
    tipoDocumento: documentTypeLabel(document?.documentType),
    clienteId: normalizeRut(document?.customerFiscalId),
    fechaEmision,
    fechaVencimiento,
    condicionPago: paymentCondition(fechaEmision, fechaVencimiento),
    monto: totalAmount,
    anulada: isNullified(document),
    pagos: mapPayments(document),
    notasCredito: [],
    notasDebito: [],
    documentosRelacionados: []
  };
}

export function adaptIssuedDocuments(documents) {
  const baseDocuments = documents.filter(
    (document) => !["CREDIT_NOTE", "DEBIT_NOTE"].includes(document?.documentType)
  );
  const mappedById = new Map(
    baseDocuments.map((document) => [document, mapBaseDocument(document)])
  );
  const standaloneDocuments = [];

  for (const note of documents.filter((document) =>
    ["CREDIT_NOTE", "DEBIT_NOTE"].includes(document?.documentType)
  )) {
    const related = findRelatedDocument(note, baseDocuments);

    if (related) {
      const target = mappedById.get(related);
      if (note.documentType === "CREDIT_NOTE") target.notasCredito.push(mapCreditNote(note));
      if (note.documentType === "DEBIT_NOTE") target.notasDebito.push(mapDebitNote(note));
      target.documentosRelacionados.push({
        id: text(note?.id),
        tipo: documentTypeLabel(note?.documentType),
        numero: text(note?.number),
        fecha: dateOnly(note?.emissionDate),
        observacion: referenceReason(note) || undefined
      });
      continue;
    }

    const standalone = mapBaseDocument(note);
    standalone.monto = 0;
    if (note.documentType === "CREDIT_NOTE") {
      standalone.notasCredito.push(mapCreditNote(note));
    }
    if (note.documentType === "DEBIT_NOTE") {
      standalone.notasDebito.push(mapDebitNote(note));
    }
    standaloneDocuments.push(standalone);
  }

  return [...mappedById.values(), ...standaloneDocuments];
}

export function createBemmboReceivablesRepository(client) {
  return {
    async listCustomers() {
      const result = await client.listCustomers();
      return result.items.map((customer) => ({
        id: normalizeRut(customer?.fiscalId) ?? text(customer?.id),
        nombre: text(customer?.name) || "Información no disponible",
        rut: normalizeRut(customer?.fiscalId) ?? "",
        tipo: "B2B"
      }));
    },
    async listInvoices() {
      const result = await client.listIssuedInvoices();
      return adaptIssuedDocuments(result.items).map((invoice) => ({
        ...invoice,
        informacionParcial: result.partialErrorCount > 0
      }));
    }
  };
}

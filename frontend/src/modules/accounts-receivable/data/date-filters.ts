import { FacturaCalculada } from "@/modules/accounts-receivable/types";

export type DocumentDateField = "fechaEmision" | "fechaVencimiento";

export interface DocumentDateRangeFilter {
  field: DocumentDateField;
  from: string;
  to: string;
}

export const defaultDocumentDateRangeFilter: DocumentDateRangeFilter = {
  field: "fechaEmision",
  from: "",
  to: ""
};

const validDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateValue(value: string | null | undefined) {
  return value && validDatePattern.test(value) ? value : "";
}

export function normalizeDocumentDateField(value: string | null | undefined): DocumentDateField {
  return value === "fechaVencimiento" || value === "vencimiento"
    ? "fechaVencimiento"
    : "fechaEmision";
}

export function normalizeDocumentDateRangeFilter(
  value: Partial<DocumentDateRangeFilter>
): DocumentDateRangeFilter {
  const from = normalizeDateValue(value.from);
  const to = normalizeDateValue(value.to);

  return {
    field: normalizeDocumentDateField(value.field),
    from: from && to && from > to ? to : from,
    to: from && to && from > to ? from : to
  };
}

export function documentDateFieldLabel(field: DocumentDateField) {
  return field === "fechaEmision" ? "emisión" : "vencimiento";
}

export function isDocumentDateRangeActive(filter: DocumentDateRangeFilter) {
  return Boolean(filter.from || filter.to);
}

export function isDateInDocumentRange(value: string, filter: DocumentDateRangeFilter) {
  const normalized = normalizeDocumentDateRangeFilter(filter);

  if (normalized.from && value < normalized.from) return false;
  if (normalized.to && value > normalized.to) return false;
  return true;
}

export function filterFacturasByDateRange<T extends Pick<FacturaCalculada, DocumentDateField>>(
  facturas: T[],
  filter: DocumentDateRangeFilter
) {
  const normalized = normalizeDocumentDateRangeFilter(filter);

  if (!isDocumentDateRangeActive(normalized)) return facturas;

  return facturas.filter((factura) => isDateInDocumentRange(factura[normalized.field], normalized));
}

export function documentDateFilterToSearchParams(
  params: URLSearchParams,
  filter: DocumentDateRangeFilter
) {
  const normalized = normalizeDocumentDateRangeFilter(filter);

  if (isDocumentDateRangeActive(normalized)) {
    params.set("fecha", normalized.field === "fechaVencimiento" ? "vencimiento" : "emision");
    if (normalized.from) params.set("desde", normalized.from);
    if (normalized.to) params.set("hasta", normalized.to);
  }

  return params;
}

export function documentDateFilterFromSearchParams(params: URLSearchParams) {
  return normalizeDocumentDateRangeFilter({
    field: normalizeDocumentDateField(params.get("fecha")),
    from: params.get("desde") ?? "",
    to: params.get("hasta") ?? ""
  });
}

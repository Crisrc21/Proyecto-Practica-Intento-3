import { TipoDocumento, TipoDocumentoRelacionado } from "@/modules/accounts-receivable/types";

type DocumentoConPrefijo = TipoDocumento | TipoDocumentoRelacionado;

const prefijos: Record<DocumentoConPrefijo, string> = {
  "Factura Electrónica 33": "F",
  "Factura Exenta Electrónica 34": "FE",
  "Nota de Crédito Electrónica 61": "NC",
  "Nota de Débito Electrónica 56": "ND",
  "Factura Reemplazo": "F"
};

export function obtenerPrefijoDocumento(tipoDocumento: DocumentoConPrefijo) {
  return prefijos[tipoDocumento];
}

export function limpiarNumeroSii(numero: string) {
  return numero
    .trim()
    .replace(/^(FE|F|NC|ND)[-\s]*/i, "")
    .replace(/[^\dA-Za-z-]/g, "");
}

export function formatearFolioDocumento(
  tipoDocumento: DocumentoConPrefijo,
  numeroSii: string
) {
  const numero = limpiarNumeroSii(numeroSii);
  const prefijo = obtenerPrefijoDocumento(tipoDocumento);

  return `${prefijo} ${numero}`;
}

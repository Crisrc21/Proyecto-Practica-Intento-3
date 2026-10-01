export type TipoCliente = "B2B" | "B2C";

export type TipoDocumento =
  | "Factura Electrónica 33"
  | "Factura Exenta Electrónica 34"
  | "Nota de Crédito Electrónica 61"
  | "Nota de Débito Electrónica 56";

export type TipoDocumentoRelacionado =
  | "Nota de Crédito Electrónica 61"
  | "Nota de Débito Electrónica 56"
  | "Factura Reemplazo";

export type CondicionPago =
  | "Contado"
  | "Contra Pago"
  | "15 días"
  | "30 días"
  | "45 días"
  | "60 días";

export type EstadoVencimiento = "En plazo" | "Vencida";
export type EstadoPago =
  | "No pagado"
  | "Pago parcial"
  | "Pagado";
export type EstadoDocumental = "Activo" | "Anulado";

export type MotivoNotaCredito =
  | "Anulación total"
  | "Corrección de datos"
  | "Devolución"
  | "Ajuste comercial"
  | "Reemplazo de documento"
  | "Otro";

export type MotivoNotaDebito =
  | "Cobro omitido"
  | "Diferencia de precio"
  | "Diferencia de cantidad"
  | "Servicio adicional"
  | "Reajuste contractual"
  | "Otro";

export interface Cliente {
  id: string;
  nombre: string;
  rut: string;
  tipo: TipoCliente;
}

export interface Pago {
  id: string;
  fechaPago: string;
  monto: number;
  observacion?: string;
  tipo: "Pago" | "Abono";
}

export interface NotaCredito {
  id: string;
  numero: string;
  fecha: string;
  monto: number;
  motivo: MotivoNotaCredito;
  observacion?: string;
}

export interface NotaDebito {
  id: string;
  numero: string;
  fecha: string;
  monto: number;
  motivo: MotivoNotaDebito;
  observacion?: string;
}

export interface DocumentoRelacionado {
  id: string;
  tipo: TipoDocumentoRelacionado;
  numero: string;
  fecha: string;
  observacion?: string;
}

export interface Factura {
  id: string;
  numero: string;
  tipoDocumento: TipoDocumento;
  clienteId: string;
  fechaEmision: string;
  fechaVencimiento: string;
  condicionPago: CondicionPago;
  monto: number;
  anulada?: boolean;
  observacion?: string;
  pagos: Pago[];
  notasCredito: NotaCredito[];
  notasDebito: NotaDebito[];
  documentosRelacionados?: DocumentoRelacionado[];
}

export interface FacturaCalculada extends Factura {
  cliente: Cliente;
  montoAjustado: number;
  saldoPendiente: number;
  montoCobrado: number;
  estadoVencimiento: EstadoVencimiento;
  estadoPago: EstadoPago;
  estadoDocumental: EstadoDocumental;
  diasVencidos: number;
  diasAtraso: number | null;
  progresoPago: number;
}

export interface EventoTimeline {
  id: string;
  fecha: string;
  titulo: string;
  descripcion: string;
  monto?: number;
  tipo:
    | "Emisión"
    | "Pago"
    | "Abono"
    | "Nota de Crédito"
    | "Nota de Débito"
    | "Anulación"
    | "Factura de reemplazo"
    | "Cierre";
}

export interface KpisDashboard {
  carteraTotal: number;
  montoCobrado: number;
  montoPendiente: number;
  pendienteEnPlazo: number;
  pendienteVencido: number;
  facturasEnPlazo: number;
  facturasVencidas: number;
  facturasPagadasCompletamente: number;
  distribucionCartera: {
    cobrado: number;
    pendienteEnPlazo: number;
    pendienteVencido: number;
  };
  aging: {
    bucket: "0-30" | "31-60" | "61-90" | "+90";
    monto: number;
  }[];
}

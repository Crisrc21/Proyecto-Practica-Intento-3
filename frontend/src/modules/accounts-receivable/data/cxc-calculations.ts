import { formatearFolioDocumento } from "@/modules/accounts-receivable/data/document-ids";
import { toIsoDate, toLocalDate } from "@/shared/lib/formatters";
import {
  Cliente,
  CondicionPago,
  EventoTimeline,
  Factura,
  FacturaCalculada,
  KpisDashboard
} from "@/modules/accounts-receivable/types";

const diasPorCondicion: Record<CondicionPago, number> = {
  Contado: 0,
  "Contra Pago": 0,
  "15 días": 15,
  "30 días": 30,
  "45 días": 45,
  "60 días": 60
};

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffDays(from: Date, to: Date) {
  const day = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calcularFechaVencimiento(
  fechaEmision: string,
  condicionPago: CondicionPago
) {
  return toIsoDate(addDays(toLocalDate(fechaEmision), diasPorCondicion[condicionPago]));
}

export function calcularMontoAjustado(factura: Factura) {
  if (factura.anulada) return 0;

  const notasDebito = factura.notasDebito.reduce((total, nota) => total + nota.monto, 0);
  const notasCredito = factura.notasCredito.reduce(
    (total, nota) => total + nota.monto,
    0
  );

  return Math.max(0, factura.monto + notasDebito - notasCredito);
}

export function calcularMontoCobrado(factura: Factura) {
  return factura.pagos.reduce((total, pago) => total + pago.monto, 0);
}

export function calcularSaldoFactura(factura: Factura) {
  return Math.max(0, calcularMontoAjustado(factura) - calcularMontoCobrado(factura));
}

export function calcularEstadoPago(factura: Factura) {
  const saldo = calcularSaldoFactura(factura);

  if (saldo === 0) return "Pagado";
  if (saldo > 0 && factura.pagos.length > 0) return "Pago parcial";
  return "No pagado";
}

export function calcularEstadoVencimiento(factura: Factura, today = new Date()) {
  return startOfDay(today) <= toLocalDate(factura.fechaVencimiento)
    ? "En plazo"
    : "Vencida";
}

export function calcularDiasVencidos(factura: Factura, today = new Date()) {
  if (calcularSaldoFactura(factura) === 0) return 0;
  return Math.max(0, diffDays(toLocalDate(factura.fechaVencimiento), startOfDay(today)));
}

export function calcularDiasAtraso(factura: Factura) {
  if (calcularSaldoFactura(factura) > 0 || factura.pagos.length === 0) return null;

  const ultimaFechaPago = factura.pagos
    .map((pago) => toLocalDate(pago.fechaPago))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return Math.max(0, diffDays(toLocalDate(factura.fechaVencimiento), ultimaFechaPago));
}

export function calcularEstadoDocumental(factura: Factura) {
  if (factura.anulada) return "Anulado";

  const anuladaPorNC = factura.notasCredito.some(
    (nota) => nota.motivo === "Anulación total"
  );

  return anuladaPorNC && calcularSaldoFactura(factura) === 0 ? "Anulado" : "Activo";
}

export function enriquecerFactura(
  factura: Factura,
  clientes: Cliente[],
  today = new Date()
): FacturaCalculada {
  const cliente = clientes.find((item) => item.id === factura.clienteId);

  if (!cliente) {
    throw new Error(`Cliente no encontrado para factura ${factura.numero}`);
  }

  const montoAjustado = calcularMontoAjustado(factura);
  const saldoPendiente = calcularSaldoFactura(factura);
  const montoCobrado = calcularMontoCobrado(factura);

  return {
    ...factura,
    cliente,
    montoAjustado,
    saldoPendiente,
    montoCobrado,
    estadoVencimiento: calcularEstadoVencimiento(factura, today),
    estadoPago: calcularEstadoPago(factura),
    estadoDocumental: calcularEstadoDocumental(factura),
    diasVencidos: calcularDiasVencidos(factura, today),
    diasAtraso: calcularDiasAtraso(factura),
    progresoPago:
      montoAjustado === 0 ? 100 : Math.min(100, (montoCobrado / montoAjustado) * 100)
  };
}

export function generarTimelineFactura(factura: Factura): EventoTimeline[] {
  const folioFactura = formatearFolioDocumento(factura.tipoDocumento, factura.numero);
  const eventos: EventoTimeline[] = [
    {
      id: `${factura.id}-emision`,
      fecha: factura.fechaEmision,
      titulo: "Factura emitida",
      descripcion: `${factura.tipoDocumento} ${folioFactura}`,
      monto: factura.monto,
      tipo: "Emisión"
    }
  ];

  factura.pagos.forEach((pago) => {
    eventos.push({
      id: pago.id,
      fecha: pago.fechaPago,
      titulo: pago.tipo === "Abono" ? "Abono registrado" : "Pago registrado",
      descripcion: pago.observacion ?? "Movimiento de cobranza",
      monto: pago.monto,
      tipo: pago.tipo
    });
  });

  factura.notasDebito.forEach((nota) => {
    eventos.push({
      id: nota.id,
      fecha: nota.fecha,
      titulo: `Nota de Débito ${formatearFolioDocumento("Nota de Débito Electrónica 56", nota.numero)}`,
      descripcion: nota.observacion ?? nota.motivo,
      monto: nota.monto,
      tipo: "Nota de Débito"
    });
  });

  factura.notasCredito.forEach((nota) => {
    const folioNota = formatearFolioDocumento("Nota de Crédito Electrónica 61", nota.numero);

    eventos.push({
      id: nota.id,
      fecha: nota.fecha,
      titulo:
        nota.motivo === "Anulación total"
          ? `Anulación con ${folioNota}`
          : `Nota de Crédito ${folioNota}`,
      descripcion: nota.observacion ?? nota.motivo,
      monto: nota.monto,
      tipo: nota.motivo === "Anulación total" ? "Anulación" : "Nota de Crédito"
    });
  });

  if (factura.anulada && !factura.notasCredito.some((nota) => nota.motivo === "Anulación total")) {
    eventos.push({
      id: `${factura.id}-anulacion`,
      fecha: factura.fechaEmision,
      titulo: "Documento anulado",
      descripcion: "Documento anulado en Buk Finanzas",
      tipo: "Anulación"
    });
  }

  factura.documentosRelacionados?.forEach((documento) => {
    eventos.push({
      id: documento.id,
      fecha: documento.fecha,
      titulo: documento.tipo,
      descripcion:
        documento.observacion ??
        `Documento ${formatearFolioDocumento(documento.tipo, documento.numero)}`,
      tipo:
        documento.tipo === "Factura Reemplazo"
          ? "Factura de reemplazo"
          : documento.tipo === "Nota de Crédito Electrónica 61"
            ? "Nota de Crédito"
            : "Nota de Débito"
    });
  });

  if (calcularSaldoFactura(factura) === 0) {
    const ultimaFecha = eventos
      .map((evento) => evento.fecha)
      .sort((a, b) => toLocalDate(b).getTime() - toLocalDate(a).getTime())[0];

    eventos.push({
      id: `${factura.id}-cierre`,
      fecha: ultimaFecha,
      titulo: "Cierre",
      descripcion: "Saldo pendiente igual a cero",
      tipo: "Cierre"
    });
  }

  return eventos.sort(
    (a, b) => toLocalDate(a.fecha).getTime() - toLocalDate(b.fecha).getTime()
  );
}

export function calcularKpisDashboard(
  facturas: Factura[],
  clientes: Cliente[],
  today = new Date()
): KpisDashboard {
  const calculadas = facturas.map((factura) => enriquecerFactura(factura, clientes, today));
  return calcularKpisDesdeFacturasCalculadas(calculadas);
}

export function calcularKpisDesdeFacturasCalculadas(
  calculadas: FacturaCalculada[]
): KpisDashboard {
  const montoCobrado = calculadas.reduce((total, factura) => total + factura.montoCobrado, 0);
  const montoPendiente = calculadas.reduce(
    (total, factura) => total + factura.saldoPendiente,
    0
  );
  const pendienteEnPlazo = calculadas
    .filter((factura) => factura.estadoVencimiento === "En plazo")
    .reduce((total, factura) => total + factura.saldoPendiente, 0);
  const pendienteVencido = calculadas
    .filter((factura) => factura.estadoVencimiento === "Vencida")
    .reduce((total, factura) => total + factura.saldoPendiente, 0);

  return {
    carteraTotal: montoCobrado + montoPendiente,
    montoCobrado,
    montoPendiente,
    pendienteEnPlazo,
    pendienteVencido,
    facturasEnPlazo: calculadas.filter(
      (factura) => factura.estadoVencimiento === "En plazo"
    ).length,
    facturasVencidas: calculadas.filter(
      (factura) => factura.estadoVencimiento === "Vencida"
    ).length,
    facturasPagadasCompletamente: calculadas.filter(
      (factura) => factura.estadoPago === "Pagado"
    ).length,
    distribucionCartera: {
      cobrado: montoCobrado,
      pendienteEnPlazo,
      pendienteVencido
    },
    aging: [
      {
        bucket: "0-30",
        monto: calculadas
          .filter(
            (factura) =>
              factura.estadoVencimiento === "Vencida" &&
              factura.saldoPendiente > 0 &&
              factura.diasVencidos >= 0 &&
              factura.diasVencidos <= 30
          )
          .reduce((total, factura) => total + factura.saldoPendiente, 0)
      },
      {
        bucket: "31-60",
        monto: calculadas
          .filter(
            (factura) =>
              factura.estadoVencimiento === "Vencida" &&
              factura.saldoPendiente > 0 &&
              factura.diasVencidos >= 31 &&
              factura.diasVencidos <= 60
          )
          .reduce((total, factura) => total + factura.saldoPendiente, 0)
      },
      {
        bucket: "61-90",
        monto: calculadas
          .filter(
            (factura) =>
              factura.estadoVencimiento === "Vencida" &&
              factura.saldoPendiente > 0 &&
              factura.diasVencidos >= 61 &&
              factura.diasVencidos <= 90
          )
          .reduce((total, factura) => total + factura.saldoPendiente, 0)
      },
      {
        bucket: "+90",
        monto: calculadas
          .filter(
            (factura) =>
              factura.estadoVencimiento === "Vencida" &&
              factura.saldoPendiente > 0 &&
              factura.diasVencidos > 90
          )
          .reduce((total, factura) => total + factura.saldoPendiente, 0)
      }
    ]
  };
}

import { documentStatuses, dueStatuses, paymentStatuses } from "../domain/document-model.js";

function enrichInvoice(invoice, customers) {
  const customer = customers.find((item) => item.id === invoice.clienteId);
  const creditNotes = invoice.notasCredito.reduce((total, item) => total + item.monto, 0);
  const debitNotes = invoice.notasDebito.reduce((total, item) => total + item.monto, 0);
  const paid = invoice.pagos.reduce((total, item) => total + item.monto, 0);
  const adjustedAmount = invoice.anulada ? 0 : Math.max(invoice.monto - creditNotes + debitNotes, 0);
  const voidedByCreditNote = invoice.notasCredito.some((item) => item.motivo === "Anulación total");
  const pendingBalance = Math.max(adjustedAmount - paid, 0);
  const today = new Date();
  const dueDate = new Date(`${invoice.fechaVencimiento}T00:00:00`);
  const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));

  return {
    ...invoice,
    cliente: customer,
    montoAjustado: adjustedAmount,
    saldoPendiente: pendingBalance,
    montoCobrado: paid,
    estadoVencimiento: pendingBalance > 0 && overdueDays > 0 ? dueStatuses.overdue : dueStatuses.current,
    estadoPago: pendingBalance === 0 ? paymentStatuses.paid : paid > 0 ? paymentStatuses.partial : paymentStatuses.unpaid,
    estadoDocumental: invoice.anulada || voidedByCreditNote ? documentStatuses.voided : documentStatuses.active,
    diasVencidos: overdueDays,
    progresoPago: adjustedAmount === 0 ? 100 : Math.round((paid / adjustedAmount) * 100)
  };
}

export function createAccountsReceivableService(repository) {
  async function listInvoices() {
    const [customers, invoices] = await Promise.all([repository.listCustomers(), repository.listInvoices()]);
    return invoices.map((invoice) => enrichInvoice(invoice, customers));
  }

  async function getDashboard() {
    const invoices = await listInvoices();
    const montoCobrado = invoices.reduce((total, invoice) => total + invoice.montoCobrado, 0);
    const montoPendiente = invoices.reduce((total, invoice) => total + invoice.saldoPendiente, 0);

    return {
      carteraTotal: montoCobrado + montoPendiente,
      montoCobrado,
      montoPendiente,
      pendienteEnPlazo: invoices
        .filter((invoice) => invoice.estadoVencimiento === dueStatuses.current)
        .reduce((total, invoice) => total + invoice.saldoPendiente, 0),
      pendienteVencido: invoices
        .filter((invoice) => invoice.estadoVencimiento === dueStatuses.overdue)
        .reduce((total, invoice) => total + invoice.saldoPendiente, 0),
      facturasEnPlazo: invoices.filter((invoice) => invoice.estadoVencimiento === dueStatuses.current).length,
      facturasVencidas: invoices.filter((invoice) => invoice.estadoVencimiento === dueStatuses.overdue).length
    };
  }

  async function getTimelines() {
    const invoices = await listInvoices();
    return Object.fromEntries(
      invoices.map((invoice) => [
        invoice.id,
        [
          {
            id: `${invoice.id}-issued`,
            fecha: invoice.fechaEmision,
            titulo: "Emision",
            descripcion: `Documento ${invoice.numero} emitido a ${invoice.cliente?.nombre ?? "cliente"}.`,
            monto: invoice.monto,
            tipo: "Emision"
          },
          ...invoice.pagos.map((payment) => ({
            id: payment.id,
            fecha: payment.fechaPago,
            titulo: payment.tipo,
            descripcion: `Pago registrado para documento ${invoice.numero}.`,
            monto: payment.monto,
            tipo: payment.tipo
          }))
        ].sort((left, right) => left.fecha.localeCompare(right.fecha))
      ])
    );
  }

  return { getDashboard, listInvoices, getTimelines };
}

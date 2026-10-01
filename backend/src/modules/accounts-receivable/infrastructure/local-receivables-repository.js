const customers = [
  { id: "cli-001", nombre: "Constructora Andes SpA", rut: "76.245.891-4", tipo: "B2B" },
  { id: "cli-002", nombre: "Inversiones Costa Sur Ltda.", rut: "77.018.334-8", tipo: "B2B" },
  { id: "cli-003", nombre: "Maria Fernanda Rojas", rut: "15.338.452-1", tipo: "B2C" },
  { id: "cli-004", nombre: "Servicios Logisticos Norte S.A.", rut: "96.831.440-2", tipo: "B2B" }
];

const invoices = [
  {
    id: "fac-001",
    numero: "000145",
    tipoDocumento: "Factura Electronica 33",
    clienteId: "cli-001",
    fechaEmision: "2026-05-10",
    fechaVencimiento: "2026-06-09",
    condicionPago: "30 dias",
    monto: 14200000,
    pagos: [],
    notasCredito: [],
    notasDebito: []
  },
  {
    id: "fac-002",
    numero: "000132",
    tipoDocumento: "Factura Electronica 33",
    clienteId: "cli-002",
    fechaEmision: "2026-03-18",
    fechaVencimiento: "2026-05-02",
    condicionPago: "45 dias",
    monto: 8650000,
    pagos: [{ id: "pag-001", fechaPago: "2026-04-20", monto: 4000000, tipo: "Abono" }],
    notasCredito: [],
    notasDebito: [{ id: "nd-001", numero: "000018", fecha: "2026-04-02", monto: 520000, motivo: "Servicio adicional" }]
  },
  {
    id: "fac-003",
    numero: "000087",
    tipoDocumento: "Factura Exenta Electronica 34",
    clienteId: "cli-003",
    fechaEmision: "2026-01-15",
    fechaVencimiento: "2026-01-30",
    condicionPago: "15 dias",
    monto: 1250000,
    pagos: [{ id: "pag-002", fechaPago: "2026-02-04", monto: 1250000, tipo: "Pago" }],
    notasCredito: [],
    notasDebito: []
  }
];

export function createLocalReceivablesRepository() {
  return {
    async listCustomers() {
      return customers;
    },
    async listInvoices() {
      return invoices;
    }
  };
}

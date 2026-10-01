"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarDays,
  FileCheck2,
  FileDigit,
  FilePenLine,
  Save,
  Search,
  UploadCloud,
  X
} from "lucide-react";
import { motion } from "framer-motion";
import { DocumentFolio } from "@/modules/accounts-receivable/components/document-folio";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input, Label, Select, Textarea } from "@/shared/components/ui/form";
import { calcularFechaVencimiento } from "@/modules/accounts-receivable/data/cxc-calculations";
import { limpiarNumeroSii, obtenerPrefijoDocumento } from "@/modules/accounts-receivable/data/document-ids";
import { formatCurrency, formatDate, toIsoDate } from "@/shared/lib/formatters";
import {
  Cliente,
  CondicionPago,
  FacturaCalculada,
  MotivoNotaCredito,
  MotivoNotaDebito,
  TipoDocumento,
  TipoDocumentoRelacionado
} from "@/modules/accounts-receivable/types";

type DocumentoIngreso = TipoDocumento | Extract<TipoDocumentoRelacionado, "Nota de Crédito Electrónica 61" | "Nota de Débito Electrónica 56">;

const condicionesPago: CondicionPago[] = [
  "Contado",
  "Contra Pago",
  "15 días",
  "30 días",
  "45 días",
  "60 días"
];

const tiposDocumento: DocumentoIngreso[] = [
  "Factura Electrónica 33",
  "Factura Exenta Electrónica 34",
  "Nota de Crédito Electrónica 61",
  "Nota de Débito Electrónica 56"
];

const motivosNotaCredito: MotivoNotaCredito[] = [
  "Anulación total",
  "Corrección de datos",
  "Devolución",
  "Ajuste comercial",
  "Reemplazo de documento",
  "Otro"
];

const motivosNotaDebito: MotivoNotaDebito[] = [
  "Cobro omitido",
  "Diferencia de precio",
  "Diferencia de cantidad",
  "Servicio adicional",
  "Reajuste contractual",
  "Otro"
];

export function InvoiceForm({
  clientes,
  facturas
}: {
  clientes: Cliente[];
  facturas: FacturaCalculada[];
}) {
  const [numeroSii, setNumeroSii] = useState("000151");
  const [tipoDocumento, setTipoDocumento] = useState<DocumentoIngreso>(tiposDocumento[0]);
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [facturaRelacionadaId, setFacturaRelacionadaId] = useState(facturas[0]?.id ?? "");
  const [busquedaFacturaRelacionada, setBusquedaFacturaRelacionada] = useState("");
  const [fechaEmision, setFechaEmision] = useState(toIsoDate(new Date()));
  const [condicionPago, setCondicionPago] = useState<CondicionPago>("30 días");
  const [motivoNotaCredito, setMotivoNotaCredito] = useState<MotivoNotaCredito>("Ajuste comercial");
  const [motivoNotaDebito, setMotivoNotaDebito] = useState<MotivoNotaDebito>("Cobro omitido");
  const [monto, setMonto] = useState("2500000");
  const [observacion, setObservacion] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);

  const fechaVencimiento = useMemo(
    () => calcularFechaVencimiento(fechaEmision, condicionPago),
    [fechaEmision, condicionPago]
  );

  const cliente = clientes.find((item) => item.id === clienteId);
  const facturaRelacionada = facturas.find((item) => item.id === facturaRelacionadaId) ?? facturas[0];
  const facturasRelacionadasFiltradas = useMemo(() => {
    const term = busquedaFacturaRelacionada.trim().toLowerCase();

    if (!term) return facturas;

    return facturas.filter((factura) => {
      const prefijo = obtenerPrefijoDocumento(factura.tipoDocumento).toLowerCase();
      const numero = limpiarNumeroSii(factura.numero).toLowerCase();

      return (
        `${prefijo} ${numero}`.includes(term) ||
        factura.numero.toLowerCase().includes(term) ||
        factura.cliente.nombre.toLowerCase().includes(term) ||
        factura.cliente.rut.toLowerCase().includes(term)
      );
    });
  }, [busquedaFacturaRelacionada, facturas]);
  const facturaRelacionadaVisible = facturasRelacionadasFiltradas.some((factura) => factura.id === facturaRelacionadaId);
  const montoNumerico = Number(monto) || 0;
  const prefijoDocumento = obtenerPrefijoDocumento(tipoDocumento);
  const esNotaCredito = tipoDocumento === "Nota de Crédito Electrónica 61";
  const esNotaDebito = tipoDocumento === "Nota de Débito Electrónica 56";
  const esNota = esNotaCredito || esNotaDebito;
  const tituloDocumento = esNotaCredito
    ? "Nueva nota de crédito"
    : esNotaDebito
      ? "Nueva nota de débito"
      : "Nueva factura";
  const descripcionDocumento = esNota
    ? "Relaciona el documento con una factura para ajustar saldo y trazabilidad."
    : "El vencimiento se calcula desde emisión y condición de pago.";
  const efectoDocumento = esNotaCredito ? "Disminuye saldo pendiente" : esNotaDebito ? "Aumenta saldo pendiente" : "Genera cartera por cobrar";
  const motivoDocumento = esNotaCredito ? motivoNotaCredito : motivoNotaDebito;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader className="border-b bg-stone-50/70 dark:border-stone-700 dark:bg-stone-900/50">
            <CardTitle>{tituloDocumento}</CardTitle>
            <CardDescription>
              {descripcionDocumento}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="numeroSii">Número SII</Label>
                <div className="flex overflow-hidden rounded-md border border-input bg-white shadow-sm focus-within:ring-2 focus-within:ring-ring dark:bg-stone-900">
                  <span className="flex min-w-14 items-center justify-center border-r bg-stone-100 px-3 text-sm font-semibold text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
                    {prefijoDocumento}
                  </span>
                  <Input
                    id="numeroSii"
                    value={numeroSii}
                    onChange={(event) => setNumeroSii(event.target.value)}
                    className="border-0 shadow-none focus:ring-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipoDocumento">Tipo documento</Label>
                <Select
                  id="tipoDocumento"
                  value={tipoDocumento}
                  onChange={(event) => setTipoDocumento(event.target.value as DocumentoIngreso)}
                >
                  {tiposDocumento.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente</Label>
                <Select
                  id="cliente"
                  value={clienteId}
                  onChange={(event) => setClienteId(event.target.value)}
                >
                  {clientes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaEmision">Fecha emisión</Label>
                <Input
                  id="fechaEmision"
                  type="date"
                  value={fechaEmision}
                  onChange={(event) => setFechaEmision(event.target.value)}
                />
              </div>
              {esNota ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="facturaRelacionada">Factura relacionada</Label>
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={busquedaFacturaRelacionada}
                        onChange={(event) => setBusquedaFacturaRelacionada(event.target.value)}
                        placeholder="Buscar por folio, cliente o RUT"
                        className="pl-9"
                      />
                    </label>
                    <Select
                      id="facturaRelacionada"
                      value={facturaRelacionadaVisible ? facturaRelacionadaId : ""}
                      disabled={facturasRelacionadasFiltradas.length === 0}
                      onChange={(event) => {
                        const selected = facturas.find((item) => item.id === event.target.value);
                        setFacturaRelacionadaId(event.target.value);
                        if (selected) setClienteId(selected.cliente.id);
                      }}
                    >
                      {facturasRelacionadasFiltradas.length === 0 && (
                        <option value="" disabled>
                          Sin facturas para esta búsqueda
                        </option>
                      )}
                      {facturasRelacionadasFiltradas.map((factura) => (
                        <option key={factura.id} value={factura.id}>
                          {obtenerPrefijoDocumento(factura.tipoDocumento)} {limpiarNumeroSii(factura.numero)} · {factura.cliente.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motivoDocumento">Motivo</Label>
                    <Select
                      id="motivoDocumento"
                      value={motivoDocumento}
                      onChange={(event) =>
                        esNotaCredito
                          ? setMotivoNotaCredito(event.target.value as MotivoNotaCredito)
                          : setMotivoNotaDebito(event.target.value as MotivoNotaDebito)
                      }
                    >
                      {(esNotaCredito ? motivosNotaCredito : motivosNotaDebito).map((motivo) => (
                        <option key={motivo} value={motivo}>
                          {motivo}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="condicionPago">Condición de pago</Label>
                  <Select
                    id="condicionPago"
                    value={condicionPago}
                    onChange={(event) => setCondicionPago(event.target.value as CondicionPago)}
                  >
                    {condicionesPago.map((condicion) => (
                      <option key={condicion} value={condicion}>
                        {condicion}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="monto">Monto</Label>
                <Input
                  id="monto"
                  type="number"
                  min="0"
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="observacion">Observación</Label>
                <Textarea
                  id="observacion"
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  placeholder="Detalle opcional para cobranza o trazabilidad"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pdf">Archivo PDF</Label>
                <label className="group flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50/70 px-4 py-6 text-center transition hover:border-orange-300 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900/60 dark:hover:border-orange-500/40 dark:hover:bg-stone-900">
                  <UploadCloud
                    className="size-9 text-stone-400 transition group-hover:-translate-y-0.5 group-hover:text-orange-500"
                    aria-hidden="true"
                  />
                  <span className="mt-3 text-sm font-semibold">Subir PDF del documento</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    Adjuntar factura, NC o ND en formato PDF
                  </span>
                  <input
                    id="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {pdfFile && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3 text-sm shadow-sm dark:border-stone-700 dark:bg-stone-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileCheck2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{pdfFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={() => setPdfFile(null)}
                      aria-label="Quitar PDF"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </motion.div>
                )}
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">
                  <Save className="size-4" aria-hidden="true" />
                  Registrar localmente
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <Card className="sticky top-5 overflow-hidden dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader className="border-b bg-primary text-primary-foreground">
            <CardTitle className="flex items-center gap-2">
              <FileDigit className="size-5" aria-hidden="true" />
              Resumen
            </CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Vista previa del documento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-md bg-muted p-3 dark:bg-stone-900">
              {esNota ? (
                <FilePenLine className="size-5 text-primary" aria-hidden="true" />
              ) : (
                <CalendarDays className="size-5 text-primary" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {esNota
                    ? `Aplica a ${facturaRelacionada ? `${obtenerPrefijoDocumento(facturaRelacionada.tipoDocumento)} ${facturaRelacionada.numero}` : "factura"}`
                    : `Vence el ${formatDate(fechaVencimiento)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {esNota ? efectoDocumento : condicionPago}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Documento</span>
                <DocumentFolio tipoDocumento={tipoDocumento} numero={numeroSii} size="sm" />
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Cliente</span>
                <span className="text-right font-medium">{cliente?.nombre}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Monto</span>
                <span className="number-tabular font-medium">{formatCurrency(montoNumerico)}</span>
              </div>
              {esNota ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Motivo</span>
                    <span className="text-right font-medium">{motivoDocumento}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Efecto</span>
                    <span className={`text-right font-medium ${esNotaCredito ? "text-emerald-600 dark:text-emerald-300" : "text-orange-600 dark:text-orange-300"}`}>
                      {esNotaCredito ? "-" : "+"}
                      {formatCurrency(montoNumerico)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Saldo inicial</span>
                  <span className="number-tabular font-medium">{formatCurrency(montoNumerico)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">PDF</span>
                <span className="max-w-40 truncate text-right font-medium">
                  {pdfFile?.name ?? "Pendiente"}
                </span>
              </div>
            </div>
            {saved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                Documento preparado en modo local. La persistencia real queda lista para conectar a SQL.
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

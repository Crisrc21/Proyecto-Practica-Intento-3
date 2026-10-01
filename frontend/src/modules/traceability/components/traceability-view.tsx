"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CircleCheck,
  CreditCard,
  FilePenLine,
  GitBranch,
  ReceiptText,
  Search
} from "lucide-react";
import { navigateTo } from "@/app/navigation";
import {
  EstadoDocumentalBadge,
  EstadoPagoBadge,
  EstadoVencimientoBadge
} from "@/modules/accounts-receivable/components/status-badges";
import { DocumentFolio, nombreCortoDocumento } from "@/modules/accounts-receivable/components/document-folio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input, Label } from "@/shared/components/ui/form";
import { Progress } from "@/shared/components/ui/progress";
import { formatearFolioDocumento, limpiarNumeroSii } from "@/modules/accounts-receivable/data/document-ids";
import { formatCurrency, formatDate } from "@/shared/lib/formatters";
import { cn } from "@/shared/lib/classnames";
import { EventoTimeline, FacturaCalculada } from "@/modules/accounts-receivable/types";

import { InvoiceProjectRelation } from "@/modules/projects/components/invoice-project-relation";

function iconForEvent(tipo: EventoTimeline["tipo"]) {
  if (tipo === "Pago" || tipo === "Abono") return CreditCard;
  if (tipo === "Nota de Crédito" || tipo === "Nota de Débito" || tipo === "Anulación") {
    return FilePenLine;
  }
  if (tipo === "Cierre") return CircleCheck;
  return ReceiptText;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function TraceabilityView({
  facturas,
  timelines,
  initialFacturaId
}: {
  facturas: FacturaCalculada[];
  timelines: Record<string, EventoTimeline[]>;
  initialFacturaId?: string;
}) {
  const [facturaId, setFacturaId] = useState(initialFacturaId ?? facturas[0]?.id ?? "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);

  const factura = useMemo(
    () => facturas.find((item) => item.id === facturaId) ?? facturas[0],
    [facturaId, facturas]
  );
  const searchableFacturas = useMemo(() => {
    const term = normalizeSearchValue(searchTerm);
    const orderedFacturas = [...facturas].sort((a, b) => {
      if (a.id === facturaId) return -1;
      if (b.id === facturaId) return 1;
      return new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime();
    });

    if (!term) return orderedFacturas.slice(0, 8);

    return orderedFacturas
      .filter((item) => {
        const folio = formatearFolioDocumento(item.tipoDocumento, item.numero);
        const relatedDocuments = [
          ...item.notasCredito.map((nota) => `NC ${nota.numero} ${nota.motivo}`),
          ...item.notasDebito.map((nota) => `ND ${nota.numero} ${nota.motivo}`),
          ...(item.documentosRelacionados ?? []).map((documento) => `${documento.tipo} ${documento.numero}`)
        ].join(" ");
        const haystack = [
          folio,
          item.numero,
          limpiarNumeroSii(item.numero),
          item.cliente.nombre,
          item.cliente.rut,
          item.tipoDocumento,
          nombreCortoDocumento(item.tipoDocumento),
          item.condicionPago,
          item.estadoPago,
          item.estadoVencimiento,
          item.estadoDocumental,
          relatedDocuments
        ].join(" ");

        return normalizeSearchValue(haystack).includes(term);
      })
      .slice(0, 10);
  }, [facturaId, facturas, searchTerm]);
  const timeline = factura ? timelines[factura.id] : [];
  const relatedDocuments = useMemo(() => {
    if (!factura) return [];

    return [
      ...factura.notasCredito.map((nota) => ({
        id: nota.id,
        titulo: formatearFolioDocumento("Nota de Crédito Electrónica 61", nota.numero),
        fecha: nota.fecha,
        monto: nota.monto,
        detalle: nota.motivo
      })),
      ...factura.notasDebito.map((nota) => ({
        id: nota.id,
        titulo: formatearFolioDocumento("Nota de Débito Electrónica 56", nota.numero),
        fecha: nota.fecha,
        monto: nota.monto,
        detalle: nota.motivo
      })),
      ...(factura.documentosRelacionados ?? []).map((documento) => ({
        id: documento.id,
        titulo: formatearFolioDocumento(documento.tipo, documento.numero),
        fecha: documento.fecha,
        monto: undefined,
        detalle: documento.tipo
      }))
    ];
  }, [factura]);

  useEffect(() => {
    setFacturaId(initialFacturaId ?? facturas[0]?.id ?? "");
  }, [facturas, initialFacturaId]);

  function selectFactura(nextFacturaId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("factura", nextFacturaId);

    setFacturaId(nextFacturaId);
    setSearchTerm("");
    setSelectorOpen(false);
    navigateTo(`/trazabilidad?${params.toString()}`, { scroll: false });
  }

  if (!factura) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        <InvoiceProjectRelation key={factura.id} invoiceId={factura.id} />
        <Card className="overflow-hidden dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader className="border-b bg-slate-950 text-white">
            <CardTitle>Documento</CardTitle>
            <CardDescription className="text-white/65">
              Selecciona una factura para revisar su historia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              className="space-y-2"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setSelectorOpen(false);
                }
              }}
            >
              <Label htmlFor="factura-search">Buscar documento</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                <Input
                  id="factura-search"
                  role="combobox"
                  aria-expanded={selectorOpen}
                  aria-controls="traceability-document-results"
                  aria-autocomplete="list"
                  value={searchTerm}
                  onFocus={() => setSelectorOpen(true)}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setSelectorOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSelectorOpen(false);
                    }

                    if (event.key === "Enter" && searchableFacturas[0]) {
                      event.preventDefault();
                      selectFactura(searchableFacturas[0].id);
                    }
                  }}
                  placeholder="Folio, cliente, RUT, tipo o estado"
                  className="pl-9"
                />
                {selectorOpen ? (
                  <div
                    id="traceability-document-results"
                    role="listbox"
                    className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl dark:border-stone-700 dark:bg-stone-950"
                  >
                    {searchableFacturas.length > 0 ? (
                      searchableFacturas.map((item) => {
                        const selected = item.id === factura.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectFactura(item.id)}
                            className={cn(
                              "grid w-full gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-stone-50 dark:hover:bg-stone-900",
                              selected && "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                            )}
                          >
                            <span className="flex min-w-0 items-center justify-between gap-3">
                              <DocumentFolio tipoDocumento={item.tipoDocumento} numero={item.numero} size="sm" />
                              <span className="number-tabular shrink-0 text-xs font-semibold text-stone-500 dark:text-stone-400">
                                {formatCurrency(item.saldoPendiente)}
                              </span>
                            </span>
                            <span className="min-w-0 truncate font-medium text-stone-700 dark:text-stone-200">
                              {item.cliente.nombre}
                            </span>
                            <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                              <span>{nombreCortoDocumento(item.tipoDocumento)}</span>
                              <span>·</span>
                              <span>{item.estadoPago}</span>
                              <span>·</span>
                              <span>{item.estadoVencimiento}</span>
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-3 py-4 text-center text-sm text-stone-500 dark:text-stone-400">
                        Sin documentos para esa búsqueda.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Busca por factura, cliente, RUT, tipo documental, NC/ND, pago o vencimiento.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white text-stone-950 shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-stone-700 dark:bg-stone-900/85 dark:text-white">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">Folio documental</p>
                    <DocumentFolio
                      tipoDocumento={factura.tipoDocumento}
                      numero={factura.numero}
                      size="lg"
                      showLabel={false}
                      className="mt-3"
                    />
                  </div>
                  <span className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
                    {nombreCortoDocumento(factura.tipoDocumento)}
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500 dark:text-stone-400">Monto ajustado</span>
                    <span className="number-tabular font-semibold">
                      {formatCurrency(factura.montoAjustado)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500 dark:text-stone-400">Saldo pendiente</span>
                    <span className="number-tabular font-semibold">
                      {formatCurrency(factura.saldoPendiente)}
                    </span>
                  </div>
                  <Progress
                    value={
                      factura.montoAjustado === 0
                        ? 0
                        : (factura.saldoPendiente / factura.montoAjustado) * 100
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <EstadoVencimientoBadge estado={factura.estadoVencimiento} />
              <EstadoPagoBadge estado={factura.estadoPago} />
              <EstadoDocumentalBadge estado={factura.estadoDocumental} />
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Cliente:{" "}
                <span className="font-medium text-foreground">{factura.cliente.nombre}</span>
              </p>
              <p>Emisión: {formatDate(factura.fechaEmision)}</p>
              <p>Vencimiento: {formatDate(factura.fechaVencimiento)}</p>
              <p>Condición: {factura.condicionPago}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader>
            <CardTitle>Pagos y abonos</CardTitle>
            <CardDescription>Monto cobrado contra monto ajustado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {factura.pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              factura.pagos.map((pago) => (
                <div key={pago.id} className="rounded-md border border-stone-200 bg-white p-3 text-sm shadow-sm dark:border-stone-700 dark:bg-stone-900">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{pago.tipo}</span>
                    <span className="number-tabular">{formatCurrency(pago.monto)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {formatDate(pago.fechaPago)} · {pago.observacion ?? "Sin observación"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader>
            <CardTitle>Notas y relacionados</CardTitle>
            <CardDescription>NC, ND y facturas de reemplazo vinculadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {relatedDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin documentos relacionados.</p>
            ) : (
              relatedDocuments.map((documento) => (
                <div key={documento.id} className="rounded-md border border-stone-200 bg-white p-3 text-sm shadow-sm dark:border-stone-700 dark:bg-stone-900">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{documento.titulo}</span>
                    {documento.monto !== undefined && (
                      <span className="number-tabular">{formatCurrency(documento.monto)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {formatDate(documento.fecha)} · {documento.detalle}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader className="border-b bg-stone-50/70 dark:border-stone-700 dark:bg-stone-900/50">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300">
                <GitBranch className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Trazabilidad documental</CardTitle>
                <CardDescription>
                  Timeline cronológica de emisión, pagos, notas y cierre.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-5 pl-8 before:absolute before:left-3 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-border dark:before:bg-stone-700">
              {timeline.map((evento, index) => {
                const Icon = iconForEvent(evento.tipo);

                return (
                  <motion.div
                    key={evento.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="relative"
                  >
                    <span className="absolute -left-[31px] top-1 flex size-7 items-center justify-center rounded-full border border-stone-200 bg-white text-primary shadow-sm dark:border-orange-500/25 dark:bg-stone-900 dark:text-orange-300">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="rounded-md border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-stone-700 dark:bg-stone-900">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{evento.titulo}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{evento.descripcion}</p>
                        </div>
                        <div className="text-sm text-muted-foreground sm:text-right">
                          <p>{formatDate(evento.fecha)}</p>
                          {evento.monto !== undefined && (
                            <p className="number-tabular font-medium text-foreground">
                              {formatCurrency(evento.monto)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

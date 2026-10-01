import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import { ArrowUpDown, Banknote, FileText, Search, WalletCards } from "lucide-react";
import { navigateTo } from "@/app/navigation";
import { DocumentConditionsPanel } from "@/modules/accounts-receivable/components/document-conditions-panel";
import { DocumentDateFilter } from "@/modules/accounts-receivable/components/document-date-filter";
import { DocumentFolio } from "@/modules/accounts-receivable/components/document-folio";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input, Select } from "@/shared/components/ui/form";
import { Progress } from "@/shared/components/ui/progress";
import {
  defaultDocumentDateRangeFilter,
  DocumentDateRangeFilter,
  documentDateFilterFromSearchParams,
  documentDateFilterToSearchParams,
  filterFacturasByDateRange,
  isDocumentDateRangeActive
} from "@/modules/accounts-receivable/data/date-filters";
import { formatearFolioDocumento } from "@/modules/accounts-receivable/data/document-ids";
import { formatCurrency, formatDate } from "@/shared/lib/formatters";
import { EstadoDocumental, EstadoPago, EstadoVencimiento, FacturaCalculada } from "@/modules/accounts-receivable/types";
import { cn } from "@/shared/lib/classnames";

export type FiltroFactura =
  | "Todas"
  | "Pendientes"
  | "En plazo"
  | "Por vencer"
  | "Vencidas"
  | "Sin pago"
  | "Pago parcial"
  | "Pagadas"
  | "Anulados"
  | "Con NC"
  | "Con ND";

type DocumentConditionKey =
  | "FACTURA"
  | "FACTURA_EXENTA"
  | "NOTA_CREDITO"
  | "NOTA_DEBITO"
  | "REEMPLAZO"
  | "ANULACION";

type FacturasViewMode = "documentos" | "pagos";

const filtros: FiltroFactura[] = [
  "Todas",
  "Pendientes",
  "En plazo",
  "Por vencer",
  "Vencidas",
  "Sin pago",
  "Pago parcial",
  "Pagadas",
  "Anulados",
  "Con NC",
  "Con ND"
];

const documentConditionOptions: {
  key: DocumentConditionKey;
  label: string;
  description: string;
  matches: (factura: FacturaCalculada) => boolean;
}[] = [
  {
    key: "FACTURA",
    label: "Factura",
    description: "Documentos afectos",
    matches: (factura) => factura.tipoDocumento === "Factura Electrónica 33"
  },
  {
    key: "FACTURA_EXENTA",
    label: "Factura exenta",
    description: "Documentos exentos",
    matches: (factura) => factura.tipoDocumento === "Factura Exenta Electrónica 34"
  },
  {
    key: "NOTA_CREDITO",
    label: "Nota de crédito",
    description: "Facturas con NC",
    matches: (factura) => factura.notasCredito.length > 0
  },
  {
    key: "NOTA_DEBITO",
    label: "Nota de débito",
    description: "Facturas con ND",
    matches: (factura) => factura.notasDebito.length > 0
  },
  {
    key: "REEMPLAZO",
    label: "Reemplazo",
    description: "Factura relacionada",
    matches: (factura) =>
      factura.documentosRelacionados?.some((documento) => documento.tipo === "Factura Reemplazo") ?? false
  },
  {
    key: "ANULACION",
    label: "Anulación",
    description: "Documento anulado",
    matches: (factura) => factura.estadoDocumental === "Anulado"
  }
];

function aplicaFiltro(factura: FacturaCalculada, filtro: FiltroFactura) {
  if (filtro === "Todas") return true;
  if (filtro === "Pendientes") return factura.saldoPendiente > 0;
  if (filtro === "En plazo") return factura.estadoVencimiento === "En plazo";
  if (filtro === "Por vencer") return factura.estadoVencimiento === "En plazo" && factura.saldoPendiente > 0;
  if (filtro === "Vencidas") return factura.estadoVencimiento === "Vencida";
  if (filtro === "Sin pago") return factura.estadoPago === "No pagado";
  if (filtro === "Pago parcial") return factura.estadoPago === "Pago parcial";
  if (filtro === "Pagadas") return factura.estadoPago === "Pagado";
  if (filtro === "Anulados") return factura.estadoDocumental === "Anulado";
  if (filtro === "Con NC") return factura.notasCredito.length > 0;
  return factura.notasDebito.length > 0;
}

function isDocumentConditionKey(value: string): value is DocumentConditionKey {
  return documentConditionOptions.some((option) => option.key === value);
}

function parseDocumentConditions(params: URLSearchParams): DocumentConditionKey[] {
  const fromConditions = params
    .get("documentos")
    ?.split(",")
    .filter(isDocumentConditionKey);

  if (fromConditions?.length) return [...new Set(fromConditions)];

  const legacyType = params.get("tipo");
  const legacyOption = documentConditionOptions.find((option) => option.label === legacyType);

  return legacyOption ? [legacyOption.key] : [];
}

function facturaMatchesDocumentConditions(
  factura: FacturaCalculada,
  selectedConditions: DocumentConditionKey[]
) {
  if (selectedConditions.length === 0) return true;

  return selectedConditions.some((condition) => {
    const option = documentConditionOptions.find((item) => item.key === condition);
    return option?.matches(factura) ?? false;
  });
}

export function normalizarFiltroFactura(value: string | null): FiltroFactura {
  const decoded = value ? decodeURIComponent(value).toLowerCase() : "";
  return filtros.find((item) => item.toLowerCase() === decoded) ?? "Todas";
}

function EstadoVencimientoCompacto({ estado }: { estado: EstadoVencimiento }) {
  return (
    <Badge tone={estado === "Vencida" ? "danger" : "success"}>
      {estado}
    </Badge>
  );
}

function EstadoPagoCompacto({ estado }: { estado: EstadoPago }) {
  const tone =
    estado === "Pagado"
      ? "success"
      : estado === "Pago parcial"
        ? "warning"
        : "muted";
  return <Badge tone={tone}>{estado}</Badge>;
}

function EstadoDocumentalCompacto({ estado }: { estado: EstadoDocumental }) {
  return <Badge tone={estado === "Anulado" ? "danger" : "default"}>{estado}</Badge>;
}

function calcularResumenFacturasFiltradas(facturas: FacturaCalculada[]) {
  return facturas.reduce(
    (resumen, factura) => ({
      cantidad: resumen.cantidad + 1,
      montoAjustado: resumen.montoAjustado + factura.montoAjustado,
      montoCobrado: resumen.montoCobrado + factura.montoCobrado,
      saldoPendiente: resumen.saldoPendiente + factura.saldoPendiente
    }),
    {
      cantidad: 0,
      montoAjustado: 0,
      montoCobrado: 0,
      saldoPendiente: 0
    }
  );
}

function parseViewMode(params: URLSearchParams): FacturasViewMode {
  return params.get("vista") === "pagos" ? "pagos" : "documentos";
}

function getPaymentTimestamp(fechaPago: string) {
  const parsed = Date.parse(`${fechaPago}T00:00:00`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFacturasUrl({
  filtro,
  query,
  dateFilter,
  documentConditions,
  paymentCondition,
  viewMode
}: {
  filtro: FiltroFactura;
  query: string;
  dateFilter: DocumentDateRangeFilter;
  documentConditions: DocumentConditionKey[];
  paymentCondition: string;
  viewMode: FacturasViewMode;
}) {
  const params = new URLSearchParams();

  if (filtro !== "Todas") {
    params.set("filtro", filtro);
  }

  if (query.trim()) {
    params.set("busqueda", query.trim());
  }

  if (documentConditions.length > 0) {
    params.set("documentos", documentConditions.join(","));
  }

  if (paymentCondition !== "Todas") {
    params.set("condicion", paymentCondition);
  }

  if (viewMode === "pagos") {
    params.set("vista", viewMode);
  }

  documentDateFilterToSearchParams(params, dateFilter);

  const queryString = params.toString();
  return queryString ? `/facturas?${queryString}` : "/facturas";
}

export function FacturasTable({
  facturas,
  initialFiltro = "Todas",
  initialQuery = "",
  search = typeof window === "undefined" ? "" : window.location.search
}: {
  facturas: FacturaCalculada[];
  initialFiltro?: string;
  initialQuery?: string;
  search?: string;
}) {
  const [filtro, setFiltro] = useState<FiltroFactura>(() => normalizarFiltroFactura(initialFiltro));
  const [query, setQuery] = useState(initialQuery);
  const [dateFilter, setDateFilter] = useState<DocumentDateRangeFilter>(() =>
    documentDateFilterFromSearchParams(new URLSearchParams(search))
  );
  const [documentConditions, setDocumentConditions] = useState<DocumentConditionKey[]>(() =>
    parseDocumentConditions(new URLSearchParams(search))
  );
  const [paymentCondition, setPaymentCondition] = useState(() => new URLSearchParams(search).get("condicion") ?? "Todas");
  const [viewMode, setViewMode] = useState<FacturasViewMode>(() => parseViewMode(new URLSearchParams(search)));
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    const params = new URLSearchParams(search);

    setFiltro(normalizarFiltroFactura(initialFiltro));
    setQuery(initialQuery);
    setDateFilter(documentDateFilterFromSearchParams(params));
    setDocumentConditions(parseDocumentConditions(params));
    setPaymentCondition(params.get("condicion") ?? "Todas");
    setViewMode(parseViewMode(params));
  }, [initialFiltro, initialQuery, search]);

  function updateFiltro(item: FiltroFactura) {
    setFiltro(item);
    navigateTo(buildFacturasUrl({ filtro: item, query, dateFilter, documentConditions, paymentCondition, viewMode }), { scroll: false });
  }

  function updateDateFilter(nextDateFilter: DocumentDateRangeFilter) {
    setDateFilter(nextDateFilter);
    navigateTo(buildFacturasUrl({ filtro, query, dateFilter: nextDateFilter, documentConditions, paymentCondition, viewMode }), { scroll: false });
  }

  function toggleDocumentCondition(condition: DocumentConditionKey) {
    const nextDocumentConditions = documentConditions.includes(condition)
      ? documentConditions.filter((item) => item !== condition)
      : [...documentConditions, condition];

    setDocumentConditions(nextDocumentConditions);
    navigateTo(
      buildFacturasUrl({
        filtro,
        query,
        dateFilter,
        documentConditions: nextDocumentConditions,
        paymentCondition,
        viewMode
      }),
      { scroll: false }
    );
  }

  function updatePaymentCondition(nextPaymentCondition: string) {
    setPaymentCondition(nextPaymentCondition);
    navigateTo(buildFacturasUrl({ filtro, query, dateFilter, documentConditions, paymentCondition: nextPaymentCondition, viewMode }), { scroll: false });
  }

  function updateViewMode(nextViewMode: FacturasViewMode) {
    setViewMode(nextViewMode);
    navigateTo(buildFacturasUrl({ filtro, query, dateFilter, documentConditions, paymentCondition, viewMode: nextViewMode }), { scroll: false });
  }

  function clearConditions() {
    setFiltro("Todas");
    setQuery("");
    setDateFilter(defaultDocumentDateRangeFilter);
    setDocumentConditions([]);
    setPaymentCondition("Todas");
    navigateTo(
      buildFacturasUrl({
        filtro: "Todas",
        query: "",
        dateFilter: defaultDocumentDateRangeFilter,
        documentConditions: [],
        paymentCondition: "Todas",
        viewMode
      }),
      { scroll: false }
    );
  }

  function openTraceability(factura: FacturaCalculada) {
    const params = new URLSearchParams({
      factura: factura.id,
      returnTo: `${window.location.pathname}${window.location.search}`
    });

    navigateTo(`/trazabilidad?${params.toString()}`);
  }

  const data = useMemo(() => {
    const term = query.trim().toLowerCase();
    const facturasByDate = filterFacturasByDateRange(facturas, dateFilter);

    return facturasByDate.filter((factura) => {
      const folio = formatearFolioDocumento(factura.tipoDocumento, factura.numero);
      const matchesFiltro = aplicaFiltro(factura, filtro);
      const matchesDocumentConditions = facturaMatchesDocumentConditions(factura, documentConditions);
      const matchesPaymentCondition = paymentCondition === "Todas" || factura.condicionPago === paymentCondition;
      const matchesQuery =
        term.length === 0 ||
        factura.numero.toLowerCase().includes(term) ||
        folio.toLowerCase().includes(term) ||
        factura.cliente.nombre.toLowerCase().includes(term) ||
        factura.cliente.rut.toLowerCase().includes(term);

      return matchesFiltro && matchesDocumentConditions && matchesPaymentCondition && matchesQuery;
    });
  }, [dateFilter, documentConditions, facturas, filtro, paymentCondition, query]);

  const resumenFiltrado = useMemo(() => calcularResumenFacturasFiltradas(data), [data]);
  const pagosRecientes = useMemo(
    () =>
      data
        .flatMap((factura) =>
          factura.pagos.map((pago) => ({
            id: `${factura.id}-${pago.id}`,
            factura,
            pago,
            timestamp: getPaymentTimestamp(pago.fechaPago)
          }))
        )
        .sort((a, b) => b.timestamp - a.timestamp || b.pago.monto - a.pago.monto),
    [data]
  );
  const totalPagosRecientes = useMemo(
    () => pagosRecientes.reduce((total, item) => total + item.pago.monto, 0),
    [pagosRecientes]
  );
  const documentConditionCounts = useMemo(
    () =>
      Object.fromEntries(
        documentConditionOptions.map((option) => [
          option.key,
          facturas.filter((factura) => option.matches(factura)).length
        ])
      ) as Record<DocumentConditionKey, number>,
    [facturas]
  );
  const paymentConditionOptions = useMemo(
    () => [...new Set(facturas.map((factura) => factura.condicionPago))].sort(),
    [facturas]
  );
  const dateFilteredCount = useMemo(
    () => filterFacturasByDateRange(facturas, dateFilter).length,
    [dateFilter, facturas]
  );
  const activeConditionsCount = [
    filtro !== "Todas",
    query.trim().length > 0,
    documentConditions.length > 0,
    paymentCondition !== "Todas",
    isDocumentDateRangeActive(dateFilter)
  ].filter(Boolean).length;

  const columns = useMemo<ColumnDef<FacturaCalculada>[]>(
    () => [
      {
        accessorKey: "numero",
        header: "Documento",
        cell: ({ row }) => (
          <DocumentFolio
            tipoDocumento={row.original.tipoDocumento}
            numero={row.original.numero}
            size="sm"
          />
        )
      },
      {
        accessorFn: (row) => row.cliente.nombre,
        id: "cliente",
        header: "Cliente",
        cell: ({ row }) => (
          <span className="block truncate font-medium" title={row.original.cliente.nombre}>
            {row.original.cliente.nombre}
          </span>
        )
      },
      {
        accessorKey: "fechaEmision",
        header: "Emisión",
        cell: ({ row }) => formatDate(row.original.fechaEmision)
      },
      {
        accessorKey: "fechaVencimiento",
        header: "Vencimiento",
        cell: ({ row }) => formatDate(row.original.fechaVencimiento)
      },
      {
        accessorKey: "condicionPago",
        header: "Condición"
      },
      {
        accessorKey: "monto",
        header: "Monto",
        cell: ({ row }) => formatCurrency(row.original.monto)
      },
      {
        accessorKey: "saldoPendiente",
        header: "Saldo",
        cell: ({ row }) => (
          <div className="space-y-2">
            <span className="number-tabular font-medium">
              {formatCurrency(row.original.saldoPendiente)}
            </span>
            <Progress
              value={
                row.original.montoAjustado === 0
                  ? 0
                  : (row.original.saldoPendiente / row.original.montoAjustado) * 100
              }
            />
          </div>
        )
      },
      {
        accessorKey: "estadoVencimiento",
        header: "Mora",
        cell: ({ row }) => <EstadoVencimientoCompacto estado={row.original.estadoVencimiento} />
      },
      {
        accessorKey: "estadoPago",
        header: "Pago",
        cell: ({ row }) => <EstadoPagoCompacto estado={row.original.estadoPago} />
      },
      {
        accessorKey: "estadoDocumental",
        header: "Doc.",
        cell: ({ row }) => <EstadoDocumentalCompacto estado={row.original.estadoDocumental} />
      }
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <DocumentConditionsPanel
        totalCount={facturas.length}
        filteredCount={data.length}
        activeCount={activeConditionsCount}
        description="Concentra búsqueda, estado y fechas para consultar documentos."
        onClear={clearConditions}
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <section className="rounded-lg border border-stone-200 bg-white/80 p-3 shadow-sm dark:border-stone-800 dark:bg-[#151515]/80">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                  Estado y cobranza
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Segmenta por saldo, mora y relacion documental.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filtros.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={item === filtro ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFiltro(item)}
                  className="h-8 rounded-full px-3 shadow-none"
                >
                  {item}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/80 p-3 shadow-sm dark:border-stone-800 dark:bg-[#151515]/80 xl:row-span-2">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                Busqueda y periodo
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Afina por texto, condicion de pago y rango de fechas.
              </p>
            </div>
            <div className="space-y-3">
              <label className="relative block w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Documento, cliente o RUT"
                  className="bg-white/90 pl-9 dark:bg-stone-900/90 dark:text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  Condicion de pago
                </span>
                <Select
                  value={paymentCondition}
                  onChange={(event) => updatePaymentCondition(event.target.value)}
                  className="bg-white/90 dark:bg-stone-900"
                >
                  <option value="Todas">Todas</option>
                  {paymentConditionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </label>

              <DocumentDateFilter
                value={dateFilter}
                onChange={updateDateFilter}
                totalCount={facturas.length}
                filteredCount={dateFilteredCount}
                description="Elige emision o vencimiento y define el rango."
                variant="compact"
              />
            </div>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white/80 p-3 shadow-sm dark:border-stone-800 dark:bg-[#151515]/80">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                  Tipo documental
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Puedes combinar facturas, NC, ND, anulaciones y reemplazos.
                </p>
              </div>
              {documentConditions.length > 0 ? (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                  {documentConditions.length} activos
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {documentConditionOptions.map((option) => {
                const selected = documentConditions.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleDocumentCondition(option.key)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition",
                      selected
                        ? "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-500/45 dark:bg-orange-500/10 dark:text-orange-300"
                        : "border-stone-200 bg-white/85 text-stone-700 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-black/20 dark:text-stone-200 dark:hover:bg-stone-800/80"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{option.label}</span>
                      <span className="number-tabular rounded-md bg-stone-100 px-1.5 text-[11px] text-stone-500 dark:bg-stone-800 dark:text-stone-300">
                        {documentConditionCounts[option.key]}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

      </DocumentConditionsPanel>

      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950 dark:text-stone-100">Vista de facturas</p>
          <p className="text-xs text-muted-foreground">
            Alterna entre documentos y pagos reales ordenados por fecha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-stone-200 px-3 py-1 text-xs text-muted-foreground dark:border-stone-800">
            {viewMode === "pagos" ? `${pagosRecientes.length} pagos` : `${data.length} documentos`}
          </span>
          <div className="inline-flex rounded-full border border-stone-200 bg-white/70 p-1 shadow-sm dark:border-stone-800 dark:bg-stone-950/70">
            <button
              type="button"
              onClick={() => updateViewMode("documentos")}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition",
                viewMode === "documentos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="size-4" />
              Documentos
            </button>
            <button
              type="button"
              onClick={() => updateViewMode("pagos")}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition",
                viewMode === "pagos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <WalletCards className="size-4" />
              Últimos pagos
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-stone-200 bg-white/80 p-3 shadow-sm dark:border-stone-800 dark:bg-stone-950/70 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Facturas filtradas</p>
            <p className="number-tabular text-lg font-semibold">{resumenFiltrado.cantidad}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Banknote className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Monto filtrado</p>
            <p className="number-tabular truncate text-lg font-semibold">{formatCurrency(resumenFiltrado.montoAjustado)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <WalletCards className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Cobrado</p>
            <p className="number-tabular truncate text-lg font-semibold">{formatCurrency(resumenFiltrado.montoCobrado)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Banknote className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Saldo pendiente</p>
            <p className="number-tabular truncate text-lg font-semibold">{formatCurrency(resumenFiltrado.saldoPendiente)}</p>
          </div>
        </div>
      </div>

      {viewMode === "pagos" ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/90 text-stone-950 shadow-sm backdrop-blur dark:border-stone-700 dark:bg-stone-950/85 dark:text-stone-100">
          <div className="flex flex-col gap-2 border-b border-stone-200 px-4 py-3 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Últimos pagos por fecha</p>
              <p className="text-xs text-muted-foreground">Respeta los filtros activos y muestra cuándo entró la plata.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-stone-200 px-3 py-1 text-muted-foreground dark:border-stone-800">
                {pagosRecientes.length} movimientos
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                {formatCurrency(totalPagosRecientes)} recibidos
              </span>
            </div>
          </div>
          <div className="overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[12px]">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[15%]" />
                <col className="w-[26%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-slate-950 text-left text-xs uppercase text-white/70 dark:bg-black">
                <tr>
                  <th className="px-2.5 py-3 font-semibold">Fecha pago</th>
                  <th className="px-2.5 py-3 font-semibold">Documento</th>
                  <th className="px-2.5 py-3 font-semibold">Cliente</th>
                  <th className="px-2.5 py-3 font-semibold">Tipo</th>
                  <th className="px-2.5 py-3 font-semibold">Monto recibido</th>
                  <th className="px-2.5 py-3 font-semibold">Saldo actual</th>
                  <th className="px-2.5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {pagosRecientes.map(({ id, factura, pago }) => (
                  <tr
                    key={id}
                    role="link"
                    tabIndex={0}
                    title={`Ver trazabilidad de ${formatearFolioDocumento(factura.tipoDocumento, factura.numero)}`}
                    onClick={() => openTraceability(factura)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openTraceability(factura);
                      }
                    }}
                    className="cursor-pointer transition hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset dark:hover:bg-orange-500/10 dark:focus-visible:bg-orange-500/10"
                  >
                    <td className="px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200">
                      {formatDate(pago.fechaPago)}
                    </td>
                    <td className="px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200">
                      <DocumentFolio tipoDocumento={factura.tipoDocumento} numero={factura.numero} size="sm" />
                    </td>
                    <td className="px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200">
                      <span className="block truncate font-medium" title={factura.cliente.nombre}>
                        {factura.cliente.nombre}
                      </span>
                    </td>
                    <td className="px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200">
                      <Badge tone={pago.tipo === "Pago" ? "success" : "warning"}>{pago.tipo}</Badge>
                    </td>
                    <td className="number-tabular px-2.5 py-3 align-middle font-semibold text-stone-900 dark:text-stone-100">
                      {formatCurrency(pago.monto)}
                    </td>
                    <td className="number-tabular px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200">
                      {formatCurrency(factura.saldoPendiente)}
                    </td>
                    <td className="px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200">
                      <EstadoPagoCompacto estado={factura.estadoPago} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagosRecientes.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay pagos registrados para el filtro seleccionado.
            </div>
          )}
        </div>
      ) : null}

      <div className={cn("overflow-hidden rounded-xl border border-stone-200 bg-white/90 text-stone-950 shadow-sm backdrop-blur dark:border-stone-700 dark:bg-stone-950/85 dark:text-stone-100", viewMode === "pagos" && "hidden")}>
        <div className="overflow-hidden">
          <table className="w-full table-fixed border-collapse text-[12px]">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-slate-950 text-left text-xs uppercase text-white/70 dark:bg-black">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-2.5 py-3 font-semibold"
                    >
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  title={`Ver trazabilidad de ${formatearFolioDocumento(row.original.tipoDocumento, row.original.numero)}`}
                  onClick={() => openTraceability(row.original)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openTraceability(row.original);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset dark:hover:bg-orange-500/10 dark:focus-visible:bg-orange-500/10"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2.5 py-3 align-middle text-stone-700 dark:text-stone-200"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay facturas para el filtro seleccionado.
          </div>
        )}
      </div>
    </motion.div>
  );
}

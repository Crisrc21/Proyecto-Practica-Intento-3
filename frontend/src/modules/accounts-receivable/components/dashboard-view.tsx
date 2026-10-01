import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppLink as Link } from "@/shared/components/app-link";
import { DocumentConditionsPanel } from "@/modules/accounts-receivable/components/document-conditions-panel";
import { DocumentDateFilter } from "@/modules/accounts-receivable/components/document-date-filter";
import { DocumentFolio } from "@/modules/accounts-receivable/components/document-folio";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  FileClock,
  HandCoins,
  Target,
  WalletCards,
  X
} from "lucide-react";
import { calcularKpisDesdeFacturasCalculadas } from "@/modules/accounts-receivable/data/cxc-calculations";
import {
  defaultDocumentDateRangeFilter,
  documentDateFilterToSearchParams,
  filterFacturasByDateRange,
  isDocumentDateRangeActive
} from "@/modules/accounts-receivable/data/date-filters";
import { formatearFolioDocumento } from "@/modules/accounts-receivable/data/document-ids";
import { formatCurrency, formatDate } from "@/shared/lib/formatters";
import { FacturaCalculada, KpisDashboard } from "@/modules/accounts-receivable/types";

function darkPanelClass(extra = "") {
  return `rounded-xl border border-stone-200 bg-white text-stone-950 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-stone-700/80 dark:bg-[#151515] dark:text-white dark:shadow-[0_18px_45px_rgba(0,0,0,0.22)] ${extra}`;
}

function progressWidth(value: number) {
  return `${Math.max(4, Math.min(100, value))}%`;
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 0
  }).format(value);
}

export function DashboardView({
  kpis,
  facturas
}: {
  kpis: KpisDashboard;
  facturas: FacturaCalculada[];
}) {
  const [activeCashKey, setActiveCashKey] = useState<"cobrado" | "pendiente">("cobrado");
  const [activePaymentKey, setActivePaymentKey] = useState<"cobrado" | "en-plazo" | "vencido">("vencido");
  const [activeTrendKey, setActiveTrendKey] = useState<string | null>(null);
  const [activeAgingKey, setActiveAgingKey] = useState<string | null>(null);
  const [selectedAgingKey, setSelectedAgingKey] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(defaultDocumentDateRangeFilter);
  const dashboardFacturas = useMemo(
    () => filterFacturasByDateRange(facturas, dateFilter),
    [dateFilter, facturas]
  );
  const dashboardKpis = useMemo(
    () => calcularKpisDesdeFacturasCalculadas(dashboardFacturas),
    [dashboardFacturas]
  );
  const partialCount = dashboardFacturas.filter((factura) => factura.estadoPago === "Pago parcial").length;
  const upcomingCount = dashboardFacturas.filter(
    (factura) => factura.estadoVencimiento === "En plazo" && factura.saldoPendiente > 0
  ).length;
  const activeDashboardConditions = isDocumentDateRangeActive(dateFilter) ? 1 : 0;

  function facturasHref(filtro?: string, busqueda?: string) {
    const params = new URLSearchParams();

    if (filtro) {
      params.set("filtro", filtro);
    }

    if (busqueda) {
      params.set("busqueda", busqueda);
    }

    documentDateFilterToSearchParams(params, dateFilter);

    const queryString = params.toString();
    return queryString ? `/facturas?${queryString}` : "/facturas";
  }

  const kpiGroups = [
    {
      title: "Cartera",
      cards: [
        {
          key: "cartera-total",
          label: "Cartera Total",
          icon: WalletCards,
          tone: "border-stone-200 bg-white text-orange-600 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
          chip: "+12.4%",
          caption: "Base activa",
          positive: true,
          value: dashboardKpis.carteraTotal,
          isMoney: true,
          href: facturasHref()
        },
        {
          key: "monto-cobrado",
          label: "Monto Cobrado",
          icon: Banknote,
          tone: "border-stone-200 bg-white text-emerald-600 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
          chip: "+18.7%",
          caption: "Cash-in",
          positive: true,
          value: dashboardKpis.montoCobrado,
          isMoney: true,
          href: facturasHref("Pagadas")
        },
        {
          key: "monto-pendiente",
          label: "Monto Pendiente",
          icon: CalendarClock,
          tone: "border-stone-200 bg-white text-orange-600 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
          chip: "-4.2%",
          caption: "Por gestionar",
          positive: false,
          value: dashboardKpis.montoPendiente,
          isMoney: true,
          href: facturasHref("Pendientes")
        }
      ]
    },
    {
      title: "Facturas",
      cards: [
        {
          key: "facturas-pagadas",
          label: "Facturas Pagadas",
          icon: CheckCircle2,
          tone: "border-stone-200 bg-white text-emerald-600 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
          chip: "+8.1%",
          caption: "Liquidadas",
          positive: true,
          value: dashboardKpis.facturasPagadasCompletamente,
          isMoney: false,
          href: facturasHref("Pagadas")
        },
        {
          key: "facturas-parciales",
          label: "Facturas con Pagos Parciales",
          icon: HandCoins,
          tone: "border-stone-200 bg-white text-amber-700 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
          chip: `${partialCount} docs`,
          caption: "Con abonos",
          positive: true,
          value: partialCount,
          isMoney: false,
          href: facturasHref("Pago parcial")
        },
        {
          key: "facturas-por-vencer",
          label: "Facturas Por Vencer",
          icon: FileClock,
          tone: "border-stone-200 bg-white text-amber-600 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
          chip: `${upcomingCount} docs`,
          caption: "Próximos cobros",
          positive: true,
          value: upcomingCount,
          isMoney: false,
          href: facturasHref("Por vencer")
        }
      ]
    }
  ];

  const mapFacturas = dashboardFacturas;

  const mapKpis = useMemo(() => {
    const montoCobrado = mapFacturas.reduce((total, factura) => total + factura.montoCobrado, 0);
    const montoPendiente = mapFacturas.reduce((total, factura) => total + factura.saldoPendiente, 0);
    const pendienteEnPlazo = mapFacturas
      .filter((factura) => factura.estadoVencimiento === "En plazo")
      .reduce((total, factura) => total + factura.saldoPendiente, 0);
    const pendienteVencido = mapFacturas
      .filter((factura) => factura.estadoVencimiento === "Vencida")
      .reduce((total, factura) => total + factura.saldoPendiente, 0);

    return {
      carteraTotal: montoCobrado + montoPendiente,
      montoCobrado,
      montoPendiente,
      pendienteEnPlazo,
      pendienteVencido
    };
  }, [mapFacturas]);

  const cashQuality = useMemo(() => {
    let cobradoEnPlazo = 0;
    let cobradoFueraPlazo = 0;

    mapFacturas.forEach((factura) => {
      factura.pagos.forEach((pago) => {
        if (pago.fechaPago <= factura.fechaVencimiento) {
          cobradoEnPlazo += pago.monto;
        } else {
          cobradoFueraPlazo += pago.monto;
        }
      });
    });

    return {
      cobradoEnPlazo,
      cobradoFueraPlazo,
      pendienteEnPlazo: mapKpis.pendienteEnPlazo,
      pendienteFueraPlazo: mapKpis.pendienteVencido
    };
  }, [mapFacturas, mapKpis.pendienteVencido, mapKpis.pendienteEnPlazo]);

  const cashBars = [
    {
      key: "cobrado" as const,
      label: "Monto cobrado",
      value: mapKpis.montoCobrado,
      caption: "Efectivo recuperado",
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      segments: [
        {
          label: "En plazo",
          value: cashQuality.cobradoEnPlazo,
          bar: "bg-emerald-500",
          text: "text-emerald-600 dark:text-emerald-400"
        },
        {
          label: "Fuera de plazo",
          value: cashQuality.cobradoFueraPlazo,
          bar: "bg-emerald-800",
          text: "text-emerald-800 dark:text-emerald-300"
        }
      ]
    },
    {
      key: "pendiente" as const,
      label: "Monto pendiente",
      value: mapKpis.montoPendiente,
      caption: "Saldo por gestionar",
      bar: "bg-orange-500",
      text: "text-orange-600 dark:text-orange-400",
      segments: [
        {
          label: "En plazo",
          value: cashQuality.pendienteEnPlazo,
          bar: "bg-orange-400",
          text: "text-orange-600 dark:text-orange-400"
        },
        {
          label: "Fuera de plazo",
          value: cashQuality.pendienteFueraPlazo,
          bar: "bg-rose-500",
          text: "text-rose-600 dark:text-rose-400"
        }
      ]
    }
  ];
  const maxCashBarValue = Math.max(...cashBars.map((item) => item.value), 1);
  const activeCashBar = cashBars.find((item) => item.key === activeCashKey) ?? cashBars[0];
  const totalCashTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(mapKpis.carteraTotal * ratio));
  const cashStory =
    mapKpis.montoCobrado >= mapKpis.montoPendiente
      ? `Revisar ${formatCurrency(cashQuality.cobradoFueraPlazo)} cobrados fuera de plazo.`
      : `Foco en ${formatCurrency(cashQuality.pendienteFueraPlazo)} fuera de plazo.`;

  const paymentStates = useMemo(
    () => [
      {
        key: "cobrado" as const,
        label: "Cobrado",
        value: mapKpis.montoCobrado,
        count: mapFacturas.filter((factura) => factura.montoCobrado > 0).length,
        color: "#10b981",
        caption: "recuperado",
        href: facturasHref()
      },
      {
        key: "en-plazo" as const,
        label: "En plazo",
        value: mapKpis.pendienteEnPlazo,
        count: mapFacturas.filter((factura) => factura.estadoVencimiento === "En plazo" && factura.saldoPendiente > 0).length,
        color: "#f97316",
        caption: "por cobrar",
        href: facturasHref("Por vencer")
      },
      {
        key: "vencido" as const,
        label: "Vencido",
        value: mapKpis.pendienteVencido,
        count: mapFacturas.filter((factura) => factura.estadoVencimiento === "Vencida" && factura.saldoPendiente > 0).length,
        color: "#e11d48",
        caption: "acción prioritaria",
        href: facturasHref("Vencidas")
      }
    ],
    [dateFilter, mapFacturas, mapKpis.montoCobrado, mapKpis.pendienteVencido, mapKpis.pendienteEnPlazo]
  );
  const pieBackground = useMemo(() => {
    let cursor = 0;
    const segments = paymentStates.map((state) => {
      const start = cursor;
      const size = (state.value / Math.max(mapKpis.carteraTotal, 1)) * 100;
      cursor += size;
      return `${state.color} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [mapKpis.carteraTotal, paymentStates]);
  const activePaymentState = paymentStates.find((state) => state.key === activePaymentKey) ?? paymentStates[0];
  const dominantPaymentState = [...paymentStates].sort((a, b) => b.value - a.value)[0];

  const paymentTimeline = useMemo(() => {
    let acumulado = 0;
    return mapFacturas
      .flatMap((factura) =>
        factura.pagos.map((pago) => ({
          id: pago.id,
          fecha: pago.fechaPago,
          monto: pago.monto,
          tipo: pago.tipo,
          cliente: factura.cliente.nombre,
          documento: formatearFolioDocumento(factura.tipoDocumento, factura.numero)
        }))
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((pago) => {
        acumulado += pago.monto;
        return { ...pago, acumulado };
      });
  }, [mapFacturas]);
  const maxTimelineAmount = Math.max(...paymentTimeline.map((item) => item.monto), 1);
  const maxTimelineAccumulated = Math.max(...paymentTimeline.map((item) => item.acumulado), 1);
  const timelinePoints = paymentTimeline
    .map((item, index) => {
      const x =
        paymentTimeline.length === 1 ? 180 : 42 + (index / Math.max(paymentTimeline.length - 1, 1)) * 294;
      const y = 154 - (item.acumulado / maxTimelineAccumulated) * 118;
      return `${x},${y}`;
    })
    .join(" ");
  const timelineAreaPoints = timelinePoints ? `42,164 ${timelinePoints} 336,164` : "";
  const latestPayment = paymentTimeline.at(-1);
  const previousPayment = paymentTimeline.at(-2);
  const timelineDelta = latestPayment && previousPayment ? latestPayment.acumulado - previousPayment.acumulado : latestPayment?.acumulado ?? 0;
  const trendData = useMemo(() => {
    const grouped = new Map<string, { label: string; facturado: number; ingresado: number }>();
    const ensureMonth = (dateValue: string) => {
      const date = new Date(`${dateValue}T00:00:00`);
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("es-CL", { month: "short" }).format(date).replace(".", "");
      const current = grouped.get(key) ?? { label, facturado: 0, ingresado: 0 };
      grouped.set(key, current);
      return current;
    };

    mapFacturas.forEach((factura) => {
      ensureMonth(factura.fechaEmision).facturado += factura.montoAjustado;
      factura.pagos.forEach((pago) => {
        ensureMonth(pago.fechaPago).ingresado += pago.monto;
      });
    });

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => ({ key, ...item }));
  }, [mapFacturas]);
  const maxTrendValue = Math.max(...trendData.flatMap((item) => [item.facturado, item.ingresado]), 1);
  const trendPoint = (value: number, index: number) => {
    const x = trendData.length === 1 ? 660 : 86 + (index / Math.max(trendData.length - 1, 1)) * 1170;
    const y = 142 - (value / maxTrendValue) * 106;
    return { x, y };
  };
  const billedTrendPoints = trendData.map((item, index) => trendPoint(item.facturado, index));
  const paidTrendPoints = trendData.map((item, index) => trendPoint(item.ingresado, index));
  const billedPolyline = billedTrendPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const paidPolyline = paidTrendPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const trendBaselineY = 142;
  const billedAreaPoints =
    billedTrendPoints.length > 0
      ? `${billedTrendPoints[0].x},${trendBaselineY} ${billedPolyline} ${billedTrendPoints.at(-1)?.x},${trendBaselineY}`
      : "";
  const paidAreaPoints =
    paidTrendPoints.length > 0
      ? `${paidTrendPoints[0].x},${trendBaselineY} ${paidPolyline} ${paidTrendPoints.at(-1)?.x},${trendBaselineY}`
      : "";
  const activeTrend = trendData.find((item) => item.key === activeTrendKey) ?? trendData.at(-1);
  const activeTrendGap = activeTrend ? activeTrend.facturado - activeTrend.ingresado : 0;

  const renderKpiGroup = (group: (typeof kpiGroups)[number], groupIndex: number) => (
    <div key={group.title} className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
          {group.title}
        </h2>
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.cards.map((card, index) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.key}
              href={card.href}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-950"
            >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ delay: (groupIndex * 3 + index) * 0.04 }}
              className="overflow-hidden rounded-xl border border-stone-200/90 bg-white text-stone-950 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-[border-color,box-shadow,transform] hover:border-stone-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.07)] dark:border-stone-700 dark:bg-[#151515] dark:text-white dark:hover:border-stone-600"
            >
              <div className="relative p-4">
                <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-stone-50/80 to-transparent dark:from-white/[0.025]" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{card.label}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {card.isMoney ? formatCurrency(card.value) : card.value}
                    </p>
                  </div>
                  <div className={`flex size-10 items-center justify-center rounded-lg border ${card.tone}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="relative mt-4 flex items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
                      card.positive
                        ? "border-emerald-500/25 text-emerald-500 dark:text-emerald-400"
                        : "border-rose-500/25 text-rose-500"
                    }`}
                  >
                    {card.positive ? (
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="size-3" aria-hidden="true" />
                    )}
                    {card.chip}
                  </span>
                  <span className="text-stone-500 dark:text-stone-400">{card.caption}</span>
                </div>
              </div>
            </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  const clientStats = useMemo(() => {
    const grouped = new Map<
      string,
      {
        cliente: string;
        total: number;
        vencidas: number;
        saldoVencido: number;
        dias: number;
        pagadas: number;
      }
    >();

    dashboardFacturas.forEach((factura) => {
      const current =
        grouped.get(factura.cliente.id) ??
        {
          cliente: factura.cliente.nombre,
          total: 0,
          vencidas: 0,
          saldoVencido: 0,
          dias: 0,
          pagadas: 0
        };

      current.total += 1;
      current.pagadas += factura.estadoPago === "Pagado" ? 1 : 0;
      current.vencidas += factura.estadoVencimiento === "Vencida" && factura.saldoPendiente > 0 ? 1 : 0;
      current.saldoVencido += factura.estadoVencimiento === "Vencida" ? factura.saldoPendiente : 0;
      current.dias += factura.diasVencidos;
      grouped.set(factura.cliente.id, current);
    });

    const values = [...grouped.values()].map((item) => ({
      ...item,
      puntualidad: Math.round((item.pagadas / Math.max(item.total, 1)) * 100),
      promedioDias: Math.round(item.dias / Math.max(item.total, 1))
    }));

    return {
      cumplidores: [...values].sort((a, b) => b.puntualidad - a.puntualidad).slice(0, 4),
      morosos: [...values].sort((a, b) => b.saldoVencido - a.saldoVencido).slice(0, 4)
    };
  }, [dashboardFacturas]);

  const agingBuckets = useMemo(() => {
    const buckets = [
      {
        label: "0 a 30 días",
        min: 0,
        max: 30,
        color: "from-emerald-50 to-emerald-100 dark:from-emerald-950/75 dark:to-stone-900",
        text: "text-stone-950 dark:text-white",
        border: "border-emerald-200 dark:border-emerald-900/70",
        bar: "bg-emerald-500"
      },
      {
        label: "31 a 60 días",
        min: 31,
        max: 60,
        color: "from-amber-50 to-amber-100 dark:from-amber-950/70 dark:to-stone-900",
        text: "text-stone-950 dark:text-white",
        border: "border-amber-200 dark:border-amber-900/70",
        bar: "bg-amber-500"
      },
      {
        label: "61 a 90 días",
        min: 61,
        max: 90,
        color: "from-orange-100 to-orange-200 dark:from-orange-950/75 dark:to-stone-900",
        text: "text-stone-950 dark:text-white",
        border: "border-orange-300 dark:border-orange-900/70",
        bar: "bg-orange-500"
      },
      {
        label: "Más de 90 días",
        min: 91,
        max: Infinity,
        color: "from-rose-100 to-red-200 dark:from-rose-950/80 dark:to-stone-900",
        text: "text-stone-950 dark:text-white",
        border: "border-rose-300 dark:border-rose-900/70",
        bar: "bg-rose-500"
      }
    ];

    return buckets.map((bucket) => {
      const bucketFacturas = dashboardFacturas.filter(
        (factura) =>
          factura.saldoPendiente > 0 &&
          factura.estadoVencimiento === "Vencida" &&
          factura.diasVencidos >= bucket.min &&
          factura.diasVencidos <= bucket.max
      );
      return {
        ...bucket,
        count: bucketFacturas.length,
        monto: bucketFacturas.reduce((total, factura) => total + factura.saldoPendiente, 0),
        facturas: bucketFacturas.sort((a, b) => b.diasVencidos - a.diasVencidos || b.saldoPendiente - a.saldoPendiente)
      };
    });
  }, [dashboardFacturas]);

  const acciones = useMemo(
    () =>
      [...dashboardFacturas]
        .filter((factura) => factura.saldoPendiente > 0)
        .sort((a, b) => b.diasVencidos - a.diasVencidos || b.saldoPendiente - a.saldoPendiente)
        .slice(0, 5),
    [dashboardFacturas]
  );


  const maxBucket = Math.max(...agingBuckets.map((bucket) => bucket.monto), 1);
  const activeAgingBucket =
    agingBuckets.find((bucket) => bucket.label === activeAgingKey) ??
    agingBuckets.reduce((selected, bucket) => (bucket.monto > selected.monto ? bucket : selected), agingBuckets[0]);
  const selectedAgingBucket = agingBuckets.find((bucket) => bucket.label === selectedAgingKey) ?? null;

  useEffect(() => {
    if (!selectedAgingBucket) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedAgingKey(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedAgingBucket]);
  return (
    <div className="space-y-4">
      <section className="space-y-3">{renderKpiGroup(kpiGroups[0], 0)}</section>

      <section className="space-y-3">{renderKpiGroup(kpiGroups[1], 1)}</section>

      <DocumentConditionsPanel
        totalCount={facturas.length}
        filteredCount={dashboardFacturas.length}
        activeCount={activeDashboardConditions}
        description="Actualiza KPIs y graficos del dashboard segun emision o vencimiento."
        onClear={() => setDateFilter(defaultDocumentDateRangeFilter)}
      >
        <DocumentDateFilter
          value={dateFilter}
          onChange={setDateFilter}
          totalCount={facturas.length}
          filteredCount={dashboardFacturas.length}
          description="Define si el tablero se lee por fecha de emision o de vencimiento."
        />
      </DocumentConditionsPanel>

      <section className="relative space-y-4 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-stone-700 dark:bg-[#151515]">
        <div className="relative flex items-center gap-3">
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 shadow-sm ring-1 ring-stone-200 dark:bg-black/35 dark:text-stone-300 dark:ring-stone-700">
            Cobranza
          </span>
          <div>
            <h2 className="text-lg font-semibold">Lectura financiera y mora</h2>
          </div>
        </div>
        <div className="space-y-10">
        <div className="space-y-10 border-t border-stone-200 pt-5 dark:border-stone-700">
          <div className="space-y-10">
            <motion.div
              key="flujo-chart"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-semibold">Cobrado vs pendiente</h3>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {cashStory}
                  </p>
                </div>
                <div className="border-l border-stone-200 px-3 py-1 dark:border-stone-700">
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                    {activeCashBar.caption}
                  </p>
                  <p className={`mt-1 number-tabular text-lg font-semibold ${activeCashBar.text}`}>
                    {formatCurrency(activeCashBar.value)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
                <div className="p-1">
                  <div className="flex flex-wrap justify-end gap-2 text-xs text-stone-500 dark:text-stone-400">
                      {[
                        ["Cobrado en plazo", "bg-emerald-500"],
                        ["Cobrado fuera plazo", "bg-emerald-800"],
                        ["Pendiente en plazo", "bg-orange-400"],
                        ["Pendiente vencido", "bg-rose-500"]
                      ].map(([label, color]) => (
                        <span key={label} className="inline-flex items-center gap-1.5">
                          <span className={`size-2 rounded-sm ${color}`} />
                          {label}
                        </span>
                      ))}
                  </div>
                  <div className="mt-5 grid h-64 grid-cols-[72px_1fr] gap-3">
                    <div className="flex flex-col justify-between py-3 text-right text-xs text-stone-500 dark:text-stone-400">
                      {totalCashTicks.map((tick) => (
                        <span key={tick}>{compactCurrency(tick)}</span>
                      ))}
                    </div>
                    <div className="relative border-b border-l border-stone-300 px-4 pb-8 pt-3 dark:border-stone-800">
                      <div className="absolute inset-x-4 top-3 grid h-[calc(100%-44px)] grid-rows-4">
                        {[0, 1, 2, 3].map((line) => (
                          <span key={line} className="border-t border-dashed border-stone-200 dark:border-stone-800" />
                        ))}
                      </div>
                      <div className="relative grid h-full grid-cols-3 items-end gap-4">
                        <div className="flex h-full flex-col items-center justify-end gap-2 text-center">
                          <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600 shadow-sm dark:bg-stone-900 dark:text-stone-300">
                            100% cartera
                          </span>
                          <motion.div
                            className="w-full max-w-24 rounded-t-xl bg-gradient-to-t from-stone-300 to-stone-100 shadow-[0_-10px_22px_rgba(15,23,42,0.08)] dark:from-stone-700 dark:to-stone-500"
                            initial={{ height: 0 }}
                            animate={{ height: "100%" }}
                            transition={{ duration: 0.75 }}
                          />
                          <div className="min-h-12">
                            <p className="number-tabular text-sm font-semibold">{compactCurrency(mapKpis.carteraTotal)}</p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">Cartera total</p>
                          </div>
                        </div>
                        {cashBars.map((item) => {
                          const isActive = activeCashKey === item.key;
                          const ratio = Math.round((item.value / Math.max(mapKpis.carteraTotal, 1)) * 100);

                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setActiveCashKey(item.key)}
                              onMouseEnter={() => setActiveCashKey(item.key)}
                              className="group flex h-full flex-col items-center justify-end gap-2 text-center outline-none"
                            >
                              <span
                                className={`rounded-md px-2 py-1 text-xs font-semibold shadow-sm ${
                                  isActive ? "bg-orange-500 text-white" : "bg-white text-stone-600 dark:bg-stone-900 dark:text-stone-300"
                                }`}
                              >
                                {ratio}% cartera
                              </span>
                              <motion.div
                                className={`w-full max-w-24 overflow-hidden rounded-t-xl bg-stone-100 shadow-[0_-10px_22px_rgba(15,23,42,0.12)] transition dark:bg-stone-800 ${
                                  isActive ? "ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-black" : "opacity-85 group-hover:opacity-100"
                                }`}
                                initial={{ height: 0 }}
                                animate={{ height: progressWidth((item.value / Math.max(mapKpis.carteraTotal, 1)) * 100) }}
                                transition={{ duration: 0.75 }}
                              >
                                <div className="flex h-full flex-col-reverse">
                                  {item.segments.map((segment) =>
                                    segment.value > 0 ? (
                                      <div
                                        key={segment.label}
                                        className={`${segment.bar} relative flex min-h-8 items-center justify-center`}
                                        style={{ height: progressWidth((segment.value / Math.max(item.value, 1)) * 100) }}
                                        title={`${segment.label}: ${formatCurrency(segment.value)}`}
                                      >
                                        <span className="number-tabular text-[11px] font-semibold text-white drop-shadow-sm">
                                          {Math.round((segment.value / Math.max(item.value, 1)) * 100)}%
                                        </span>
                                      </div>
                                    ) : null
                                  )}
                                </div>
                              </motion.div>
                              <div className="min-h-12">
                                <p className="number-tabular text-sm font-semibold">{compactCurrency(item.value)}</p>
                                <p className="text-xs text-stone-500 dark:text-stone-400">{item.label}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {cashBars.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveCashKey(item.key)}
                      className={`rounded-lg border p-3 text-left transition ${
                        activeCashKey === item.key
                          ? "border-orange-300 bg-white shadow-md dark:border-orange-500/40 dark:bg-stone-950"
                          : "border-stone-200 bg-white/70 hover:bg-white dark:border-stone-800 dark:bg-stone-950/70"
                      }`}
                    >
                      <p className="text-sm text-stone-500 dark:text-stone-400">{item.caption}</p>
                      <p className={`mt-1 number-tabular text-lg font-semibold ${item.text}`}>{formatCurrency(item.value)}</p>
                      <div className="mt-4 space-y-2.5">
                        {item.segments.map((segment) => (
                          <div key={segment.label}>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-stone-500 dark:text-stone-400">{segment.label}</span>
                              <span className={`number-tabular font-semibold ${segment.text}`}>{formatCurrency(segment.value)}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                              <motion.div
                                className={`h-full rounded-full ${segment.bar}`}
                                initial={{ width: 0 }}
                                animate={{ width: progressWidth((segment.value / Math.max(item.value, 1)) * 100) }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              key="estado-chart"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 border-t border-stone-200/80 pt-8 dark:border-stone-700/80"
            >
              <h3 className="font-semibold">Composición de cartera</h3>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                Foco: {dominantPaymentState.label} concentra {Math.round((dominantPaymentState.value / Math.max(mapKpis.carteraTotal, 1)) * 100)}%.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[190px_1fr] lg:items-center">
                <button
                  type="button"
                  className="relative mx-auto flex size-44 items-center justify-center rounded-full shadow-[0_14px_28px_rgba(15,23,42,0.12)] outline-none"
                  style={{ background: pieBackground }}
                  aria-label="Gráfico de torta de composición de cartera"
                >
                  <span className="flex size-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-sm dark:bg-stone-950">
                    <span className="text-2xl font-semibold">
                      {Math.round((activePaymentState.value / Math.max(mapKpis.carteraTotal, 1)) * 100)}%
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">{activePaymentState.label}</span>
                    <span className="mt-1 number-tabular text-xs font-semibold text-stone-600 dark:text-stone-300">
                      {compactCurrency(activePaymentState.value)}
                    </span>
                  </span>
                </button>

                <div className="space-y-2.5">
                  {paymentStates.map((state) => (
                    <Link
                      key={state.key}
                      href={state.href}
                      onMouseEnter={() => setActivePaymentKey(state.key)}
                      className={`grid w-full gap-3 rounded-lg border p-3 text-left transition sm:grid-cols-[150px_1fr] sm:items-center ${
                        activePaymentKey === state.key
                          ? "border-stone-300 bg-stone-50 shadow-sm dark:border-stone-600 dark:bg-stone-900"
                          : "border-stone-200 bg-white hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-950"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: state.color }} />
                          <span className="font-semibold">{state.label}</span>
                        </div>
                        <p className="mt-1 number-tabular text-sm text-stone-500 dark:text-stone-400">
                          {formatCurrency(state.value)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                          <span style={{ color: state.color }}>{state.caption}</span>
                          <span className="number-tabular font-semibold">
                            {Math.round((state.value / Math.max(mapKpis.carteraTotal, 1)) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: state.color }}
                            initial={{ width: 0 }}
                            animate={{ width: progressWidth((state.value / Math.max(mapKpis.carteraTotal, 1)) * 100) }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>

          <motion.div
            key="historico-chart"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 border-t border-stone-200/80 pt-8 dark:border-stone-700/80"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Tendencia mensual</h3>
              </div>
              <div className="grid gap-2 text-right">
                <p className="number-tabular text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {activeTrend ? formatCurrency(activeTrend.ingresado) : formatCurrency(mapKpis.montoCobrado)}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {activeTrend ? `Brecha ${activeTrend.label}: ${compactCurrency(activeTrendGap)}` : "Sin movimiento activo"}
                </p>
              </div>
            </div>
              <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                    <span className="size-2.5 rounded-full bg-orange-500" />
                    Facturado
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    Ingresado
                  </span>
                </div>
              </div>
              <svg viewBox="0 0 1320 180" className="h-56 w-full overflow-visible">
                <defs>
                  <linearGradient id="billedAreaFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.04" />
                  </linearGradient>
                  <linearGradient id="paidAreaFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                {[36, 62.5, 89, 115.5, 142].map((y) => (
                  <line
                    key={y}
                    x1="86"
                    x2="1256"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-stone-200 dark:text-stone-800"
                    strokeDasharray="4 5"
                  />
                ))}
                {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                  <text
                    key={ratio}
                    x="74"
                    y={142 - ratio * 106 + 4}
                    textAnchor="end"
                    className="fill-stone-500 text-[10px]"
                  >
                    {compactCurrency(maxTrendValue * ratio)}
                  </text>
                ))}
                {billedAreaPoints && (
                  <motion.polygon
                    points={billedAreaPoints}
                    fill="url(#billedAreaFill)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                  />
                )}
                {paidAreaPoints && (
                  <motion.polygon
                    points={paidAreaPoints}
                    fill="url(#paidAreaFill)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.12 }}
                  />
                )}
                <motion.polyline
                  points={billedPolyline}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9 }}
                />
                <motion.polyline
                  points={paidPolyline}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay: 0.12 }}
                />
                {trendData.map((item, index) => {
                  const billedPoint = billedTrendPoints[index];
                  const paidPoint = paidTrendPoints[index];
                  const isActive = activeTrend?.key === item.key;

                  return (
                    <g
                      key={item.key}
                      className="cursor-pointer"
                      onClick={() => setActiveTrendKey(item.key)}
                      onMouseEnter={() => setActiveTrendKey(item.key)}
                    >
                      {isActive && (
                        <line
                          x1={billedPoint.x}
                          x2={billedPoint.x}
                          y1="30"
                          y2="148"
                          stroke="#f97316"
                          strokeOpacity="0.22"
                          strokeDasharray="4 4"
                        />
                      )}
                      <circle cx={billedPoint.x} cy={billedPoint.y} r={isActive ? "6.5" : "4.5"} fill="#f97316" stroke="white" strokeWidth="2.5" />
                      <circle cx={paidPoint.x} cy={paidPoint.y} r={isActive ? "6.5" : "4.5"} fill="#10b981" stroke="white" strokeWidth="2.5" />
                      <text
                        x={billedPoint.x}
                        y="168"
                        textAnchor="middle"
                        className={`${isActive ? "fill-orange-600" : "fill-stone-600"} text-[10px] font-semibold`}
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {trendData.slice(-3).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTrendKey(item.key)}
                    onMouseEnter={() => setActiveTrendKey(item.key)}
                    className={`rounded-lg border p-3 text-left transition ${
                      activeTrend?.key === item.key
                        ? "border-orange-300 bg-orange-50 shadow-sm dark:border-orange-500/40 dark:bg-orange-500/10"
                        : "border-stone-200 bg-white hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">{item.label}</p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-orange-600">Fact. {compactCurrency(item.facturado)}</span>
                      <span className="text-emerald-600">Ing. {compactCurrency(item.ingresado)}</span>
                    </div>
                    <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                      Brecha {compactCurrency(item.facturado - item.ingresado)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden">
              <svg viewBox="0 0 360 180" className="h-72 w-full overflow-visible">
                <defs>
                  <linearGradient id="timelineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[36, 75, 114, 153].map((y) => (
                  <line
                    key={y}
                    x1="42"
                    x2="336"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-stone-200 dark:text-stone-800"
                    strokeDasharray="4 5"
                  />
                ))}
                {[1, 0.75, 0.5, 0.25].map((ratio) => (
                  <text
                    key={ratio}
                    x="34"
                    y={154 - ratio * 118 + 4}
                    textAnchor="end"
                    className="fill-stone-500 text-[10px]"
                  >
                    {compactCurrency(maxTimelineAccumulated * ratio)}
                  </text>
                ))}
                {timelineAreaPoints && <polygon points={timelineAreaPoints} fill="url(#timelineFill)" />}
                {timelinePoints && (
                  <motion.polyline
                    points={timelinePoints}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9 }}
                  />
                )}
                {paymentTimeline.map((item, index) => {
                  const x =
                    paymentTimeline.length === 1 ? 180 : 42 + (index / Math.max(paymentTimeline.length - 1, 1)) * 294;
                  const y = 154 - (item.acumulado / maxTimelineAccumulated) * 118;

                  return (
                    <g key={item.id}>
                      <circle cx={x} cy={y} r="5" fill="#10b981" stroke="white" strokeWidth="3" />
                      <text x={x} y="174" textAnchor="middle" className="fill-stone-500 text-[10px]">
                        {new Intl.DateTimeFormat("es-CL", { month: "short" }).format(new Date(`${item.fecha}T00:00:00`))}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {paymentTimeline.slice(-3).map((item) => (
                  <div key={item.id} className="rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
                    <p className="text-xs text-stone-500 dark:text-stone-400">{formatDate(item.fecha)}</p>
                    <p className="mt-1 number-tabular font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.acumulado)}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{item.documento}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
        </div>

        <div className={darkPanelClass("p-4")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Heatmap de mora</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                Color más intenso indica mayor antigüedad y urgencia de cobranza.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
              {[
                ["Bajo", "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"],
                ["Medio", "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900"],
                ["Alto", "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-900"],
                ["Crítico", "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900"]
              ].map(([label, classes]) => (
                <span key={label} className={`rounded-md px-2 py-1 ring-1 ${classes}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {agingBuckets.map((bucket, index) => {
              const isActive = activeAgingBucket?.label === bucket.label;
              const riskLabel = ["Bajo", "Medio", "Alto", "Crítico"][index];

              return (
              <button
                key={bucket.label}
                type="button"
                onClick={() => {
                  setActiveAgingKey(bucket.label);
                  setSelectedAgingKey(bucket.label);
                }}
                onMouseEnter={() => setActiveAgingKey(bucket.label)}
                aria-haspopup="dialog"
                className={`rounded-lg border bg-gradient-to-br ${bucket.color} ${bucket.text} ${bucket.border} p-4 text-left shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition ${
                  isActive ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-stone-950" : "hover:-translate-y-0.5 hover:shadow-lg"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold">{bucket.label}</p>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                      Riesgo {riskLabel}
                    </p>
                  </div>
                  <span className="rounded-md bg-white/80 px-3 py-1 text-sm font-semibold text-stone-950 shadow-sm dark:bg-black/55 dark:text-white">
                    {bucket.count} docs
                  </span>
                </div>
                <p className="mt-4 text-xl font-semibold">{formatCurrency(bucket.monto)}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/75 dark:bg-black/45">
                  <motion.div
                    className={`h-full rounded-full ${bucket.bar}`}
                    initial={{ width: 0 }}
                    animate={{ width: progressWidth((bucket.monto / maxBucket) * 100) }}
                  />
                </div>
              </button>
              );
            })}
          </div>
        </div>
        </div>
      </section>

      <section className="relative space-y-4 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/35 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-stone-800 dark:bg-stone-900/20">
        <div className="relative flex items-center gap-3">
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 shadow-sm ring-1 ring-stone-200 dark:bg-black/35 dark:text-stone-300 dark:ring-stone-700">
            02 · Acción
          </span>
          <div>
            <h2 className="text-lg font-semibold">Priorización y clientes</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Próximas gestiones, clientes cumplidores y focos morosos.
            </p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr_0.8fr]">
        <div className={darkPanelClass("p-4")}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Acciones sugeridas</h2>
            <button className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 dark:border-stone-700 dark:bg-black/30 dark:text-stone-300">
              <Target className="size-4" aria-hidden="true" />
              Prioridad por vencimiento
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {acciones.map((factura) => (
              <Link
                key={factura.id}
                href={facturasHref(
                  factura.estadoVencimiento === "Vencida" ? "Vencidas" : "Por vencer",
                  factura.numero
                )}
                className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/45 hover:shadow-md sm:grid-cols-[1fr_auto] dark:border-stone-700 dark:bg-black/45 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DocumentFolio tipoDocumento={factura.tipoDocumento} numero={factura.numero} size="sm" />
                    <span className="rounded-md bg-stone-200 px-2 py-1 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                      {factura.estadoVencimiento === "Vencida" ? "Vencida" : "Próxima a vencer"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                    {factura.cliente.nombre} · vence {formatDate(factura.fechaVencimiento)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold">{formatCurrency(factura.saldoPendiente)}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{Math.round(factura.progresoPago)}% pagado</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className={darkPanelClass("overflow-hidden")}>
          <div className="border-b border-stone-200 bg-white px-4 py-3 text-stone-950 dark:border-stone-700 dark:bg-[#151515] dark:text-white">
            <h2 className="text-lg font-semibold">Top clientes cumplidores</h2>
          </div>
          <div className="space-y-3 p-4">
            {clientStats.cumplidores.map((client) => (
              <div key={client.cliente} className="rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-black/45">
                <p className="font-semibold">{client.cliente}</p>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {client.promedioDias} días atraso promedio · {client.vencidas} eventos
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
                  <span className="font-semibold">{client.puntualidad}% pago puntual</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: progressWidth(client.puntualidad) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={darkPanelClass("overflow-hidden")}>
          <div className="border-b border-stone-200 bg-white px-4 py-3 text-stone-950 dark:border-stone-700 dark:bg-[#151515] dark:text-white">
            <h2 className="text-lg font-semibold">Top clientes morosos</h2>
          </div>
          <div className="space-y-3 p-4">
            {clientStats.morosos.map((client) => (
              <div key={client.cliente} className="rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-black/45">
                <p className="font-semibold">{client.cliente}</p>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {client.promedioDias} días atraso promedio · {client.vencidas} eventos
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <AlertTriangle className="size-4 text-rose-500" aria-hidden="true" />
                  <span className="font-semibold">{formatCurrency(client.saldoVencido)}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                  <motion.div
                    className="h-full rounded-full bg-rose-500"
                    initial={{ width: 0 }}
                    animate={{ width: progressWidth((client.saldoVencido / Math.max(dashboardKpis.pendienteVencido, 1)) * 100) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      {selectedAgingBucket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aging-bucket-dialog-title"
          onClick={() => setSelectedAgingKey(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-stone-200 bg-white text-stone-950 shadow-2xl dark:border-stone-700 dark:bg-[#151515] dark:text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-stone-200 px-4 py-4 dark:border-stone-700 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                  Heatmap de mora
                </p>
                <h3 id="aging-bucket-dialog-title" className="mt-1 text-xl font-semibold">
                  Facturas: {selectedAgingBucket.label}
                </h3>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  {selectedAgingBucket.count} documentos · {formatCurrency(selectedAgingBucket.monto)} pendiente
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgingKey(null)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:bg-stone-50 hover:text-stone-950 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-black/35 dark:hover:text-white"
                aria-label="Cerrar detalle de facturas"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[64vh] overflow-auto p-4">
              {selectedAgingBucket.facturas.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="hidden grid-cols-[1.2fr_1.5fr_0.9fr_0.8fr_0.9fr_auto] gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 dark:border-stone-700 dark:bg-black/25 dark:text-stone-400 md:grid">
                    <span>Documento</span>
                    <span>Cliente</span>
                    <span>Vence</span>
                    <span>Días</span>
                    <span className="text-right">Saldo</span>
                    <span className="text-right">Acción</span>
                  </div>
                  <div className="divide-y divide-stone-200 dark:divide-stone-700">
                    {selectedAgingBucket.facturas.map((factura) => (
                      <div
                        key={factura.id}
                        className="grid grid-cols-1 gap-3 px-3 py-3 text-sm transition hover:bg-stone-50 dark:hover:bg-black/25 md:grid-cols-[1.2fr_1.5fr_0.9fr_0.8fr_0.9fr_auto] md:items-center"
                      >
                        <div className="min-w-0">
                          <DocumentFolio tipoDocumento={factura.tipoDocumento} numero={factura.numero} size="sm" />
                          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                            Emitida {formatDate(factura.fechaEmision)}
                          </p>
                        </div>
                        <p className="min-w-0 truncate font-medium">{factura.cliente.nombre}</p>
                        <p className="text-stone-600 dark:text-stone-300">{formatDate(factura.fechaVencimiento)}</p>
                        <p className="number-tabular font-semibold text-rose-600 dark:text-rose-400">
                          {factura.diasVencidos} días
                        </p>
                        <p className="number-tabular text-right font-semibold">{formatCurrency(factura.saldoPendiente)}</p>
                        <Link
                          href={facturasHref("Vencidas", factura.numero)}
                          className="justify-self-start rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 hover:text-stone-950 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-black/35 dark:hover:text-white md:justify-self-end"
                        >
                          Ver factura
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
                  <p className="font-semibold">Sin facturas en este tramo</p>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    No hay documentos vencidos que cumplan esta condición.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}

    </div>
  );
}

import { FileText, ReceiptText } from "lucide-react";
import { navigateTo } from "@/app/navigation";
import { FacturaCalculada } from "@/modules/accounts-receivable/types";
import { cn } from "@/shared/lib/classnames";

type DocumentMixFilterKey = "FACTURA" | "FACTURA_EXENTA" | "NOTA_CREDITO" | "NOTA_DEBITO";

function parseActiveDocumentFilters(search: string) {
  const validFilters = new Set<DocumentMixFilterKey>(["FACTURA", "FACTURA_EXENTA", "NOTA_CREDITO", "NOTA_DEBITO"]);
  return (
    new URLSearchParams(search)
      .get("documentos")
      ?.split(",")
      .filter((value): value is DocumentMixFilterKey => validFilters.has(value as DocumentMixFilterKey)) ?? []
  );
}

function buildDocumentFilterUrl(search: string, filterKey: DocumentMixFilterKey) {
  const params = new URLSearchParams(search);
  const activeFilters = parseActiveDocumentFilters(search);
  const nextFilters = activeFilters.includes(filterKey)
    ? activeFilters.filter((item) => item !== filterKey)
    : [...activeFilters, filterKey];

  if (nextFilters.length > 0) {
    params.set("documentos", [...new Set(nextFilters)].join(","));
  } else {
    params.delete("documentos");
  }

  const queryString = params.toString();
  return queryString ? `/facturas?${queryString}` : "/facturas";
}

export function DocumentMixSummary({
  facturas,
  search = typeof window === "undefined" ? "" : window.location.search
}: {
  facturas: FacturaCalculada[];
  search?: string;
}) {
  const activeFilters = parseActiveDocumentFilters(search);
  const mix = [
    {
      label: "Factura",
      code: "33",
      filterKey: "FACTURA" as const,
      count: facturas.filter((factura) => factura.tipoDocumento === "Factura Electrónica 33").length
    },
    {
      label: "Factura exenta",
      code: "34",
      filterKey: "FACTURA_EXENTA" as const,
      count: facturas.filter((factura) => factura.tipoDocumento === "Factura Exenta Electrónica 34").length
    },
    {
      label: "Nota débito",
      code: "56",
      filterKey: "NOTA_DEBITO" as const,
      count: facturas.reduce((total, factura) => total + factura.notasDebito.length, 0)
    },
    {
      label: "Nota crédito",
      code: "61",
      filterKey: "NOTA_CREDITO" as const,
      count: facturas.reduce((total, factura) => total + factura.notasCredito.length, 0)
    }
  ];

  return (
    <section className="mb-4 rounded-xl border border-stone-200 bg-white/90 p-4 text-stone-950 shadow-sm dark:border-stone-700 dark:bg-stone-950/85 dark:text-white">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mix documental</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Distribución de documentos antes de revisar el detalle de facturas.
          </p>
        </div>
        <ReceiptText className="size-5 text-stone-400" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mix.map((item) => {
          const active = activeFilters.includes(item.filterKey);

          return (
          <button
            key={item.code}
            type="button"
            onClick={() => navigateTo(buildDocumentFilterUrl(search, item.filterKey), { scroll: false })}
            aria-pressed={active}
            className={cn(
              "rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:border-stone-300 hover:bg-stone-50 hover:shadow-sm dark:hover:bg-stone-800/75",
              active
                ? "border-orange-300 bg-orange-50 text-orange-700 shadow-sm dark:border-orange-500/45 dark:bg-orange-500/10 dark:text-orange-300"
                : "border-stone-200 bg-stone-50 text-stone-950 dark:border-stone-700 dark:bg-stone-900/70 dark:text-white"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={cn("inline-flex items-center gap-2 text-sm font-medium", active ? "text-orange-700 dark:text-orange-300" : "text-stone-700 dark:text-stone-200")}>
                <FileText className={cn("size-4", active ? "text-orange-500" : "text-stone-400")} aria-hidden="true" />
                {item.label}
              </span>
              <span className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold ring-1",
                active
                  ? "bg-white text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/30"
                  : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700"
              )}>
                {item.code}
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{item.count}</p>
            <p className={cn("text-xs", active ? "text-orange-700/80 dark:text-orange-200/80" : "text-stone-500 dark:text-stone-400")}>
              {active ? "filtro activo" : "documentos"}
            </p>
          </button>
          );
        })}
      </div>
    </section>
  );
}

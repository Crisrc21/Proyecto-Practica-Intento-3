import { CalendarClock, X } from "lucide-react";
import {
  DocumentDateRangeFilter,
  documentDateFieldLabel,
  isDocumentDateRangeActive,
  normalizeDocumentDateRangeFilter
} from "@/modules/accounts-receivable/data/date-filters";
import { Button } from "@/shared/components/ui/button";
import { Input, Select } from "@/shared/components/ui/form";

export function DocumentDateFilter({
  value,
  onChange,
  totalCount,
  filteredCount,
  description = "Filtra documentos por fecha de emisión o vencimiento.",
  variant = "card"
}: {
  value: DocumentDateRangeFilter;
  onChange: (value: DocumentDateRangeFilter) => void;
  totalCount: number;
  filteredCount: number;
  description?: string;
  variant?: "card" | "compact";
}) {
  const active = isDocumentDateRangeActive(value);
  const compact = variant === "compact";
  const filteredText = active
    ? `${filteredCount} de ${totalCount} documentos`
    : `${totalCount} documentos`;

  function update(next: Partial<DocumentDateRangeFilter>) {
    onChange(normalizeDocumentDateRangeFilter({ ...value, ...next }));
  }

  return (
    <div
      className={
        compact
          ? "space-y-3"
          : "rounded-xl border border-stone-200 bg-white/85 p-3 shadow-sm dark:border-stone-700 dark:bg-black/30"
      }
    >
      <div className={compact ? "space-y-3" : "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500 dark:border-stone-700 dark:bg-[#151515] dark:text-stone-300">
              <CalendarClock className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                Fecha de {documentDateFieldLabel(value.field)}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
          <Select
            aria-label="Tipo de fecha"
            value={value.field}
            onChange={(event) => update({ field: event.target.value as DocumentDateRangeFilter["field"] })}
            className="h-9 bg-white/90 text-sm dark:border-stone-700 dark:bg-[#111111] dark:text-white"
          >
            <option value="fechaEmision">Emisión</option>
            <option value="fechaVencimiento">Vencimiento</option>
          </Select>
          <Input
            aria-label="Fecha desde"
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => update({ from: event.target.value })}
            className="h-9 bg-white/90 text-sm dark:border-stone-700 dark:bg-[#111111] dark:text-white"
          />
          <Input
            aria-label="Fecha hasta"
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => update({ to: event.target.value })}
            className="h-9 bg-white/90 text-sm dark:border-stone-700 dark:bg-[#111111] dark:text-white"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ field: value.field, from: "", to: "" })}
            disabled={!active}
            className="h-9 whitespace-nowrap"
          >
            <X className="size-4" aria-hidden="true" />
            Limpiar
          </Button>
        </div>
      </div>
      <div className="text-xs text-stone-500 dark:text-stone-400">{filteredText}</div>
    </div>
  );
}

import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/classnames";

export function DocumentConditionsPanel({
  children,
  totalCount,
  filteredCount,
  activeCount,
  description = "Agrupa las condiciones de lectura sin recargar la vista.",
  onClear
}: {
  children: ReactNode;
  totalCount: number;
  filteredCount: number;
  activeCount: number;
  description?: string;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActiveConditions = activeCount > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white/90 shadow-sm dark:border-stone-700 dark:bg-[#151515]">
      <div className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500 dark:border-stone-700 dark:bg-black/30 dark:text-stone-300">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                Condiciones
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{description}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-600 dark:border-stone-700 dark:bg-black/30 dark:text-stone-300">
            {hasActiveConditions
              ? `${filteredCount} de ${totalCount} documentos`
              : `${totalCount} documentos`}
          </span>
          {hasActiveConditions && onClear ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8">
              <X className="size-4" aria-hidden="true" />
              Limpiar
            </Button>
          ) : null}
          <Button
            type="button"
            variant={hasActiveConditions ? "default" : "outline"}
            size="sm"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="h-8"
          >
            Condiciones
            {hasActiveConditions ? (
              <span className="rounded-full bg-white/20 px-1.5 text-[11px] leading-5">
                {activeCount}
              </span>
            ) : null}
            <ChevronDown
              className={cn("size-4 transition", open && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-stone-200 bg-stone-50/55 p-3 dark:border-stone-700 dark:bg-[#151515]">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

import { limpiarNumeroSii, obtenerPrefijoDocumento } from "@/modules/accounts-receivable/data/document-ids";
import { TipoDocumento, TipoDocumentoRelacionado } from "@/modules/accounts-receivable/types";
import { cn } from "@/shared/lib/classnames";

type DocumentoConPrefijo = TipoDocumento | TipoDocumentoRelacionado;

const sizes = {
  sm: {
    root: "gap-0.5",
    label: "text-[10px]",
    prefix: "text-[11px]",
    number: "text-sm"
  },
  md: {
    root: "gap-1",
    label: "text-[11px]",
    prefix: "text-xs",
    number: "text-base"
  },
  lg: {
    root: "gap-1.5",
    label: "text-xs",
    prefix: "text-xl",
    number: "text-2xl"
  }
};

export function nombreCortoDocumento(tipoDocumento: DocumentoConPrefijo) {
  if (tipoDocumento.includes("Exenta")) return "Factura exenta";
  if (tipoDocumento.includes("Crédito")) return "Nota crédito";
  if (tipoDocumento.includes("Débito")) return "Nota débito";
  if (tipoDocumento.includes("Reemplazo")) return "Factura reemplazo";
  return "Factura";
}

export function DocumentFolio({
  tipoDocumento,
  numero,
  size = "md",
  showLabel = true,
  className
}: {
  tipoDocumento: DocumentoConPrefijo;
  numero: string;
  size?: keyof typeof sizes;
  showLabel?: boolean;
  className?: string;
}) {
  const classes = sizes[size];

  return (
    <span
      title={tipoDocumento}
      className={cn(
        "inline-flex flex-col font-medium text-stone-800 dark:text-stone-100",
        classes.root,
        className
      )}
    >
      {showLabel && (
        <span className={cn("leading-none text-stone-500 dark:text-stone-400", classes.label)}>
          {nombreCortoDocumento(tipoDocumento)}
        </span>
      )}
      <span className="inline-flex items-baseline gap-1.5 leading-none">
        <span className={cn("font-semibold text-orange-600", classes.prefix)}>
          {obtenerPrefijoDocumento(tipoDocumento)}
        </span>
        <span className={cn("number-tabular font-medium text-stone-800 dark:text-stone-100", classes.number)}>
          {limpiarNumeroSii(numero)}
        </span>
      </span>
    </span>
  );
}

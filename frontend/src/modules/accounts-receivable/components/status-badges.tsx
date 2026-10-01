import { Badge } from "@/shared/components/ui/badge";
import { EstadoDocumental, EstadoPago, EstadoVencimiento } from "@/modules/accounts-receivable/types";

export function EstadoPagoBadge({ estado }: { estado: EstadoPago }) {
  const tone =
    estado === "Pagado"
      ? "success"
      : estado === "Pago parcial"
        ? "warning"
        : "muted";

  return <Badge tone={tone}>{estado}</Badge>;
}

export function EstadoVencimientoBadge({ estado }: { estado: EstadoVencimiento }) {
  return (
    <Badge tone={estado === "Vencida" ? "danger" : "success"}>{estado}</Badge>
  );
}

export function EstadoDocumentalBadge({ estado }: { estado: EstadoDocumental }) {
  return <Badge tone={estado === "Anulado" ? "danger" : "default"}>{estado}</Badge>;
}

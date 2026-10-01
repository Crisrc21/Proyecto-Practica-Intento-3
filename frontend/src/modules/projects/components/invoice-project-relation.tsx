import { useEffect, useState } from "react";
import { loadProjects } from "../data/projects-api";
import type { Project } from "../types";
import { AppLink } from "../../../shared/components/app-link";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/components/ui/card";

export function InvoiceProjectRelation({ invoiceId }: { invoiceId: string }) {
  const [projects, setProjects] = useState<Project[] | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true; setProjects(null); setError("");
    loadProjects().then(data => { if (active) setProjects(data.projects); }).catch(() => { if (active) setError("No se pudieron consultar las relaciones con proyectos."); });
    return () => { active = false; };
  }, [invoiceId]);
  const project = projects?.find(p => p.invoiceLinks.some(l => l.invoiceId === invoiceId));
  const link = project?.invoiceLinks.find(l => l.invoiceId === invoiceId);
  const edp = project?.milestones.find(m => m.id === link?.milestoneId);
  return <Card><CardHeader><CardTitle>Proyecto y estado de pago</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
    {error ? <p role="alert">{error}</p> : !projects ? <p>Consultando relación…</p> : project && link ? <><p className="font-semibold">{project.name}</p><p>{edp?.name || "Estado de pago vinculado"}</p><div className="flex flex-wrap gap-2">{link.tags?.map(tag => <span key={tag} className="rounded-md bg-orange-500/10 px-2 py-1 text-xs">{tag}</span>)}</div><AppLink className="inline-block text-orange-600 underline dark:text-orange-300" href={`/proyectos?proyecto=${encodeURIComponent(project.id)}&vista=edps&edp=${encodeURIComponent(link.milestoneId)}`}>Abrir estado de pago y gestionar relación</AppLink></> : <><p>Esta factura aún no tiene un proyecto y EDP asociados.</p><AppLink className="text-orange-600 underline dark:text-orange-300" href="/proyectos">Ir a proyectos para vincularla</AppLink></>}
  </CardContent></Card>;
}

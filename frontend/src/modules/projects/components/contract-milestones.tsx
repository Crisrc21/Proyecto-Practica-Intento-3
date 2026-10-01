import { CheckCircle2, CircleDashed } from "lucide-react";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Milestone, Project } from "../types";
import { contractMilestones } from "../data/contract-milestones";
import { emptyMilestone, shortDate } from "../data/project-calculations";
import "../contract-process.css";

export function ContractMilestones({ project, invoices, dataState, cutoff, onEdit, onProfile, onEdps }: { project: Project; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string; onEdit: (m: Milestone) => void; onProfile: () => void; onEdps: () => void }) {
  const milestones = contractMilestones(project, invoices, dataState, cutoff);
  function manage(type: "Anticipo" | "Retenciones") {
    const records = project.milestones.filter(m => m.type === type);
    if (records.length > 1) { onEdps(); return; }
    const held = project.milestones.filter(m => m.type === "EDP").reduce((s, m) => s + (m.settlement?.retention || 0), 0);
    onEdit(records[0] || { ...emptyMilestone(), type, name: type === "Anticipo" ? "Anticipo del contrato" : "Liberación y cobro de retenciones", scope: "General", cashAmount: type === "Retenciones" && held > 0 ? Math.round(held * 100) / 100 : null });
  }
  return <div className="project-contract-milestones" aria-label="Tres hitos financieros del proyecto">{milestones.map((m, i) => <section className="project-panel project-contract-milestone" key={m.key}><span className={`project-badge ${m.actual ? "success" : "neutral"}`}>{m.actual ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}Hito {i + 1} · {m.actual ? "Cumplido" : "Pendiente"}</span><h3>{m.name}</h3><p>{m.detail}</p><p>{m.actual ? `Cumplido: ${shortDate(m.actual)}` : `Previsto: ${shortDate(m.forecast)}`}</p><div className="project-actions"><button className="project-button" onClick={() => m.key === "firma" ? onProfile() : manage(m.key === "anticipo" ? "Anticipo" : "Retenciones")}>{m.key === "firma" ? "Ver datos del proyecto" : m.key === "anticipo" ? "Gestionar anticipo" : "Gestionar retenciones"}</button>{m.key !== "firma" && <button className="project-text-link" onClick={onEdps}>Facturas y cobros</button>}</div></section>)}</div>;
}

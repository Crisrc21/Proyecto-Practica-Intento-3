import { IncomePlanning } from "./income-planning";
import { useMemo, useState } from "react";
import { ProjectInvoiceLinks } from "./project-invoice-links";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";

export function ProjectCash({ projects: providedProjects, allProjects, invoices, dataState, cutoff, year, onSave }: { projects: Project[]; allProjects: Project[]; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string; year: number; onSave: (p: Project, reason: string) => Promise<void> }) {
  const [showSimulation, setShowSimulation] = useState(false);
  const hasMixed = providedProjects.some(p => p.simulation) && providedProjects.some(p => !p.simulation);
  const projects = useMemo(() => hasMixed ? providedProjects.filter(p => showSimulation ? p.simulation : !p.simulation) : providedProjects, [providedProjects, hasMixed, showSimulation]);
  const project = projects.length === 1 ? projects[0] : null;
  return <div className="project-stack">
    {hasMixed && <label className="project-field compact">Cartera financiera<select value={showSimulation ? "simulation" : "real"} onChange={e => setShowSimulation(e.target.value === "simulation")}><option value="real">Proyectos reales</option><option value="simulation">Solo simulaciones</option></select></label>}
    {projects.some(p => p.simulation) && <p className="project-note">Escenario ficticio. Los importes y pagos pertenecen exclusivamente a la simulación.</p>}
    <IncomePlanning projects={projects} invoices={invoices} dataState={dataState} cutoff={cutoff} year={year} onSave={onSave} />
    {project && <ProjectInvoiceLinks project={project} allProjects={allProjects} invoices={invoices} dataState={dataState} cutoff={cutoff} onSave={onSave} />}
  </div>;
}

import type { Milestone, Project } from "../types";

export function appliedRetentions(project: Project, cutoff: string): number {
  return Math.round(project.milestones.filter(m => m.type === "EDP" && m.edp?.presentedDate && m.edp.presentedDate <= cutoff && m.settlement?.applyRetention !== false)
    .reduce((sum, m) => sum + (m.settlement?.retention ?? 0), 0) * 100) / 100;
}

export function retentionForSave(project: Project, draft: Milestone, currentDate: string): Milestone {
  return { ...draft, type: "Retenciones", scope: "General", cashAmount: appliedRetentions(project, project.simulation?.asOf || currentDate), settlement: undefined };
}

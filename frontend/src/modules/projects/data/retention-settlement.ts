import type { Project } from "../types";

export function appliedRetentions(project: Project, cutoff: string): number {
  return Math.round(project.milestones.filter(m => m.type === "EDP" && m.edp?.status === "Aprobado" && m.edp.approvedDate && m.edp.approvedDate <= cutoff && m.settlement?.applyRetention !== false)
    .reduce((sum, m) => sum + (m.settlement?.retention ?? 0), 0) * 100) / 100;
}

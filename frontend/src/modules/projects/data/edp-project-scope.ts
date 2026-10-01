import type { Milestone, Project } from "../types";

export function withEdpScope(project: Project, milestone: Milestone): Project {
  const keys = (milestone.detailKeys || [milestone.edp?.stageKey]).filter((key): key is "interior" | "exterior" => key === "interior" || key === "exterior");
  if (!keys.length) return project;
  return { ...project, nature: "llave_en_mano", includedWorks: [...new Set([...(project.includedWorks || []), ...keys])] };
}

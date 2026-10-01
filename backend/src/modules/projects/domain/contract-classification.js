// Legacy numeric natures are translated without changing evidence or commitments.
export function normalizeClassification(project) {
  const legacy = project.nature;
  if (![1, 2, 3, 4].includes(legacy)) return project;
  return { ...project, nature: legacy === 1 ? "fabricacion_montaje" : "llave_en_mano",
    includedWorks: [...([2, 3].includes(legacy) ? ["interior"] : []), ...([3, 4].includes(legacy) ? ["exterior"] : [])] };
}

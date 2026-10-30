export function synchronizeRetentions(project, currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) {
  const records = project.milestones.filter(m => m.type === "Retenciones");
  // Multiple legacy releases have separate amounts; do not assign the whole total to each.
  if (records.length !== 1) return project;
  const cutoff = project.simulation?.asOf || currentDate;
  const total = Math.round(project.milestones.filter(m => m.type === "EDP" && m.edp?.presentedDate && m.edp.presentedDate <= cutoff && m.settlement?.applyRetention !== false)
    .reduce((sum, m) => sum + (m.settlement?.retention ?? 0), 0) * 100) / 100;
  return { ...project, milestones: project.milestones.map(m => m.id === records[0].id ? { ...m, cashAmount: total } : m) };
}

import { randomUUID } from "node:crypto";
import { HttpError } from "../../../shared/errors/http-error.js";
import { preserveBaselines, validateProject } from "../domain/project-validation.js";
import { applyWorkflow } from "../domain/project-workflow.js";
import { preserveEdpPlan } from "../domain/edp-plan.js";

import { preserveOperations, withOperations } from "../domain/project-operations.js";

import { CRISSONT_ID, createCrissontSimulation } from "../domain/crissont-simulation.js";

function changes(previous, next) {
  if (!previous) return ["Proyecto creado"];
  const result = [];
  if (JSON.stringify(previous.edpConditions) !== JSON.stringify(next.edpConditions)) result.push(`Condiciones EDP actualizadas: retenciones ${next.edpConditions?.retentionPercent ?? 5}%, anticipo ${next.edpConditions?.recoveryPercent ?? 20}%. Referencia: ${next.edpConditions?.reference || "sin referencia"}.`);
  if (!previous.edpPlan && next.edpPlan) result.push(`Programación inicial basada en el primer EDP presentado: ${next.edpPlan.reference}. ${next.edpPlan.milestoneIds.length} EDP; total contractual ${next.edpPlan.contractAmount} ${next.edpPlan.currency}.`);
  for (const [key, label] of Object.entries({ lifecycle: "Estado contractual", nature: "Tipo de contrato", areaM2: "Superficie contratada (m²)", signedDate: "Fecha de firma" })) {
    if (previous[key] !== next[key]) result.push(`${label}: ${previous[key] ?? "sin dato"} → ${next[key] ?? "sin dato"}`);
  }
  for (const key of new Set([...Object.keys(previous.incomeDates || {}), ...Object.keys(next.incomeDates || {})])) {
    if (previous.incomeDates?.[key] !== next.incomeDates?.[key]) result.push(`Fecha de proyección ${key}: ${previous.incomeDates?.[key] || "fecha original"} → ${next.incomeDates?.[key] || "fecha original"}.`);
  }
  for (const r of next.progressReports || []) {
    if (!(previous.progressReports || []).some(old => old.id === r.id)) result.push(`Avance ${r.stageKey} al ${r.date}: cantidad ${r.quantity ?? "—"}, casas terminadas ${r.completedUnits ?? "—"}, porcentaje ${r.percent ?? "—"}. Evidencia: ${r.evidence}`);
  }
  for (const [key, label] of Object.entries({ name: "Nombre", customer: "Cliente", units: "Viviendas", contractAmount: "Monto contractual", startDate: "Inicio", endDate: "Término", ufValue: "UF de proyección", approvedFolder: "Carpeta de aprobados", paymentTerms: "Condiciones de pago", notes: "Observaciones" })) {
    if (previous[key] !== next[key]) result.push(`${label}: ${previous[key] ?? "sin dato"} → ${next[key] ?? "sin dato"}`);
  }
  for (const m of next.milestones) {
    const old = previous.milestones.find(item => item.id === m.id);
    if (!old) { result.push(`Nuevo hito: ${m.name}`); continue; }
    if (JSON.stringify(old.settlement) !== JSON.stringify(m.settlement)) result.push(`${m.name}: desglose financiero actualizado; bruto ${m.settlement?.gross ?? "sin desglose"}, anticipo ${m.settlement?.advanceRecovery ?? 0}, retención ${m.settlement?.retention ?? 0}, descuentos ${m.settlement?.discounts ?? 0}, multas ${m.settlement?.penalties ?? 0}, ajustes ${m.settlement?.adjustments ?? 0}`);
    if (JSON.stringify(old.edp) !== JSON.stringify(m.edp)) result.push(`${m.name}: EDP ${old.edp?.status ?? "sin condición"} → ${m.edp?.status ?? "sin condición"}; condición ${m.edp?.metric ?? "—"} ≥ ${m.edp?.threshold ?? "—"}; presentación ${m.edp?.presentedDate ?? "—"}; aprobación ${m.edp?.approvedDate ?? "—"}`);
    for (const [key, label] of Object.entries({ forecastDate: "fecha prevista", actualDate: "fecha efectiva", cashDate: "fecha de cobro", cashAmount: "monto de cobro", state: "estado", evidence: "evidencia", baselineApproved: "base confirmada", invoicingComplete: "facturación completa", name: "nombre", scope: "alcance", type: "tipo", startDate: "inicio", source: "fuente", notes: "observaciones" })) {
      if (old[key] !== m[key]) result.push(`${m.name}, ${label}: ${old[key] ?? "sin dato"} → ${m[key] ?? "sin dato"}`);
    }
  }
  if (JSON.stringify(previous.includedWorks || []) !== JSON.stringify(next.includedWorks || [])) result.push("Alcances de construcción actualizados");
  if (JSON.stringify(previous.invoiceLinks) !== JSON.stringify(next.invoiceLinks)) {
    result.push("Asociaciones de facturas actualizadas");
    for (const link of next.invoiceLinks) {
      const old = previous.invoiceLinks.find(l => l.invoiceId === link.invoiceId);
      if (JSON.stringify(old) !== JSON.stringify(link)) result.push(`Factura ${link.invoiceId}: ${previous.milestones.find(m => m.id === old?.milestoneId)?.name || "sin EDP"} → ${next.milestones.find(m => m.id === link.milestoneId)?.name}; etiquetas: ${(link.tags || []).join(", ") || "sin etiquetas"}`);
    }
    for (const link of previous.invoiceLinks.filter(old => !next.invoiceLinks.some(l => l.invoiceId === old.invoiceId))) result.push(`Factura ${link.invoiceId}: relación retirada de ${previous.milestones.find(m => m.id === link.milestoneId)?.name}`);
  }
  for (const e of next.houseEvents || []) if (!(previous.houseEvents || []).some(old => old.id === e.id)) result.push(`Casa ${e.house} · ${e.stage}: ${e.date || "fecha retirada"} · ${e.evidence}`);
  for (const invoice of next.simulation?.invoices || []) for (const pay of invoice.payments) if (!previous.simulation?.invoices.find(i => i.id === invoice.id)?.payments.some(p => p.id === pay.id)) result.push(`Pago simulado conciliado · factura ${invoice.number}: ${pay.amountUF} UF · ${pay.reference}`);
  if (JSON.stringify(previous.issues) !== JSON.stringify(next.issues)) result.push("Pendientes de revisión actualizados");
  return result.length ? result : ["Ficha actualizada"];
}

export function createProjectsService(repository) {
  return {
    async list() {
      const data = await repository.read();
      return { projects: data.projects.map(withOperations), integration: { provider: "Microsoft 365", status: "not_connected" } };
    },
    async createSimulation() {
      const data = await repository.read();
      const existing = data.projects.find(p => p.id === CRISSONT_ID);
      if (existing) return withOperations(existing);
      try { return await this.save({ project: createCrissontSimulation(), expectedRevision: 0, reason: "Simulación Los Crissont creada con 18 facturas ficticias y cobro cero" }); }
      catch (error) { if (error.statusCode === 409 || error.status === 409) { const current = (await repository.read()).projects.find(p => p.id === CRISSONT_ID); if (current) return withOperations(current); } throw error; }
    },
    async remove(payload) {
      if (!payload || typeof payload.id !== "string" || !Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 1) throw new HttpError(400, "Falta identificar el proyecto y su versión.");
      return repository.transaction(data => {
        const project = data.projects.find(p => p.id === payload.id);
        if (!project) throw new HttpError(404, "El proyecto ya no existe.");
        if (project.revision !== payload.expectedRevision) throw new HttpError(409, "El proyecto cambió en otra sesión. Actualiza los datos antes de eliminarlo.");
        data.deletedProjects = [...(data.deletedProjects || []), { ...project, deletedAt: new Date().toISOString() }];
        data.projects = data.projects.filter(p => p.id !== payload.id);
        return { id: project.id };
      });
    },
    async save(payload) {
      if (!payload || !Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 0) throw new HttpError(400, "Falta la versión del proyecto.");
      const project = validateProject(payload.project);
      const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
      if (reason.length > 1000) throw new HttpError(400, "El detalle del registro supera los 1.000 caracteres.");
      return repository.transaction(data => {
        const previous = data.projects.find(item => item.id === project.id);
        if ((previous?.revision ?? 0) !== payload.expectedRevision) throw new HttpError(409, "El proyecto cambió en otra sesión. Recarga los datos antes de guardar.");
        preserveOperations(previous, project);
        applyWorkflow(previous, project);
        preserveEdpPlan(previous, project);
        preserveBaselines(previous, project);
        for (const other of data.projects.filter(item => item.id !== project.id)) {
          if (other.invoiceLinks.some(link => project.invoiceLinks.some(item => item.invoiceId === link.invoiceId))) {
            throw new HttpError(409, `Una factura ya está asociada al proyecto ${other.name}.`);
          }
        }
        const now = new Date().toISOString();
        const saved = {
          ...project,
          revision: (previous?.revision ?? 0) + 1,
          updatedAt: now,
          history: [...(previous?.history ?? []), { id: randomUUID(), at: now, reason: reason || (!previous ? project.lifecycle === "Potencial" ? "Contrato potencial agregado" : "Proyecto creado" : "Actualización del proyecto"), changes: changes(previous, project) }]
        };
        if (previous) data.projects[data.projects.indexOf(previous)] = saved;
        else data.projects.push(saved);
        return withOperations(saved);
      });
    }
  };
}

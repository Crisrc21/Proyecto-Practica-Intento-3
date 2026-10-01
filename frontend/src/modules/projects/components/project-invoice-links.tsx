import "../linked-invoice-cards.css";
import { edpDetailLabels } from "../data/edp-detail-labels";
import { useState, type FormEvent } from "react";
import { Link2, Pencil, Unlink, FileText, Plus, ArrowUpRight } from "lucide-react";
import type { FacturaCalculada } from "../../accounts-receivable/types";
import type { DataState, Project } from "../types";
import { amount, shortDate } from "../data/project-calculations";
import { AppLink } from "../../../shared/components/app-link";

export function ProjectInvoiceLinks({ project, allProjects, invoices, dataState, cutoff, selectedMilestone, onSave }: {
  project: Project; allProjects: Project[]; invoices: FacturaCalculada[]; dataState: DataState; cutoff: string;
  selectedMilestone?: string; onSave: (p: Project, reason: string) => Promise<void>;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [milestoneId, setMilestoneId] = useState(selectedMilestone || "");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(project.invoiceLinks.length === 0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const simulationInvoices = project.simulation?.invoices || [];
  const assigned = new Set(allProjects.flatMap(p => p.invoiceLinks.map(l => l.invoiceId)));
  const rut = (s: string) => s.replace(/[^\dkK]/g, "").toUpperCase();
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const eligible = invoices.filter(i => !assigned.has(i.id) && !i.anulada && ["Factura Electrónica 33", "Factura Exenta Electrónica 34"].includes(i.tipoDocumento) && (!project.customerRut || rut(i.cliente?.rut || i.clienteId) === rut(project.customerRut)));
  const candidates = eligible.filter(i => i.id === invoiceId || normalize(`${i.numero} ${i.cliente?.nombre || ""} ${i.observacion || ""}`).includes(normalize(query)));
  const targets = project.milestones.filter(m => ["Anticipo", "EDP", "Retenciones"].includes(m.type));
  const links = project.invoiceLinks.filter(l => !selectedMilestone || l.milestoneId === selectedMilestone);
  function reset() { setInvoiceId(""); setMilestoneId(selectedMilestone || ""); setTags(""); setEditing(null); setQuery(""); }
  async function save(e: FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    const tagList = [...new Set(tags.split(",").map(t => t.trim().toLocaleLowerCase("es")).filter(Boolean))];
    if (tagList.length > 12 || tagList.some(t => t.length > 50)) { setError("Usa hasta 12 etiquetas de máximo 50 caracteres cada una."); return; }
    if (!targets.some(m => m.id === milestoneId) || !invoiceId || (!editing && (dataState !== "ready" || !eligible.some(i => i.id === invoiceId)))) { setError("Selecciona una factura disponible y un estado de pago."); return; }
    const link = { invoiceId, milestoneId, tags: tagList };
    setBusy(true);
    try {
      await onSave({ ...project, invoiceLinks: editing ? project.invoiceLinks.map(l => l.invoiceId === editing ? link : l) : [...project.invoiceLinks, link] }, editing ? "Relación factura–EDP y etiquetas actualizadas" : "Factura vinculada al estado de pago");
      reset(); setFormOpen(false); setMessage("Relación guardada. Los pagos de la factura se reflejan en el EDP y en Cobros.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la relación."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError(""); setMessage("");
    try { await onSave({ ...project, invoiceLinks: project.invoiceLinks.filter(l => l.invoiceId !== id) }, "Factura desvinculada del estado de pago"); if (editing === id) reset(); setMessage("Relación eliminada. La factura y sus pagos siguen disponibles en CxC."); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo desvincular."); }
    finally { setBusy(false); }
  }
  return <section className="project-panel project-invoice-links">
    <div className="project-panel-heading linked-invoices-heading"><div><h2>Facturas y estados de pago <span className="linked-invoices-count">{links.length}</span></h2><p>Documentos vinculados y cobros de sus estados de pago.</p></div>{!project.simulation && !formOpen ? <button type="button" className="project-button primary" onClick={() => setFormOpen(true)}><Plus size={16} />Vincular factura</button> : <Link2 size={20} />}</div>
    {!project.simulation && formOpen && <form className="project-form" onSubmit={save}>
      {!editing && <label className="project-field project-full">Buscar factura disponible<input type="search" placeholder="Número, cliente o descripción" value={query} onChange={e => setQuery(e.target.value)} /></label>}
      <label className="project-field">Factura<select required disabled={busy || Boolean(editing) || dataState !== "ready"} value={invoiceId} onChange={e => setInvoiceId(e.target.value)}><option value="">Selecciona una factura</option>{editing ? <option value={editing}>{invoices.find(i => i.id === editing)?.numero || "Factura no disponible"}</option> : candidates.map(i => <option key={i.id} value={i.id}>{i.numero} · {i.cliente?.nombre} · {amount(i.monto)}</option>)}</select></label>
      <label className="project-field">Estado de pago asociado<select required disabled={busy} value={milestoneId} onChange={e => setMilestoneId(e.target.value)}><option value="">Selecciona un EDP</option>{targets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="project-field project-full">Etiquetas de la relación (opcional)<input disabled={busy} value={tags} maxLength={650} onChange={e => setTags(e.target.value)} placeholder="Ej.: etapa 1, fabricación, lote norte" /><span>Separa con comas. Las etiquetas ayudan a buscar; la vinculación se confirma con el botón Guardar.</span></label>
      <div className="project-form-actions project-full"><button type="button" className="project-button" disabled={busy} onClick={() => { reset(); setFormOpen(false); }}>Cancelar</button><button className="project-button primary" disabled={busy || !invoiceId || !milestoneId || (!editing && dataState !== "ready")}>{busy ? "Guardando…" : editing ? "Guardar relación" : "Vincular factura"}</button></div>
    </form>}

    {project.simulation && <p className="project-note project-full">Las facturas de este escenario fueron creadas automáticamente con folios 4000 en adelante. Puedes revisar y conciliar sus pagos desde Cobros.</p>}
    {error && <p className="project-error" role="alert">{error}</p>}{message && <p className="project-feedback" role="status">{message}</p>}
    {dataState !== "ready" && !project.simulation && <p className="project-footnote">CxC no está disponible. Puedes revisar las relaciones guardadas; los importes y pagos se mostrarán al recuperar la conexión.</p>}
    {dataState === "ready" && !project.simulation && !eligible.length && !editing && <p className="project-footnote">No hay facturas disponibles para vincular{project.customerRut ? " del RUT del cliente" : ""}. Las facturas ya asignadas se conservan en su EDP.</p>}
    {!targets.length && <p className="project-footnote">Planifica un estado de pago antes de vincular facturas.</p>}
    <div className="linked-invoice-grid">{links.map(l => {
      const invoice = dataState === "ready" ? invoices.find(i => i.id === l.invoiceId) : undefined;
      const simulationInvoice = simulationInvoices.find(i => i.id === l.invoiceId);
      const m = project.milestones.find(m => m.id === l.milestoneId);
      const paid = simulationInvoice ? simulationInvoice.payments.filter(p => p.date <= cutoff).reduce((sum, p) => sum + p.amountUF, 0) : invoice ? invoice.pagos.filter(p => p.fechaPago <= cutoff).reduce((sum, p) => sum + p.monto, 0) : null;
      const currency = simulationInvoice ? "UF" : "CLP";
      return <article className="linked-invoice-card" key={l.invoiceId}>
        <div className="linked-invoice-title"><span className="linked-invoice-icon"><FileText size={21} aria-hidden="true" /></span><div>{invoice ? <AppLink href={`/trazabilidad?factura=${encodeURIComponent(invoice.id)}`}>Factura {invoice.numero}<ArrowUpRight size={15} aria-hidden="true" /></AppLink> : <strong>{simulationInvoice ? `Factura ${simulationInvoice.number} · ficticia` : "Factura vinculada"}</strong>}<span className="linked-invoice-subtitle">{invoice || simulationInvoice ? `Documento en ${currency}` : "Datos no disponibles"}</span></div></div>
        <div className="linked-invoice-edp"><span>Estado de pago</span><AppLink href={`/proyectos?proyecto=${encodeURIComponent(project.id)}&vista=edps&edp=${encodeURIComponent(l.milestoneId)}`}>{m?.name || "EDP no disponible"}</AppLink></div>
        <div className="project-relation-tags">{[...new Set([...edpDetailLabels(m), ...(l.tags || [])])].map(tag => <span key={tag}>{tag}</span>)}</div>
        <dl className="linked-invoice-amounts"><div><dt>Monto factura</dt><dd>{invoice ? amount(invoice.monto) : simulationInvoice ? amount(simulationInvoice.amountUF, "UF") : "Sin dato"}</dd></div><div><dt>Cobrado al corte</dt><dd>{paid === null ? "Por consultar" : amount(paid, currency)}</dd></div></dl>
        <div className="linked-invoice-due"><span>Vencimiento</span><span>{shortDate(invoice?.fechaVencimiento || simulationInvoice?.due || null)}</span></div>
        {!project.simulation && <div className="linked-invoice-actions"><button type="button" className="project-button" disabled={busy} onClick={() => { setFormOpen(true); setEditing(l.invoiceId); setInvoiceId(l.invoiceId); setMilestoneId(l.milestoneId); setTags((l.tags || []).join(", ")); setError(""); setMessage(""); }}><Pencil size={14} />Editar relación</button><button type="button" className="linked-invoice-unlink" disabled={busy} aria-label={`Desvincular factura ${invoice?.numero || l.invoiceId}`} onClick={() => remove(l.invoiceId)}><Unlink size={14} />Desvincular</button></div>}
      </article>;
    })}</div>
    {!links.length && <p className="project-footnote">Todavía no hay facturas vinculadas en esta vista.</p>}
  </section>;
}

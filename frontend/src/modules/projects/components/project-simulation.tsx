import { useMemo, useState, type FormEvent } from "react";
import { ClipboardList, FlaskConical, Plus, WalletCards } from "lucide-react";
import type { Project, HouseEvent, SimulationInvoice } from "../types";
import { amount, shortDate, todayISO } from "../data/project-calculations";

type Save = (project: Project, reason: string) => Promise<void>;

export function ProjectSimulationSummary({ project }: { project: Project }) {
  if (!project.simulation) return null;
  const billed = project.simulation.invoices.reduce((sum, invoice) => sum + invoice.amountUF, 0);
  const paid = project.simulation.invoices.reduce((sum, invoice) => sum + invoice.payments.reduce((subtotal, payment) => subtotal + payment.amountUF, 0), 0);
  return <section className="project-panel project-simulation-summary">
    <div className="project-panel-heading"><div><span className="project-eyebrow">ESCENARIO DE PRUEBA</span><h2>Simulación Los Crissont</h2><p>Datos ficticios para probar hitos, EDP, facturas y conciliación sin alterar la cartera real.</p></div><FlaskConical size={20} /></div>
    <div className="project-stats project-simulation-stats"><div><span>Facturas ficticias</span><strong>{project.simulation.invoices.length}</strong><small>Folios 4000–{3999 + project.simulation.invoices.length}</small></div><div><span>Facturado</span><strong>{amount(billed, "UF")}</strong><small>Incluye anticipo, EDP y retenciones</small></div><div><span>Recaudado</span><strong>{amount(paid, "UF")}</strong><small>{paid === 0 ? "Sin pagos conciliados" : "Pagos registrados"}</small></div><div><span>Corte del escenario</span><strong>{shortDate(project.simulation.asOf)}</strong><small>UF ficticia: {amount(project.simulation.ufValue)}</small></div></div>
    <div className="project-contract-terms"><h3>Supuestos aplicados</h3><ul>{project.simulation.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></div>
  </section>;
}

function latestEvent(events: HouseEvent[], house: number, stage: HouseEvent["stage"]) {
  return events.filter(event => event.house === house && event.stage === stage).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
}

export function HouseTracking({ project, stage, onSave }: { project: Project; stage: HouseEvent["stage"]; onSave: Save }) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [evidence, setEvidence] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const events = project.houseEvents || [];
  const houses = useMemo(() => Array.from({ length: project.units || 0 }, (_, index) => index + 1).filter(house => !query || String(house).includes(query)), [project.units, query]);
  const completed = houses.filter(house => latestEvent(events, house, stage)?.date).length;
  const label = stage === "despachos" ? "despachada" : "montada";
  async function saveHouse(house: number) {
    const date = drafts[house] || latestEvent(events, house, stage)?.date || "";
    if (!date) { setError(`Indica la fecha de ${label} de la casa ${house}.`); return; }
    if (stage === "montaje" && !latestEvent(events, house, "despachos")) { setError(`Registra primero el despacho de la casa ${house}.`); return; }
    setBusy(true); setError(""); setMessage("");
    const next: HouseEvent = { id: crypto.randomUUID(), house, stage, date, evidence: evidence[house] || latestEvent(events, house, stage)?.evidence || "" };
    try { await onSave({ ...project, houseEvents: [...events, next] }, `Registro de ${stage === "despachos" ? "despacho" : "montaje"} de casa ${house}`); setMessage(`Casa ${house} marcada como ${label}.`); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la actualización."); }
    finally { setBusy(false); }
  }
  return <section className="project-panel project-house-tracking"><div className="project-panel-heading"><div><span className="project-eyebrow">CONTROL POR VIVIENDA</span><h3>{stage === "despachos" ? "Despachos" : "Montaje"}</h3><p>Registra cada casa con su fecha y evidencia. El avance acumulado se calcula automáticamente.</p></div><ClipboardList size={20} /></div>
    <div className="project-tracking-toolbar"><strong>{completed}/{project.units} casas {label === "despachada" ? "despachadas" : "montadas"}</strong><input type="search" aria-label={`Buscar casa para ${stage}`} placeholder="Buscar número de casa" value={query} onChange={event => setQuery(event.target.value.replace(/\D/g, ""))} /></div>
    {message && <p className="project-feedback" role="status">{message}</p>}{error && <p className="project-error" role="alert">{error}</p>}
    <div className="project-house-grid">{houses.map(house => { const current = latestEvent(events, house, stage); return <div className="project-house-row" key={house}><div><strong>Casa {house}</strong><small>{current?.date ? `Último registro: ${shortDate(current.date)}` : "Sin registro"}</small></div><input type="date" max={project.simulation?.asOf || todayISO()} value={drafts[house] ?? current?.date ?? ""} onChange={event => setDrafts(values => ({ ...values, [house]: event.target.value }))} /><input type="text" placeholder="Evidencia (opcional)" value={evidence[house] ?? current?.evidence ?? ""} onChange={event => setEvidence(values => ({ ...values, [house]: event.target.value }))} /><button className="project-button" disabled={busy} onClick={() => saveHouse(house)}><Plus size={14} />Guardar</button></div>; })}</div>
    {!houses.length && <p className="project-footnote">No hay casas para esta búsqueda.</p>}
  </section>;
}

export function SimulationInvoices({ project, onSave }: { project: Project; onSave: Save }) {
  const invoices = project.simulation?.invoices || [];
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [amountUF, setAmountUF] = useState("");
  const [date, setDate] = useState(project.simulation?.asOf || todayISO());
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!project.simulation) return null;
  const simulation = project.simulation;
  async function addPayment(event: FormEvent) {
    event.preventDefault(); if (!paymentFor) return;
    const value = Number(amountUF); if (!value || value <= 0) { setError("Indica un monto mayor que cero."); return; }
    setBusy(true); setError("");
    const next = invoices.map(invoice => invoice.id === paymentFor ? { ...invoice, payments: [...invoice.payments, { id: crypto.randomUUID(), date, amountUF: value, reference }] } : invoice);
    try { await onSave({ ...project, simulation: { ...simulation, invoices: next } }, `Pago simulado registrado en factura ${invoices.find(i => i.id === paymentFor)?.number || ""}`); setPaymentFor(null); setAmountUF(""); setReference(""); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar el pago simulado."); }
    finally { setBusy(false); }
  }
  return <section className="project-panel project-simulation-invoices"><div className="project-panel-heading"><div><h3>Facturas ficticias y conciliación</h3><p>Todos los EDP están vinculados a un folio correlativo. El escenario parte con recaudación cero.</p></div><WalletCards size={20} /></div>
    {error && <p className="project-error" role="alert">{error}</p>}
    <div className="project-invoice-table">{invoices.map(invoice => { const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountUF, 0); const milestone = project.milestones.find(m => project.invoiceLinks.some(link => link.invoiceId === invoice.id && link.milestoneId === m.id)); return <article className="project-invoice-row" key={invoice.id}><div><strong>Factura {invoice.number}</strong><small>{milestone?.name || "EDP simulado"}</small></div><div><strong>{amount(invoice.amountUF, "UF")}</strong><small>Emitida {shortDate(invoice.issued)} · vence {shortDate(invoice.due)}</small></div><div><span className={`project-badge ${paid >= invoice.amountUF ? "success" : paid ? "warning" : "neutral"}`}>{paid >= invoice.amountUF ? "Conciliada" : paid ? "Pago parcial" : "Sin pago"}</span><small>{amount(paid, "UF")} / {amount(invoice.amountUF, "UF")}</small></div><button className="project-button" disabled={busy} onClick={() => setPaymentFor(invoice.id)}>Registrar pago de prueba</button></article>; })}</div>
    {paymentFor && <form className="project-form project-payment-form" onSubmit={addPayment}><h4>Pago simulado · factura {invoices.find(invoice => invoice.id === paymentFor)?.number}</h4><label className="project-field">Monto (UF)<input required type="number" min="0.01" step="0.01" value={amountUF} onChange={event => setAmountUF(event.target.value)} /></label><label className="project-field">Fecha de pago<input required type="date" max={project.simulation.asOf} value={date} onChange={event => setDate(event.target.value)} /></label><label className="project-field project-full">Referencia<input value={reference} onChange={event => setReference(event.target.value)} placeholder="Ej.: comprobante de prueba" /></label><div className="project-form-actions project-full"><button type="button" className="project-button" onClick={() => setPaymentFor(null)}>Cancelar</button><button className="project-button primary" disabled={busy}>{busy ? "Guardando…" : "Guardar pago simulado"}</button></div></form>}
  </section>;
}

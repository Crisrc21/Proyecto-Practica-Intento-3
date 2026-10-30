import { latestRegisteredEdp } from "../data/edp-slots";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Building2, CheckCircle2, CircleAlert, ClipboardList, FlaskConical, History, Plus, RefreshCw, Wallet } from "lucide-react";
import { navigateTo } from "@/app/navigation";
import type { FacturaCalculada } from "@/modules/accounts-receivable/types";
import type { DataState, Milestone, Project } from "../types";
import { createCrissontSimulation, deleteProject, loadProjects, saveProject } from "../data/projects-api";
import { amount, emptyProject, shortDate, todayISO } from "../data/project-calculations";
import { Editor, MilestoneForm } from "./project-forms";
import { RetentionForm } from "./retention-form";
import { AdvanceForm } from "./advance-form";
import { MilestoneBadge } from "./project-timeline";
import { ProjectCash } from "./project-cash";
import { EdpForm, ProjectEdps, EdpListBadges } from "./project-workflow";
import { ProjectManual } from "./project-manual";
import { ProjectDirectory, ProjectProfile } from "./project-directory";
import { SimulationInvoices } from "./project-simulation";
import { ProjectOverview } from "./project-overview";
import { workflowAtCutoff } from "../data/project-workflow";
import { ContractMilestones } from "./contract-milestones";
import { withInvoiceDates } from "../data/edp-invoice-data";

type View = "resumen" | "cobros" | "historial" | "edps" | "manual";
export function ProjectsView({ search, invoices, dataState, onRefreshAccounts }: { search: string; invoices: FacturaCalculada[]; dataState: DataState; onRefreshAccounts: () => Promise<void> }) {
  const [projects, setProjects] = useState<Project[]>([]); const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(""); const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(""); const [cutoff, setCutoff] = useState(todayISO());
  const [year, setYear] = useState(Number(todayISO().slice(0,4)));
  const [profileEditor, setProfileEditor] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false), [deleteError, setDeleteError] = useState("");
  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      await deleteProject(deleteTarget);
      setProjects(current => current.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMessage(`Proyecto «${deleteTarget.name}» eliminado de Gestión de proyectos.`);
    } catch (e) { setDeleteError(e instanceof Error ? e.message : "No se pudo eliminar el proyecto."); }
    finally { setDeleting(false); }
  }
  const [milestoneEditor, setMilestoneEditor] = useState<Milestone | null>(null);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const selectedId = params.get("proyecto");
  const selected = projects.find(p => p.id === selectedId);
  useEffect(() => { if (selected?.lifecycle === "Potencial") { setProfileEditor(selected); navigateTo("/proyectos", { scroll: false }); } }, [selected]);
  const view: View = ["manual", "cobros", ...(selected ? ["historial", "edps"] : [])].includes(params.get("vista") || "") ? params.get("vista") as View : "resumen";
  const matches = projects.filter(p => `${p.name} ${p.customer} ${p.location}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const filtered = matches.filter(p => p.lifecycle !== "Potencial");

  const scope = selected ? [selected] : filtered;
  const displayed = scope.map(p => workflowAtCutoff(p, invoices, dataState, cutoff));
  const displaySelected = selected ? displayed[0] : undefined;
  const currentEdp = selected ? latestRegisteredEdp(selected, cutoff) : undefined;
  function changeView(next: View, projectId = selectedId) {
    const q = new URLSearchParams(); if (projectId) q.set("proyecto", projectId); if (next !== "resumen") q.set("vista", next);
    navigateTo(`/proyectos${q.size ? `?${q}` : ""}`, { scroll: false });
    setMessage(""); setActionError("");
  }
  async function reload() {
    setLoading(true); setLoadError("");
    try { const [data] = await Promise.all([loadProjects(), onRefreshAccounts()]); setProjects(data.projects); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los proyectos."); }
    finally { setLoading(false); }
  }
  useEffect(() => { let active = true; loadProjects().then(data => { if(active) setProjects(data.projects); }).catch(e => { if(active) setLoadError(e.message); }).finally(() => { if(active) setLoading(false); }); return () => { active = false; }; }, []);
  async function persist(project: Project, reason: string) {
    const saved = await saveProject(withInvoiceDates(project, invoices, dataState), reason);
    setProjects(current => current.some(p => p.id === saved.id) ? current.map(p => p.id === saved.id ? saved : p) : [...current, saved]);
    setMessage("Cambios guardados. El historial se actualizó automáticamente.");

  }
  async function createSimulation() {
    setBusy(true); setActionError("");
    try { const simulation = await createCrissontSimulation(); setProjects(current => current.some(p => p.id === simulation.id) ? current.map(p => p.id === simulation.id ? simulation : p) : [...current, simulation]); changeView("resumen", simulation.id); setMessage("Simulación Los Crissont creada. Revisa hitos financieros, EDP, facturas y cobros ficticios."); }
    catch (e) { setActionError(e instanceof Error ? e.message : "No se pudo crear la simulación."); }
    finally { setBusy(false); }
  }
  const datedYears = [year, Number(todayISO().slice(0,4)), ...scope.flatMap(p => [p.startDate, p.endDate, ...p.milestones.flatMap(m => [m.baselineDate, m.forecastDate, m.actualDate, m.cashDate, m.baselineCashDate])].filter((d): d is string => Boolean(d)).map(d => Number(d.slice(0,4))))];
  const firstYear = Math.min(...datedYears), lastYear = Math.max(...datedYears);
  const yearOptions = Array.from({length:lastYear-firstYear+1},(_,index)=>firstYear+index);
  if (loading) return <div className="projects-module"><div className="project-empty"><RefreshCw size={24} className="animate-spin" /><h1>Cargando proyectos</h1><p>Consultando contratos y planificación guardada.</p></div></div>;
  if (loadError) return <div className="projects-module"><div className="project-empty" role="alert"><CircleAlert size={28} /><h1>No se pudieron cargar los proyectos</h1><p>{loadError}</p><button className="project-button" onClick={reload}>Reintentar</button></div></div>;
  if (selectedId && !selected) return <div className="projects-module"><div className="project-empty"><h1>Proyecto no encontrado</h1><button className="project-button" onClick={() => changeView("resumen", null)}>Volver a proyectos</button></div></div>;
  return <div className="projects-module">
    {selected && <button className="project-back" onClick={() => changeView("resumen", null)}><ArrowLeft size={15} />Todos los proyectos</button>}
    <header className="project-page-heading"><div><span className="project-eyebrow">CONTROL DE GESTIÓN</span><h1>{selected ? selected.name : "Gestión de proyectos"}</h1><p>{selected ? `${selected.customer || "Cliente por definir"} · ${selected.location || "Ubicación por definir"}` : "Proyecta ingresos, revisa la caja semanal y compara el cobro real al cierre del mes."}</p></div><div className="project-actions"><button className="project-button" onClick={reload} aria-label="Actualizar proyectos"><RefreshCw size={15} />Actualizar</button>{!selected && <button className="project-button" disabled={busy} onClick={createSimulation}><FlaskConical size={16} />Crear simulación</button>}{view !== "manual" && <button className="project-button primary" onClick={() => setProfileEditor(selected || emptyProject())}>{selected ? <ClipboardList size={16} /> : <Plus size={16} />}{selected ? "Ficha del proyecto" : "Agregar proyecto"}</button>}</div></header>
    <div className="project-toolbar"><div className="project-view-tabs" role="group" aria-label="Vistas de proyectos">{([
      ["resumen", selected ? "1 · Vista general" : "Proyectos", Building2], ...(selected ? [["edps", "2 · Estados de pago", ClipboardList]] : []), ["cobros", "Planificación financiera", Wallet], ["manual", "Manual", BookOpen], ...(selected ? [["historial", "Historial", History]] : [])
    ] as const).map(([id,label,Icon]) => <button key={id as string} className={view === id ? "is-active" : ""} onClick={() => changeView(id as View, id === "manual" ? null : selectedId)} aria-pressed={view === id}><Icon size={16} />{label as string}</button>)}</div>{view !== "manual" && (selected || view !== "resumen") && <div className="project-cutoff-controls"><label className="project-field compact">Fecha de revisión<input type="date" max={todayISO()} value={cutoff} onChange={e => { if (e.target.value) setCutoff(e.target.value); }} /></label></div>}</div>
    {message && <div role="status" className="project-feedback"><CheckCircle2 size={17} />{message}</div>}
    {actionError && <p role="alert" className="project-error">{actionError}</p>}
    {selected && view === "resumen" && <div className="project-stats">
      <Stat label="Total contrato" value={amount(selected.contractAmount == null ? null : Math.round(selected.contractAmount), selected.currency)} context="Monto total contratado" icon={Wallet} />
      <div className="project-stat"><div><span>EDP actual</span><ClipboardList size={18} /></div><strong>{currentEdp ? currentEdp.name.match(/\bEDP\s*\d+/i)?.[0] || currentEdp.name : "—"}</strong><small>{currentEdp ? `${currentEdp.name} · ${amount(currentEdp.cashAmount, selected.currency)}` : "No hay EDP registrado al corte"}</small>{currentEdp && <EdpListBadges project={selected} milestone={currentEdp} invoices={invoices} dataState={dataState} cutoff={cutoff} />}</div>
    </div>}
    {!selected && view !== "manual" && <div className="project-search-row"><input type="search" aria-label="Buscar proyecto" placeholder="Buscar por proyecto, mandante o ubicación" value={query} onChange={e => setQuery(e.target.value)} /><span>{view === "resumen" ? matches.length : filtered.length} {(view === "resumen" ? matches.length : filtered.length) === 1 ? "proyecto" : "proyectos"}</span></div>}
    {view === "manual" && <ProjectManual />}

    {view === "edps" && selected && <ProjectEdps key={selected.id} project={selected} allProjects={projects} onSave={persist} initialEdpId={params.get("edp")} cutoff={cutoff} invoices={invoices} dataState={dataState} onEdit={setMilestoneEditor} onCash={() => changeView("cobros")} />}
    {view === "resumen" && !selected && <ProjectDirectory projects={matches} onSelect={setProfileEditor} onDelete={p => { setDeleteError(""); setDeleteTarget(p); }} onOpenTracking={p => p.lifecycle === "Potencial" ? setProfileEditor(p) : changeView("resumen", p.id)} />}
    {view === "resumen" && selected && <div className="project-overview-layout"><ContractMilestones project={selected} invoices={invoices} dataState={dataState} cutoff={cutoff} onEdit={setMilestoneEditor} onProfile={() => setProfileEditor(selected)} onEdps={() => changeView("edps")} /><ProjectOverview project={selected} invoices={invoices} dataState={dataState} cutoff={cutoff} /><section className="project-panel project-upcoming-panel"><div className="project-panel-heading"><div><span className="project-eyebrow">SEGUIMIENTO INMEDIATO</span><h2>Próximos hitos y compromisos</h2><p>Fechas previstas desde el corte seleccionado.</p></div><button className="project-button" onClick={() => changeView("edps")}>Ver todos</button></div>{selected.milestones.filter(m => m.forecastDate && m.forecastDate >= cutoff && (!m.actualDate || m.actualDate > cutoff)).sort((a,b)=>a.forecastDate!.localeCompare(b.forecastDate!)).slice(0,5).map(m => <button className="project-upcoming" key={m.id} onClick={() => setMilestoneEditor(m)}><span className="project-upcoming-date">{shortDate(m.forecastDate)}</span><span><strong>{m.name}</strong><small>{m.scope}</small></span><MilestoneBadge milestone={m} cutoff={cutoff} /></button>)}{!selected.milestones.some(m => m.forecastDate && m.forecastDate >= cutoff && (!m.actualDate || m.actualDate > cutoff)) && <p className="project-empty">No hay próximos hitos programados.</p>}</section></div>}
    {view === "cobros" && <>{selected?.simulation && <SimulationInvoices project={selected} onSave={persist} />}<ProjectCash key={selected?.id || "all"} projects={scope} allProjects={projects} invoices={invoices} dataState={dataState} cutoff={cutoff} year={year} onSave={persist} /></>}
    {view === "historial" && selected && <section className="project-panel"><div className="project-panel-heading"><div><h2>Historial de cambios</h2><p>Registro de planificación, fechas efectivas y asociaciones de facturas.</p></div><History size={20} /></div>{[...selected.history].reverse().map(h=><article className="project-history" key={h.id}><time>{new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeStyle:"short"}).format(new Date(h.at))}</time><div><h3>{h.reason}</h3><ul>{h.changes.map((c,i)=><li key={i}>{c}</li>)}</ul></div></article>)}</section>}
    {view !== "manual" && (selected || view !== "resumen") && <p className="project-page-footnote">Corte: {shortDate(cutoff)}. El corte filtra cumplimiento y pagos; las fechas previstas muestran la última planificación guardada.</p>}
    {deleteTarget && <Editor title="Eliminar proyecto" onClose={() => { if (!deleting) setDeleteTarget(null); }}><div className="project-form"><p className="project-full">¿Eliminar el proyecto <strong>{deleteTarget.name}</strong> ({deleteTarget.customer || "Mandante por definir"})?</p><p className="project-note project-full">Se retirarán de Gestión de proyectos sus datos, avances, EDP, proyecciones y relaciones con facturas. Las facturas y los pagos originales de CxC se conservarán.</p>{deleteError && <p role="alert" className="project-error project-full">{deleteError}</p>}<div className="project-form-actions project-full"><button type="button" autoFocus disabled={deleting} className="project-button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button type="button" disabled={deleting} className="project-button project-negative" onClick={confirmDelete}>{deleting ? "Eliminando…" : "Eliminar proyecto"}</button></div></div></Editor>}
    {profileEditor && <ProjectProfile key={`${profileEditor.id}-${profileEditor.revision}`} project={profileEditor} onSave={persist} onClose={() => setProfileEditor(null)} onOpen={() => changeView("resumen", profileEditor.id)} />}
    {milestoneEditor?.type === "Retenciones" && selected && <RetentionForm project={selected} milestone={milestoneEditor} cutoff={cutoff} onClose={()=>setMilestoneEditor(null)} onSave={(m,reason)=>persist({ ...selected, milestones: selected.milestones.some(item=>item.id===m.id) ? selected.milestones.map(item=>item.id===m.id?m:item) : [...selected.milestones,m] },reason)} />}
    {milestoneEditor?.type === "Anticipo" && selected && <AdvanceForm project={selected} milestone={milestoneEditor} cutoff={cutoff} onClose={()=>setMilestoneEditor(null)} onSave={(m,reason)=>persist({ ...selected, milestones: selected.milestones.some(item=>item.id===m.id) ? selected.milestones.map(item=>item.id===m.id?m:item) : [...selected.milestones,m] },reason)} />}
    {milestoneEditor?.edp && milestoneEditor.type !== "Anticipo" && milestoneEditor.type !== "Retenciones" && selected && <EdpForm invoices={invoices} dataState={dataState} project={selected} milestone={milestoneEditor} onClose={()=>setMilestoneEditor(null)} onSave={(m,reason)=>persist({ ...selected, milestones: selected.milestones.some(item=>item.id===m.id) ? selected.milestones.map(item=>item.id===m.id?m:item) : [...selected.milestones,m] },reason)} />}
    {milestoneEditor && milestoneEditor.type !== "Anticipo" && milestoneEditor.type !== "Retenciones" && selected && !milestoneEditor.edp && <MilestoneForm milestone={milestoneEditor} currency={selected.currency} onClose={()=>setMilestoneEditor(null)} onSave={(m,reason)=>persist({ ...selected, milestones: selected.milestones.some(item=>item.id===m.id) ? selected.milestones.map(item=>item.id===m.id?m:item) : [...selected.milestones,m] },reason)} />}
  </div>;
}
function Stat({ label, value, context, icon: Icon, attention }: { label: string; value: string; context: string; icon: typeof Building2; attention?: boolean }) { return <div className={`project-stat ${attention ? "attention" : ""}`}><div><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{context}</small></div>; }

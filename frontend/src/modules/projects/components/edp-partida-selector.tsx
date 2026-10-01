import type { Milestone, Project, StageKey } from "../types";
import { activeStages, stages } from "../data/project-workflow";

const groups = [
  { label: "Urbanización", options: [{ key: "exterior", label: "Urbanización Exterior", scope: "Urbanización Exterior" }] },
  { label: "Vivienda", options: [
    { key: "fabricacion", label: "Vivienda", scope: "Fabricación" },
    { key: "interior", label: "Vivienda - Urbanización Interior", scope: "Urbanización Interior" },
    { key: "montaje", label: "Vivienda - TGM", scope: "Montaje" }
  ] }
] as const;

export function EdpPartidaSelector({ project, milestone, locked, onChange }: { project: Project; milestone: Milestone; locked: boolean; onChange: (patch: Partial<Milestone>) => void }) {
  const edp = milestone.edp!;
  const active = activeStages(project.nature, project.includedWorks);
  const enabled = (key: string) => active.some(s => s.key === key);
  const selected = milestone.detailKeys?.length ? milestone.detailKeys : [edp.stageKey];
  const group = groups.find(g => g.options.some(o => o.key === selected[0]));
  function select(key: StageKey, detailKeys: StageKey[] = [key]) {
    const option = groups.flatMap(g => [...g.options]).find(o => o.key === key)!;
    const metric = stages.find(s => s.key === key)!.metrics[0];
    onChange({ detailKeys, scope: option.scope, type: "EDP", edp: locked ? edp : { ...edp, stageKey: key, metric, threshold: metric.endsWith("Pct") ? 100 : 1 } });
  }
  return <>
    <label className="project-field project-full">Partida o condición que habilita el EDP
      <select value={group?.label || "legacy"} onChange={e => {
        const next = groups.find(g => g.label === e.target.value)!;
        select(next.options[0].key);
      }}>
        {!group && <option value="legacy">{stages.find(s => s.key === edp.stageKey)?.label || milestone.scope} (registrado)</option>}
        {groups.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
      </select>
    </label>
    {group && <fieldset className="project-edp-options project-full">
      <legend>Detalle de {group.label.toLocaleLowerCase("es")}</legend>
      <p className="project-edp-options-hint">Puedes marcar varias opciones.</p>
      {group.options.map(o => <label key={o.key} className={`project-edp-option${selected.includes(o.key) ? " is-selected" : ""}`}>
        <input type="checkbox" checked={selected.includes(o.key)} disabled={selected.includes(o.key) && selected.length === 1} onChange={e => {
          const keys = e.target.checked ? [...selected, o.key] : selected.filter(k => k !== o.key);
          if (keys.includes(edp.stageKey)) onChange({ detailKeys: keys });
          else select(keys[0], keys);
        }} /><span>{o.label}</span>
      </label>)}
    </fieldset>}
    {!enabled(edp.stageKey) && <p className="project-note project-full">Al guardar este EDP se incorporará {edp.stageKey === "exterior" ? "Urbanización Exterior" : "Urbanización Interior"} a los alcances del proyecto{project.nature !== "llave_en_mano" ? " y el tipo de contrato se actualizará a Completa" : ""}.</p>}
  </>;
}

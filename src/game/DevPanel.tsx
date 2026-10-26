/**
 * The dev tuning panel's UI. Never shipped: `DevPanelMount` loads this module
 * behind `import.meta.env.DEV`, so a production bundle contains no reference to
 * it at all (see dev-panel-gate.test.ts).
 *
 * Styles are inline in this file rather than in index.css on purpose — a
 * developer tool that shares a stylesheet with the game is a stylesheet the game
 * can break, and this one must keep working whatever the art direction does.
 */
import { useEffect, useReducer } from "react";

import { KNOB_GROUPS, KNOBS, adminTune, formatTuned, type Knob } from "./AdminStore";

const CSS = `
.sunbird-dev-panel {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 9000;
  width: min(340px, 100vw); display: flex; flex-direction: column;
  background: rgba(14, 18, 34, 0.94); color: #eaf2ff;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  box-shadow: -18px 0 40px rgba(0, 0, 0, 0.45); backdrop-filter: blur(8px);
}
.sunbird-dev-panel * { box-sizing: border-box; }
.sunbird-dev-panel header {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.sunbird-dev-panel header h2 { margin: 0; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
.sunbird-dev-panel header .k { color: #8fb4ff; }
.sunbird-dev-panel .body { overflow-y: auto; padding: 8px 12px 24px; flex: 1; }
.sunbird-dev-panel .hint { padding: 6px 12px; color: #8593b8; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.sunbird-dev-panel .hint kbd {
  font: inherit; padding: 1px 4px; border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.22);
}
.sunbird-dev-panel h3 {
  margin: 14px 0 6px; font-size: 10px; letter-spacing: 0.18em;
  text-transform: uppercase; color: #7f8db3;
}
.sunbird-dev-panel .knob { margin: 0 0 9px; }
.sunbird-dev-panel .row { display: flex; align-items: baseline; gap: 6px; }
.sunbird-dev-panel .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sunbird-dev-panel .val { color: #ffd479; font-variant-numeric: tabular-nums; }
.sunbird-dev-panel .scope {
  font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 1px 4px; border-radius: 4px; border: 1px solid currentColor;
}
.sunbird-dev-panel .scope.now { color: #62d69a; }
.sunbird-dev-panel .scope.run { color: #ffb454; }
.sunbird-dev-panel .scope.layout { color: #ff7a7a; }
.sunbird-dev-panel input[type="range"] { width: 100%; margin: 3px 0 0; accent-color: #ffb454; }
.sunbird-dev-panel .note { color: #8593b8; font-size: 10px; margin-top: 1px; }
.sunbird-dev-panel .knob.dirty .name { color: #ffd479; }
.sunbird-dev-panel button {
  font: inherit; color: #eaf2ff; background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 6px;
  padding: 3px 8px; cursor: pointer;
}
.sunbird-dev-panel button:hover { background: rgba(255, 255, 255, 0.18); }
.sunbird-dev-panel footer {
  display: flex; gap: 6px; align-items: center; padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}
.sunbird-dev-panel .count { flex: 1; color: #8593b8; }
`;

/** One knob: label, live value, slider, and a way back to the shipped number. */
function Row({ knob }: { knob: Knob }) {
  const value = adminTune.get(knob.key);
  const dirty = value !== knob.fallback;
  return (
    <div className={`knob${dirty ? " dirty" : ""}`}>
      <div className="row">
        <span className="name" title={knob.label}>{knob.label}</span>
        <span className="val">
          {formatTuned(knob, value)}
          {knob.unit ? ` ${knob.unit}` : ""}
        </span>
        <span className={`scope ${knob.scope}`}>{knob.scope}</span>
      </div>
      <input
        type="range"
        aria-label={knob.label}
        min={knob.min}
        max={knob.max}
        step={knob.step}
        value={value}
        onChange={(e) => adminTune.set(knob.key, Number(e.target.value))}
      />
      {knob.note ? <div className="note">{knob.note}</div> : null}
      <button type="button" onClick={() => adminTune.reset(knob.key)} disabled={!dirty}>
        reset to {formatTuned(knob, knob.fallback)}
      </button>
    </div>
  );
}

export default function DevPanel({ onClose }: { onClose: () => void }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    // Pick up the last session's overrides, then keep saving as they change —
    // a tuning pass that survives a reload is the difference between a knob
    // and a note in a scratch file.
    adminTune.hydrate();
    return adminTune.subscribe(() => {
      bump();
      adminTune.persist();
    });
  }, []);

  const dirty = adminTune.dirty();

  return (
    <aside className="sunbird-dev-panel" role="dialog" aria-label="Developer tuning panel">
      <style>{CSS}</style>
      <header>
        <h2>Tuning</h2>
        <span className="k">dev only</span>
        <button type="button" onClick={onClose} aria-label="Close tuning panel">
          close
        </button>
      </header>
      {/* Focus has to sit on a control for the sliders to take arrow keys, and a
          focused control means the game's own keys are ignored while you are in
          here — so say so rather than let it read as a broken dive key. */}
      <div className="hint">
        <kbd>`</kbd> toggles this · close it and click the sky to fly
      </div>
      <div className="body">
        {KNOB_GROUPS.map((group) => {
          const knobs = KNOBS.filter((k) => k.group === group);
          if (knobs.length === 0) return null;
          return (
            <section key={group}>
              <h3>{group}</h3>
              {knobs.map((knob) => (
                <Row key={knob.key} knob={knob} />
              ))}
            </section>
          );
        })}
      </div>
      <footer>
        <span className="count">{dirty.length} override{dirty.length === 1 ? "" : "s"}</span>
        <button type="button" onClick={() => adminTune.resetAll()} disabled={dirty.length === 0}>
          reset all
        </button>
      </footer>
    </aside>
  );
}

// tweaks-app.jsx — Bearzenker site tweaks
// Two controls:
//   • Hero block height (shrinks vertical space between lede and meta rows;
//     the bear image keeps its aspect ratio because the right column is sized
//     by the same shared height and the image uses object-fit: cover at a
//     1:1 source — same crop center, just less of it.)
//   • Training pillar order — reorder the five training topics. The pillars
//     themselves live as plain HTML inside #pillars-list (direct-editable);
//     this control only shuffles them and renumbers .pillar-num.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroSize": 75,
  "pillarOrder": ["limits", "deterministic", "theory", "human", "coding"]
}/*EDITMODE-END*/;

const PILLAR_LABELS = {
  limits: "The limits of AI",
  deterministic: "Deterministic prompting",
  theory: "The theory of agentic AI",
  human: "Human-in-the-loop workflows",
  coding: "Coding agents as PMs",
};
const PILLAR_IDS = Object.keys(PILLAR_LABELS);

// ── Apply tweaks to the live page ───────────────────────────────────────────

function applyHeroSize(pct) {
  document.documentElement.style.setProperty("--hero-height", pct + "vh");
}

function applyPillarOrder(order) {
  const list = document.getElementById("pillars-list");
  if (!list) return;
  const byId = new Map();
  list.querySelectorAll(".pillar").forEach((el) => {
    byId.set(el.dataset.pillarId, el);
  });
  // Append in tweak-specified order; any unknown/missing ids fall through.
  const seen = new Set();
  order.forEach((id) => {
    const el = byId.get(id);
    if (el) { list.appendChild(el); seen.add(id); }
  });
  // Append any pillars not in the order (defensive — never lose a pillar).
  byId.forEach((el, id) => { if (!seen.has(id)) list.appendChild(el); });
  // Renumber.
  list.querySelectorAll(".pillar").forEach((el, i) => {
    const num = el.querySelector(".pillar-num");
    if (num) num.textContent = String(i + 1).padStart(2, "0");
  });
}

// ── Reorder control (compact up/down list) ──────────────────────────────────

function PillarReorder({ order, onChange }) {
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>Pillar order</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {order.map((id, i) => (
          <div key={id} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 6px 4px 8px",
            background: "rgba(255,255,255,.55)",
            border: ".5px solid rgba(0,0,0,.08)",
            borderRadius: 6,
            fontSize: 11,
          }}>
            <span style={{
              fontVariantNumeric: "tabular-nums",
              color: "rgba(41,38,27,.5)",
              minWidth: 14,
            }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden",
                           textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {PILLAR_LABELS[id] || id}
            </span>
            <button type="button" aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    style={reorderBtn(i === 0)}>↑</button>
            <button type="button" aria-label="Move down"
                    disabled={i === order.length - 1}
                    onClick={() => move(i, +1)}
                    style={reorderBtn(i === order.length - 1)}>↓</button>
          </div>
        ))}
        <button type="button"
                onClick={() => onChange(PILLAR_IDS.slice())}
                style={{
                  marginTop: 2,
                  appearance: "none", border: 0,
                  background: "rgba(0,0,0,.06)",
                  borderRadius: 6, padding: "4px 8px",
                  font: "inherit", fontSize: 10.5, fontWeight: 500,
                  color: "rgba(41,38,27,.7)", cursor: "default",
                }}>Reset order</button>
      </div>
    </div>
  );
}
function reorderBtn(disabled) {
  return {
    appearance: "none", border: 0,
    width: 20, height: 20, borderRadius: 4,
    background: disabled ? "transparent" : "rgba(0,0,0,.06)",
    color: disabled ? "rgba(41,38,27,.25)" : "rgba(41,38,27,.75)",
    font: "inherit", fontSize: 11, lineHeight: 1,
    cursor: disabled ? "default" : "default",
  };
}

// ── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { applyHeroSize(t.heroSize); }, [t.heroSize]);
  React.useEffect(() => { applyPillarOrder(t.pillarOrder); }, [t.pillarOrder]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Hero">
        <TweakSlider label="Block height" value={t.heroSize}
                     min={45} max={100} step={1} unit="vh"
                     onChange={(v) => setTweak("heroSize", v)} />
      </TweakSection>
      <TweakSection label="Training">
        <PillarReorder order={t.pillarOrder}
                       onChange={(v) => setTweak("pillarOrder", v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("tweaks-root")).render(<App />);

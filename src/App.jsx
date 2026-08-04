import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  BASE_PLATFORM, INCLUDED_SEATS, INCLUDED_FEATURES, QUANTITIES, LEADS, MODULES, CALL_METER, CONTACT,
  DEFAULT_STATE, computeTotals, formatINR,
} from "./pricing.config.js";
import { saveLead, API_BASE } from "./config/api.js";

const REDUCE_MOTION =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/* ---------- animated "live meter" number ---------- */
function useAnimatedNumber(value, duration = 500) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    if (REDUCE_MOTION) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    cancelAnimationFrame(rafRef.current);
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(t < 1 ? Math.round(from + (value - from) * ease(t)) : value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}

/* fires a short-lived +/- delta and a "bump" tick whenever value changes */
function useValueBump(value) {
  const [delta, setDelta] = useState(0);
  const [bump, setBump] = useState(0);
  const prevRef = useRef(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const diff = value - prevRef.current;
    if (diff !== 0) {
      prevRef.current = value;
      setDelta(diff);
      setBump((b) => b + 1);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setDelta(0), 1500);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [value]);

  return { delta, bump };
}

/* ---------- reusable stepper ---------- */
function Stepper({ value, min, max, step = 1, onChange }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper" role="group" aria-label="quantity">
      <button type="button" aria-label="decrease" disabled={value <= min} onClick={() => set(value - step)}>−</button>
      <input
        type="number" inputMode="numeric" value={value} min={min} max={max}
        onChange={(e) => { const n = parseInt(e.target.value, 10); set(Number.isNaN(n) ? min : n); }}
      />
      <button type="button" aria-label="increase" disabled={value >= max} onClick={() => set(value + step)}>+</button>
    </div>
  );
}

/* ---------- book-a-demo modal ---------- */
function DemoModal({ totals, state, onClose }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", company_website: "" });
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [err, setErr] = useState("");
  const savedRef = useRef(false); // save at most once per modal open

  const summaryText = useMemo(() => {
    const parts = [`Hi ${CONTACT.brand}, I'd like a demo of Skyup CRM with this setup:`];
    for (const l of totals.lines) {
      if (l.kind === "qty") parts.push(`• ${l.label}: ${l.qty}`);
      else if (l.kind === "meter") parts.push(`• ${l.label}`);
      else parts.push(`• ${l.label}`);
    }
    parts.push(`Estimated: ${formatINR(totals.displayTotal)}/month (incl. GST)${totals.minApplied ? " — minimum monthly plan" : ""}.`);
    if (form.name) parts.push(`\nName: ${form.name}`);
    if (form.phone) parts.push(`Phone: ${form.phone}`);
    if (form.email) parts.push(`Email: ${form.email}`);
    return parts.join("\n");
  }, [totals, form]);

  const waLink = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(summaryText)}`;
  const mailLink = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Skyup CRM demo request")}&body=${encodeURIComponent(summaryText)}`;

  const buildPayload = () => ({
    name: form.name,
    phone: form.phone,
    email: form.email,
    company_website: form.company_website, // honeypot — real users leave this blank
    pricing: {
      currency: "INR",
      lines: totals.lines.map((l) => ({ id: l.id, label: l.label, kind: l.kind, qty: l.qty, amount: l.amount })),
      subtotal: totals.subtotal,
      gst: totals.gst,
      total: totals.total,
      displayTotal: totals.displayTotal,
      minApplied: totals.minApplied,
    },
    config: {
      users: state?.users, admins: state?.admins, websites: state?.websites,
      metaCampaigns: state?.metaCampaigns, googleCampaigns: state?.googleCampaigns,
      leads: state?.leads, callBlocks: state?.callBlocks, modules: state?.modules || {},
    },
    referrer: typeof document !== "undefined" ? document.referrer : "",
    source: "pricing-site",
  });

  // Persist the lead. `block` = user pressed the primary button (validate + show errors);
  // otherwise it's a background save triggered by the WhatsApp/email links.
  const persist = async ({ block = false } = {}) => {
    if (savedRef.current) return true;

    const hasContact = form.phone.trim() || form.email.trim();
    if (block) {
      if (!form.name.trim()) { setErr("Please add your name."); return false; }
      if (!hasContact) { setErr("Add a phone number or email."); return false; }
    } else if (!form.name.trim() || !hasContact) {
      return false; // don't fire junk background saves
    }

    if (!API_BASE) { if (block) setErr("Lead saving isn't configured yet (set VITE_API_URL)."); return false; }

    setErr(""); setStatus("saving");
    try {
      await saveLead(buildPayload());
      savedRef.current = true;
      setStatus("saved");
      return true;
    } catch (e) {
      setStatus("error");
      if (block) setErr("Couldn't save right now — please reach us on WhatsApp/email below.");
      return false;
    }
  };

  const saved = status === "saved";

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h3>Book a demo</h3>
        <p className="m-sub">Leave your details and we'll walk you through this exact setup. No payment now.</p>
        <div className="quote">
          Your build: <b>{formatINR(totals.displayTotal)}/month</b> <span style={{ color: "var(--muted)" }}>(incl. GST)</span>
          {totals.minApplied && <div className="quote-note">Minimum monthly plan</div>}
        </div>
        <div className="field"><label htmlFor="d-name">Name</label><input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
        <div className="field"><label htmlFor="d-phone">Phone / WhatsApp</label><input id="d-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" /></div>
        <div className="field"><label htmlFor="d-email">Email</label><input id="d-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" /></div>

        {/* honeypot: hidden from users, catches bots */}
        <input
          type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />

        <button className="btn btn-primary" onClick={() => persist({ block: true })} disabled={status === "saving" || saved}>
          {status === "saving" ? "Sending…" : saved ? "Request sent ✓" : "Submit request"}
        </button>
        <a className="btn wa" href={waLink} target="_blank" rel="noreferrer" onClick={() => { persist(); }}>Send on WhatsApp</a>
        <a className="btn btn-ghost" href={mailLink} onClick={() => { persist(); }}>Send by email</a>

        {saved && <p className="s-note" style={{ color: "var(--good)" }}>Thanks! We've got your request and will reach out shortly.</p>}
        {err && <p className="s-note" style={{ color: "var(--amber)" }}>{err}</p>}
      </div>
    </div>
  );
}

/* ---------- a quantity row ---------- */
function QtyRow({ q, count, onChange }) {
  const billable = Math.max(0, count - q.included);
  const amt = billable * q.pricePer;
  return (
    <div className="qty">
      <div>
        <div className="q-label">{q.label}</div>
        <div className="q-help">{q.help}</div>
      </div>
      <Stepper value={count} min={q.min} max={q.max} onChange={onChange} />
      <div className="q-price">
        {q.included > 0 && `${q.included} included · `}
        {formatINR(q.pricePer)}/{q.unit}
        {amt > 0 ? ` · +${formatINR(amt)}/mo` : ""}
      </div>
    </div>
  );
}

/* ---------- a numbered rail node wrapping a panel ---------- */
function FlowRow({ n, done, children }) {
  return (
    <div className={"flow-row" + (done ? " section-done" : "")}>
      <div className="flow-node">
        <span className={"flow-dot" + (done ? " done" : "")}>{done ? "✓" : n}</span>
        <span className="flow-line" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ ...DEFAULT_STATE, modules: { ...DEFAULT_STATE.modules } });
  const [showDemo, setShowDemo] = useState(false);
  const totals = useMemo(() => computeTotals(state), [state]);

  const setQty = useCallback((id, v) => setState((s) => ({ ...s, [id]: v })), []);
  const setLeads = useCallback((v) => setState((s) => ({ ...s, leads: v })), []);
  const toggleModule = useCallback((id) => setState((s) => ({ ...s, modules: { ...s.modules, [id]: !s.modules[id] } })), []);

  const team = QUANTITIES.filter((q) => q.section === "team");
  const channels = QUANTITIES.filter((q) => q.section === "channels");
  const callMins = (state.callBlocks || 0) * CALL_METER.blockMinutes;
  const callAmt = (state.callBlocks || 0) * CALL_METER.blockPrice;

  const teamDone = state.users > 3 || state.admins > 1;
  const channelsDone = state.websites > 1 || state.metaCampaigns > 1 || state.googleCampaigns > 1;
  const leadsDone = Number(state.leads) !== LEADS.default;
  const addonsDone = Object.values(state.modules).some(Boolean) || (state.callBlocks || 0) > 0;

  const displayTotal = useAnimatedNumber(totals.displayTotal);
  const { delta, bump } = useValueBump(totals.displayTotal);

  const scrollToSummary = () => {
    document.getElementById("summary-card")?.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
  };

  return (
    <>
      <header className="site-head">
  <div className="wrap">
    <div className="brand">
      <span className="brand-logo">
        <img src="/skyup-logo.png" alt="Skyup Digital Solutions" width="198" height="67" />
      </span>
      <span className="brand-badge">CRM</span>
    </div>
  </div>
</header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">◆ Build your own plan</span>
            <h1>Only pay for the CRM you <span className="hl">actually use.</span></h1>
            <p className="lede">No fixed Basic / Pro / Enterprise boxes. Pick your seats, channels, lead capacity and automations — the price updates live, right in front of you. When it looks right, book a demo.</p>
            <div className="trust-row">
              <span>No card required</span>
              <span>Cancel anytime</span>
              <span>We set it up for you</span>
            </div>
          </div>
          <button type="button" className="hero-live" onClick={scrollToSummary} aria-label="Jump to your live price">
            <span className="hl-top"><span className="hl-dot" />Live · your build so far</span>
            <div className="hl-price mono">{formatINR(displayTotal)}<span style={{ fontSize: 13, fontWeight: 500 }}>/mo</span></div>
            <div className="hl-note">Updates as you configure ↓</div>
          </button>
        </div>
      </section>

      <main className="wrap">
        <div className="builder">
          <div className="col-config flow">
            {/* 01 core */}
            <FlowRow n="01" done>
              <section className="panel">
                <div className="section-head"><h2>Start with the core</h2><span className="sub">Included in every build — this is your foundation.</span></div>
                <div className="base-row">
                  <span className="tick">✓</span>
                  <div><div className="b-label">{BASE_PLATFORM.label}</div><div className="b-note">{BASE_PLATFORM.note}</div></div>
                  <div className="b-price mono">{formatINR(BASE_PLATFORM.price)}<span style={{ color: "var(--muted)", fontWeight: 400 }}>/mo</span></div>
                </div>
                <div className="included">
                  {INCLUDED_SEATS.map((s) => (
                    <span className="chip" key={s.label}><b>{s.count}</b> {s.label} <span className="free">free</span></span>
                  ))}
                  {INCLUDED_FEATURES.map((f) => (
                    <span className="chip" key={f.label}><b>{f.count}</b> {f.label} <span className="free">free</span></span>
                  ))}
                </div>
              </section>
            </FlowRow>

            {/* 02 team */}
            <FlowRow n="02" done={teamDone}>
              <section className="panel">
                <div className="section-head"><h2>Your team</h2><span className="sub">Add extra users and admins beyond what's included.</span></div>
                <div className="qty-list">
                  {team.map((q) => <QtyRow key={q.id} q={q} count={state[q.id]} onChange={(v) => setQty(q.id, v)} />)}
                </div>
              </section>
            </FlowRow>

            {/* 03 channels */}
            <FlowRow n="03" done={channelsDone}>
              <section className="panel">
                <div className="section-head"><h2>Channels & reports</h2><span className="sub">Each one bundles its own analytics report.</span></div>
                <div className="qty-list">
                  {channels.map((q) => <QtyRow key={q.id} q={q} count={state[q.id]} onChange={(v) => setQty(q.id, v)} />)}
                </div>
              </section>
            </FlowRow>

            {/* 04 leads */}
            <FlowRow n="04" done={leadsDone}>
              <section className="panel">
                <div className="section-head"><h2>Lead storage</h2><span className="sub">How many leads should your CRM hold?</span></div>
                <div className={"meter" + (leadsDone ? " on" : "")}>
                  <div>
                    <div className="mt-label">{LEADS.label}</div>
                    <div className="mt-desc">{LEADS.help}</div>
                  </div>
                  <Stepper value={state.leads} min={LEADS.min} max={LEADS.max} step={LEADS.blockSize} onChange={setLeads} />
                  <div className="mt-read">
                    {LEADS.includedFree.toLocaleString("en-IN")} free · {formatINR(LEADS.blockPrice)} per {LEADS.blockSize.toLocaleString("en-IN")} after · {state.leads.toLocaleString("en-IN")} leads · {formatINR(Math.max(0, (state.leads - LEADS.includedFree) / LEADS.blockSize) * LEADS.blockPrice)}/mo
                  </div>
                </div>
              </section>
            </FlowRow>

            {/* 05 automations + call meter */}
            <FlowRow n="05" done={addonsDone}>
              <section className="panel">
                <div className="section-head"><h2>Automations & add-ons</h2><span className="sub">Toggle any of these on. Everything else stays off — and free.</span></div>
                <div className="modules">
                  {MODULES.map((m) => {
                    const on = !!state.modules[m.id];
                    return (
                      <div key={m.id} className={"mod" + (on ? " on" : "")} role="checkbox" aria-checked={on} tabIndex={0}
                        onClick={() => toggleModule(m.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleModule(m.id); } }}>
                        <span className="box">{on ? "✓" : ""}</span>
                        <div><div className="m-label">{m.label}</div><div className="m-desc">{m.desc}</div></div>
                        <div className="m-price">+{formatINR(m.price)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* metered call add-on */}
                <div className={"meter" + ((state.callBlocks || 0) > 0 ? " on" : "")}>
                  <div>
                    <div className="mt-label">{CALL_METER.label}</div>
                    <div className="mt-desc">{CALL_METER.desc}</div>
                  </div>
                  <Stepper value={state.callBlocks} min={CALL_METER.min} max={CALL_METER.maxBlocks} onChange={(v) => setQty("callBlocks", v)} />
                  <div className="mt-read">
                    {CALL_METER.blockMinutes} min = {formatINR(CALL_METER.blockPrice)}
                    {callMins > 0 ? ` · ${callMins} min · +${formatINR(callAmt)}/mo` : " · off"}
                  </div>
                </div>
                <div className="meter-note">{CALL_METER.note}</div>
              </section>
            </FlowRow>
          </div>

          {/* live summary */}
          <aside className="col-summary">
            <div className="summary" id="summary-card">
              <div className="s-top">
                <div className="s-eye">Your monthly price</div>
                <div className="s-price mono" key={bump}>
                  {formatINR(displayTotal)}<span className="per">/ month</span>
                  {delta !== 0 && (
                    <span className="delta-chip">{delta > 0 ? "+" : "−"}{formatINR(Math.abs(delta))}</span>
                  )}
                </div>
                <div className="s-sub">incl. 18% GST · cancel anytime</div>
              </div>
              <div className="receipt">
                {totals.lines.map((l) => (
                  <div className="r-line" key={l.id}>
                    <span className="r-lab">{l.label}{l.kind === "qty" ? ` ×${l.qty}` : ""}</span>
                    <span className="r-amt">{formatINR(l.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="totals">
                <div className="t-line"><span>Subtotal</span><span className="mono">{formatINR(totals.subtotal)}</span></div>
                <div className="t-line"><span>GST (18%)</span><span className="mono">{formatINR(totals.gst)}</span></div>
                <div className="t-line grand"><span>Total / month</span><span className="mono">{formatINR(totals.displayTotal)}</span></div>
                {totals.minApplied && <div className="floor-note">Minimum monthly plan</div>}
              </div>
              <div className="s-actions">
                <button className="btn btn-primary" onClick={() => setShowDemo(true)}>Book a demo →</button>
                <p className="s-note">No card required. We'll set up this exact configuration for you.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="site-foot">
        <div className="wrap">Built by {CONTACT.brand} · <a href={`https://${CONTACT.site}`} target="_blank" rel="noreferrer">{CONTACT.site}</a></div>
      </footer>

      <div className="mobile-bar">
        <div className="mb-price">
          <b className="mono">{formatINR(displayTotal)}</b>
          <span>/ month · incl. GST{totals.minApplied ? " · min plan" : ""}</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowDemo(true)}>Book a demo</button>
      </div>

      <div className="sticky-bar-desktop">
        <div className="wrap sbd-grid">
          <div className="sbd-spacer" aria-hidden="true" />
          <div className="sbd-card">
            <div className="sbd-price mono">
              {formatINR(displayTotal)}<span className="sbd-per">/mo{totals.minApplied ? " · min plan" : ""}</span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowDemo(true)}>Book a demo →</button>
          </div>
        </div>
      </div>

      {showDemo && <DemoModal totals={totals} state={state} onClose={() => setShowDemo(false)} />}
    </>
  );
}
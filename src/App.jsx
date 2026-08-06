import { useState, useMemo, useCallback, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import {
  BASE_PLATFORM, INCLUDED_SEATS, INCLUDED_FEATURES, QUANTITIES, LEADS, MODULES, CALL_METER, CONTACT,
  DEFAULT_STATE, BILLING_PERIODS, computeTotals, computeBilling, formatINR,
} from "./pricing.config.js";
import { saveLead, API_BASE } from "./config/api.js";
import logoUrl from "./assets/rbd-logo.webp";
import {
  Check, X, Plus, Minus, Info, ArrowRight, Sparkles, LayoutGrid, Users, Megaphone,
  Database, Zap, BadgePercent, TrendingUp, TrendingDown, MessageCircle, Send, Filter, Bell, Link2,
  Globe, ShieldCheck,
} from "lucide-react";
import { SiMeta, SiGoogleads } from "react-icons/si";

const REDUCE_MOTION =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

// true on mice/trackpads (laptop, desktop) — false on touchscreens, where
// there's no real "hover" and tapping has to be the only way to open a tip
const SUPPORTS_HOVER =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
    : false;

const DEMO_SUBMITTED_KEY = "skyup_demo_submitted";

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

/* fires a short-lived +/- delta and a "bump" tick when `trigger` changes
   (e.g. a period-independent monthly total) — the +/- magnitude shown is the
   change in `display` (e.g. the rounded, period-scaled headline price) —
   so switching billing periods never itself pops a delta chip, but a real
   builder change still reports the exact jump in whatever period is showing */
function useTrackedDelta(trigger, display) {
  const [delta, setDelta] = useState(0);
  const [bump, setBump] = useState(0);
  const prevTriggerRef = useRef(trigger);
  const prevDisplayRef = useRef(display);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (trigger !== prevTriggerRef.current) {
      const diff = display - prevDisplayRef.current;
      prevTriggerRef.current = trigger;
      if (diff !== 0) {
        setDelta(diff);
        setBump((b) => b + 1);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setDelta(0), 1500);
      }
    }
    prevDisplayRef.current = display;
    return () => clearTimeout(timeoutRef.current);
  }, [trigger, display]);

  return { delta, bump };
}

/* fires once an element scrolls into view; used to trigger the reveal-on-scroll animation */
function useReveal() {
  const ref = useRef(null);
  const [inView, setInView] = useState(REDUCE_MOTION);

  useEffect(() => {
    if (REDUCE_MOTION || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.unobserve(el); } },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, inView];
}

/* ---------- reusable stepper ---------- */
function Stepper({ value, min, max, step = 1, onChange }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper" role="group" aria-label="quantity">
      <button type="button" aria-label="decrease" disabled={value <= min} onClick={() => set(value - step)}><Minus size={16} /></button>
      <input
        type="number" inputMode="numeric" value={value} min={min} max={max}
        onChange={(e) => { const n = parseInt(e.target.value, 10); set(Number.isNaN(n) ? min : n); }}
      />
      <button type="button" aria-label="increase" disabled={value >= max} onClick={() => set(value + step)}><Plus size={16} /></button>
    </div>
  );
}

/* only one InfoTip may be open at a time — clicking one closes any other
   that's already open, so their popups can never stack/overlap each other */
let activeInfoTipId = null;
const infoTipListeners = new Set();
function setActiveInfoTip(id) {
  activeInfoTipId = id;
  infoTipListeners.forEach((fn) => fn(id));
}

/* ---------- hover (mouse) / tap (touch) reveal for plain-English explanations ---------- */
function InfoTip({ text }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const listener = (activeId) => setOpen(activeId === id);
    infoTipListeners.add(listener);
    return () => infoTipListeners.delete(listener);
  }, [id]);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  // on mouse/trackpad devices, hovering opens it immediately; the singleton
  // above still guarantees only one is ever open, so hovering across several
  // tightly-packed chips just hands "active" from one to the next — never two at once
  const openOnHover = () => { clearTimeout(closeTimerRef.current); setShift(0); setActiveInfoTip(id); };
  const closeOnHoverOut = () => {
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => { if (activeInfoTipId === id) setActiveInfoTip(null); }, 150);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setActiveInfoTip(null); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // the popup is portaled to <body> (see below) so it can never end up behind a
  // later section — but that means it's no longer positioned relative to its
  // trigger by CSS alone; measure the trigger's on-screen position ourselves
  useEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    // a fixed-position popup would visually detach from its trigger on scroll — closing
    // is simpler and more predictable than continuously re-measuring while open.
    // Delay attaching by a beat so residual momentum from the scroll that just brought
    // the trigger into view (e.g. scrollIntoView) doesn't immediately close it again.
    const onScroll = () => setActiveInfoTip(null);
    const attachTimer = setTimeout(() => {
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    }, 250);
    return () => {
      clearTimeout(attachTimer);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  // keep the popover inside the viewport instead of letting it run off-screen
  // (and get visually clipped) when the trigger sits near an edge
  useEffect(() => {
    if (!open || !pos || !popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    const margin = 10;
    let delta = 0;
    if (rect.left < margin) delta = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) delta = (window.innerWidth - margin) - rect.right;
    setShift(delta);
  }, [open, pos]);

  if (!text) return null;
  return (
    <span
      className="infotip" ref={ref}
      onMouseEnter={SUPPORTS_HOVER ? openOnHover : undefined}
      onMouseLeave={SUPPORTS_HOVER ? closeOnHoverOut : undefined}
    >
      <button
        ref={btnRef}
        type="button" className="info-btn" aria-label="What does this mean?" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setShift(0); setActiveInfoTip(open ? null : id); }}
      ><Info size={10} strokeWidth={2.5} /></button>
      {open && pos && createPortal(
        <span
          className="info-pop" ref={popRef} role="note"
          style={{ position: "fixed", top: pos.top, left: pos.left, "--pop-shift": `${shift}px` }}
          onClick={(e) => e.stopPropagation()}
        >{text}</span>,
        document.body
      )}
    </span>
  );
}

/* ---------- book-a-demo modal ---------- */
function DemoModal({ totals, state, onClose, onSubmitted }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
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

  const buildPayload = () => ({
    name: form.name,
    phone: form.phone,
    email: form.email,
    pricing: {
      currency: "INR",
      lines: totals.lines.map((l) => ({ id: l.id, label: l.label, kind: l.kind, qty: l.qty, amount: l.amount })),
      subtotal: totals.subtotal,
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
      onSubmitted?.();
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
        <button className="modal-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
        <h3>Book a free demo</h3>
        <p className="m-sub">Leave your details and we'll walk you through this exact setup. No payment now.</p>
        <div className="quote">
          Your build: <b>{formatINR(totals.displayTotal)}/month</b> <span style={{ color: "var(--muted)" }}>(incl. GST)</span>
          {totals.minApplied && <div className="quote-note">Minimum monthly plan</div>}
        </div>
        <div className="field"><label htmlFor="d-name">Name</label><input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
        <div className="field"><label htmlFor="d-phone">Phone / WhatsApp</label><input id="d-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" /></div>
        <div className="field"><label htmlFor="d-email">Email</label><input id="d-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" /></div>

        <button className="btn btn-primary" onClick={() => persist({ block: true })} disabled={status === "saving" || saved}>
          {status === "saving" ? "Sending…" : saved ? <><Check size={16} /> Request sent</> : <><Send size={16} /> Submit request</>}
        </button>
        <a className="btn wa" href={waLink} target="_blank" rel="noreferrer" onClick={() => { persist(); }}><MessageCircle size={18} /> Send on WhatsApp</a>

        {saved && <p className="s-note" style={{ color: "var(--good)" }}>Thanks! We've got your request and will reach out shortly.</p>}
        {err && <p className="s-note" style={{ color: "var(--amber)" }}>{err}</p>}
      </div>
    </div>
  );
}

/* ---------- brand/context icon shown next to a quantity row's label ---------- */
const QTY_ICONS = {
  users: { Icon: Users, color: "var(--accent)" },
  admins: { Icon: ShieldCheck, color: "var(--accent)" },
  websites: { Icon: Globe, color: "var(--accent)" },
  metaCampaigns: { Icon: SiMeta, color: "#0866FF" },
  googleCampaigns: { Icon: SiGoogleads, color: "#4285F4" },
};
function QtyIcon({ id }) {
  const cfg = QTY_ICONS[id];
  if (!cfg) return null;
  const { Icon, color } = cfg;
  return <Icon size={16} className="q-icon" style={{ color }} aria-hidden="true" />;
}

/* ---------- a quantity row ---------- */
function QtyRow({ q, count, onChange }) {
  const billable = Math.max(0, count - q.included);
  const amt = billable * q.pricePer;
  return (
    <div className="qty">
      <div>
        <div className="q-label"><QtyIcon id={q.id} />{q.label}<InfoTip text={q.info} /></div>
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

/* ---------- scroll-revealed row wrapping a panel ---------- */
function FlowRow({ variant = "up", children }) {
  const [ref, inView] = useReveal();
  return (
    <div ref={ref} className={`flow-row reveal reveal-${variant}` + (inView ? " in-view" : "")}>
      {children}
    </div>
  );
}

/* ---------- generic scroll-triggered reveal wrapper for marketing sections ---------- */
function Reveal({ variant = "up", className = "", delay = 0, children }) {
  const [ref, inView] = useReveal();
  const style = delay ? { transitionDelay: `${delay}ms` } : undefined;
  return (
    <div ref={ref} style={style} className={["reveal", `reveal-${variant}`, className, inView ? "in-view" : ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/* ---------- small line-icon used on marketing feature cards ---------- */
function FeatIcon({ name }) {
  const Icon = { pipeline: Filter, bell: Bell, link: Link2, team: Users, spark: Sparkles }[name];
  return (
    <span className="feat-icon">
      <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

/* ---------- marketing copy (static content, not pricing data) ---------- */
const PAIN_POINTS = [
  "Missed or delayed follow-ups",
  "Leads being forgotten after the first call",
  "No clarity about sales-team activity",
  "Difficulty tracking which ads generate quality leads",
  "Incomplete customer and sales information",
];

const AI_SUGGESTIONS = [
  "Quick lead and call summaries",
  "Important customer requirements",
  "Pending follow-up points",
  "Suggested next actions",
  "Business-specific insights based on your configured sales process",
];

const FEATURES = [
  { icon: "pipeline", title: "Lead and Pipeline Management", desc: "Capture, assign and track every enquiry from the first contact until conversion." },
  { icon: "bell", title: "Smart Follow-Up Management", desc: "Schedule calls, meetings and reminders so your team knows exactly which lead to contact next." },
  { icon: "link", title: "Meta, Google and Website Integration", desc: "Bring enquiries from your advertising campaigns and websites directly into the CRM." },
  { icon: "team", title: "Sales-Team Tracking", desc: "Monitor assigned leads, pending activities, attendance, daily reports and team performance." },
  { icon: "spark", title: "AI Summaries and Suggestions", desc: "AI can review available lead remarks, calls and interactions to provide:", bullets: AI_SUGGESTIONS, highlight: true },
];

export default function App() {
  const [state, setState] = useState({ ...DEFAULT_STATE, modules: { ...DEFAULT_STATE.modules } });
  const [showDemo, setShowDemo] = useState(false);
  const [period, setPeriod] = useState(BILLING_PERIODS[0]); // default: monthly
  const totals = useMemo(() => computeTotals(state, period.basePrice), [state, period]);
  // tracked at the default base price so switching periods never itself looks
  // like a builder-driven price change to useValueBump below
  const deltaTotals = useMemo(() => computeTotals(state), [state]);

  const demoSubmittedRef = useRef(
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem(DEMO_SUBMITTED_KEY) === "1"
      : false
  );
  const handleDemoSubmitted = useCallback(() => {
    demoSubmittedRef.current = true;
    try { window.localStorage.setItem(DEMO_SUBMITTED_KEY, "1"); } catch {}
  }, []);

  // auto-open the demo modal once at each 50/100% scroll milestone —
  // stops firing for good once a lead has actually been submitted
  useEffect(() => {
    if (demoSubmittedRef.current) return;
    const thresholds = [50, 100];
    const fired = new Set();
    const onScroll = () => {
      if (demoSubmittedRef.current) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      const pct = (window.scrollY / scrollable) * 100;
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          setShowDemo(true);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const setQty = useCallback((id, v) => setState((s) => ({ ...s, [id]: v })), []);
  const setLeads = useCallback((v) => setState((s) => ({ ...s, leads: v })), []);
  const toggleModule = useCallback((id) => setState((s) => ({ ...s, modules: { ...s.modules, [id]: !s.modules[id] } })), []);

  const team = QUANTITIES.filter((q) => q.section === "team");
  const channels = QUANTITIES.filter((q) => q.section === "channels");
  const callMins = (state.callBlocks || 0) * CALL_METER.blockMinutes;
  const callAmt = (state.callBlocks || 0) * CALL_METER.blockPrice;

  const leadsDone = Number(state.leads) !== LEADS.default;

  const billing = useMemo(() => computeBilling(totals.displayTotal, period), [totals.displayTotal, period]);
  const displayPrice = useAnimatedNumber(billing.discounted);
  const { delta: deltaForPeriod, bump } = useTrackedDelta(deltaTotals.displayTotal, billing.discounted);

  const [summaryRef, summaryInView] = useReveal();
  const [footRef, footInView] = useReveal();

  const builderRef = useRef(null);
  const scrollToBuilder = useCallback(() => {
    builderRef.current?.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
  }, []);

  // phone price bar stays hidden over the hero/marketing sections and only
  // appears once the builder ("Start with the core" onward) reaches the viewport
  const [showMobileBar, setShowMobileBar] = useState(false);
  useEffect(() => {
    const el = builderRef.current;
    if (!el) return;
    const onScroll = () => setShowMobileBar(window.scrollY >= el.offsetTop - 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <header className="site-head">
  <div className="wrap">
    <div className="brand">
      <span className="brand-logo">
        <img src={logoUrl} alt="Skyup Digital Solutions" width="160" height="46" />
      </span>
      <span className="brand-badge">CRM</span>
    </div>
  </div>
</header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow"><Sparkles size={12} /> AI-Powered CRM</span>
            <h1>AI-Powered CRM That Helps You <span className="hl">Follow Up Smarter</span> and Close More Sales</h1>
            <p className="lede">Capture every enquiry, manage your sales team and receive AI-generated summaries and follow-up suggestions — all from one CRM.</p>
            <p className="lede">Connect leads from Meta Ads, Google Ads, websites and other sources without managing multiple applications.</p>
            <div className="hero-ctas">
              <button type="button" className="btn btn-primary btn-cta btn-standout" onClick={scrollToBuilder}><span>Customise My CRM & See the Price</span><span className="btn-arrow"><ArrowRight size={16} /></span></button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowDemo(true)}>Book a Free Demo</button>
            </div>
            <p className="hero-note">Plans are recommended based on your users, lead volume, integrations and business requirements.</p>
          </div>
        </div>
      </section>

      <section className="pain">
        <div className="wrap">
          <Reveal variant="up" className="pain-card">
            <h2 className="sec-h2">Are Valuable Leads Getting Missed?</h2>
            <p className="sec-sub">Managing enquiries through Excel, personal WhatsApp accounts and multiple applications can result in:</p>
            <ul className="pain-list">
              {PAIN_POINTS.map((p, i) => (
                <li key={p} style={{ transitionDelay: `${i * 60}ms` }}><span className="pain-x"><X size={11} strokeWidth={3} /></span>{p}</li>
              ))}
            </ul>
            <p className="pain-solution"><span className="tick-sm"><Check size={12} strokeWidth={3} /></span>Our CRM keeps your leads, conversations, follow-ups and team activity in one organised system.</p>
          </Reveal>
        </div>
      </section>

      <section className="features">
        <div className="wrap">
          <Reveal variant="up" className="features-head">
            <span className="eyebrow"><Sparkles size={12} /> What's inside</span>
            <h2 className="sec-h2">Everything You Need to Manage and Convert Leads</h2>
          </Reveal>
          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} variant="up" className={"feat-card" + (f.bullets ? " feat-card-wide" : "") + (f.highlight ? " feat-card-highlight" : "")} delay={i * 80}>
                <FeatIcon name={f.icon} />
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
                {f.bullets && (
                  <ul className="feat-bullets">
                    {f.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </Reveal>
            ))}
          </div>
          <Reveal variant="up" className="section-cta">
            <button type="button" className="btn btn-primary btn-cta" onClick={() => setShowDemo(true)}><span>See the CRM in Action</span><span className="btn-arrow"><ArrowRight size={16} /></span></button>
          </Reveal>
        </div>
      </section>

      <main className="wrap" ref={builderRef}>
        <div className="builder">
          <div className="col-config flow">
            {/* 01 core */}
            <FlowRow variant="up">
              <section className="panel">
                <div className="section-head"><h2><LayoutGrid size={18} /> Start with the core</h2><span className="sub">Included in every build — this is your foundation.</span></div>
                <div className="base-row">
                  <span className="tick"><Check size={13} strokeWidth={3} /></span>
                  <div><div className="b-label">{BASE_PLATFORM.label}</div><div className="b-note">{BASE_PLATFORM.note}</div></div>
                </div>
                <div className="included">
                  {INCLUDED_SEATS.map((s) => (
                    <span className="chip" key={s.label}><b>{s.count}</b> {s.label} <span className="free">free</span><InfoTip text={s.info} /></span>
                  ))}
                  {INCLUDED_FEATURES.map((f) => (
                    <span className="chip" key={f.label}><b>{f.count}</b> {f.label} <span className="free">free</span><InfoTip text={f.info} /></span>
                  ))}
                </div>
              </section>
            </FlowRow>

            {/* 02 team */}
            <FlowRow variant="left">
              <section className="panel">
                <div className="section-head"><h2><Users size={18} /> Your team</h2><span className="sub">Add extra users and admins beyond what's included.</span></div>
                <div className="qty-list">
                  {team.map((q) => <QtyRow key={q.id} q={q} count={state[q.id]} onChange={(v) => setQty(q.id, v)} />)}
                </div>
              </section>
            </FlowRow>

            {/* 03 channels */}
            <FlowRow variant="right">
              <section className="panel">
                <div className="section-head"><h2><Megaphone size={18} /> Channels & reports</h2><span className="sub">Each one bundles its own analytics report.</span></div>
                <div className="qty-list">
                  {channels.map((q) => <QtyRow key={q.id} q={q} count={state[q.id]} onChange={(v) => setQty(q.id, v)} />)}
                </div>
              </section>
            </FlowRow>

            {/* 04 leads */}
            <FlowRow variant="zoom">
              <section className="panel">
                <div className="section-head"><h2><Database size={18} /> Lead storage</h2><span className="sub">How many leads should your CRM hold?</span></div>
                <div className={"meter" + (leadsDone ? " on" : "")}>
                  <div>
                    <div className="mt-label">{LEADS.label}<InfoTip text={LEADS.info} /></div>
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
            <FlowRow variant="flip">
              <section className="panel">
                <div className="section-head"><h2><Zap size={18} /> Automations & add-ons</h2><span className="sub">Toggle any of these on. Everything else stays off — and free.</span></div>
                <div className="modules">
                  {MODULES.map((m) => {
                    const on = !!state.modules[m.id];
                    return (
                      <div key={m.id} className={"mod" + (on ? " on" : "")} role="checkbox" aria-checked={on} tabIndex={0}
                        onClick={() => toggleModule(m.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleModule(m.id); } }}>
                        <span className="box">{on && <Check size={14} strokeWidth={3} />}</span>
                        <div><div className="m-label">{m.label}<InfoTip text={m.info} /></div><div className="m-desc">{m.desc}</div></div>
                        <div className="m-price">+{formatINR(m.price)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* metered call add-on */}
                <div className={"meter" + ((state.callBlocks || 0) > 0 ? " on" : "")}>
                  <div>
                    <div className="mt-label">{CALL_METER.label}<InfoTip text={CALL_METER.info} /></div>
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

          {/* live summary — visually placed on the right via explicit grid-column
              placement in CSS (desktop), regardless of this DOM position; on mobile
              it naturally renders here, after all the config panels. */}
          <aside
            ref={summaryRef} id="summary-card"
            className={"summary reveal reveal-right" + (summaryInView ? " in-view" : "")}
          >
            <div className="s-top">
              <div className="period-toggle" role="tablist" aria-label="Billing period">
                {BILLING_PERIODS.map((p) => (
                  <button
                    key={p.id} type="button" role="tab" aria-selected={period.id === p.id}
                    className={"period-btn" + (period.id === p.id ? " active" : "")}
                    onClick={() => setPeriod(p)}
                  >
                    {p.label}
                    {p.discountPct > 0 && <span className="period-badge">{p.discountPct}% off</span>}
                  </button>
                ))}
              </div>
              <div className="s-eye">Your {period.label} price</div>
              <div className="s-price-wrap">
                {billing.hasDiscount && (
                  <div className="s-price-meta">
                    <span className="s-price-strike mono">{formatINR(billing.original)}</span>
                    <span className="s-discount-badge"><BadgePercent size={13} /> {billing.discountPct}% OFF</span>
                  </div>
                )}
                <div className="s-price mono" key={`${bump}-${period.id}`}>
                  {formatINR(displayPrice)}<span className="per">/ {period.unit}</span>
                  {deltaForPeriod !== 0 && (
                    <span className="delta-chip">
                      {deltaForPeriod > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {formatINR(Math.abs(deltaForPeriod))}
                    </span>
                  )}
                </div>
              </div>
              <div className="s-sub">Incl. GST · cancel anytime</div>
              <div className="s-permo">{formatINR(totals.displayTotal)} / month</div>
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
              <div className="t-line grand">
                <span>Total / {period.unit} (incl. GST)</span>
                <span className="mono">
                  {billing.hasDiscount && <s className="t-strike">{formatINR(billing.original)}</s>}
                  {formatINR(billing.discounted)}
                </span>
              </div>
              {totals.minApplied && <div className="floor-note"><Info size={12} /> Minimum monthly plan</div>}
            </div>
            <div className="s-actions">
              <button className="btn btn-primary btn-cta" onClick={() => setShowDemo(true)}><span>Book a free demo</span><span className="btn-arrow"><ArrowRight size={16} /></span></button>
              <p className="s-note">No card required. We'll set up this exact configuration for you.</p>
            </div>
          </aside>
        </div>
      </main>

      <footer ref={footRef} className={"site-foot reveal reveal-up" + (footInView ? " in-view" : "")}>
        <div className="wrap">Built by {CONTACT.brand} · <a href={`https://${CONTACT.site}`} target="_blank" rel="noreferrer">{CONTACT.site}</a></div>
      </footer>

      {/* phone-only persistent price bar — hidden on tablet/laptop/desktop (see CSS),
          since the full summary card is already always visible there via position: sticky.
          Also hidden until the builder section scrolls into view, so it doesn't cover
          the hero's own CTAs before the user has configured anything. */}
      {showMobileBar && (
        <div className="mobile-price-bar">
          <div className="mpb-info">
            <div className="mpb-label">Total / {period.unit} (incl. GST)</div>
            <div className="mpb-price mono">{formatINR(billing.discounted)}</div>
          </div>
          <button className="btn btn-primary btn-cta" onClick={() => setShowDemo(true)}>
            <span>Book a free demo</span><span className="btn-arrow"><ArrowRight size={16} /></span>
          </button>
        </div>
      )}

      {showDemo && <DemoModal totals={totals} state={state} onClose={() => setShowDemo(false)} onSubmitted={handleDemoSubmitted} />}
    </>
  );
}
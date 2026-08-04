// =============================================================
//  SKYUP CRM — PRICING CONFIG  (edit ONLY this file to change prices)
//  All amounts are in INR, per month, exclusive of GST.
//  GST (18%) is added on top and shown as a separate line.
// =============================================================

export const CURRENCY = "\u20B9";
export const GST_RATE = 0.18; // 18% GST shown separately

// Every build is billed at least this much per month (incl. GST), regardless of
// how small the picked configuration is. Only the DISPLAYED total is floored \u2014
// the underlying receipt lines/subtotal/GST always reflect the real picks.
export const MIN_MONTHLY_TOTAL = 2999;

// Where "Book a Demo" sends the pre-filled enquiry. EDIT to your real details.
export const CONTACT = {
  whatsapp: "919999999999",              // no +, country code + number
  email: "hello@skyupdigitalsolutions.com",
  site: "skyupdigitalsolutions.com",
  brand: "Skyup Digital Solutions",
};

// Required base — every plan starts here and INCLUDES the fixed seats below.
export const BASE_PLATFORM = {
  id: "base",
  label: "Core CRM platform",
  price: 1499,
  note: "Lead management, live dashboard, real-time notifications, secure login & role-based access.",
};

// Seats that are ALWAYS included in the base (fixed, free, non-removable).
export const INCLUDED_SEATS = [
  { label: "Users", count: 3 },
  { label: "Admin", count: 1 },
  { label: "Super admin", count: 1 },
];

// Stepper quantities. amount = pricePer * max(0, qty - included)
// section "team"     -> shown under "Your team"
// section "channels" -> shown under "Channels & reports"
export const QUANTITIES = [
  { id: "users",           section: "team",     label: "Team users",                       help: "3 included \u00B7 add more people who log in to work leads", unit: "user",     min: 3, max: 500, included: 3, pricePer: 199 },
  { id: "admins",          section: "team",     label: "Admin accounts",                   help: "1 included \u00B7 add more full-control admins",             unit: "admin",    min: 1, max: 50,  included: 1, pricePer: 299 },
  { id: "websites",        section: "channels", label: "Website + analytics report",       help: "1 included · add more websites, each with its own analytics report", unit: "website",  min: 1, max: 50,  included: 1, pricePer: 300 },
  { id: "metaCampaigns",   section: "channels", label: "Meta campaign + analytics report", help: "1 included · add more Meta (FB / Instagram) campaigns with report", unit: "campaign", min: 1, max: 100, included: 1, pricePer: 300 },
  { id: "googleCampaigns", section: "channels", label: "Google campaign + analytics report",help: "1 included · add more Google Ads campaigns with report",           unit: "campaign", min: 1, max: 100, included: 1, pricePer: 300 },
];

// Lead storage capacity. Linear meter: blockPrice per blockSize leads,
// with the first includedFree leads at no charge.
export const LEADS = {
  id: "leads",
  label: "Lead storage capacity",
  help: "5,000 leads included, then ₹100 per 1,000",
  includedFree: 5000,
  default: 5000,
  blockSize: 1000,
  blockPrice: 100,
  min: 5000,
  max: 100000,
};

// Optional automation modules — toggle on/off.
export const MODULES = [
  { id: "whatsapp",  label: "WhatsApp Automation",          price: 999, desc: "Automated WhatsApp campaigns, templates & alerts" },
  { id: "email",     label: "Email Automation",             price: 999, desc: "Automated email sequences, broadcasts & alerts" },
  { id: "sms",       label: "SMS Automation",               price: 999, desc: "Bulk & triggered SMS via DLT-approved templates" },
  { id: "analytics", label: "Advanced Analytics & Reports", price: 699, desc: "Conversion, productivity & campaign dashboards" },
];

// Metered call add-on: buy in blocks. Each block = blockMinutes for blockPrice.
export const CALL_METER = {
  id: "callBlocks",
  label: "Call Recording, Transcription & Summary",
  desc: "AI transcript + summary for recorded calls.",
  blockMinutes: 100,
  blockPrice: 100,
  min: 0,
  maxBlocks: 500,
  note: "Note: unused transcription minutes carry forward to the next month.",
};

// Sensible starting selection when the page loads.
export const DEFAULT_STATE = {
  users: 3,
  admins: 1,
  websites: 1,
  metaCampaigns: 1,
  googleCampaigns: 1,
  leads: 5000,
  callBlocks: 0,
  modules: {}, // e.g. { whatsapp: true }
};

// -------- Pure pricing engine (shared logic) --------
export function priceLines(state) {
  const lines = [];
  lines.push({ id: "base", label: BASE_PLATFORM.label, qty: 1, amount: BASE_PLATFORM.price, kind: "base" });

  for (const q of QUANTITIES) {
    const count = Math.max(q.min, Number(state[q.id]) || q.min);
    const billable = Math.max(0, count - q.included);
    const amount = billable * q.pricePer;
    if (amount > 0 || q.section === "team" || q.section === "channels") {
      lines.push({ id: q.id, label: q.label, qty: count, amount, kind: "qty", unit: q.unit });
    }
  }

  const leads = Math.min(LEADS.max, Math.max(LEADS.min, Number(state.leads) || LEADS.min));
  const leadPrice = Math.max(0, (leads - LEADS.includedFree) / LEADS.blockSize) * LEADS.blockPrice;
  lines.push({ id: "leads", label: `${LEADS.label} (${leads.toLocaleString("en-IN")})`, qty: 1, amount: leadPrice, kind: "leads" });

  const blocks = Math.max(0, Number(state.callBlocks) || 0);
  if (blocks > 0) {
    const mins = blocks * CALL_METER.blockMinutes;
    lines.push({ id: "callBlocks", label: `Call transcription (${mins} min)`, qty: blocks, amount: blocks * CALL_METER.blockPrice, kind: "meter" });
  }

  for (const m of MODULES) {
    if (state.modules && state.modules[m.id]) {
      lines.push({ id: m.id, label: m.label, qty: 1, amount: m.price, kind: "module" });
    }
  }
  return lines;
}

export function computeTotals(state) {
  const lines = priceLines(state);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;
  const displayTotal = Math.max(total, MIN_MONTHLY_TOTAL);
  const minApplied = displayTotal > total;
  return { lines, subtotal, gst, total, displayTotal, minApplied };
}

export function formatINR(n) {
  return CURRENCY + Number(Math.round(n)).toLocaleString("en-IN");
}

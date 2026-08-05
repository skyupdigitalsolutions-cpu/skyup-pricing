// =============================================================
//  SKYUP CRM — PRICING CONFIG  (edit ONLY this file to change prices)
//  All amounts are in INR, per month, and already INCLUDE GST —
//  nothing is added on top of the listed prices.
// =============================================================

export const CURRENCY = "\u20B9";

// Every build is billed at least this much per month (incl. GST), regardless of
// how small the picked configuration is. Only the DISPLAYED total is floored \u2014
// the underlying receipt lines/subtotal always reflect the real picks.
export const MIN_MONTHLY_TOTAL = 3349;

// Billing-period toggle shown above the price. "months" is the commitment length;
// "discountPct" is the % knocked off the plain months-multiplied price for
// committing upfront.
export const BILLING_PERIODS = [
  { id: "sixmonth",  label: "6 Months", unit: "6 months",  months: 6,  discountPct: 10 },
  { id: "yearly",    label: "Yearly",   unit: "year",     months: 12, discountPct: 20 },
];

// Turns a monthly total into what a billing period should show: the plain
// "list" price for that many months (rounded down to a clean hundred), and \u2014
// for periods with a discount \u2014 a discounted price that lands just under the
// next hundred (\u2026999-style) so it reads as a deliberate offer, not a rounding artifact.
export function computeBilling(monthlyTotal, period) {
  const exact = monthlyTotal * period.months;
  // only round multi-month "list" prices to a clean hundred for the bundle look —
  // the plain monthly view must keep showing the real total, matching the receipt below it
  const original = period.months > 1 ? Math.floor(exact / 100) * 100 : exact;
  const discounted = period.discountPct > 0
    ? Math.floor((original * (1 - period.discountPct / 100)) / 100) * 100 - 1
    : original;
  return { months: period.months, original, discounted, hasDiscount: period.discountPct > 0, discountPct: period.discountPct };
}

// Where "Book a Demo" sends the pre-filled enquiry. EDIT to your real details.
export const CONTACT = {
  whatsapp: "918867867775",              // no +, country code + number
  email: "hello@skyupdigitalsolutions.com",
  site: "skyupdigitalsolutions.com",
  brand: "Skyup Digital Solutions",
};

// Required base — every plan starts here and INCLUDES the fixed seats below.
export const BASE_PLATFORM = {
  id: "base",
  label: "Core CRM platform",
  price: 3349,
  note: "Lead management, live dashboard, real-time notifications, secure login & role-based access.",
};

// Seats that are ALWAYS included in the base (fixed, free, non-removable).
export const INCLUDED_SEATS = [
  { label: "Users", count: 3, info: "Logins for your team members — like salespeople or support staff — so they can view and manage leads." },
  { label: "Admin", count: 1, info: "An admin can change settings, add or remove team members, and control how the CRM works — more power than a regular user." },
  { label: "Super admin", count: 1, info: "The top-level owner account. It can do everything an admin can, plus manage billing and every other admin's access." },
];

// Extra base inclusions shown as chips in the "Start with the core" section,
// so customers can see everything the base plan already covers (all free).
export const INCLUDED_FEATURES = [
  { label: "Website + analytics report", count: 1, info: "Leads from your website land here automatically, plus a report showing how many visitors turn into leads." },
  { label: "Meta ad account + analytics report", count: 1, info: "Connects your Facebook/Instagram ad account so leads from those ads land here automatically, with a report on how the ads are doing." },
  { label: "Google ad account + analytics report", count: 1, info: "Connects your Google ad account so leads from those ads land here automatically, with a report on how the ads are doing." },
  { label: "leads storage", count: "5,000", info: "The total number of leads (potential customers) your CRM can hold at once, at no extra cost." },
];

// Stepper quantities. amount = pricePer * max(0, qty - included)
// section "team"     -> shown under "Your team"
// section "channels" -> shown under "Channels & reports"
export const QUANTITIES = [
  { id: "users",           section: "team",     label: "Team users",                          help: "3 included \u00B7 add more people who log in to work leads", unit: "user",       min: 3, max: 500, included: 3, pricePer: 199,
    info: "Add logins for more team members \u2014 like salespeople or support staff \u2014 so they can view and manage leads too." },
  { id: "admins",          section: "team",     label: "Admin accounts",                      help: "1 included \u00B7 add more full-control admins",             unit: "admin",      min: 1, max: 50,  included: 1, pricePer: 299,
    info: "Admins can change settings, add or remove users, and control how the CRM works. Add more if several people need that level of access." },
  { id: "websites",        section: "channels", label: "Website + analytics report",          help: "1 included · add more websites, each with its own analytics report", unit: "website",    min: 1, max: 50,  included: 1, pricePer: 300,
    info: "Add more websites you want connected to the CRM. Each one gets its own report showing how many visitors turn into leads." },
  { id: "metaCampaigns",   section: "channels", label: "Meta ad account + analytics report",  help: "1 included · add more Meta (FB / Instagram) ad accounts with report", unit: "ad account", min: 1, max: 100, included: 1, pricePer: 300,
    info: "Add more Facebook/Instagram ad accounts you want connected. Each one gets its own report on how those ads are performing." },
  { id: "googleCampaigns", section: "channels", label: "Google ad account + analytics report", help: "1 included · add more Google Ads accounts with report",              unit: "ad account", min: 1, max: 100, included: 1, pricePer: 300,
    info: "Add more Google ad accounts you want connected. Each one gets its own report on how those ads are performing." },
];

// Lead storage capacity. Linear meter: blockPrice per blockSize leads,
// with the first includedFree leads at no charge.
export const LEADS = {
  id: "leads",
  label: "Lead storage capacity",
  help: "5,000 leads included, then ₹100 per 1,000",
  info: "This is the total number of leads (potential customers) your CRM can store. The first 5,000 are free — after that, a small amount is charged for every extra 1,000.",
  includedFree: 5000,
  default: 5000,
  blockSize: 1000,
  blockPrice: 100,
  min: 5000,
  max: 100000,
};

// Optional automation modules — toggle on/off.
export const MODULES = [
  { id: "whatsapp",  label: "WhatsApp Automation",          price: 999, desc: "Automated WhatsApp campaigns, templates & alerts",
    info: "Automatically sends WhatsApp messages to your leads — like a welcome message, a reminder, or a special offer — without you doing it by hand." },
  { id: "email",     label: "Email Automation",             price: 999, desc: "Automated email sequences, broadcasts & alerts",
    info: "Automatically sends emails to your leads and customers — like follow-ups or newsletters — without you doing it by hand." },
  { id: "sms",       label: "SMS Automation",               price: 999, desc: "Bulk & triggered SMS via DLT-approved templates",
    info: "Automatically sends text messages (SMS) to your leads — for reminders, offers or updates — using templates approved for bulk messaging." },
  { id: "analytics", label: "Advanced Analytics & Reports", price: 699, desc: "Conversion, productivity & campaign dashboards",
    info: "Extra dashboards and reports that show how well your team and your ad campaigns are doing, in more detail than the basic reports." },
];

// Metered call add-on: buy in blocks. Each block = blockMinutes for blockPrice.
export const CALL_METER = {
  id: "callBlocks",
  label: "Call Recording, Transcription & Summary",
  desc: "AI transcript + summary for recorded calls.",
  info: "When turned on, your calls are recorded, turned into text (a transcript), and a short summary is created for you automatically — so you don't have to take notes during calls.",
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
  const total = subtotal; // listed prices already include GST — nothing added on top
  const displayTotal = Math.max(total, MIN_MONTHLY_TOTAL);
  const minApplied = displayTotal > total;
  return { lines, subtotal, total, displayTotal, minApplied };
}

export function formatINR(n) {
  // Show up to 2 decimals so GST / total like ₹539.82 render correctly,
  // while whole amounts (₹2,999) stay clean with no trailing ".00".
  return CURRENCY + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
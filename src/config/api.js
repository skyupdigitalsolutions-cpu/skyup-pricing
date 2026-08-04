// Base URL of the SkyUp pricing API (Express + MongoDB backend).
// Set VITE_API_URL in .env, e.g.  VITE_API_URL=https://skyup-pricing-api.onrender.com
//
// NOTE: Vite inlines env vars at BUILD time. After changing .env (or the Cloudflare
// Pages env var) you must rebuild + redeploy for the new value to take effect.

const RAW = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

// Guard against a missing scheme: a bare host like "api.example.com" would be
// treated by the browser as a RELATIVE path. Force https:// when no scheme given.
function normalize(url) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export const API_BASE = normalize(RAW);

/** POST a lead to the backend. Throws on network / non-2xx so callers can react. */
export async function saveLead(payload) {
  if (!API_BASE) throw new Error("VITE_API_URL is not configured");

  const res = await fetch(`${API_BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Request failed";
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return res.json();
}

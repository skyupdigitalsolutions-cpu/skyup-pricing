# Skyup CRM — Flexible Pricing Landing Page (v2)

Vite + React landing page. Visitors build their own plan (no fixed tiers); price
updates live incl. 18% GST. CTA is **Book a demo** (WhatsApp/email), never a payment.

## Run
    npm install
    npm run dev      # http://localhost:5173
    npm run build    # -> /dist  (deploy to Cloudflare/Hostinger)

## Everything editable is in src/pricing.config.js
- BASE_PLATFORM.price ......... core fee (₹1499)
- INCLUDED_SEATS ............. fixed free seats (3 users, 1 admin, 1 super admin)
- QUANTITIES ................. extra users ₹199, extra admins ₹299,
                              website/meta/google + report ₹300 each
- LEADS ...................... lead storage meter (1,000 leads = ₹100, linear)
- MODULES ................... WhatsApp / Email / SMS ₹999, Analytics ₹699
- CALL_METER ................ 100 min = ₹100 per block (carry-forward note)
- CONTACT ................... ** set your WhatsApp number + email **

## preview.html
Zero-install standalone (plain HTML/JS). Open on any device incl. old Nokia.

## Note
Prices carried over from your last spec + these updates. Advanced Analytics (₹699)
is kept as a standalone module — delete that line in MODULES if it's now redundant
with the per-channel analytics reports.

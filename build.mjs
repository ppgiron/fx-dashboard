// Builds dist/index.html by pulling the current numbers from Supabase and
// injecting them into template.html. Run by GitHub Actions after each FX close.
//
// SUPABASE_KEY is a *publishable* key. It is designed to be exposed, and the
// only thing it can reach is the fx_dashboard_data() function, which returns
// exchange rates and the alert target — no amounts, no personal data.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const BASE = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_KEY;
if (!BASE || !KEY) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");

const res = await fetch(`${BASE}/rest/v1/rpc/fx_dashboard_data`, {
  method: "POST",
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 400)}`);
const raw = await res.json();

const n = (v) => (v === null || v === undefined ? null : Number(v));
const nums = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) =>
  [k, typeof v === "string" && !isNaN(Number(v)) ? Number(v) : v]));

const D = {
  rate: n(raw.rate),
  rate_ts: raw.rate_ts,
  session: raw.session,
  stale: !!raw.stale,
  threshold: n(raw.threshold),
  change_pct: n(raw.change_pct),
  days_since_target: raw.days_since_target,
  vs_prev_close_pct: n(raw.vs_prev_close_pct),
  prev: nums(raw.prev),
  morning: nums(raw.morning),
  days: (raw.days ?? []).map((x) => ({
    ...nums(x),
    pts: (x.pts ?? []).map((r) => [Number(r[0]), Number(r[1])]),
  })),
  d5: nums(raw.d5),
  win: Object.fromEntries(Object.entries(raw.win ?? {}).map(([k, v]) => [k, nums(v)])),
  ind: nums(raw.ind),
  s90: (raw.series_90d ?? []).map((r) => [r[0], Number(r[1])]),
  si:  (raw.series_intra ?? []).map((r) => [Number(r[0]), Number(r[1])]),
  series_morning: (raw.series_morning ?? []).map((r) => [Number(r[0]), Number(r[1])]),
  series_prevday: (raw.series_prevday ?? []).map((r) => [Number(r[0]), Number(r[1])]),
};

// Refuse to publish something broken — a stale page beats a wrong one.
const problems = [];
if (!(D.rate > 0)) problems.push("rate missing or not positive");
for (const w of ["30", "60", "90", "365"]) if (!D.win[w]) problems.push(`window ${w} missing`);
if (!D.s90.length) problems.push("90-day series empty");
if (D.win["90"] && !(D.rate >= D.win["90"].lo && D.rate <= D.win["90"].hi)) {
  problems.push(`rate ${D.rate} outside its own 90-day range`);
}
if (problems.length) throw new Error("Refusing to build:\n  - " + problems.join("\n  - "));

// Empty intraday series are survivable (holiday, first deploy) — the page
// renders an explanatory placeholder. Warn, do not fail.
if (!D.series_morning.length) console.warn("warning: no morning ticks yet");
if (!D.series_prevday.length) console.warn("warning: no previous-day ticks");
if (D.days.length < 20) console.warn(`warning: only ${D.days.length} day panels available`);

const html = (await readFile("template.html", "utf8"))
  .replace("__DATA__", JSON.stringify(D));
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);

console.log(`built dist/index.html — rate ${D.rate}, ${D.s90.length} daily points, ` +
            `${D.series_morning.length} morning, ${D.series_prevday.length} prev-day, ` +
            `${D.si.length} today, ${D.days.length} day panels, session ${D.session}, ` +
            `prev ${D.prev?.date}`);

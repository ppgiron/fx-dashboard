# USD → CAD dashboard

A single static page showing where the USD→CAD rate Wise displays currently sits: the
overnight move, the previous trading day, five lookback windows, and the technical
indicators explained in plain language.

**Live page:** https://ppgiron.github.io/fx-dashboard/

## How it works

```
Supabase (fx-tracker)          GitHub Actions              GitHub Pages
  fx_dashboard_data()  ──POST──►  build.mjs  ──dist/──►  the live page
   rates, windows,               injects the JSON
   indicators, series            into template.html
```

- `template.html` — the page. All layout, styling and the explanatory copy live here.
  Contains one placeholder, `__DATA__`, where the data object is injected.
- `build.mjs` — fetches `fx_dashboard_data()` from Supabase, sanity-checks the result,
  and writes `dist/index.html`. It **refuses to build** on a missing rate, a missing
  lookback window, an empty series, or a rate outside its own 90-day range — a stale
  page beats a wrong one.
- `.github/workflows/build.yml` — runs on weekdays at **13:30 and 14:30 UTC** (so the
  page is rebuilt shortly before the 9:00 AM Central digest goes out, in both CST and
  CDT — one of the two firings is always the right one) and again at **22:15 UTC** after
  the FX close. Also on every push to `main`, and on demand via
  **Actions → Build dashboard → Run workflow**.

## To change the design

Edit `template.html` and push. Do not edit `dist/` — it is generated and gitignored.

## About the Supabase key

`SUPABASE_KEY` in the workflow is a Supabase **publishable** key, the kind meant to be
exposed in client code. The only thing it can reach is `fx_dashboard_data()`, which
returns exchange rates, the ranges, the indicators and the alert target. Every other
table is deny-all under row-level security, and nothing about transfers, amounts or
obligations is reachable through it. To rotate: change the key in Supabase and update
the one line in `build.yml`.

## Related

The rate data is collected minute-by-minute by the `fx-tracker` Supabase project, which
also sends the daily close digest and the 1.4000 target alert over ntfy.

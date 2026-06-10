# MemKeeper

**Own your AI memory.** Import the official data exports of ChatGPT,
Claude and Gemini — parsed entirely in your browser — and see what each
AI knows about you that the others don't.

https://memkeeper.eu

## The promise is structural, not declarative

- **Nothing is uploaded.** Export ZIPs are read in-memory in the
  browser tab (fflate). There is no upload endpoint to send them to.
  Verify it yourself: DevTools → Network while importing.
- **No account needed.** The vault lives in IndexedDB on your device.
- **Deterministic comparison.** The cross-platform diff uses normalized
  content equality plus a difflib-equivalent ratio — same algorithm,
  same result, every time. No embeddings, no LLM calls.
- **Self-hosted fonts, strict CSP.** Zero third-party requests on every
  page.

The parsing core is a strict TypeScript port of
[AgentKeeper](https://github.com/Thinklanceai/agentkeeper)'s importers
(MIT) — content strings and scope metadata are byte-identical, so a
vault built here stays interoperable with the Python lib.

## Stack

Next.js 15 (App Router, static output) · TypeScript strict · Tailwind 4
· fflate · idb-keyval · Vitest. Supabase is wired but deliberately
unused in v1 — opt-in encrypted sync is phase 2.

## Develop

```bash
npm install
npm run dev
```

## Validate

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

## Structure

```
src/lib/core/        parsers (chatgpt, claude, gemini), compare, zip guards
src/lib/store/       IndexedDB vault (client-only)
src/app/import       drop an export ZIP or paste a memory summary
src/app/inventory    per-platform counts + searchable fact ledger
src/app/compare      the diff: what each AI knows that the others don't
```

© ThinkLance AI — all rights reserved. The engine (AgentKeeper) is MIT;
this product is not.

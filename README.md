# MemKeeper

**See what AI assistants remember about you. On-device, open source, zero telemetry.**

The only tool that compares what ChatGPT, Claude and Gemini have memorized about you — side by side. Your exports are parsed in your browser tab. Nothing is uploaded. Open DevTools, watch the Network tab stay silent.

> **Live:** [memkeeper.eu](https://memkeeper.eu)
> Drop your exports in. See the diff in 5 seconds.

---

## Why this exists

Every major AI assistant now keeps a long-term memory about you. ChatGPT remembers your job, Claude remembers your preferences, Gemini saves what it considers important. None of them tells you what the others have learned. None of them shows you what *you yourself* have inadvertently revealed across a year of conversations.

MemKeeper does. It reads the official export from each platform, parses it locally, and shows you three columns: **Only ChatGPT knows**, **Both platforms know**, **Only Claude knows**. Most people discover their two assistants agree on roughly zero facts about them — and that the things they remember are not the things you would have written down yourself.

## What it does

- **Compare across platforms.** Deterministic diff between ChatGPT, Claude and Gemini memory exports. Same algorithm, same result, every time.
- **Sync in one click.** Generate a copy-paste prompt that teaches one assistant what the other knows. Bilingual (FR/EN auto-detected per fact), grouped by category, opens directly in the target platform.
- **Manage what's kept.** Delete from your local vault per fact, or jump straight to each platform's own memory settings to manage what they retain on their side. MemKeeper is honest about what it controls and what it does not.
- **Inventory by source.** See every fact, tagged by platform and type — identity, preferences, decisions, events.

## Privacy by design — not by promise

This is structural, not declarative:

- Your exports are parsed entirely in your browser with the `fflate` and IndexedDB APIs. The vault is `idb-keyval` in your tab's storage.
- The app makes zero requests carrying your data. The repo is open — read `src/lib/core/` and verify.
- There is no server-side processing. Hosting is static.
- The on-device badge in the header is a permanent invitation to verify in DevTools.

If MemKeeper ever needs to send anything — for example to enable optional cross-device sync — it will be opt-in, per-fact, and visible. That is not the case today.

## Quickstart

```bash
git clone https://github.com/Thinklanceai/memkeeper.git
cd memkeeper
npm install
npm run dev
```

Then open `http://localhost:3000/import`, drop the official memory export from ChatGPT / Claude / Gemini, head to `/compare`, and read the diff.

Where to get the exports:
- **ChatGPT** — Settings → Data Controls → Export data (then unzip and drop `conversations.json`).
- **Claude** — Settings → Account → Export data, or paste "everything you remember about me" from a conversation.
- **Gemini** — Saved info, or paste a summary the model gives you.

## Architecture

```
src/
├── app/
│   ├── import/      — drop exports, runs parser in-tab
│   ├── inventory/   — every fact, by platform
│   └── compare/     — the diff, with sync packet generator
├── lib/
│   ├── core/        — parsers, deterministic similarity, scope comparison
│   └── store/       — IndexedDB vault (idb-keyval)
└── components/      — UI primitives, PacketModal
```

The comparison engine in `src/lib/core/compare.ts` is a port of the Python lib used internally — same threshold, same matching, same byte layout. Determinism is not an accident.

## Roadmap

- **Drift over time.** Re-import a more recent export, see what the platform's memory has added, dropped, or quietly reshaped.
- **More platforms.** Perplexity, Mistral Le Chat, Grok — pull requests welcome, the parser interface is small.
- **Optional encrypted sync** between your own devices. Opt-in, per-fact, end-to-end encrypted. Not now.

## Contributing

Open an [issue](https://github.com/Thinklanceai/memkeeper/issues) or pull request. The parsers are the high-leverage entry point — each new platform is a single file under `src/lib/core/parsers.ts`-style.

If you find a path where your data leaves the browser tab, that is the highest-priority bug. Please open an issue.

## Sibling projects

MemKeeper is part of [ThinkLanceAI](https://github.com/Thinklanceai)'s work on user sovereignty over AI:

- **[HumanRoot](https://github.com/Thinklanceai/humanroot)** — delegation certificates and an MCP enforcement proxy so an autonomous agent can prove which human authorized it, with which scopes, until when.

MemKeeper is your memory. HumanRoot is your delegations. Same north star.

## License

[MIT](./LICENSE)

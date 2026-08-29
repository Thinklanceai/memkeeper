"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type Platform,
  compareScopes,
  parseMemorySummary,
  platformScope,
} from "@/lib/core";
import { PlatformTag } from "@/components/ui";

const SAMPLE_A = `- Works in marketing for a logistics company in Rotterdam
- Prefers short answers with no preamble
- Is planning a move to Lisbon next spring
- Uses metric units and 24-hour time`;

const SAMPLE_B = `- Works in marketing for a logistics company in Rotterdam
- Prefers short answers, no preamble
- Moved to Lisbon in March
- Writes in British English`;

const EXPORT_HOWTO: Array<{
  platform: Platform;
  name: string;
  steps: string;
  url: string;
}> = [
  {
    platform: "chatgpt",
    name: "ChatGPT",
    steps: "Settings → Data controls → Export data. Email arrives in a few minutes.",
    url: "https://chatgpt.com/#settings/DataControls",
  },
  {
    platform: "claude",
    name: "Claude",
    steps: "Settings → Privacy → Export data. Email arrives within a day.",
    url: "https://claude.ai/settings/data-privacy-controls",
  },
  {
    platform: "gemini",
    name: "Gemini",
    steps: "takeout.google.com → My Activity → Gemini Apps. Pick JSON format.",
    url: "https://takeout.google.com/",
  },
];

export default function Home() {
  const [summaryA, setSummaryA] = useState(SAMPLE_A);
  const [summaryB, setSummaryB] = useState(SAMPLE_B);

  const diff = useMemo(() => {
    const facts = [
      ...parseMemorySummary(summaryA, "chatgpt"),
      ...parseMemorySummary(summaryB, "claude"),
    ];
    return compareScopes(facts, platformScope("chatgpt"), platformScope("claude"));
  }, [summaryA, summaryB]);

  return (
    <div className="py-6 sm:py-10">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-brass">
        Your AI memory, in your hands
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-lapis-deep sm:text-5xl">
        Every AI remembers things about you.
        <br />
        None of them show you what.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        MemKeeper reads what ChatGPT, Claude and Gemini remember and shows
        you what each one knows that the others don&apos;t — entirely in
        your browser.
      </p>

      {/* Live demo ------------------------------------------------------ */}
      <section
        aria-label="Live demo"
        className="mt-10 rounded-xl border border-line bg-card p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">
            Try it now — no install
          </h2>
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-slate">
            live · in this tab · 0 requests
          </p>
        </div>
        <p className="mt-1 text-sm text-slate">
          Ask each AI: <em>&ldquo;List everything you remember about me as
          bullet points.&rdquo;</em> Paste the answers below. The diff
          updates as you type.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SummaryBox
            platform="chatgpt"
            value={summaryA}
            onChange={setSummaryA}
          />
          <SummaryBox platform="claude" value={summaryB} onChange={setSummaryB} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Only ChatGPT" value={diff.onlyInA.length} accent />
          <Stat label="Shared" value={diff.shared.length} />
          <Stat label="Only Claude" value={diff.onlyInB.length} accent />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <DiffColumn
            heading={
              <>
                Only <PlatformTag platform="chatgpt" /> knows
              </>
            }
            items={diff.onlyInA.map((f) => f.content)}
          />
          <DiffColumn
            heading={
              <>
                Only <PlatformTag platform="claude" /> knows
              </>
            }
            items={diff.onlyInB.map((f) => f.content)}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <Link
            href="/import"
            className="rounded-md bg-lapis px-5 py-2.5 font-medium text-white hover:bg-lapis-deep"
          >
            Now do it with the full exports →
          </Link>
          <span className="text-sm text-slate">
            ZIPs, conversation history, search, side-by-side.
          </span>
        </div>
      </section>

      {/* How to get the exports ----------------------------------------- */}
      <section aria-label="How to get your exports" className="mt-16">
        <h2 className="font-display text-xl font-bold text-ink">
          How to get your exports
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate">
          Every platform offers a data export under data protection law.
          MemKeeper reads them as-is — no scraping, no permissions, no
          plugin.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {EXPORT_HOWTO.map((item) => (
            <div
              key={item.platform}
              className="rounded-lg border border-line bg-card p-5"
            >
              <PlatformTag platform={item.platform} />
              <h3 className="mt-3 font-display text-base font-bold text-ink">
                {item.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {item.steps}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-lapis underline-offset-4 hover:underline"
              >
                Request export ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-lg border border-line bg-card p-6">
        <h2 className="font-display text-base font-bold text-ink">
          Why this works the way it does
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate sm:grid-cols-2">
          <li>
            <span className="font-medium text-ink">Nothing uploaded.</span>{" "}
            Verify it yourself: DevTools → Network while you type above.
          </li>
          <li>
            <span className="font-medium text-ink">No account.</span> The
            vault lives in IndexedDB on this device.
          </li>
          <li>
            <span className="font-medium text-ink">Deterministic diff.</span>{" "}
            Normalized text + difflib ratio. No embeddings, no LLM call.
          </li>
          <li>
            <span className="font-medium text-ink">Engine is open source.</span>{" "}
            TypeScript port of{" "}
            <a
              href="https://github.com/Thinklanceai/agentkeeper"
              className="text-lapis underline-offset-2 hover:underline"
            >
              AgentKeeper
            </a>{" "}
            (MIT).
          </li>
        </ul>
      </section>
    </div>
  );
}

function SummaryBox({
  platform,
  value,
  onChange,
}: {
  platform: Platform;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2">
        <PlatformTag platform={platform} />
        <span className="text-xs text-slate">memory summary</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        spellCheck={false}
        className="w-full rounded-md border border-line bg-porcelain p-3 font-mono text-xs leading-relaxed focus:border-lapis focus:outline-none"
      />
    </label>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-brass/40 bg-[#c9a22708]" : "border-line bg-card"
      }`}
    >
      <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-slate">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function DiffColumn({
  heading,
  items,
}: {
  heading: React.ReactNode;
  items: string[];
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
        {heading}
      </h3>
      <div className="mt-2 rounded-lg border border-line bg-porcelain">
        {items.length === 0 ? (
          <p className="p-3 font-mono text-xs text-slate">
            Nothing exclusive yet.
          </p>
        ) : (
          items.map((content, i) => (
            <p
              key={i}
              className="border-b border-line px-3 py-2 font-mono text-xs text-ink last:border-b-0"
            >
              {content}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

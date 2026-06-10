"use client";

import type { ImportedFact, Platform } from "@/lib/core";

/**
 * The signature element: a permanent, truthful indicator that parsing
 * happens on-device. It invites verification rather than asking for
 * trust — open DevTools, watch the network tab stay silent.
 */
export function LocalOnlyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 font-mono text-[0.6875rem] text-slate"
      title="Your exports are parsed in this browser tab. Open DevTools → Network while importing: no request carries your data."
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-ok"
      />
      on-device — 0 requests with your data
    </span>
  );
}

const PLATFORM_STYLES: Record<Platform, { label: string; cls: string }> = {
  chatgpt: { label: "CHATGPT", cls: "bg-[#10a37f1a] text-[#0d7a60]" },
  claude: { label: "CLAUDE", cls: "bg-[#d977571a] text-[#b05730]" },
  gemini: { label: "GEMINI", cls: "bg-[#4285f41a] text-[#2a5cc2]" },
};

export function PlatformTag({ platform }: { platform: Platform }) {
  const s = PLATFORM_STYLES[platform];
  return <span className={`ledger-tag ${s.cls}`}>{s.label}</span>;
}

const TYPE_CLS: Record<string, string> = {
  IDENTITY: "bg-[#233d7b14] text-lapis",
  PREFERENCE: "bg-[#c9a22720] text-[#8a6f15]",
  EVENT: "bg-[#5b657714] text-slate",
  FACT: "bg-[#1f7a4d14] text-ok",
};

export function FactRow({ fact }: { fact: ImportedFact }) {
  return (
    <div className="ledger-row">
      <PlatformTag platform={fact.metadata.source} />
      <span
        className={`ledger-tag ${TYPE_CLS[fact.factType] ?? TYPE_CLS.FACT}`}
      >
        {fact.factType}
      </span>
      <span className="min-w-0 flex-1 break-words text-ink">
        {fact.content}
      </span>
      {fact.when && (
        <time className="shrink-0 text-[0.6875rem] text-slate">
          {fact.when.slice(0, 10)}
        </time>
      )}
    </div>
  );
}

export function EmptyVault({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-card p-10 text-center">
      <p className="text-slate">{message}</p>
      <a
        href="/import"
        className="mt-3 inline-block font-medium text-lapis underline-offset-4 hover:underline"
      >
        Import an export →
      </a>
    </div>
  );
}

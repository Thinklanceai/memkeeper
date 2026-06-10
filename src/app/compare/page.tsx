"use client";

import { useMemo, useState } from "react";
import {
  type ImportedFact,
  type Platform,
  compareScopes,
  platformScope,
} from "@/lib/core";
import {
  MEMORY_PAGES,
  PLATFORM_NAMES,
  buildGroupPacket,
  buildLinePacket,
} from "@/lib/core/packet";
import { useVault } from "@/lib/store/vault";
import { EmptyVault, PlatformTag } from "@/components/ui";
import { PacketModal } from "@/components/PacketModal";

const ALL_PLATFORMS: Platform[] = ["chatgpt", "claude", "gemini"];

interface PacketRequest {
  title: string;
  prompt: string;
  target: Platform;
}

export default function ComparePage() {
  const { facts, ready, removeFact } = useVault();
  const [a, setA] = useState<Platform>("chatgpt");
  const [b, setB] = useState<Platform>("claude");
  const [everything, setEverything] = useState(false);
  const [packet, setPacket] = useState<PacketRequest | null>(null);

  const platformsWithData = useMemo(
    () =>
      ALL_PLATFORMS.filter((p) =>
        facts.some((f) => f.metadata.source === p),
      ),
    [facts],
  );

  const result = useMemo(() => {
    if (a === b) return null;
    return compareScopes(
      facts,
      platformScope(a),
      platformScope(b),
      undefined,
      everything ? null : ["memory_summary"],
    );
  }, [facts, a, b, everything]);

  function tellOne(fact: ImportedFact, target: Platform) {
    setPacket({
      title: `Tell ${PLATFORM_NAMES[target]} — 1 memory`,
      prompt: buildLinePacket(fact),
      target,
    });
  }

  function tellAll(list: ImportedFact[], source: Platform, target: Platform) {
    setPacket({
      title: `Tell ${PLATFORM_NAMES[target]} — ${list.length} memories from ${PLATFORM_NAMES[source]}`,
      prompt: buildGroupPacket(list, source),
      target,
    });
  }

  async function handleDelete(fact: ImportedFact) {
    const ok = window.confirm(
      "Delete this memory from your local MemKeeper vault?\n\nThis does not touch the platform's own memory — manage that on their side.",
    );
    if (ok) await removeFact(fact.id);
  }

  if (!ready) return <p className="font-mono text-sm text-slate">Loading…</p>;
  if (platformsWithData.length < 2) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-lapis-deep">Compare</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate">
          The diff needs at least two platforms in the vault.
          {platformsWithData.length === 1 &&
            ` You have ${platformsWithData[0]} — import one more.`}
        </p>
        <div className="mt-6">
          <EmptyVault message="Not enough platforms to compare yet." />
        </div>
      </div>
    );
  }

  const summaryFactsExist = facts.some(
    (f) => f.metadata.kind === "memory_summary",
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-lapis-deep">Compare</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        What does one AI know about you that the other doesn&apos;t?
        Matching is deterministic — same algorithm, same result, every
        time.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Selector value={a} onChange={setA} exclude={b} />
        <span className="font-mono text-sm text-slate">vs</span>
        <Selector value={b} onChange={setB} exclude={a} />
        <label className="ml-auto flex items-center gap-2 text-xs text-slate">
          <input
            type="checkbox"
            checked={everything}
            onChange={(e) => setEverything(e.target.checked)}
            className="accent-[#233d7b]"
          />
          Include conversation events (noisier)
        </label>
      </div>

      {!everything && !summaryFactsExist && (
        <p className="mt-4 rounded-md border border-brass/40 bg-[#c9a22710] p-3 text-sm text-ink">
          The sharpest diff comes from memory summaries — on the Import
          page, paste &ldquo;everything you remember about me&rdquo; from
          each platform. Or tick the checkbox above to compare
          conversation events instead.
        </p>
      )}

      {result && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label={`Only ${a}`} value={result.onlyInA.length} />
            <Stat label="Shared" value={result.shared.length} />
            <Stat label={`Only ${b}`} value={result.onlyInB.length} />
          </div>

          <p className="mt-3 font-mono text-[0.6875rem] text-slate">
            Each platform&apos;s own memory lives on their side — manage it
            there:{" "}
            <a
              href={MEMORY_PAGES[a].url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lapis underline-offset-2 hover:underline"
            >
              {PLATFORM_NAMES[a]}
            </a>
            {" · "}
            <a
              href={MEMORY_PAGES[b].url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lapis underline-offset-2 hover:underline"
            >
              {PLATFORM_NAMES[b]}
            </a>
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Column
              title={
                <>
                  Only <PlatformTag platform={a} /> knows
                </>
              }
              factsList={result.onlyInA}
              targetName={PLATFORM_NAMES[b]}
              onTell={(f) => tellOne(f, b)}
              onTellAll={() => tellAll(result.onlyInA, a, b)}
              onDelete={handleDelete}
            />
            <Column
              title={
                <>
                  Only <PlatformTag platform={b} /> knows
                </>
              }
              factsList={result.onlyInB}
              targetName={PLATFORM_NAMES[a]}
              onTell={(f) => tellOne(f, a)}
              onTellAll={() => tellAll(result.onlyInB, b, a)}
              onDelete={handleDelete}
            />
          </div>

          {result.shared.length > 0 && (
            <section className="mt-8">
              <h2 className="text-base font-bold text-ink">
                Both platforms know
              </h2>
              <div className="mt-2 rounded-lg border border-line bg-card">
                {result.shared.map((pair) => (
                  <div key={pair.factA.id} className="ledger-row">
                    <span className="ledger-tag bg-[#1f7a4d14] text-ok">
                      {Math.round(pair.similarity * 100)}%
                    </span>
                    <span className="min-w-0 flex-1 break-words text-ink">
                      {pair.factA.content}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {packet && (
        <PacketModal
          title={packet.title}
          prompt={packet.prompt}
          target={packet.target}
          onClose={() => setPacket(null)}
        />
      )}
    </div>
  );
}

function Selector({
  value,
  onChange,
  exclude,
}: {
  value: Platform;
  onChange: (p: Platform) => void;
  exclude: Platform;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Platform)}
      className="rounded-md border border-line bg-card px-3 py-2 text-sm font-medium focus:border-lapis focus:outline-none"
    >
      {ALL_PLATFORMS.filter((p) => p !== exclude).map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-slate">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

const TYPE_CLS: Record<string, string> = {
  IDENTITY: "bg-[#233d7b14] text-lapis",
  PREFERENCE: "bg-[#c9a22720] text-[#8a6f15]",
  EVENT: "bg-[#5b657714] text-slate",
  FACT: "bg-[#1f7a4d14] text-ok",
};

function ActionRow({
  fact,
  targetName,
  onTell,
  onDelete,
}: {
  fact: ImportedFact;
  targetName: string;
  onTell: () => void;
  onDelete: () => void;
}) {
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
      <button
        type="button"
        onClick={onTell}
        title={`Generate a prompt to sync this memory to ${targetName}`}
        className="shrink-0 rounded-md border border-line bg-card px-2 py-1 font-mono text-[0.6875rem] text-lapis hover:bg-black/5"
      >
        Tell {targetName}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete from local vault"
        title="Delete from your local MemKeeper vault only"
        className="shrink-0 rounded-md px-2 py-1 font-mono text-[0.6875rem] text-slate hover:bg-[#b0573014] hover:text-[#b05730]"
      >
        ✕
      </button>
    </div>
  );
}

function Column({
  title,
  factsList,
  targetName,
  onTell,
  onTellAll,
  onDelete,
}: {
  title: React.ReactNode;
  factsList: ImportedFact[];
  targetName: string;
  onTell: (fact: ImportedFact) => void;
  onTellAll: () => void;
  onDelete: (fact: ImportedFact) => void;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          {title}
        </h2>
        {factsList.length > 0 && (
          <button
            type="button"
            onClick={onTellAll}
            className="rounded-md border border-line bg-card px-3 py-1.5 font-mono text-[0.6875rem] font-medium text-lapis hover:bg-black/5"
          >
            Tell {targetName} all {factsList.length} →
          </button>
        )}
      </div>
      <div className="mt-2 rounded-lg border border-line bg-card">
        {factsList.length === 0 ? (
          <p className="p-4 font-mono text-xs text-slate">
            Nothing exclusive found.
          </p>
        ) : (
          factsList.map((f) => (
            <ActionRow
              key={f.id}
              fact={f}
              targetName={targetName}
              onTell={() => onTell(f)}
              onDelete={() => onDelete(f)}
            />
          ))
        )}
      </div>
    </section>
  );
}

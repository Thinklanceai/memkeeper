"use client";

import { useMemo, useState } from "react";
import {
  type ImportedFact,
  type Platform,
  compareScopes,
  platformScope,
} from "@/lib/core";
import { useVault } from "@/lib/store/vault";
import { EmptyVault, FactRow, PlatformTag } from "@/components/ui";

const ALL_PLATFORMS: Platform[] = ["chatgpt", "claude", "gemini"];

export default function ComparePage() {
  const { facts, ready } = useVault();
  const [a, setA] = useState<Platform>("chatgpt");
  const [b, setB] = useState<Platform>("claude");
  const [everything, setEverything] = useState(false);

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

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Column
              title={
                <>
                  Only <PlatformTag platform={a} /> knows
                </>
              }
              factsList={result.onlyInA}
            />
            <Column
              title={
                <>
                  Only <PlatformTag platform={b} /> knows
                </>
              }
              factsList={result.onlyInB}
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

function Column({
  title,
  factsList,
}: {
  title: React.ReactNode;
  factsList: ImportedFact[];
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        {title}
      </h2>
      <div className="mt-2 rounded-lg border border-line bg-card">
        {factsList.length === 0 ? (
          <p className="p-4 font-mono text-xs text-slate">
            Nothing exclusive found.
          </p>
        ) : (
          factsList.map((f) => <FactRow key={f.id} fact={f} />)
        )}
      </div>
    </section>
  );
}

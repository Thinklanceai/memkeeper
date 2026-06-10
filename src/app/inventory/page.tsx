"use client";

import { useMemo, useState } from "react";
import { type Platform, scopeInventory } from "@/lib/core";
import { useVault } from "@/lib/store/vault";
import { EmptyVault, FactRow, PlatformTag } from "@/components/ui";

const ALL_PLATFORMS: Platform[] = ["chatgpt", "claude", "gemini"];

export default function InventoryPage() {
  const { facts, ready, clearPlatform, clearAll } = useVault();
  const [filter, setFilter] = useState<Platform | "all">("all");
  const [query, setQuery] = useState("");

  const inventory = useMemo(() => scopeInventory(facts), [facts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facts.filter((f) => {
      if (filter !== "all" && f.metadata.source !== filter) return false;
      if (q && !f.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [facts, filter, query]);

  if (!ready) return <p className="font-mono text-sm text-slate">Loading…</p>;
  if (facts.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-lapis-deep">Inventory</h1>
        <div className="mt-6">
          <EmptyVault message="Your vault is empty." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-lapis-deep">Inventory</h1>
        <button
          onClick={() => {
            if (confirm("Delete everything in this vault? This device only.")) {
              void clearAll();
            }
          }}
          className="text-xs text-warn underline-offset-2 hover:underline"
        >
          Delete all local data
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {ALL_PLATFORMS.map((p) => {
          const bucket = inventory[`platform:${p}`];
          const total = bucket
            ? Object.values(bucket).reduce((s, n) => s + (n ?? 0), 0)
            : 0;
          return (
            <div key={p} className="rounded-lg border border-line bg-card p-4">
              <div className="flex items-center justify-between">
                <PlatformTag platform={p} />
                {total > 0 && (
                  <button
                    onClick={() => void clearPlatform(p)}
                    className="text-[0.6875rem] text-slate hover:text-warn"
                  >
                    remove
                  </button>
                )}
              </div>
              <p className="mt-2 font-display text-3xl font-bold text-ink">
                {total}
              </p>
              <p className="font-mono text-[0.6875rem] text-slate">
                {bucket
                  ? Object.entries(bucket)
                      .map(([t, n]) => `${n} ${t.toLowerCase()}`)
                      .join(" · ")
                  : "not imported"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(["all", ...ALL_PLATFORMS] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                filter === p
                  ? "border-lapis bg-lapis text-white"
                  : "border-line bg-card text-slate hover:text-ink"
              }`}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search facts…"
          className="min-w-48 flex-1 rounded-md border border-line bg-card px-3 py-1.5 font-mono text-sm focus:border-lapis focus:outline-none"
        />
        <span className="font-mono text-xs text-slate">
          {visible.length} / {facts.length}
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-line bg-card">
        {visible.slice(0, 500).map((f) => (
          <FactRow key={f.id} fact={f} />
        ))}
        {visible.length > 500 && (
          <p className="p-3 font-mono text-xs text-slate">
            Showing first 500 — refine the search to narrow down.
          </p>
        )}
      </div>
    </div>
  );
}

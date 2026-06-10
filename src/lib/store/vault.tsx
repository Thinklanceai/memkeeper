"use client";

/**
 * Client-side vault store. Facts live in IndexedDB on this device —
 * nothing is uploaded anywhere. Supabase sync (opt-in, per-fact) lands
 * in phase 2; this store is deliberately the only source of truth for
 * v1 so the local-only promise is structural, not declarative.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { get, set, del } from "idb-keyval";
import type { ImportReport, ImportedFact, Platform } from "@/lib/core";

const VAULT_KEY = "memkeeper:facts:v1";
const REPORTS_KEY = "memkeeper:reports:v1";

export interface VaultState {
  facts: ImportedFact[];
  reports: ImportReport[];
  ready: boolean;
  addImport: (facts: ImportedFact[], report: ImportReport) => Promise<void>;
  removeFact: (id: string) => Promise<void>;
  clearPlatform: (platform: Platform) => Promise<void>;
  clearAll: () => Promise<void>;
}

const VaultContext = createContext<VaultState | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [facts, setFacts] = useState<ImportedFact[]>([]);
  const [reports, setReports] = useState<ImportReport[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      get<ImportedFact[]>(VAULT_KEY),
      get<ImportReport[]>(REPORTS_KEY),
    ])
      .then(([storedFacts, storedReports]) => {
        if (cancelled) return;
        if (storedFacts) setFacts(storedFacts);
        if (storedReports) setReports(storedReports);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(
    nextFacts: ImportedFact[],
    nextReports: ImportReport[],
  ) {
    setFacts(nextFacts);
    setReports(nextReports);
    await Promise.all([
      set(VAULT_KEY, nextFacts),
      set(REPORTS_KEY, nextReports),
    ]);
  }

  async function addImport(
    newFacts: ImportedFact[],
    report: ImportReport,
  ): Promise<void> {
    const withoutPlatform = facts.filter(
      (f) => f.metadata.source !== report.platform,
    );
    const otherReports = reports.filter(
      (r) => r.platform !== report.platform,
    );
    await persist([...withoutPlatform, ...newFacts], [...otherReports, report]);
  }

  async function removeFact(id: string): Promise<void> {
    await persist(
      facts.filter((f) => f.id !== id),
      reports,
    );
  }

  async function clearPlatform(platform: Platform): Promise<void> {
    await persist(
      facts.filter((f) => f.metadata.source !== platform),
      reports.filter((r) => r.platform !== platform),
    );
  }

  async function clearAll(): Promise<void> {
    setFacts([]);
    setReports([]);
    await Promise.all([del(VAULT_KEY), del(REPORTS_KEY)]);
  }

  return (
    <VaultContext.Provider
      value={{
        facts,
        reports,
        ready,
        addImport,
        removeFact,
        clearPlatform,
        clearAll,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultState {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside VaultProvider");
  return ctx;
}

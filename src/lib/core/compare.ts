/**
 * Cross-platform knowledge comparison — port of
 * agentkeeper.importers.compare. Greedy best-match over normalized
 * content with a difflib-equivalent ratio. Deterministic for a given
 * fact set; same default threshold (0.82) as the Python lib.
 */

import { normalize, ratio } from "./similarity";
import type { FactType, ImportedFact } from "./types";

export const DEFAULT_SIMILARITY = 0.82;

export interface MatchedPair {
  factA: ImportedFact;
  factB: ImportedFact;
  similarity: number;
}

export interface ScopeComparison {
  scopeA: string;
  scopeB: string;
  onlyInA: ImportedFact[];
  onlyInB: ImportedFact[];
  shared: MatchedPair[];
}

function factsInScope(
  facts: ImportedFact[],
  scope: string,
  includeKinds: string[] | null,
): ImportedFact[] {
  return facts.filter((f) => {
    if (f.metadata.scope !== scope) return false;
    if (includeKinds !== null) {
      const kind = f.metadata.kind;
      return typeof kind === "string" && includeKinds.includes(kind);
    }
    return true;
  });
}

export function compareScopes(
  facts: ImportedFact[],
  scopeA: string,
  scopeB: string,
  similarity: number = DEFAULT_SIMILARITY,
  includeKinds: string[] | null = ["memory_summary"],
): ScopeComparison {
  if (similarity < 0 || similarity > 1) {
    throw new RangeError(`similarity must be in [0, 1], got ${similarity}`);
  }

  const factsA = factsInScope(facts, scopeA, includeKinds);
  const factsB = factsInScope(facts, scopeB, includeKinds);
  const normsA = factsA.map((f) => normalize(f.content));
  const normsB = factsB.map((f) => normalize(f.content));

  const result: ScopeComparison = {
    scopeA,
    scopeB,
    onlyInA: [],
    onlyInB: [],
    shared: [],
  };
  const unmatchedB = new Set(factsB.map((_, j) => j));

  for (let i = 0; i < factsA.length; i++) {
    let bestJ: number | null = null;
    let bestScore = 0;
    for (const j of [...unmatchedB].sort((a, b) => a - b)) {
      if (normsA[i] === normsB[j]) {
        bestJ = j;
        bestScore = 1.0;
        break;
      }
      const score = ratio(normsA[i], normsB[j]);
      if (score > bestScore) {
        bestJ = j;
        bestScore = score;
      }
    }
    if (bestJ !== null && bestScore >= similarity) {
      unmatchedB.delete(bestJ);
      result.shared.push({
        factA: factsA[i],
        factB: factsB[bestJ],
        similarity: bestScore,
      });
    } else {
      result.onlyInA.push(factsA[i]);
    }
  }

  result.onlyInB = [...unmatchedB].sort((a, b) => a - b).map((j) => factsB[j]);
  return result;
}

export type ScopeInventory = Record<string, Partial<Record<FactType, number>>>;

export function scopeInventory(facts: ImportedFact[]): ScopeInventory {
  const inventory: ScopeInventory = {};
  for (const fact of facts) {
    const scope =
      typeof fact.metadata.scope === "string" ? fact.metadata.scope : "unscoped";
    const bucket = (inventory[scope] ??= {});
    bucket[fact.factType] = (bucket[fact.factType] ?? 0) + 1;
  }
  return inventory;
}

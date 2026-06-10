/**
 * Deterministic text matching — parity with agentkeeper.importers.compare.
 *
 * `normalize` mirrors the Python `_normalize` (NFKD accent stripping,
 * casefold, punctuation removal, whitespace collapse). `ratio` is a
 * faithful port of Python's difflib.SequenceMatcher.ratio() — recursive
 * longest-matching-block, 2*M/T — so the 0.82 threshold means the same
 * thing in the browser as it does in the Python lib. No embeddings, no
 * network, reproducible to the byte.
 */

const PUNCT_RE = /[^\p{L}\p{N}\s]/gu;
const WS_RE = /\s+/g;

export function normalize(text: string): string {
  const decomposed = text.normalize("NFKD");
  const stripped = decomposed.replace(/\p{M}/gu, "");
  const noPunct = stripped.toLowerCase().replace(PUNCT_RE, " ");
  return noPunct.replace(WS_RE, " ").trim();
}

interface Match {
  a: number;
  b: number;
  size: number;
}

function longestMatch(
  a: string,
  b: string,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
  b2j: Map<string, number[]>,
): Match {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = new Map<number, number>();

  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>();
    const indices = b2j.get(a[i]) ?? [];
    for (const j of indices) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len.get(j - 1) ?? 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) {
        besti = i - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return { a: besti, b: bestj, size: bestsize };
}

function matchingBlocks(a: string, b: string): Match[] {
  const b2j = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    const ch = b[j];
    const list = b2j.get(ch);
    if (list) list.push(j);
    else b2j.set(ch, [j]);
  }

  const queue: Array<[number, number, number, number]> = [
    [0, a.length, 0, b.length],
  ];
  const blocks: Match[] = [];

  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop() as [
      number,
      number,
      number,
      number,
    ];
    const m = longestMatch(a, b, alo, ahi, blo, bhi, b2j);
    if (m.size > 0) {
      blocks.push(m);
      if (alo < m.a && blo < m.b) queue.push([alo, m.a, blo, m.b]);
      if (m.a + m.size < ahi && m.b + m.size < bhi) {
        queue.push([m.a + m.size, ahi, m.b + m.size, bhi]);
      }
    }
  }
  return blocks;
}

/** difflib.SequenceMatcher(None, a, b).ratio() equivalent. */
export function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1.0;
  const matches = matchingBlocks(a, b).reduce((s, m) => s + m.size, 0);
  return (2.0 * matches) / total;
}

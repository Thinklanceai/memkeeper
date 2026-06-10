/**
 * Core data model — strict mirror of agentkeeper.importers (Python).
 * Content strings, scopes and metadata keys are kept byte-identical so
 * a vault built in the browser stays interoperable with the Python lib.
 */

export type FactType =
  | "DECISION"
  | "PREFERENCE"
  | "CONSTRAINT"
  | "RELATIONSHIP"
  | "TASK_STATE"
  | "TRANSIENT"
  | "IDENTITY"
  | "EVENT"
  | "FACT";

export type MemoryTier = "WORKING" | "EPISODIC" | "SEMANTIC" | "ARCHIVAL";

export type Platform = "chatgpt" | "claude" | "gemini";

export const SCOPE_GLOBAL = "global";

export function platformScope(platform: Platform): string {
  return `platform:${platform}`;
}

export interface FactMetadata {
  source: Platform;
  scope: string;
  imported_at: string;
  kind?: string;
  external_id?: string;
  message_count?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ImportedFact {
  id: string;
  content: string;
  factType: FactType;
  tier: MemoryTier;
  importance: number;
  when: string | null;
  metadata: FactMetadata;
}

export interface ImportReport {
  platform: Platform;
  conversationsParsed: number;
  messagesSeen: number;
  factsCreated: number;
  skipped: number;
  warnings: string[];
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export function utcnowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function epochToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const dt = new Date(value * 1000);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().replace(/\.\d{3}Z$/, "Z");
}

let counter = 0;

export function factId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `fact-${Date.now()}-${counter}`;
}

export function makeFact(
  partial: Omit<ImportedFact, "id" | "tier" | "importance" | "when"> &
    Partial<Pick<ImportedFact, "tier" | "importance" | "when">>,
): ImportedFact {
  return {
    id: factId(),
    tier: "SEMANTIC",
    importance: 0.5,
    when: null,
    ...partial,
  };
}

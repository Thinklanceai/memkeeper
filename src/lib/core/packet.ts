/**
 * Memory packet generator — turns the diff into action.
 * Builds copy-paste prompts that sync facts from one platform's
 * memory to another, in the language of the facts themselves
 * (FR/EN auto-detected). Pure functions, zero side effects, zero
 * network — same on-device promise as the rest of the core.
 */

import type { FactType, ImportedFact, Platform } from "./types";

export type PacketLanguage = "en" | "fr";

export const PLATFORM_NAMES: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

export interface MemoryPage {
  url: string;
  hint: Record<PacketLanguage, string>;
}

/**
 * Where each platform's own memory is managed. We never pretend to
 * delete on their side — we link to the one place that actually can.
 */
export const MEMORY_PAGES: Record<Platform, MemoryPage> = {
  chatgpt: {
    url: "https://chatgpt.com/#settings/Personalization",
    hint: {
      en: "Settings → Personalization → Manage memories",
      fr: "Settings → Personalization → Manage memories",
    },
  },
  claude: {
    url: "https://claude.ai/settings",
    hint: {
      en: "Settings → Memory",
      fr: "Settings → Memory",
    },
  },
  gemini: {
    url: "https://gemini.google.com/saved-info",
    hint: {
      en: "Saved info",
      fr: "Infos enregistrées",
    },
  },
};

const FR_PATTERN =
  /[àâäéèêëîïôöùûüç]|\b(c'est|d'un|d'une|qu'il|qu'elle|n'est|n'a|j'ai|l'utilisateur)\b/i;

const FR_TOKENS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "du",
  "de",
  "et",
  "est",
  "sont",
  "avec",
  "pour",
  "dans",
  "sur",
  "pas",
  "que",
  "qui",
  "mais",
  "plus",
  "son",
  "ses",
  "leur",
  "aux",
  "chez",
  "comme",
  "aussi",
  "toujours",
  "jamais",
  "travaille",
  "utilise",
  "habite",
  "veut",
]);

export function detectLanguage(text: string): PacketLanguage {
  if (FR_PATTERN.test(text)) return "fr";
  const words = text
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(Boolean);
  if (words.length === 0) return "en";
  let hits = 0;
  for (const w of words) {
    if (FR_TOKENS.has(w)) hits += 1;
  }
  return hits / words.length >= 0.18 ? "fr" : "en";
}

export function detectDominantLanguage(facts: ImportedFact[]): PacketLanguage {
  if (facts.length === 0) return "en";
  let fr = 0;
  for (const f of facts) {
    if (detectLanguage(f.content) === "fr") fr += 1;
  }
  return fr / facts.length >= 0.5 ? "fr" : "en";
}

const CATEGORY_ORDER: FactType[] = [
  "IDENTITY",
  "PREFERENCE",
  "CONSTRAINT",
  "RELATIONSHIP",
  "DECISION",
  "TASK_STATE",
  "EVENT",
  "FACT",
  "TRANSIENT",
];

const CATEGORY_LABELS: Record<PacketLanguage, Record<FactType, string>> = {
  en: {
    IDENTITY: "Identity & background",
    PREFERENCE: "Preferences & working style",
    CONSTRAINT: "Rules & constraints",
    RELATIONSHIP: "People & relationships",
    DECISION: "Decisions made",
    TASK_STATE: "Ongoing work",
    EVENT: "Events & history",
    FACT: "Other facts",
    TRANSIENT: "Recent context",
  },
  fr: {
    IDENTITY: "Identité et contexte",
    PREFERENCE: "Préférences et façon de travailler",
    CONSTRAINT: "Règles et contraintes",
    RELATIONSHIP: "Personnes et relations",
    DECISION: "Décisions prises",
    TASK_STATE: "Travaux en cours",
    EVENT: "Événements et historique",
    FACT: "Autres faits",
    TRANSIENT: "Contexte récent",
  },
};

export function buildLinePacket(fact: ImportedFact): string {
  const lang = detectLanguage(fact.content);
  if (lang === "fr") {
    return [
      "Pour ton contexte sur moi, retiens cette information dans ta mémoire :",
      "",
      `« ${fact.content} »`,
      "",
      "Confirme brièvement que c'est noté, puis tiens-en compte dans nos prochains échanges.",
    ].join("\n");
  }
  return [
    "For context about me, please save the following to your memory:",
    "",
    `"${fact.content}"`,
    "",
    "Briefly confirm it's saved, then use this context in our future conversations.",
  ].join("\n");
}

export function buildGroupPacket(
  facts: ImportedFact[],
  source: Platform,
): string {
  const lang = detectDominantLanguage(facts);
  const grouped = new Map<FactType, ImportedFact[]>();
  for (const f of facts) {
    const bucket = grouped.get(f.factType) ?? [];
    bucket.push(f);
    grouped.set(f.factType, bucket);
  }

  const sections: string[] = [];
  for (const type of CATEGORY_ORDER) {
    const items = grouped.get(type);
    if (!items || items.length === 0) continue;
    const lines = items.map((f) => `- ${f.content}`).join("\n");
    sections.push(`${CATEGORY_LABELS[lang][type]}:\n${lines}`);
  }
  const body = sections.join("\n\n");
  const src = PLATFORM_NAMES[source];

  if (lang === "fr") {
    return [
      `Pour ton contexte sur moi : voici ce qu'un autre assistant IA (${src}) a appris au fil de nos conversations. Mémorise ces informations :`,
      "",
      body,
      "",
      "Confirme brièvement que c'est noté, puis tiens-en compte dans nos prochains échanges. Si un point contredit ce que tu sais déjà sur moi, signale-le-moi.",
    ].join("\n");
  }
  return [
    `For context about me: here is what another AI assistant (${src}) has learned across our conversations. Please save the following to memory:`,
    "",
    body,
    "",
    "Briefly confirm it's saved, then use this context going forward. If anything conflicts with what you already know about me, flag it to me.",
  ].join("\n");
}

const DEEP_LINK_MAX_ENCODED = 4000;

/**
 * Deep link that opens the target platform with the packet prefilled.
 * Returns null when the platform has no prompt parameter (Gemini) or
 * when the encoded packet would exceed safe URL length — the modal
 * falls back to copy-only in both cases.
 */
export function deepLink(target: Platform, prompt: string): string | null {
  const encoded = encodeURIComponent(prompt);
  if (encoded.length > DEEP_LINK_MAX_ENCODED) return null;
  switch (target) {
    case "chatgpt":
      return `https://chatgpt.com/?q=${encoded}`;
    case "claude":
      return `https://claude.ai/new?q=${encoded}`;
    case "gemini":
      return null;
  }
}

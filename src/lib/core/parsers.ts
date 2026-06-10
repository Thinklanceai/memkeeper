/**
 * Platform parsers — ports of agentkeeper.importers.{chatgpt,claude,gemini}.
 * Output content strings are byte-identical to the Python lib so vaults
 * stay interoperable. PII is excluded unless includePii is set. All
 * parsing happens in this process — no network, ever.
 */

import {
  type FactMetadata,
  type ImportedFact,
  type ImportReport,
  type Platform,
  ImportError,
  epochToIso,
  makeFact,
  normalizeIso,
  platformScope,
  utcnowIso,
} from "./types";
import { decodeJson, decodeText, findMember, readZip } from "./zip";

const FIRST_MESSAGE_MAX_CHARS = 500;
const PROMPT_MAX_CHARS = 300;

export interface ParseOptions {
  includeMessages?: boolean;
  includePii?: boolean;
  maxConversations?: number;
}

export interface ParseResult {
  facts: ImportedFact[];
  report: ImportReport;
}

function emptyReport(platform: Platform): ImportReport {
  return {
    platform,
    conversationsParsed: 0,
    messagesSeen: 0,
    factsCreated: 0,
    skipped: 0,
    warnings: [],
  };
}

function meta(
  platform: Platform,
  importedAt: string,
  extra: Partial<FactMetadata> = {},
): FactMetadata {
  return {
    source: platform,
    scope: platformScope(platform),
    imported_at: importedAt,
    ...extra,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ------------------------------------------------------------------ */
/* ChatGPT                                                             */
/* ------------------------------------------------------------------ */

function chatgptMessageText(msg: Record<string, unknown>): string {
  const content = msg.content;
  if (!isRecord(content)) return "";
  const parts = content.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join("\n");
}

function chatgptRole(msg: Record<string, unknown>): string {
  const author = msg.author;
  if (isRecord(author) && typeof author.role === "string") return author.role;
  return "";
}

export function parseChatGPT(
  zipData: Uint8Array,
  options: ParseOptions = {},
): ParseResult {
  const unzipped = readZip(zipData);
  const convMember = findMember(unzipped, "conversations.json");
  if (!convMember) {
    throw new ImportError("conversations.json not found in export archive.");
  }
  const decoded = decodeJson(unzipped[convMember], "conversations.json");
  if (!Array.isArray(decoded)) {
    throw new ImportError("conversations.json is not a JSON array.");
  }
  const userMember = findMember(unzipped, "user.json");
  const user = userMember
    ? decodeJson(unzipped[userMember], "user.json")
    : null;

  const report = emptyReport("chatgpt");
  const facts: ImportedFact[] = [];
  const importedAt = utcnowIso();

  if (isRecord(user)) {
    const accountMeta = meta("chatgpt", importedAt, { kind: "account" });
    if (
      options.includePii &&
      typeof user.email === "string" &&
      user.email.length > 0
    ) {
      facts.push(
        makeFact({
          content: `ChatGPT account email: ${user.email}`,
          factType: "IDENTITY",
          importance: 0.85,
          metadata: { ...accountMeta },
        }),
      );
    }
    if (typeof user.chatgpt_plus_user === "boolean") {
      const tierName = user.chatgpt_plus_user ? "Plus" : "Free";
      facts.push(
        makeFact({
          content: `User had a ChatGPT ${tierName} account.`,
          factType: "IDENTITY",
          importance: 0.4,
          metadata: { ...accountMeta },
        }),
      );
    }
  }

  let conversations = decoded.filter(isRecord);
  if (options.maxConversations !== undefined) {
    conversations = conversations.slice(0, options.maxConversations);
  }

  for (const conv of conversations) {
    const mapping = conv.mapping;
    if (!isRecord(mapping)) {
      report.skipped += 1;
      continue;
    }
    const title =
      typeof conv.title === "string" && conv.title ? conv.title : "Untitled";
    const convId = String(conv.id ?? conv.conversation_id ?? "");
    const when = epochToIso(conv.create_time);

    let userMsgs = 0;
    let assistantMsgs = 0;
    let firstUserText: string | null = null;

    for (const node of Object.values(mapping)) {
      if (!isRecord(node)) continue;
      const msg = node.message;
      if (!isRecord(msg)) continue;
      const role = chatgptRole(msg);
      const text = chatgptMessageText(msg);
      if (role === "user" && text) {
        userMsgs += 1;
        if (firstUserText === null) firstUserText = text;
      } else if (role === "assistant" && text) {
        assistantMsgs += 1;
      }
    }

    const total = userMsgs + assistantMsgs;
    report.messagesSeen += total;
    if (total === 0) {
      report.skipped += 1;
      continue;
    }

    facts.push(
      makeFact({
        content:
          `ChatGPT conversation: '${title}' ` +
          `(${total} messages, ${userMsgs} from user)`,
        factType: "EVENT",
        tier: "EPISODIC",
        importance: 0.35,
        when,
        metadata: meta("chatgpt", importedAt, {
          kind: "conversation",
          external_id: convId,
          message_count: total,
        }),
      }),
    );
    if (options.includeMessages && firstUserText) {
      facts.push(
        makeFact({
          content:
            `In ChatGPT conversation '${title}', ` +
            `the user opened with: ${firstUserText.slice(0, FIRST_MESSAGE_MAX_CHARS)}`,
          factType: "FACT",
          tier: "ARCHIVAL",
          importance: 0.3,
          when,
          metadata: meta("chatgpt", importedAt, {
            kind: "first_message",
            external_id: convId,
          }),
        }),
      );
    }
    report.conversationsParsed += 1;
  }

  report.factsCreated = facts.length;
  return { facts, report };
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */

function claudeMessageText(msg: Record<string, unknown>): string {
  if (typeof msg.text === "string" && msg.text.trim()) return msg.text.trim();
  const content = msg.content;
  if (!Array.isArray(content)) return "";
  const chunks: string[] = [];
  for (const block of content) {
    if (
      isRecord(block) &&
      block.type === "text" &&
      typeof block.text === "string" &&
      block.text.trim()
    ) {
      chunks.push(block.text.trim());
    }
  }
  return chunks.join("\n");
}

function decodeClaudeConversations(
  raw: Uint8Array,
  name: string,
): Record<string, unknown>[] {
  if (name.endsWith(".jsonl")) {
    const conversations: Record<string, unknown>[] = [];
    const lines = decodeText(raw).split("\n");
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim();
      if (!stripped) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(stripped);
      } catch (err) {
        throw new ImportError(
          `Invalid JSON on line ${i + 1} of ${name}: ` +
            `${err instanceof Error ? err.message : err}`,
        );
      }
      if (isRecord(obj)) conversations.push(obj);
    }
    return conversations;
  }
  const decoded = decodeJson(raw, name);
  if (!Array.isArray(decoded)) {
    throw new ImportError(`${name} is not a JSON array.`);
  }
  return decoded.filter(isRecord);
}

export function parseClaude(
  zipData: Uint8Array,
  options: ParseOptions = {},
): ParseResult {
  const unzipped = readZip(zipData);
  const convMember =
    findMember(unzipped, "conversations.json") ??
    findMember(unzipped, "conversations.jsonl");
  if (!convMember) {
    throw new ImportError(
      "No conversations.json or conversations.jsonl found in export archive.",
    );
  }
  const convName = convMember.split("/").pop() as string;
  let conversations = decodeClaudeConversations(
    unzipped[convMember],
    convName,
  );

  const report = emptyReport("claude");
  const facts: ImportedFact[] = [];
  const importedAt = utcnowIso();

  const usersMember = findMember(unzipped, "users.json");
  if (options.includePii && usersMember) {
    const decoded = decodeJson(unzipped[usersMember], "users.json");
    const users = Array.isArray(decoded)
      ? decoded.filter(isRecord)
      : isRecord(decoded)
        ? [decoded]
        : [];
    const accountMeta = meta("claude", importedAt, { kind: "account" });
    for (const user of users) {
      if (typeof user.full_name === "string" && user.full_name) {
        facts.push(
          makeFact({
            content: `Claude account holder: ${user.full_name}`,
            factType: "IDENTITY",
            importance: 0.85,
            metadata: { ...accountMeta },
          }),
        );
      }
      if (typeof user.email_address === "string" && user.email_address) {
        facts.push(
          makeFact({
            content: `Claude account email: ${user.email_address}`,
            factType: "IDENTITY",
            importance: 0.85,
            metadata: { ...accountMeta },
          }),
        );
      }
    }
  }

  const projectsMember = findMember(unzipped, "projects.json");
  if (projectsMember) {
    const decoded = decodeJson(unzipped[projectsMember], "projects.json");
    const projects = Array.isArray(decoded) ? decoded.filter(isRecord) : [];
    for (const project of projects) {
      if (typeof project.name !== "string" || !project.name) continue;
      const description =
        typeof project.description === "string" && project.description
          ? ` — ${project.description}`
          : "";
      facts.push(
        makeFact({
          content: `Claude project: '${project.name}'${description}`,
          factType: "FACT",
          importance: 0.5,
          when: normalizeIso(project.created_at),
          metadata: meta("claude", importedAt, {
            kind: "project",
            external_id: String(project.uuid ?? ""),
          }),
        }),
      );
    }
  }

  if (options.maxConversations !== undefined) {
    conversations = conversations.slice(0, options.maxConversations);
  }

  for (const conv of conversations) {
    const messages = conv.chat_messages;
    if (!Array.isArray(messages)) {
      report.skipped += 1;
      continue;
    }
    const title =
      typeof conv.name === "string" && conv.name ? conv.name : "Untitled";
    const convId = String(conv.uuid ?? "");
    const when = normalizeIso(conv.created_at);

    let humanMsgs = 0;
    let assistantMsgs = 0;
    let firstHumanText: string | null = null;

    for (const msg of messages) {
      if (!isRecord(msg)) continue;
      const text = claudeMessageText(msg);
      if (msg.sender === "human" && text) {
        humanMsgs += 1;
        if (firstHumanText === null) firstHumanText = text;
      } else if (msg.sender === "assistant" && text) {
        assistantMsgs += 1;
      }
    }

    const total = humanMsgs + assistantMsgs;
    report.messagesSeen += total;
    if (total === 0) {
      report.skipped += 1;
      continue;
    }

    facts.push(
      makeFact({
        content:
          `Claude conversation: '${title}' ` +
          `(${total} messages, ${humanMsgs} from user)`,
        factType: "EVENT",
        tier: "EPISODIC",
        importance: 0.35,
        when,
        metadata: meta("claude", importedAt, {
          kind: "conversation",
          external_id: convId,
          message_count: total,
        }),
      }),
    );
    if (options.includeMessages && firstHumanText) {
      facts.push(
        makeFact({
          content:
            `In Claude conversation '${title}', ` +
            `the user opened with: ${firstHumanText.slice(0, FIRST_MESSAGE_MAX_CHARS)}`,
          factType: "FACT",
          tier: "ARCHIVAL",
          importance: 0.3,
          when,
          metadata: meta("claude", importedAt, {
            kind: "first_message",
            external_id: convId,
          }),
        }),
      );
    }
    report.conversationsParsed += 1;
  }

  report.factsCreated = facts.length;
  return { facts, report };
}

/* ------------------------------------------------------------------ */
/* Gemini (Google Takeout)                                             */
/* ------------------------------------------------------------------ */

const TITLE_PREFIXES = ["Prompted ", "Asked ", "Said "];
const GEMINI_MARKERS = ["gemini", "bard"];

function stripPrefix(title: string): string {
  for (const prefix of TITLE_PREFIXES) {
    if (title.startsWith(prefix)) return title.slice(prefix.length);
  }
  return title;
}

function isGeminiRecord(record: Record<string, unknown>): boolean {
  if (
    typeof record.header === "string" &&
    GEMINI_MARKERS.some((m) => (record.header as string).toLowerCase().includes(m))
  ) {
    return true;
  }
  if (Array.isArray(record.products)) {
    return record.products.some(
      (p) =>
        typeof p === "string" &&
        GEMINI_MARKERS.some((m) => p.toLowerCase().includes(m)),
    );
  }
  return false;
}

export interface GeminiParseOptions {
  maxActivities?: number;
}

export function parseGemini(
  zipData: Uint8Array,
  options: GeminiParseOptions = {},
): ParseResult {
  const unzipped = readZip(zipData);
  const member = findMember(unzipped, "MyActivity.json", GEMINI_MARKERS);
  if (!member) {
    if (findMember(unzipped, "MyActivity.html")) {
      throw new ImportError(
        "This Takeout archive contains an HTML export. Re-run Google " +
          "Takeout with the JSON format selected for My Activity.",
      );
    }
    throw new ImportError("No MyActivity.json found in Takeout archive.");
  }
  const decoded = decodeJson(unzipped[member], "MyActivity.json");
  if (!Array.isArray(decoded)) {
    throw new ImportError("MyActivity.json is not a JSON array.");
  }

  const report = emptyReport("gemini");
  const facts: ImportedFact[] = [];
  const importedAt = utcnowIso();

  const records = decoded.filter(isRecord);
  let geminiRecords = records.filter(isGeminiRecord);
  report.skipped = records.length - geminiRecords.length;

  if (options.maxActivities !== undefined) {
    geminiRecords = geminiRecords.slice(0, options.maxActivities);
  }

  for (const record of geminiRecords) {
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) {
      report.skipped += 1;
      continue;
    }
    const prompt = stripPrefix(title).slice(0, PROMPT_MAX_CHARS);
    if (!prompt) {
      report.skipped += 1;
      continue;
    }
    facts.push(
      makeFact({
        content: `Gemini prompt: ${prompt}`,
        factType: "EVENT",
        tier: "EPISODIC",
        importance: 0.3,
        when: normalizeIso(record.time),
        metadata: meta("gemini", importedAt, { kind: "activity" }),
      }),
    );
    report.messagesSeen += 1;
  }

  report.conversationsParsed = facts.length;
  report.factsCreated = facts.length;
  return { facts, report };
}

/* ------------------------------------------------------------------ */
/* Memory summary (all platforms)                                      */
/* ------------------------------------------------------------------ */

const PREFERENCE_RE =
  /\b(prefer|prefers|likes?|enjoys?|favou?rite|style|tone|préfère|aime|favori)\b/i;
const IDENTITY_RE =
  /\b(name is|named|works (as|at|in)|lives in|based in|is a|is an|years old|profession|s'appelle|travaille|habite)\b/i;

export function parseMemorySummary(
  text: string,
  platform: Platform,
): ImportedFact[] {
  const importedAt = utcnowIso();
  const facts: ImportedFact[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine
      .trim()
      .replace(/^[-*•·]+\s*/, "")
      .trim();
    if (line.length < 8 || line.endsWith(":")) continue;
    let factType: ImportedFact["factType"] = "FACT";
    let importance = 0.55;
    if (IDENTITY_RE.test(line)) {
      factType = "IDENTITY";
      importance = 0.85;
    } else if (PREFERENCE_RE.test(line)) {
      factType = "PREFERENCE";
      importance = 0.6;
    }
    facts.push(
      makeFact({
        content: line,
        factType,
        importance,
        metadata: meta(platform, importedAt, { kind: "memory_summary" }),
      }),
    );
  }
  return facts;
}

import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  ImportError,
  compareScopes,
  normalize,
  parseChatGPT,
  parseClaude,
  parseGemini,
  parseMemorySummary,
  ratio,
  scopeInventory,
} from "../src/lib/core";

/* ------------------------- fixtures ------------------------------- */

function chatgptConversation(
  id: string,
  title: string,
  createTime: number,
  userTexts: string[],
  assistantTexts: string[],
) {
  const mapping: Record<string, unknown> = {};
  let idx = 0;
  for (const [role, texts] of [
    ["user", userTexts],
    ["assistant", assistantTexts],
  ] as const) {
    for (const text of texts) {
      idx += 1;
      mapping[`node-${idx}`] = {
        id: `node-${idx}`,
        message: {
          author: { role },
          content: { content_type: "text", parts: [text] },
          create_time: createTime + idx,
        },
      };
    }
  }
  return { id, title, create_time: createTime, mapping };
}

function chatgptZip(): Uint8Array {
  const conversations = [
    chatgptConversation(
      "conv-1",
      "Trip to Lisbon",
      1768000000,
      ["Help me plan a trip to Lisbon", "What about food?"],
      ["Sure.", "Try the pastéis."],
    ),
    chatgptConversation(
      "conv-2",
      "Python debugging",
      1769000000,
      ["Why does this raise KeyError?"],
      ["Because the key is missing."],
    ),
    { id: "conv-empty", title: "Empty", mapping: {} },
  ];
  const user = { id: "u-1", email: "tom@example.com", chatgpt_plus_user: true };
  return zipSync({
    "conversations.json": strToU8(JSON.stringify(conversations)),
    "user.json": strToU8(JSON.stringify(user)),
  });
}

function claudeConversation(
  uuid: string,
  name: string,
  createdAt: string,
  humanTexts: string[],
  assistantTexts: string[],
  useContentBlocks = false,
) {
  const messages: Record<string, unknown>[] = [];
  for (const [sender, texts] of [
    ["human", humanTexts],
    ["assistant", assistantTexts],
  ] as const) {
    for (const text of texts) {
      messages.push(
        useContentBlocks
          ? {
              sender,
              text: "",
              content: [{ type: "text", text }],
              created_at: createdAt,
            }
          : { sender, text, created_at: createdAt },
      );
    }
  }
  return { uuid, name, created_at: createdAt, chat_messages: messages };
}

function claudeZip(jsonl = false): Uint8Array {
  const conversations = [
    claudeConversation(
      "c-1",
      "AEGIS roadmap",
      "2026-02-10T09:00:00.000000Z",
      ["Plan the compliance bridge", "And the diff view?"],
      ["Here is the plan.", "Next sprint."],
    ),
    claudeConversation(
      "c-2",
      "Globe rendering",
      "2026-03-05T14:30:00.000000Z",
      ["Why does the globe flicker?"],
      ["Z-fighting."],
      true,
    ),
    { uuid: "c-empty", name: "Empty", chat_messages: [] },
  ];
  const files: Record<string, Uint8Array> = jsonl
    ? {
        "conversations.jsonl": strToU8(
          conversations.map((c) => JSON.stringify(c)).join("\n"),
        ),
      }
    : { "conversations.json": strToU8(JSON.stringify(conversations)) };
  files["users.json"] = strToU8(
    JSON.stringify([
      { uuid: "u-1", full_name: "Tom Anciaux", email_address: "tom@example.com" },
    ]),
  );
  files["projects.json"] = strToU8(
    JSON.stringify([
      {
        uuid: "p-1",
        name: "Circuit Live",
        description: "Touring intelligence",
        created_at: "2026-01-01T00:00:00.000000Z",
      },
    ]),
  );
  return zipSync(files);
}

function geminiZip(): Uint8Array {
  const records = [
    {
      header: "Gemini Apps",
      title: "Prompted how do I center a div",
      time: "2026-02-01T10:00:00.123Z",
      products: ["Gemini Apps"],
    },
    {
      header: "Gemini Apps",
      title: "Prompted plan a weekend in Vienna",
      time: "2026-02-02T18:30:00.000Z",
      products: ["Gemini Apps"],
    },
    {
      header: "YouTube",
      title: "Watched a video about cats",
      time: "2026-02-03T11:00:00Z",
      products: ["YouTube"],
    },
  ];
  return zipSync({
    "Takeout/My Activity/Gemini Apps/MyActivity.json": strToU8(
      JSON.stringify(records),
    ),
    "Takeout/My Activity/Search/MyActivity.json": strToU8(
      JSON.stringify([{ header: "Search", title: "Searched cats" }]),
    ),
  });
}

/* ------------------------- ChatGPT -------------------------------- */

describe("parseChatGPT", () => {
  it("parses conversations with platform scoping", () => {
    const { facts, report } = parseChatGPT(chatgptZip());
    const events = facts.filter((f) => f.factType === "EVENT");
    expect(events).toHaveLength(2);
    expect(report.conversationsParsed).toBe(2);
    expect(report.skipped).toBe(1);
    expect(report.messagesSeen).toBe(6);
    expect(facts.every((f) => f.metadata.scope === "platform:chatgpt")).toBe(
      true,
    );
    expect(events[0].content).toBe(
      "ChatGPT conversation: 'Trip to Lisbon' (4 messages, 2 from user)",
    );
  });

  it("excludes PII by default", () => {
    const { facts } = parseChatGPT(chatgptZip());
    expect(facts.some((f) => f.content.includes("tom@example.com"))).toBe(
      false,
    );
    const withPii = parseChatGPT(chatgptZip(), { includePii: true });
    expect(
      withPii.facts.some((f) => f.content.includes("tom@example.com")),
    ).toBe(true);
  });

  it("keeps the first user message in archival tier when asked", () => {
    const { facts } = parseChatGPT(chatgptZip(), { includeMessages: true });
    const archival = facts.filter((f) => f.tier === "ARCHIVAL");
    expect(archival).toHaveLength(2);
    expect(archival.some((f) => f.content.includes("Lisbon"))).toBe(true);
  });

  it("caps conversations", () => {
    const { facts } = parseChatGPT(chatgptZip(), { maxConversations: 1 });
    expect(facts.filter((f) => f.factType === "EVENT")).toHaveLength(1);
  });

  it("rejects archives without conversations.json", () => {
    const bad = zipSync({ "user.json": strToU8("{}") });
    expect(() => parseChatGPT(bad)).toThrowError(ImportError);
  });

  it("rejects traversal member names", () => {
    const evil = zipSync({
      "conversations.json": strToU8("[]"),
      "../../etc/evil.txt": strToU8("x"),
    });
    expect(() => parseChatGPT(evil)).toThrowError(/Unsafe member path/);
  });
});

/* ------------------------- Claude --------------------------------- */

describe("parseClaude", () => {
  it("parses JSON layout with normalized timestamps", () => {
    const { facts, report } = parseClaude(claudeZip());
    const events = facts.filter((f) => f.factType === "EVENT");
    expect(events).toHaveLength(2);
    expect(report.skipped).toBe(1);
    expect(new Set(events.map((f) => f.when))).toEqual(
      new Set(["2026-02-10T09:00:00Z", "2026-03-05T14:30:00Z"]),
    );
  });

  it("parses JSONL layout", () => {
    const { facts } = parseClaude(claudeZip(true));
    expect(facts.filter((f) => f.factType === "EVENT")).toHaveLength(2);
  });

  it("reads content blocks fallback", () => {
    const { facts } = parseClaude(claudeZip(), { includeMessages: true });
    const archival = facts.filter((f) => f.tier === "ARCHIVAL");
    expect(archival.some((f) => f.content.includes("globe flicker"))).toBe(
      true,
    );
  });

  it("imports projects, excludes PII by default", () => {
    const { facts } = parseClaude(claudeZip());
    const projects = facts.filter((f) => f.metadata.kind === "project");
    expect(projects).toHaveLength(1);
    expect(projects[0].content).toContain("Circuit Live");
    expect(facts.some((f) => f.content.includes("Tom Anciaux"))).toBe(false);
    const withPii = parseClaude(claudeZip(), { includePii: true });
    expect(
      withPii.facts.some((f) => f.content.includes("Tom Anciaux")),
    ).toBe(true);
  });

  it("rejects invalid JSONL lines with line numbers", () => {
    const bad = zipSync({
      "conversations.jsonl": strToU8('{"uuid": "ok"}\n{broken'),
    });
    expect(() => parseClaude(bad)).toThrowError(/line 2/);
  });
});

/* ------------------------- Gemini --------------------------------- */

describe("parseGemini", () => {
  it("parses only Gemini records from a multi-service Takeout", () => {
    const { facts, report } = parseGemini(geminiZip());
    expect(facts).toHaveLength(2);
    expect(report.skipped).toBe(1);
    expect(facts.every((f) => f.metadata.scope === "platform:gemini")).toBe(
      true,
    );
    const vienna = facts.find((f) => f.content.includes("Vienna"));
    expect(vienna?.content).toBe("Gemini prompt: plan a weekend in Vienna");
    expect(vienna?.when).toBe("2026-02-02T18:30:00Z");
  });

  it("rejects HTML exports with an actionable message", () => {
    const html = zipSync({
      "Takeout/My Activity/Gemini Apps/MyActivity.html": strToU8("<html>"),
    });
    expect(() => parseGemini(html)).toThrowError(/JSON format/);
  });

  it("caps activities", () => {
    const { facts } = parseGemini(geminiZip(), { maxActivities: 1 });
    expect(facts).toHaveLength(1);
  });
});

/* ------------------------- summary + compare ----------------------- */

describe("parseMemorySummary + compareScopes", () => {
  const chatgpt = parseMemorySummary(
    [
      "Here is what I remember about you:",
      "- My name is Tom and I work as a developer in Brussels",
      "- Prefers short, direct answers",
      "- Building a touring platform for electronic music",
      "- Likes techno and runs a music archive since 1992",
    ].join("\n"),
    "chatgpt",
  );
  const claude = parseMemorySummary(
    [
      "- My name is Tom and I work as a developer in Brussels",
      "- prefers short direct answers",
      "- Working on an EU AI Act compliance observatory",
    ].join("\n"),
    "claude",
  );
  const all = [...chatgpt, ...claude];

  it("classifies identity, preference and fact lines", () => {
    const types = new Set(chatgpt.map((f) => f.factType));
    expect(types).toContain("IDENTITY");
    expect(types).toContain("PREFERENCE");
    expect(types).toContain("FACT");
    expect(chatgpt.every((f) => f.metadata.kind === "memory_summary")).toBe(
      true,
    );
  });

  it("normalize strips accents, case and punctuation", () => {
    expect(normalize("Préfère des réponses COURTES!")).toBe(
      "prefere des reponses courtes",
    );
    expect(normalize("  a,  b.c ")).toBe("a b c");
  });

  it("ratio matches difflib semantics on edge cases", () => {
    expect(ratio("", "")).toBe(1.0);
    expect(ratio("abc", "abc")).toBe(1.0);
    expect(ratio("abc", "xyz")).toBe(0.0);
    expect(ratio("abcd", "bcde")).toBeCloseTo(0.75, 10);
  });

  it("finds exclusive and shared knowledge deterministically", () => {
    const result = compareScopes(all, "platform:chatgpt", "platform:claude");
    expect(result.shared).toHaveLength(2);
    expect(result.onlyInA.map((f) => f.content).join(" ")).toContain(
      "touring platform",
    );
    expect(result.onlyInB.map((f) => f.content).join(" ")).toContain(
      "compliance observatory",
    );
    const again = compareScopes(all, "platform:chatgpt", "platform:claude");
    expect(JSON.stringify(again)).toBe(JSON.stringify(result));
  });

  it("is symmetric in counts", () => {
    const ab = compareScopes(all, "platform:chatgpt", "platform:claude");
    const ba = compareScopes(all, "platform:claude", "platform:chatgpt");
    expect(ab.shared.length).toBe(ba.shared.length);
    expect(ab.onlyInA.length).toBe(ba.onlyInB.length);
  });

  it("rejects invalid similarity", () => {
    expect(() =>
      compareScopes(all, "platform:chatgpt", "platform:claude", 1.5),
    ).toThrowError(RangeError);
  });

  it("builds the scope inventory", () => {
    const inv = scopeInventory(all);
    expect(Object.keys(inv).sort()).toEqual([
      "platform:chatgpt",
      "platform:claude",
    ]);
    expect(inv["platform:chatgpt"].IDENTITY).toBe(1);
    expect(inv["platform:chatgpt"].PREFERENCE).toBe(2);
  });
});

"use client";

import { useCallback, useRef, useState } from "react";
import {
  type ImportReport,
  type Platform,
  ImportError,
  parseChatGPT,
  parseClaude,
  parseGemini,
  parseMemorySummary,
} from "@/lib/core";
import { useVault } from "@/lib/store/vault";
import { PlatformTag } from "@/components/ui";

const PLATFORMS: Array<{ id: Platform; name: string; hint: string }> = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    hint: "Settings → Data controls → Export data",
  },
  { id: "claude", name: "Claude", hint: "Settings → Privacy → Export data" },
  {
    id: "gemini",
    name: "Gemini",
    hint: "takeout.google.com → My Activity → Gemini apps (JSON format)",
  },
];

type Status =
  | { kind: "idle" }
  | { kind: "parsing"; platform: Platform }
  | { kind: "done"; report: ImportReport }
  | { kind: "error"; message: string };

export default function ImportPage() {
  const { addImport, reports } = useVault();
  const [platform, setPlatform] = useState<Platform>("chatgpt");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [includeMessages, setIncludeMessages] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setStatus({ kind: "parsing", platform });
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const parse =
          platform === "chatgpt"
            ? () => parseChatGPT(data, { includeMessages })
            : platform === "claude"
              ? () => parseClaude(data, { includeMessages })
              : () => parseGemini(data);
        const { facts, report } = parse();
        await addImport(facts, report);
        setStatus({ kind: "done", report });
      } catch (err) {
        setStatus({
          kind: "error",
          message:
            err instanceof ImportError
              ? err.message
              : "Could not read this file. Check it is the unmodified export ZIP.",
        });
      }
    },
    [platform, includeMessages, addImport],
  );

  async function handleSummary() {
    const facts = parseMemorySummary(summaryText, platform);
    if (facts.length === 0) {
      setStatus({
        kind: "error",
        message: "No usable lines found. Paste the bullet list your AI gave you.",
      });
      return;
    }
    const report: ImportReport = {
      platform,
      conversationsParsed: 0,
      messagesSeen: 0,
      factsCreated: facts.length,
      skipped: 0,
      warnings: [],
    };
    const existing = reports.find((r) => r.platform === platform);
    if (existing) {
      report.conversationsParsed = existing.conversationsParsed;
      report.messagesSeen = existing.messagesSeen;
    }
    await addImport(facts, report);
    setStatus({ kind: "done", report });
    setSummaryText("");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-lapis-deep">Import</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        Pick a platform, drop its export ZIP. Parsing runs in this tab —
        watch the network panel stay silent.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              platform === p.id
                ? "border-lapis bg-lapis text-white"
                : "border-line bg-card text-ink hover:border-slate"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-slate">
        {PLATFORMS.find((p) => p.id === platform)?.hint}
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={`mt-5 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-brass bg-[#c9a22710]"
            : "border-line bg-card hover:border-slate"
        }`}
      >
        <p className="font-medium text-ink">
          Drop the export ZIP here, or click to choose
        </p>
        <p className="mt-1 text-xs text-slate">
          Stays on this device. Max 2 GB.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {platform !== "gemini" && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate">
          <input
            type="checkbox"
            checked={includeMessages}
            onChange={(e) => setIncludeMessages(e.target.checked)}
            className="accent-[#233d7b]"
          />
          Also keep the first message of each conversation (more detail,
          larger vault)
        </label>
      )}

      {status.kind === "parsing" && (
        <p className="mt-4 font-mono text-sm text-slate">
          Parsing on this device…
        </p>
      )}
      {status.kind === "done" && (
        <div className="mt-4 rounded-md border border-line bg-card p-4 font-mono text-sm">
          <PlatformTag platform={status.report.platform} />{" "}
          <span className="text-ok">imported</span> —{" "}
          {status.report.factsCreated} facts
          {status.report.conversationsParsed > 0 &&
            ` from ${status.report.conversationsParsed} conversations (${status.report.messagesSeen} messages seen)`}
          {status.report.skipped > 0 && `, ${status.report.skipped} skipped`}
          .{" "}
          <a href="/inventory" className="text-lapis underline">
            View inventory →
          </a>
        </div>
      )}
      {status.kind === "error" && (
        <div className="mt-4 rounded-md border border-warn/40 bg-card p-4 text-sm text-warn">
          {status.message}
        </div>
      )}

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="text-lg font-bold text-ink">
          Or paste a memory summary
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate">
          Ask {PLATFORMS.find((p) => p.id === platform)?.name}: &ldquo;List
          everything you remember about me as bullet points.&rdquo; Paste the
          answer here. This is the knowledge the Compare view works best
          with.
        </p>
        <textarea
          value={summaryText}
          onChange={(e) => setSummaryText(e.target.value)}
          rows={6}
          placeholder={"- My name is …\n- Prefers …\n- Working on …"}
          className="mt-3 w-full rounded-md border border-line bg-card p-3 font-mono text-sm focus:border-lapis focus:outline-none"
        />
        <button
          onClick={() => void handleSummary()}
          disabled={summaryText.trim().length === 0}
          className="mt-2 rounded-md bg-lapis px-4 py-2 text-sm font-medium text-white hover:bg-lapis-deep disabled:opacity-40"
        >
          Add to vault
        </button>
      </section>
    </div>
  );
}

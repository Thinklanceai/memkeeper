"use client";

import { useEffect, useRef, useState } from "react";
import type { Platform } from "@/lib/core";
import { PLATFORM_NAMES, deepLink } from "@/lib/core/packet";

export interface PacketModalProps {
  title: string;
  prompt: string;
  target: Platform;
  onClose: () => void;
}

/**
 * Displays a generated memory packet. The prompt only ever renders
 * through a readOnly textarea and React text nodes — fact content is
 * user-imported data and must never reach the DOM as HTML.
 */
export function PacketModal({
  title,
  prompt,
  target,
  onClose,
}: PacketModalProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.select();
        document.execCommand("copy");
        setCopied(true);
      }
    }
  }

  const link = deepLink(target, prompt);
  const name = PLATFORM_NAMES[target];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-line bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 font-mono text-sm text-slate hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <textarea
          ref={textareaRef}
          readOnly
          value={prompt}
          rows={12}
          className="mt-3 w-full resize-y rounded-md border border-line bg-white p-3 font-mono text-xs leading-relaxed text-ink focus:border-lapis focus:outline-none"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-[#233d7b] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {copied ? "Copied ✓" : "Copy packet"}
          </button>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-line bg-card px-4 py-2 text-sm font-medium text-lapis hover:bg-black/5"
            >
              Open in {name} →
            </a>
          )}
          <p className="ml-auto font-mono text-[0.6875rem] text-slate">
            Paste into {name} to sync this memory.
          </p>
        </div>
      </div>
    </div>
  );
}

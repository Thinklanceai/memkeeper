import Link from "next/link";

export default function Home() {
  return (
    <div className="py-8">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-brass">
        Your AI memory, in your hands
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-lapis-deep sm:text-5xl">
        Every AI remembers things about you.
        <br />
        None of them show you what.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        MemKeeper reads the official data exports of ChatGPT, Claude and
        Gemini — entirely in your browser — and shows you what each one
        knows about you that the others don&apos;t.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/import"
          className="rounded-md bg-lapis px-5 py-2.5 font-medium text-white hover:bg-lapis-deep"
        >
          Import your first export
        </Link>
        <span className="text-sm text-slate">
          No account. No upload. Verify it yourself: DevTools → Network.
        </span>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "Export",
            body: "Request your data from ChatGPT, Claude, or Google Takeout. Each platform emails you a ZIP.",
          },
          {
            step: "Import",
            body: "Drop the ZIP here. Parsing runs on this device — the file never crosses the network.",
          },
          {
            step: "Compare",
            body: "See the full inventory, then diff platforms: what does ChatGPT know that Claude doesn't?",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-lg border border-line bg-card p-5"
          >
            <h2 className="font-display text-base font-bold text-ink">
              {item.step}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

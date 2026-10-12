import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";

const capabilities = [
  {
    label: "HTTP",
    detail: "Build requests, inspect responses, keep history by URL.",
  },
  {
    label: "SSE",
    detail: "Watch event streams as they arrive, without leaving the workspace.",
  },
  {
    label: "WebSocket",
    detail: "Connect, send frames, and read the conversation in one place.",
  },
] as const;

export default function WaitlistPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,oklch(0.93_0.03_195),transparent_48%),radial-gradient(ellipse_at_95%_10%,oklch(0.95_0.02_85),transparent_40%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:linear-gradient(to_right,oklch(0.7_0_0/0.05)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.7_0_0/0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 sm:px-8">
        <header className="flex items-center pt-7 sm:pt-9">
          <Link
            href="/"
            className="font-mono text-[13px] tracking-[0.28em] text-foreground uppercase"
          >
            Reqyx
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              <span className="mr-2 inline-block size-1.5 rounded-full bg-brand align-middle" />
              Private beta
            </p>

            <h1 className="mt-5 text-[2.35rem] leading-[1.08] font-medium tracking-[-0.035em] text-balance sm:text-5xl sm:leading-[1.05]">
              API testing that stays out of your way.
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Reqyx is a quiet workspace for HTTP, SSE, and WebSockets — with
              local execution through the browser extension, so localhost just
              works.
            </p>

            <div className="mt-9 max-w-lg">
              <WaitlistForm />
            </div>
          </div>

          <div
            aria-hidden
            className="mt-14 max-w-2xl overflow-hidden rounded-xl border border-border/70 bg-card/70 shadow-[0_1px_0_oklch(0_0_0/0.03)] backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
              <span className="size-2 rounded-full bg-border" />
              <span className="size-2 rounded-full bg-border" />
              <span className="size-2 rounded-full bg-border" />
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                request · untitled
              </span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-3 font-mono text-[12px] sm:text-[13px]">
              <span className="rounded-md bg-method-get/15 px-2 py-0.5 font-medium text-method-get-fg">
                GET
              </span>
              <span className="truncate text-foreground/80">
                https://api.example.com/v1/health
              </span>
              <span className="ml-auto hidden rounded-md bg-status-success/15 px-2 py-0.5 text-status-success-fg sm:inline">
                200 · 48ms
              </span>
            </div>
          </div>

          <ul className="mt-16 grid gap-0 border-t border-border/70 sm:grid-cols-3">
            {capabilities.map((item) => (
              <li
                key={item.label}
                className="border-b border-border/70 py-6 sm:border-r sm:border-b-0 sm:px-6 sm:py-7 first:sm:pl-0 last:sm:border-r-0 last:sm:pr-0"
              >
                <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-foreground/85">
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </main>

        <footer className="flex flex-col gap-2 border-t border-border/60 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Reqyx</p>
          <p className="font-mono tracking-wide">waitlist · early access</p>
        </footer>
      </div>
    </div>
  );
}

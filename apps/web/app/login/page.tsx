import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Spinner } from "@repo/ui/components/spinner";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,oklch(0.93_0.04_195),transparent_50%),radial-gradient(ellipse_at_90%_80%,oklch(0.95_0.025_85),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,oklch(0.7_0_0/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.7_0_0/0.06)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link
            href="/login"
            className="font-mono text-sm tracking-[0.28em] text-foreground uppercase"
          >
            Reqyx
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-medium tracking-tight text-balance">
              Sign in to your workspace
            </h1>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
              Request history, collections, and environments sync to your
              account — open any request by URL.
            </p>
          </div>
        </div>
        <div className="w-full rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            }
          >
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

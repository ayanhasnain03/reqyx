"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@/lib/utils";

type WaitlistFormProps = {
  className?: string;
};

type JoinResponse = {
  ok?: boolean;
  alreadyJoined?: boolean;
  error?: string;
};

export function WaitlistForm({ className }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"joined" | "existing" | null>(null);

  if (done) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/80 bg-card/90 px-5 py-4",
          className,
        )}
        role="status"
      >
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {done === "existing" ? "Already on the list" : "You're in"}
        </p>
        <p className="mt-2 text-sm text-foreground/90">
          {done === "existing"
            ? "That email is already on the waitlist. We'll write when a spot opens."
            : "Thanks — we'll email you when Reqyx opens for early access."}
        </p>
      </div>
    );
  }

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        try {
          const response = await fetch("/api/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, source: "landing" }),
          });
          const data = (await response.json()) as JoinResponse;

          if (!response.ok) {
            setError(data.error ?? "Something went wrong. Try again.");
            return;
          }

          setDone(data.alreadyJoined ? "existing" : "joined");
          setEmail("");
        } catch {
          setError("Could not reach the server. Try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          aria-invalid={error ? true : undefined}
          disabled={pending}
          className="h-11 flex-1 rounded-lg border-border/80 bg-card px-3.5 text-sm shadow-none"
        />
        <Button
          type="submit"
          size="lg"
          disabled={pending || email.trim().length === 0}
          className="h-11 rounded-lg px-5 text-sm"
        >
          {pending ? "Joining…" : "Join waitlist"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-2.5 text-xs text-muted-foreground">
          No spam. One email when access opens.
        </p>
      )}
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "login" | "signup";

function safeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/r/new";
  }
  return value;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === "signup") {
        const result = await signUp.email({
          name: name.trim() || email.split("@")[0] || "User",
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Could not create account");
          return;
        }
      } else {
        const result = await signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Invalid email or password");
          return;
        }
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  const altHref =
    mode === "login"
      ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="w-full max-w-sm">
      <FieldGroup>
        {mode === "signup" ? (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Ada Lovelace"
            />
          </Field>
        ) : null}

        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            aria-invalid={!!error || undefined}
            placeholder="you@example.com"
          />
        </Field>

        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            aria-invalid={!!error || undefined}
            placeholder="At least 8 characters"
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>

        <Button
          type="submit"
          className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={pending}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>

        <FieldDescription className="text-center">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link
                href={altHref}
                className="text-foreground underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href={altHref}
                className="text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </>
          )}
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

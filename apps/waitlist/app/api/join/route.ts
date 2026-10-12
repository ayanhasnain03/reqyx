import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { waitlist } from "@/server/db/schema";

export const dynamic = "force-dynamic";

const joinSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(320),
  source: z.string().trim().max(64).optional(),
});

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email" },
      { status: 400 },
    );
  }

  const email = parsed.data.email;

  const existing = await db.query.waitlist.findFirst({
    where: eq(waitlist.email, email),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, alreadyJoined: true });
  }

  try {
    await db.insert(waitlist).values({
      id: createId(),
      email,
      source: parsed.data.source ?? "landing",
      userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not join the waitlist. Try again in a moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, alreadyJoined: false });
}

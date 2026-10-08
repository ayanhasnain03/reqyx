import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createId, emptyKeyValue } from "@repo/core";
import { environments, userSettings } from "../../db/schema";
import type { TRPCContext } from "../context";
import { createTRPCRouter, protectedProcedure } from "../init";

const keyValueSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
});

const upsertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  variables: z.array(keyValueSchema),
});

async function ensureDefaultEnvironment(userId: string, db: TRPCContext["db"]) {
  const rows = await db
    .select()
    .from(environments)
    .where(eq(environments.userId, userId))
    .orderBy(asc(environments.createdAt));

  if (rows.length > 0) return rows;

  const id = createId();
  const now = new Date();
  const seeded = {
    id,
    userId,
    name: "Local",
    variables: [
      emptyKeyValue({ key: "baseUrl", value: "http://localhost:8080" }),
      emptyKeyValue({ key: "token", value: "" }),
    ],
    updatedAt: now,
    createdAt: now,
  };

  await db.insert(environments).values(seeded);

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!settings) {
    await db.insert(userSettings).values({
      userId,
      activeEnvironmentId: id,
      updatedAt: now,
    });
  } else if (!settings.activeEnvironmentId) {
    await db
      .update(userSettings)
      .set({ activeEnvironmentId: id, updatedAt: now })
      .where(eq(userSettings.userId, userId));
  }

  return [seeded];
}

export const environmentsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ensureDefaultEnvironment(ctx.user.id, ctx.db);

    const [settings] = await ctx.db
      .select({ activeEnvironmentId: userSettings.activeEnvironmentId })
      .from(userSettings)
      .where(eq(userSettings.userId, ctx.user.id))
      .limit(1);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      variables: row.variables,
    }));

    const activeEnvironmentId =
      settings?.activeEnvironmentId &&
      items.some((item) => item.id === settings.activeEnvironmentId)
        ? settings.activeEnvironmentId
        : (items[0]?.id ?? null);

    return { items, activeEnvironmentId };
  }),

  upsert: protectedProcedure
    .input(upsertSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ userId: environments.userId })
        .from(environments)
        .where(eq(environments.id, input.id))
        .limit(1);

      if (existing && existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Environment belongs to another user",
        });
      }

      const now = new Date();

      await ctx.db
        .insert(environments)
        .values({
          id: input.id,
          userId: ctx.user.id,
          name: input.name,
          variables: input.variables,
          updatedAt: now,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: environments.id,
          set: {
            name: input.name,
            variables: input.variables,
            updatedAt: now,
          },
          setWhere: eq(environments.userId, ctx.user.id),
        });

      return { id: input.id };
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [owned] = await ctx.db
          .select({ id: environments.id })
          .from(environments)
          .where(
            and(
              eq(environments.id, input.id),
              eq(environments.userId, ctx.user.id),
            ),
          )
          .limit(1);

        if (!owned) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Environment not found",
          });
        }
      }

      const now = new Date();
      await ctx.db
        .insert(userSettings)
        .values({
          userId: ctx.user.id,
          activeEnvironmentId: input.id,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: {
            activeEnvironmentId: input.id,
            updatedAt: now,
          },
        });

      return { id: input.id };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(environments)
        .where(
          and(
            eq(environments.id, input.id),
            eq(environments.userId, ctx.user.id),
          ),
        );

      const [settings] = await ctx.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, ctx.user.id))
        .limit(1);

      if (settings?.activeEnvironmentId === input.id) {
        await ctx.db
          .update(userSettings)
          .set({ activeEnvironmentId: null, updatedAt: new Date() })
          .where(eq(userSettings.userId, ctx.user.id));
      }

      return { ok: true as const };
    }),
});

import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AUTH_TYPES, BODY_MODES, HTTP_METHODS, REQUEST_KINDS } from "@repo/core";
import { emptyAuth } from "@repo/core";
import { requestHistory } from "../../db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

const keyValueSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
});

const authSchema = z.object({
  type: z.enum(AUTH_TYPES),
  token: z.string(),
  username: z.string(),
  password: z.string(),
  key: z.string(),
  value: z.string(),
  addTo: z.enum(["header", "query"]),
});

const upsertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(REQUEST_KINDS),
  method: z.enum(HTTP_METHODS),
  url: z.string().min(1),
  params: z.array(keyValueSchema),
  headers: z.array(keyValueSchema),
  body: z.string(),
  bodyMode: z.enum(BODY_MODES),
  auth: authSchema,
  statusCode: z.number().int().nullable().optional(),
  updatedAt: z.number().int(),
});

function mapRow(row: typeof requestHistory.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind as (typeof REQUEST_KINDS)[number]) || "http",
    method: row.method as (typeof HTTP_METHODS)[number],
    url: row.url,
    params: row.params,
    headers: row.headers,
    body: row.body,
    bodyMode: (row.bodyMode as (typeof BODY_MODES)[number]) || "raw",
    auth: row.auth ?? emptyAuth(),
    statusCode: row.statusCode,
    updatedAt: row.updatedAt.getTime(),
  };
}

export const historyRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(requestHistory)
      .where(eq(requestHistory.userId, ctx.user.id))
      .orderBy(desc(requestHistory.updatedAt))
      .limit(80);

    return rows.map(mapRow);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(requestHistory)
        .where(
          and(
            eq(requestHistory.id, input.id),
            eq(requestHistory.userId, ctx.user.id),
          ),
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      return mapRow(row);
    }),

  upsert: protectedProcedure
    .input(upsertSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ userId: requestHistory.userId })
        .from(requestHistory)
        .where(eq(requestHistory.id, input.id))
        .limit(1);

      if (existing && existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Request belongs to another user",
        });
      }

      const updatedAt = new Date(input.updatedAt);

      await ctx.db
        .insert(requestHistory)
        .values({
          id: input.id,
          userId: ctx.user.id,
          name: input.name,
          kind: input.kind,
          method: input.method,
          url: input.url,
          params: input.params,
          headers: input.headers,
          body: input.body,
          bodyMode: input.bodyMode,
          auth: input.auth,
          statusCode: input.statusCode ?? null,
          updatedAt,
          createdAt: updatedAt,
        })
        .onConflictDoUpdate({
          target: requestHistory.id,
          set: {
            name: input.name,
            kind: input.kind,
            method: input.method,
            url: input.url,
            params: input.params,
            headers: input.headers,
            body: input.body,
            bodyMode: input.bodyMode,
            auth: input.auth,
            statusCode: input.statusCode ?? null,
            updatedAt,
          },
          setWhere: eq(requestHistory.userId, ctx.user.id),
        });

      return { id: input.id };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(requestHistory)
        .where(
          and(
            eq(requestHistory.id, input.id),
            eq(requestHistory.userId, ctx.user.id),
          ),
        );

      return { ok: true as const };
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(requestHistory)
      .where(eq(requestHistory.userId, ctx.user.id));

    return { ok: true as const };
  }),
});

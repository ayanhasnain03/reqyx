import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  BODY_MODES,
  HTTP_METHODS,
  REQUEST_KINDS,
  emptyAuth,
  type CollectionItem,
} from "@repo/core";
import {
  collections,
  type CollectionTreeItem,
} from "../../db/schema";
import { requestHistory } from "../../db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  collectRequestIds,
  itemsFromLegacyRequestIds,
} from "@/lib/collections";

const folderSchema: z.ZodType<CollectionItem> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("folder"),
      id: z.string().min(1),
      name: z.string().min(1),
      children: z.array(folderSchema),
    }),
    z.object({
      type: z.literal("request"),
      id: z.string().min(1),
      requestId: z.string().min(1),
    }),
  ]),
);

const upsertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  items: z.array(folderSchema),
  updatedAt: z.number().int(),
});

function normalizeItems(raw: unknown): CollectionTreeItem[] {
  if (!Array.isArray(raw)) return [];

  
  if (raw.length > 0 && typeof raw[0] === "string") {
    return itemsFromLegacyRequestIds(raw as string[]);
  }

  return raw as CollectionTreeItem[];
}

export const collectionsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(collections)
      .where(eq(collections.userId, ctx.user.id))
      .orderBy(desc(collections.updatedAt));

    const normalized = rows.map((row) => {
      const items = normalizeItems(row.items);
      return { ...row, items };
    });

    const allIds = [
      ...new Set(normalized.flatMap((row) => collectRequestIds(row.items))),
    ];
    const requestRows =
      allIds.length === 0
        ? []
        : await ctx.db
            .select()
            .from(requestHistory)
            .where(
              and(
                eq(requestHistory.userId, ctx.user.id),
                inArray(requestHistory.id, allIds),
              ),
            );

    const byId = new Map(
      requestRows.map((row) => [
        row.id,
        {
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
          updatedAt: row.updatedAt.getTime(),
        },
      ]),
    );

    return normalized.map((row) => ({
      id: row.id,
      name: row.name,
      items: row.items,
      requests: collectRequestIds(row.items)
        .map((id) => byId.get(id))
        .filter((item): item is NonNullable<typeof item> => !!item),
      updatedAt: row.updatedAt.getTime(),
    }));
  }),

  upsert: protectedProcedure
    .input(upsertSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ userId: collections.userId })
        .from(collections)
        .where(eq(collections.id, input.id))
        .limit(1);

      if (existing && existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Collection belongs to another user",
        });
      }

      const updatedAt = new Date(input.updatedAt);

      await ctx.db
        .insert(collections)
        .values({
          id: input.id,
          userId: ctx.user.id,
          name: input.name,
          items: input.items,
          updatedAt,
          createdAt: updatedAt,
        })
        .onConflictDoUpdate({
          target: collections.id,
          set: {
            name: input.name,
            items: input.items,
            updatedAt,
          },
          setWhere: eq(collections.userId, ctx.user.id),
        });

      return { id: input.id };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(collections)
        .where(
          and(
            eq(collections.id, input.id),
            eq(collections.userId, ctx.user.id),
          ),
        );

      return { ok: true as const };
    }),
});

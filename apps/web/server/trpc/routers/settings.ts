import { eq } from "drizzle-orm";
import { z } from "zod";
import { userSettings } from "../../db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

const defaults = {
  autoSaveHistory: false,
  saveRequestBody: true,
  saveResponseMeta: true,
  activeEnvironmentId: null as string | null,
};

export const settingsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, ctx.user.id))
      .limit(1);

    if (!row) {
      return defaults;
    }

    return {
      autoSaveHistory: row.autoSaveHistory,
      saveRequestBody: row.saveRequestBody,
      saveResponseMeta: row.saveResponseMeta,
      activeEnvironmentId: row.activeEnvironmentId,
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        autoSaveHistory: z.boolean().optional(),
        saveRequestBody: z.boolean().optional(),
        saveResponseMeta: z.boolean().optional(),
        activeEnvironmentId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, ctx.user.id))
        .limit(1);

      const next = {
        autoSaveHistory:
          input.autoSaveHistory ??
          existing?.autoSaveHistory ??
          defaults.autoSaveHistory,
        saveRequestBody:
          input.saveRequestBody ??
          existing?.saveRequestBody ??
          defaults.saveRequestBody,
        saveResponseMeta:
          input.saveResponseMeta ??
          existing?.saveResponseMeta ??
          defaults.saveResponseMeta,
        activeEnvironmentId:
          input.activeEnvironmentId !== undefined
            ? input.activeEnvironmentId
            : (existing?.activeEnvironmentId ?? defaults.activeEnvironmentId),
        updatedAt: new Date(),
      };

      await ctx.db
        .insert(userSettings)
        .values({
          userId: ctx.user.id,
          ...next,
        })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: next,
        });

      return {
        autoSaveHistory: next.autoSaveHistory,
        saveRequestBody: next.saveRequestBody,
        saveResponseMeta: next.saveResponseMeta,
        activeEnvironmentId: next.activeEnvironmentId,
      };
    }),
});

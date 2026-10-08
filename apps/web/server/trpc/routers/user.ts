import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const userRouter = createTRPCRouter({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }

    return {
      id: ctx.session.user.id,
      name: ctx.session.user.name,
      email: ctx.session.user.email,
      image: ctx.session.user.image,
    };
  }),

  session: protectedProcedure.query(({ ctx }) => ctx.session),
});

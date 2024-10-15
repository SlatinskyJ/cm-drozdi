import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const eventRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        start: z.coerce.date().optional(),
        end: z.coerce.date().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        description: z.string().optional(),
        isPrivate: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.event.create({
        data: input,
      });
    }),
});

import { z } from "zod";
import { EventState } from "~/enums/EventState";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const eventRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        id: z.string().cuid().optional(),
        name: z.string(),
        start: z.coerce.date().optional(),
        end: z.coerce.date().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        description: z.string().optional(),
        isPrivate: z.boolean(),
        location: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;

      return ctx.db.event.upsert({
        where: {
          id: id ?? "",
        },
        update: { ...data },
        create: { ...data },
      });
    }),

  getUpcoming: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.event.findMany({
      where: {
        OR: [
          {
            start: {
              gte: new Date(),
            },
          },
          { start: null },
        ],
      },
      orderBy: {
        start: "asc",
      },
    });
  }),

  getForCalendar: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.event.findMany({
      select: {
        name: true,
        start: true,
        isPrivate: true,
        location: true,
      },
      where: {
        state: {
          not: EventState.CANCELED,
        },
        start: { not: null },
      },
    });
  }),

  changeState: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        state: z.nativeEnum(EventState),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.event.update({
        where: {
          id: input.id,
        },
        data: {
          state: input.state,
        },
      });
    }),
});

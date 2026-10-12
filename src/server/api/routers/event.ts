import { z } from 'zod';
import { EventState } from '~/enums/EventState';
import {
	adminProcedure,
	createTRPCRouter,
	memberProcedure,
	publicProcedure,
} from '~/server/api/trpc';

/**
 * Fields of an event that can be set through the event form. `state` is not
 * one of them: a new event always starts as PROPOSED (the column default) and
 * only changes through `changeState`.
 */
const eventFields = z.object({
	name: z.string(),
	start: z.coerce.date().optional(),
	end: z.coerce.date().optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	description: z.string().optional(),
	isPrivate: z.boolean(),
	location: z.string().optional(),
});

export const eventRouter = createTRPCRouter({
	/**
	 * Public "request an event" form. Always creates a new event — it takes no
	 * id, so it can never overwrite an existing one — and returns only the new
	 * id, not the stored row.
	 */
	create: publicProcedure
		.input(eventFields)
		.mutation(async ({ ctx, input }) => {
			const { id } = await ctx.db.event.create({
				data: input,
				select: { id: true },
			});
			return { id };
		}),

	/** Edits an existing event. Members and admins, as in the `/events` UI. */
	update: memberProcedure
		.input(eventFields.extend({ id: z.string().cuid() }))
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			await ctx.db.event.update({
				where: { id },
				data,
				select: { id: true },
			});
			return { id };
		}),

	getUpcoming: memberProcedure.query(({ ctx }) => {
		return ctx.db.event.findMany({
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
				start: 'asc',
			},
		});
	}),

	getForCalendar: publicProcedure.query(({ ctx }) => {
		return ctx.db.event.findMany({
			select: {
				name: true,
				start: true,
				isPrivate: true,
				location: true,
			},
			where: {
				AND: {
					state: {
						not: EventState.CANCELED,
					},
					start: { not: null },
				},
			},
		});
	}),

	changeState: memberProcedure
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

	/** Admin-only, as in the UI (`DeleteEvent` renders only for admins). */
	deleteById: adminProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(({ ctx, input }) => {
			return ctx.db.event.delete({
				where: {
					id: input.id,
				},
			});
		}),
});

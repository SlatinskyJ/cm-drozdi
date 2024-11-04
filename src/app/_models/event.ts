import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '~/server/api/root';

type RouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

export type TCreateEvent = RouterInput['event']['create'];
export type TEvent = RouterOutput['event']['getUpcoming'][0];
export type TCalendarEvent = RouterOutput['event']['getForCalendar'][0];

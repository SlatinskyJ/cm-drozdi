'use client';
import { Badge } from '@components/ui/badge';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Separator } from '@components/ui/separator';
import { Tooltip } from '@components/ui/tooltip';
import { useState } from 'react';
import { type TEvent } from '~/app/_models/event';
import EventValues from '~/app/events/_components/EventValues';
import formatEventState from '~/app/events/_utils/formatEventState';
import { EventDetailModal } from './EventDetailModal';

export default function Event({ event }: Readonly<{ event: TEvent }>) {
	const [isOpen, setIsOpen] = useState(false);

	const stateData = formatEventState(event.state);

	return (
		<>
			<Card
				className="w-[265px] cursor-pointer bg-green-400"
				onClick={() => setIsOpen(true)}
			>
				<CardHeader className="flex flex-row items-center">
					<Tooltip content={event.name} delay={500} size="xl">
						<span className="truncate text-xl">{event.name}</span>
					</Tooltip>
					<div className="grow" />
					<Badge variant={stateData.color}>{stateData.label}</Badge>
				</CardHeader>
				<Separator />
				<CardContent>
					<EventValues event={event} withHover />
				</CardContent>
			</Card>
			<EventDetailModal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				event={event}
				state={stateData}
			/>
		</>
	);
}

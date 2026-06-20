import KeyValue from '@components/KeyValue';
import { type TEvent } from '~/app/_models/event';
import { formatDateToTime, formatDuration } from '~/utils/date';

export default function EventValues({
	event,
	withHover,
}: Readonly<{
	event: TEvent;
	withHover?: boolean;
}>) {
	const duration =
		!!event.start && !!event.end
			? formatDuration(event.start, event.end)
			: null;

	return (
		<>
			<KeyValue
				label="Soukromá"
				value={event.isPrivate ? 'Ano' : 'Ne'}
				withHover={withHover}
			/>
			<KeyValue
				label="Datum"
				value={event.start?.toLocaleDateString('cs-CZ')}
				withHover={withHover}
			/>
			<KeyValue
				label="Čas"
				value={!!event.start ? formatDateToTime(event.start) : null}
				withHover={withHover}
			/>
			<KeyValue label="Délka" value={duration} withHover={withHover} />
			<KeyValue
				label="Lokace"
				value={event.location}
				withHover={withHover}
			/>
			<KeyValue
				label="Popis"
				value={event.description}
				withHover={withHover}
			/>
		</>
	);
}

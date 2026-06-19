import { type BadgeProps } from '@components/ui/badge';
import { EventState } from '~/enums/EventState';

export type TFormatEventStateReturn = {
	label: string;
	color: BadgeProps['variant'];
	value: EventState;
};

export default function formatEventState(
	state: EventState,
): TFormatEventStateReturn {
	switch (state) {
		case EventState.PROPOSED:
			return { label: 'Návrh', color: 'default', value: state };
		case EventState.PENDING:
			return { label: 'Nerozhodnuto', color: 'warning', value: state };
		case EventState.CONFIRMED:
			return { label: 'Potvrzeno', color: 'success', value: state };
		case EventState.CANCELED:
			return { label: 'Zrušeno', color: 'destructive', value: state };
		default:
			return { label: 'Neznámý', color: 'unknown', value: state };
	}
}

import { type ChipProps } from '@components/ui/Chip';
import { EventState } from '~/enums/EventState';

export type TFormatEventStateReturn = {
	label: string;
	color: ChipProps['color'];
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
			return { label: 'Zrušeno', color: 'danger', value: state };
		default:
			return { label: 'Neznámý', color: 'unknown', value: state };
	}
}

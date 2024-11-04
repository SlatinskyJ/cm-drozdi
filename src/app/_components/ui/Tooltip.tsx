'use client';
//extendVariants on server side throws error

import { extendVariants } from '@nextui-org/system';
import { Tooltip as NextTooltip } from '@nextui-org/tooltip';

export const Tooltip = extendVariants(NextTooltip, {
	variants: {
		size: {
			xl: {
				content: ['text-2xl'],
			},
		},
	},
});

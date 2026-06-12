'use client';
import { Button as NextButton } from '@nextui-org/button';
import { extendVariants } from '@nextui-org/system';

export const Button = extendVariants(NextButton, {
	variants: {
		color: {
			primary: 'text-white',
		},
		size: {
			xl: 'p-8 text-xl font-semibold',
		},
	},
});

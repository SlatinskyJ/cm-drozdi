'use client';
import { TooltipProvider } from '@components/ui/tooltip';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { type ReactNode } from 'react';
import { TRPCReactProvider } from '~/trpc/react';

export default function Providers({ children }: { children: ReactNode }) {
	return (
		<div className="h-full">
			<TooltipProvider delayDuration={500}>
				<TRPCReactProvider>
					{children}
					<SpeedInsights />
				</TRPCReactProvider>
			</TooltipProvider>
		</div>
	);
}

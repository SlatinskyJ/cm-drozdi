'use client';
import { Button } from '@components/ui/button';
import { Calendar } from '@components/ui/calendar';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@components/ui/popover';
import { Switch } from '@components/ui/switch';
import { Textarea } from '@components/ui/textarea';
import {
	addHours,
	format,
	getHours,
	getMinutes,
	isBefore,
	set,
	startOfDay,
	startOfHour,
	startOfMinute,
} from 'date-fns';
import { cs } from 'date-fns/locale';
import React from 'react';
import { type Control, Controller } from 'react-hook-form';
import {
	DURATION_PATTERN,
	type TEventInputs,
} from '~/app/events/_utils/useEventForm';
import { cn } from '~/lib/utils';

const TIME_PATTERN = /^(\d{2}):(\d{2})/;

function StartDateTimeField({
	id,
	labelId,
	value,
	onChange,
}: Readonly<{
	id: string;
	labelId: string;
	value?: Date;
	onChange: (date: Date) => void;
}>) {
	function handleDateSelect(date: Date | undefined) {
		if (!date) return;
		// Keep the chosen time; on the first pick default to the next full hour.
		const time = value ?? startOfHour(addHours(new Date(), 1));
		onChange(
			set(date, {
				hours: getHours(time),
				minutes: getMinutes(time),
				seconds: 0,
				milliseconds: 0,
			}),
		);
	}

	function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
		const match = TIME_PATTERN.exec(e.target.value);
		if (!value || !match) return;
		onChange(
			set(value, {
				hours: Number(match[1]),
				minutes: Number(match[2]),
				seconds: 0,
				milliseconds: 0,
			}),
		);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					aria-labelledby={`${labelId} ${id}`}
					className={cn(
						'w-full justify-start font-normal',
						!value && 'text-muted-foreground',
					)}
				>
					{value
						? format(value, 'd. M. yyyy HH:mm', { locale: cs })
						: 'Vyberte datum'}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-auto space-y-2 p-3"
				aria-label="Výběr data a času"
			>
				<Calendar
					mode="single"
					required
					selected={value}
					defaultMonth={value}
					onSelect={handleDateSelect}
					disabled={{ before: startOfDay(new Date()) }}
				/>
				<Input
					type="time"
					aria-label="Čas"
					value={value ? format(value, 'HH:mm') : ''}
					onChange={handleTimeChange}
					disabled={!value}
				/>
			</PopoverContent>
		</Popover>
	);
}

export function EventForm({
	control,
}: Readonly<{ control: Control<TEventInputs> }>) {
	return (
		<div className="space-y-4">
			<div className="space-y-1">
				<Label htmlFor="name">Název události</Label>
				<Controller
					name="name"
					control={control}
					rules={{ required: true }}
					render={({ field }) => (
						<Input id="name" {...field} value={field.value ?? ''} required />
					)}
				/>
			</div>
			<Controller
				name="isPrivate"
				control={control}
				render={({ field }) => (
					<div className="flex items-center gap-2">
						<Switch
							id="isPrivate"
							checked={field.value}
							onCheckedChange={field.onChange}
						/>
						<Label htmlFor="isPrivate">Soukromá událost</Label>
					</div>
				)}
			/>
			<div className="space-y-1">
				<Label id="start-label" htmlFor="start">
					Datum a čas
				</Label>
				<Controller
					name="start"
					control={control}
					rules={{
						required: true,
						validate: (value) =>
							!value ||
							!isBefore(value, startOfMinute(new Date())) ||
							'Začátek nesmí být v minulosti',
					}}
					render={({ field, fieldState }) => (
						<>
							<StartDateTimeField
								id="start"
								labelId="start-label"
								value={field.value}
								onChange={field.onChange}
							/>
							{fieldState.error?.message ? (
								<p className="text-sm text-danger">
									{fieldState.error.message}
								</p>
							) : null}
						</>
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="duration">Délka (HH:MM)</Label>
				<Controller
					name="duration"
					control={control}
					rules={{ required: true, pattern: DURATION_PATTERN }}
					render={({ field }) => (
						<Input
							id="duration"
							placeholder="HH:MM"
							{...field}
							value={field.value ?? ''}
						/>
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="email">Email</Label>
				<Controller
					name="email"
					control={control}
					rules={{
						required: true,
						pattern: {
							value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
							message: 'invalid email address',
						},
					}}
					render={({ field }) => (
						<Input id="email" {...field} value={field.value ?? ''} required />
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="phone">Telefon</Label>
				<Controller
					name="phone"
					control={control}
					render={({ field }) => (
						<Input id="phone" {...field} value={field.value ?? ''} />
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="location">Lokace</Label>
				<Controller
					name="location"
					control={control}
					render={({ field }) => (
						<Input id="location" {...field} value={field.value ?? ''} />
					)}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor="description">Popis</Label>
				<Controller
					name="description"
					control={control}
					render={({ field }) => (
						<Textarea
							id="description"
							{...field}
							value={field.value ?? ''}
						/>
					)}
				/>
			</div>
		</div>
	);
}

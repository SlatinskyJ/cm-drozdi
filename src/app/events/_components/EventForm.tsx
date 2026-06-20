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
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import React from 'react';
import { type Control, Controller } from 'react-hook-form';
import {
	DURATION_PATTERN,
	type TEventInputs,
} from '~/app/events/_utils/useEventForm';

function StartDateTimeField({
	value,
	onChange,
}: Readonly<{ value?: Date; onChange: (date: Date) => void }>) {
	const current = value ?? new Date();

	function handleDateSelect(date: Date | undefined) {
		if (!date) return;
		const merged = new Date(date);
		merged.setHours(current.getHours(), current.getMinutes());
		onChange(merged);
	}

	function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
		const [hours, minutes] = e.target.value.split(':').map(Number);
		const merged = new Date(current);
		merged.setHours(hours ?? 0, minutes ?? 0);
		onChange(merged);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="w-full justify-start font-normal"
				>
					{format(current, 'd. M. yyyy HH:mm', { locale: cs })}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto space-y-2 p-3">
				<Calendar mode="single" selected={current} onSelect={handleDateSelect} />
				<Input
					type="time"
					value={format(current, 'HH:mm')}
					onChange={handleTimeChange}
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
						<Label htmlFor="isPrivate">Soukormá událost</Label>
					</div>
				)}
			/>
			<div className="space-y-1">
				<Label>Datum a čas</Label>
				<Controller
					name="start"
					control={control}
					rules={{ required: true }}
					render={({ field }) => (
						<StartDateTimeField
							value={field.value}
							onChange={field.onChange}
						/>
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

"use client";
import { getLocalTimeZone, today } from "@internationalized/date";
import { DateRangePicker } from "@nextui-org/date-picker";
import { Input, Textarea } from "@nextui-org/input";
import { Switch } from "@nextui-org/switch";
import React from "react";
import { type Control, Controller } from "react-hook-form";
import { type TEventInputs } from "~/app/events/_utils/useEventForm";

export function EventForm({
  control,
}: Readonly<{ control: Control<TEventInputs> }>) {
  return (
    <>
      <Controller
        name="name"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Input {...field} label="Název události" isRequired />
        )}
      />
      <Controller
        name="isPrivate"
        control={control}
        render={(field) => (
          <Switch
            isSelected={field.field.value}
            onValueChange={field.field.onChange}
          >
            Soukormá událost
          </Switch>
        )}
      />
      <Controller
        name="date"
        control={control}
        render={({ field }) => (
          <DateRangePicker
            {...field}
            minValue={today(getLocalTimeZone())}
            granularity="minute"
            label="Datum a čas"
            hourCycle={24}
          />
        )}
      />
      <Controller
        name="email"
        control={control}
        rules={{
          required: true,
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: "invalid email address",
          },
        }}
        render={({ field }) => <Input {...field} label="Email" isRequired />}
      />
      <Controller
        name="phone"
        control={control}
        render={({ field }) => <Input {...field} label="Telefon" />}
      />
      <Controller
        name="location"
        control={control}
        render={({ field }) => <Input {...field} label="Lokace" />}
      />
      <Controller
        name="description"
        control={control}
        render={({ field }) => <Textarea {...field} label="Popis" />}
      />
    </>
  );
}

import { Tooltip } from "@nextui-org/tooltip";

export default function KeyValue({
  label,
  value,
  withHover,
}: Readonly<{ label: string; value?: string | null; withHover?: boolean }>) {
  return (
    <div className="flex">
      <span className="text-sm">{label}</span>
      <div className="min-w-4 grow" />
      <Tooltip content={value} delay={500} isDisabled={!withHover}>
        <span className="truncate text-sm font-bold">{value}</span>
      </Tooltip>
    </div>
  );
}

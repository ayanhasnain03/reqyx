"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

type Props = {
  data: unknown;
  name?: string;
  
  indexKey?: boolean;
  defaultOpen?: boolean;
  depth?: number;
};

function KeyLabel({ name, indexKey }: { name: string; indexKey?: boolean }) {
  if (indexKey) {
    return <span className="text-muted-foreground tabular-nums">{name}</span>;
  }
  return <span className="text-json-key">{JSON.stringify(name)}</span>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function preview(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isPlainObject(value)) return `Object(${Object.keys(value).length})`;
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  return String(value);
}

function Value({ value }: { value: unknown }) {
  if (typeof value === "string") {
    return <span className="text-json-string">{JSON.stringify(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-json-number tabular-nums">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-json-boolean">{String(value)}</span>;
  }
  if (value === null) {
    return <span className="text-json-null">null</span>;
  }
  return <span className="text-muted-foreground">{String(value)}</span>;
}

export function JsonTree({
  data,
  name,
  indexKey = false,
  defaultOpen = true,
  depth = 0,
}: Props) {
  const expandable = Array.isArray(data) || isPlainObject(data);
  const [open, setOpen] = useState(defaultOpen && depth < 2);

  if (!expandable) {
    return (
      <div className="flex flex-wrap items-baseline gap-1.5 font-mono text-xs leading-6">
        {name !== undefined ? (
          <>
            <KeyLabel name={name} indexKey={indexKey} />
            <span className="text-json-punctuation">:</span>
          </>
        ) : null}
        <Value value={data} />
      </div>
    );
  }

  const entries: Array<[string, unknown]> = Array.isArray(data)
    ? data.map((item, index) => [String(index), item])
    : Object.entries(data);

  const bracketOpen = Array.isArray(data) ? "[" : "{";
  const bracketClose = Array.isArray(data) ? "]" : "}";

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="font-mono text-xs leading-6"
    >
      <div className="flex items-center gap-1">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </Button>
        </CollapsibleTrigger>
        {name !== undefined ? (
          <>
            <KeyLabel name={name} indexKey={indexKey} />
            <span className="text-json-punctuation">:</span>
          </>
        ) : null}
        <span className="text-json-punctuation">{bracketOpen}</span>
        {!open ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto px-1 font-mono text-xs text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            {preview(data)}
          </Button>
        ) : null}
        {!open ? (
          <span className="text-json-punctuation">{bracketClose}</span>
        ) : null}
      </div>
      <CollapsibleContent>
        <div className="ml-3 flex flex-col border-l border-border pl-3">
          {entries.map(([key, value]) => (
            <JsonTree
              key={key}
              data={value}
              name={key}
              indexKey={Array.isArray(data)}
              depth={depth + 1}
              defaultOpen={depth + 1 < 2}
            />
          ))}
        </div>
        <div className="pl-6">
          <span className="text-json-punctuation">{bracketClose}</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

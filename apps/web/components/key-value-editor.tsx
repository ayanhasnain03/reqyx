"use client";

import { emptyKeyValue, type KeyValue } from "@repo/core";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { PlusIcon, Trash2Icon } from "lucide-react";

type Props = {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
};

export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: Props) {
  function update(id: string, patch: Partial<KeyValue>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    const next = rows.filter((row) => row.id !== id);
    onChange(next.length ? next : [emptyKeyValue()]);
  }

  return (
    <FieldGroup className="gap-2">
      {rows.map((row) => (
        <Field
          key={row.id}
          orientation="horizontal"
          className="items-center gap-2"
        >
          <Checkbox
            checked={row.enabled}
            onCheckedChange={(checked) =>
              update(row.id, { enabled: checked === true })
            }
            aria-label="Enabled"
          />
          <FieldLabel className="sr-only">Key</FieldLabel>
          <Input
            value={row.key}
            onChange={(event) => update(row.id, { key: event.target.value })}
            placeholder={keyPlaceholder}
            className="min-w-0 flex-1 font-mono text-xs"
          />
          <FieldLabel className="sr-only">Value</FieldLabel>
          <Input
            value={row.value}
            onChange={(event) => update(row.id, { value: event.target.value })}
            placeholder={valuePlaceholder}
            className="min-w-0 flex-1 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(row.id)}
            aria-label="Remove row"
          >
            <Trash2Icon />
          </Button>
        </Field>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...rows, emptyKeyValue()])}
      >
        <PlusIcon data-icon="inline-start" />
        Add row
      </Button>
    </FieldGroup>
  );
}

"use client";

import { useMemo } from "react";
import { detectBodyKind, formatJsonBody } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { ButtonGroup } from "@repo/ui/components/button-group";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@repo/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/ui/components/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { BracesIcon, WrapTextIcon } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function BodyEditor({ value, onChange }: Props) {
  const kind = useMemo(() => detectBodyKind(value), [value]);
  const canFormat = kind === "json";
  const invalid = kind === "text" && Boolean(value.trim());

  function format() {
    const next = formatJsonBody(value);
    if (next !== null) onChange(next);
  }

  function minify() {
    try {
      onChange(JSON.stringify(JSON.parse(value)));
    } catch {
      
    }
  }

  return (
    <FieldGroup className="h-full min-h-0 gap-2">
      <Field
        data-invalid={invalid || undefined}
        className="min-h-0 flex-1 gap-2"
      >
        <InputGroup className="h-full min-h-48 items-stretch">
          <InputGroupTextarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={'{\n  "example": true\n}'}
            spellCheck={false}
            aria-invalid={invalid || undefined}
            aria-label="Request body"
            className="min-h-40 flex-1 resize-none font-mono text-xs leading-6 field-sizing-fixed"
          />
          <InputGroupAddon
            align="block-end"
            className="justify-between border-t"
          >
            <Badge
              variant="secondary"
              className={cn(
                "rounded-md font-mono",
                kind === "json" && "bg-status-success text-status-success-fg",
                invalid && "bg-status-client-error text-status-client-error-fg",
              )}
            >
              {kind === "empty" ? "Empty" : kind === "json" ? "JSON" : "Text"}
            </Badge>
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    type="button"
                    disabled={!canFormat}
                    onClick={format}
                  >
                    <BracesIcon data-icon="inline-start" />
                    Format
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>Pretty-print JSON</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    type="button"
                    disabled={!canFormat}
                    onClick={minify}
                  >
                    <WrapTextIcon data-icon="inline-start" />
                    Minify
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>Collapse JSON to one line</TooltipContent>
              </Tooltip>
              <CopyButton value={value} label="Copy body" />
            </ButtonGroup>
          </InputGroupAddon>
        </InputGroup>
        {invalid ? (
          <FieldDescription>Body is not valid JSON.</FieldDescription>
        ) : null}
      </Field>
    </FieldGroup>
  );
}

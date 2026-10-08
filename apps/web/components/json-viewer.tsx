"use client";

import { useMemo, useState } from "react";
import { detectBodyKind, parseJsonBody, prettyBody } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/toggle-group";
import { CopyButton } from "@/components/copy-button";
import { JsonTree } from "@/components/json-tree";
import { highlightJson } from "@/lib/json-highlight";
import { cn } from "@/lib/utils";

type ViewMode = "pretty" | "tree" | "raw";

type Props = {
  body: string;
  className?: string;
};

export function JsonViewer({ body, className }: Props) {
  const kind = detectBodyKind(body);
  const parsed = useMemo(() => parseJsonBody(body), [body]);
  const pretty = useMemo(
    () => (parsed.ok ? parsed.pretty : prettyBody(body)),
    [body, parsed],
  );
  const [mode, setMode] = useState<ViewMode>(kind === "json" ? "pretty" : "raw");

  const activeMode = kind === "json" ? mode : "raw";
  const display =
    activeMode === "raw" ? body || "(empty)" : pretty || "(empty)";

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "rounded-md font-mono",
              kind === "json" && "bg-status-success text-status-success-fg",
            )}
          >
            {kind === "empty" ? "Empty" : kind === "json" ? "JSON" : "Text"}
          </Badge>
          {kind === "json" ? (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={activeMode}
              onValueChange={(value) => {
                if (value) setMode(value as ViewMode);
              }}
              aria-label="Body view mode"
            >
              <ToggleGroupItem value="pretty">Pretty</ToggleGroupItem>
              <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
              <ToggleGroupItem value="raw">Raw</ToggleGroupItem>
            </ToggleGroup>
          ) : null}
        </div>
        <CopyButton value={body} label="Copy response body" />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {activeMode === "tree" && parsed.ok ? (
          <div className="p-4">
            <JsonTree data={parsed.value} />
          </div>
        ) : (
          <pre
            className={cn(
              "p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words",
              activeMode === "raw" && "text-foreground/90",
            )}
          >
            {kind === "json" && activeMode === "pretty"
              ? highlightJson(pretty)
              : display}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}

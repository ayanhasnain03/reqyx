"use client";

import type { SseEvent } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Spinner } from "@repo/ui/components/spinner";
import { Trash2Icon } from "lucide-react";

type Props = {
  events: SseEvent[];
  connected: boolean;
  error: string | null;
  onClear: () => void;
};

export function SseView({ events, connected, error, onClear }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">SSE Events</p>
          <Badge variant="secondary" className="font-mono uppercase">
            {connected ? "Listening" : "Idle"}
          </Badge>
          {connected ? <Spinner className="size-3.5" /> : null}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear events">
          <Trash2Icon />
        </Button>
      </div>
      {error ? (
        <p className="px-4 pb-2 text-xs text-destructive">{error}</p>
      ) : null}
      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        {events.length === 0 ? (
          <Empty className="min-h-40 border-0">
            <EmptyHeader>
              <EmptyTitle>No events yet</EmptyTitle>
              <EmptyDescription>
                Connect to an SSE endpoint to stream server-sent events here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((event) => (
              <article
                key={event.id}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono">
                    {event.event}
                  </Badge>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    {new Date(event.at).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                  {event.data || event.raw}
                </pre>
              </article>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

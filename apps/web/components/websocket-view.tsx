"use client";

import { useState } from "react";
import type { WsMessage } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { SendIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  messages: WsMessage[];
  connected: boolean;
  onSend: (data: string) => void;
  onClear: () => void;
};

export function WebSocketView({
  messages,
  connected,
  onSend,
  onClear,
}: Props) {
  const [draft, setDraft] = useState("ping");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">WebSocket</p>
          <Badge variant="secondary" className="font-mono uppercase">
            {connected ? "Open" : "Closed"}
          </Badge>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear messages">
          <Trash2Icon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-4">
        {messages.length === 0 ? (
          <Empty className="min-h-40 border-0">
            <EmptyHeader>
              <EmptyTitle>No messages</EmptyTitle>
              <EmptyDescription>
                Connect to a WebSocket and send or receive frames.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "rounded-lg border border-border p-3",
                  message.direction === "out" && "bg-brand-muted/40",
                  message.direction === "system" && "bg-muted/50",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono uppercase">
                    {message.direction}
                  </Badge>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    {new Date(message.at).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                  {message.data}
                </pre>
              </article>
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message payload"
          className="font-mono text-xs"
          disabled={!connected}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (draft.trim() && connected) {
                onSend(draft);
              }
            }
          }}
        />
        <Button
          disabled={!connected || !draft.trim()}
          onClick={() => onSend(draft)}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <SendIcon data-icon="inline-start" />
          Send
        </Button>
      </div>
    </div>
  );
}

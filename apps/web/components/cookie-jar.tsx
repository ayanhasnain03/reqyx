"use client";

import type { StoredCookie } from "@repo/core";
import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Trash2Icon } from "lucide-react";

type Props = {
  cookies: StoredCookie[];
  onChange: (cookies: StoredCookie[]) => void;
};

export function CookieJar({ cookies, onChange }: Props) {
  if (cookies.length === 0) {
    return (
      <Empty className="min-h-40 border-0">
        <EmptyHeader>
          <EmptyTitle>No cookies saved</EmptyTitle>
          <EmptyDescription>
            Enable Save cookies, then send a request that returns Set-Cookie.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
        >
          <Trash2Icon data-icon="inline-start" />
          Clear all
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cookies.map((cookie) => (
              <TableRow key={cookie.id}>
                <TableCell className="font-mono text-xs">{cookie.name}</TableCell>
                <TableCell className="max-w-40 truncate font-mono text-xs">
                  {cookie.value}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cookie.domain}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${cookie.name}`}
                    onClick={() =>
                      onChange(cookies.filter((item) => item.id !== cookie.id))
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

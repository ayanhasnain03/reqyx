"use client";

import {
  formatBytes,
  formatDuration,
  statusBand,
  type HttpResult,
} from "@repo/core";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Separator } from "@repo/ui/components/separator";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Spinner } from "@repo/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { AlertCircleIcon, InboxIcon } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { JsonViewer } from "@/components/json-viewer";
import { cn } from "@/lib/utils";

const bandClass = {
  success: "bg-status-success text-status-success-fg",
  redirect: "bg-status-redirect text-status-redirect-fg",
  "client-error": "bg-status-client-error text-status-client-error-fg",
  "server-error": "bg-status-server-error text-status-server-error-fg",
  unknown: "",
} as const;

type Props = {
  result: HttpResult | null;
  loading: boolean;
};

export function ResponseView({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Spinner />
          <p className="text-sm text-muted-foreground">Sending request…</p>
        </div>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="min-h-0 flex-1 w-full" />
      </div>
    );
  }

  if (!result) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>No response yet</EmptyTitle>
          <EmptyDescription>
            Send a request to inspect status, timing, and body here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!result.ok) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>
            <p className="font-mono text-sm text-pretty">{result.error}</p>
          </AlertDescription>
        </Alert>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDuration(result.timeMs)}
        </p>
      </div>
    );
  }

  const band = statusBand(result.status);
  const headers = result.headers.filter((header) => header.key);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Badge
          variant={band === "unknown" ? "secondary" : "outline"}
          className={cn("rounded-md font-mono tabular-nums", bandClass[band])}
        >
          {result.status} {result.statusText}
        </Badge>
        <Badge variant="secondary" className="rounded-md font-mono tabular-nums">
          {formatDuration(result.timeMs)}
        </Badge>
        <Badge variant="secondary" className="rounded-md font-mono tabular-nums">
          {formatBytes(result.size)}
        </Badge>
      </div>
      <Separator />
      <Tabs defaultValue="body" className="flex min-h-0 flex-1 gap-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <TabsList>
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">
              Headers
              {headers.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="rounded-md font-mono tabular-nums"
                >
                  {headers.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>
        <Separator />
        <TabsContent value="body" className="mt-0 min-h-0 flex-1 outline-none">
          <JsonViewer body={result.body} />
        </TabsContent>
        <TabsContent
          value="headers"
          className="mt-0 min-h-0 flex-1 outline-none"
        >
          {headers.length === 0 ? (
            <Empty className="h-full border-0">
              <EmptyHeader>
                <EmptyTitle>No headers</EmptyTitle>
                <EmptyDescription>
                  This response did not include any headers.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex justify-end px-4 py-2">
                <CopyButton
                  value={headers
                    .map((header) => `${header.key}: ${header.value}`)
                    .join("\n")}
                  label="Copy headers"
                />
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="px-4 pb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Name</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {headers.map((header) => (
                        <TableRow key={header.id}>
                          <TableCell className="font-mono text-xs text-json-key">
                            {header.key}
                          </TableCell>
                          <TableCell className="break-all font-mono text-xs">
                            {header.value}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

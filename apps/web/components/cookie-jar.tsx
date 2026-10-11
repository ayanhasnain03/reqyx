"use client";

import { useState } from "react";
import { createManualCookie, type StoredCookie } from "@repo/core";
import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { PlusIcon, Trash2Icon } from "lucide-react";

type Props = {
  cookies: StoredCookie[];
  onChange: (cookies: StoredCookie[]) => void;
  /** Prefill domain when manually adding (from current request URL). */
  defaultDomain?: string;
};

export function CookieJar({ cookies, onChange, defaultDomain = "" }: Props) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [domain, setDomain] = useState("");
  const [path, setPath] = useState("/");

  function addCookie() {
    const cookie = createManualCookie({
      name,
      value,
      domain: domain.trim() || defaultDomain,
      path,
    });
    if (!cookie) return;
    onChange([...cookies.filter((item) => !(
      item.name === cookie.name &&
      item.domain === cookie.domain &&
      item.path === cookie.path
    )), cookie]);
    setName("");
    setValue("");
    setDomain("");
    setPath("/");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Like Postman: stores <span className="font-mono">Set-Cookie</span> from
        responses (e.g. Express <span className="font-mono">res.cookie</span>)
        and sends matching cookies on later requests. JSON fields like{" "}
        <span className="font-mono">accessToken</span> are not cookies — put
        those under Auth → Bearer.
      </p>

      <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cookie-name" className="text-xs">
            Name
          </Label>
          <Input
            id="cookie-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="session"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cookie-value" className="text-xs">
            Value
          </Label>
          <Input
            id="cookie-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="cookie value"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cookie-domain" className="text-xs">
            Domain
          </Label>
          <Input
            id="cookie-domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder={defaultDomain || "api.example.com"}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cookie-path" className="text-xs">
            Path
          </Label>
          <Input
            id="cookie-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/"
            className="font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCookie}
            disabled={!name.trim() || !(domain.trim() || defaultDomain)}
          >
            <PlusIcon data-icon="inline-start" />
            Add cookie
          </Button>
        </div>
      </div>

      {cookies.length === 0 ? (
        <Empty className="min-h-32 border-0">
          <EmptyHeader>
            <EmptyTitle>No cookies saved</EmptyTitle>
            <EmptyDescription>
              Enable Save cookies, send a request that returns Set-Cookie (your
              sign-in sets <span className="font-mono">session</span>), and keep
              the transport on Proxy. Or add a cookie manually above.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>
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
                  <TableHead>Path</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cookies.map((cookie) => (
                  <TableRow key={cookie.id}>
                    <TableCell className="font-mono text-xs">
                      {cookie.name}
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-xs">
                      {cookie.value}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cookie.domain}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cookie.path}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${cookie.name}`}
                        onClick={() =>
                          onChange(
                            cookies.filter((item) => item.id !== cookie.id),
                          )
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
        </>
      )}
    </div>
  );
}

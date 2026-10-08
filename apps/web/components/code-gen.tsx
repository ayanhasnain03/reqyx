"use client";

import { useMemo, useState } from "react";
import { toCurl, toFetch, type ExecutePayload } from "@repo/core";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { CopyButton } from "@/components/copy-button";

type Props = {
  payload: ExecutePayload;
};

export function CodeGen({ payload }: Props) {
  const [lang, setLang] = useState<"curl" | "fetch">("curl");
  const code = useMemo(
    () => (lang === "curl" ? toCurl(payload) : toFetch(payload)),
    [lang, payload],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={lang}
          onValueChange={(value) => setLang(value as "curl" | "fetch")}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="curl">cURL</SelectItem>
              <SelectItem value="fetch">Fetch</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <CopyButton value={code} />
      </div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap">
        {code}
      </pre>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(code);
        }}
      >
        Copy snippet
      </Button>
    </div>
  );
}

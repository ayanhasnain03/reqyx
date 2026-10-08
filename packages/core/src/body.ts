import type { BodyMode, KeyValue } from "./types";

export function buildRequestBody(
  mode: BodyMode,
  raw: string,
  formRows: KeyValue[],
): { body: string; contentType: string | null } {
  if (mode === "none") {
    return { body: "", contentType: null };
  }

  if (mode === "urlencoded") {
    const params = new URLSearchParams();
    for (const row of formRows) {
      if (!row.enabled || !row.key.trim()) continue;
      params.append(row.key.trim(), row.value);
    }
    return {
      body: params.toString(),
      contentType: "application/x-www-form-urlencoded",
    };
  }

  if (mode === "formdata") {
    return {
      body: raw,
      contentType: "multipart/form-data",
    };
  }

  const trimmed = raw.trim();
  let contentType: string | null = "text/plain";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    contentType = "application/json";
  }
  return { body: raw, contentType };
}

export function withContentType(
  headers: KeyValue[],
  contentType: string | null,
): KeyValue[] {
  if (!contentType) return headers;
  const hasType = headers.some(
    (row) => row.enabled && row.key.trim().toLowerCase() === "content-type",
  );
  if (hasType) return headers;
  return [
    ...headers,
    {
      id: `ct-${Date.now()}`,
      key: "Content-Type",
      value: contentType,
      enabled: true,
    },
  ];
}

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export const REQUEST_KINDS = ["http", "sse", "websocket"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const BODY_MODES = ["none", "raw", "urlencoded", "formdata"] as const;
export type BodyMode = (typeof BODY_MODES)[number];

export const AUTH_TYPES = ["none", "bearer", "basic", "apikey"] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export type KeyValue = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

export type AuthConfig = {
  type: AuthType;
  token: string;
  username: string;
  password: string;
  key: string;
  value: string;
  addTo: "header" | "query";
};

export type RequestDraft = {
  id: string;
  name: string;
  kind: RequestKind;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  bodyMode: BodyMode;
  auth: AuthConfig;
  updatedAt: number;
};

export type HttpSuccess = {
  ok: true;
  status: number;
  statusText: string;
  headers: KeyValue[];
  body: string;
  timeMs: number;
  size: number;
};

export type HttpFailure = {
  ok: false;
  error: string;
  timeMs: number;
};

export type HttpResult = HttpSuccess | HttpFailure;

export type ExecutePayload = {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string;
};

export type SseEvent = {
  id: string;
  event: string;
  data: string;
  raw: string;
  at: number;
};

export type WsMessage = {
  id: string;
  direction: "in" | "out" | "system";
  data: string;
  at: number;
};

export type Environment = {
  id: string;
  name: string;
  variables: KeyValue[];
};

export type CollectionFolder = {
  type: "folder";
  id: string;
  name: string;
  children: CollectionItem[];
};

export type CollectionRequestRef = {
  type: "request";
  id: string;
  requestId: string;
};

export type CollectionItem = CollectionFolder | CollectionRequestRef;

export type Collection = {
  id: string;
  name: string;
  items: CollectionItem[];
  
  requests: RequestDraft[];
  updatedAt: number;
};

export function emptyAuth(): AuthConfig {
  return {
    type: "none",
    token: "",
    username: "",
    password: "",
    key: "",
    value: "",
    addTo: "header",
  };
}

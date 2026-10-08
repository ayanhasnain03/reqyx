import type { ExecutePayload, HttpResult, SseEvent, WsMessage } from "./types";

export const BRIDGE_SOURCE = "reqyx" as const;

export type BridgePing = {
  source: typeof BRIDGE_SOURCE;
  type: "PING";
};

export type BridgePong = {
  source: typeof BRIDGE_SOURCE;
  type: "PONG";
  version: string;
  connected: boolean;
};

export type BridgeSetConnected = {
  source: typeof BRIDGE_SOURCE;
  type: "SET_CONNECTED";
  connected: boolean;
};

export type BridgeStatus = {
  source: typeof BRIDGE_SOURCE;
  type: "STATUS";
  version: string;
  connected: boolean;
};

export type BridgeExecute = {
  source: typeof BRIDGE_SOURCE;
  type: "EXECUTE";
  id: string;
  payload: ExecutePayload;
};

export type BridgeExecuteResult = {
  source: typeof BRIDGE_SOURCE;
  type: "EXECUTE_RESULT";
  id: string;
  result: HttpResult;
};

export type BridgeSseStart = {
  source: typeof BRIDGE_SOURCE;
  type: "SSE_START";
  id: string;
  url: string;
  headers: ExecutePayload["headers"];
};

export type BridgeSseEvent = {
  source: typeof BRIDGE_SOURCE;
  type: "SSE_EVENT";
  id: string;
  event: SseEvent;
};

export type BridgeSseEnd = {
  source: typeof BRIDGE_SOURCE;
  type: "SSE_END";
  id: string;
  error?: string;
};

export type BridgeSseStop = {
  source: typeof BRIDGE_SOURCE;
  type: "SSE_STOP";
  id: string;
};

export type BridgeWsConnect = {
  source: typeof BRIDGE_SOURCE;
  type: "WS_CONNECT";
  id: string;
  url: string;
};

export type BridgeWsSend = {
  source: typeof BRIDGE_SOURCE;
  type: "WS_SEND";
  id: string;
  data: string;
};

export type BridgeWsClose = {
  source: typeof BRIDGE_SOURCE;
  type: "WS_CLOSE";
  id: string;
};

export type BridgeWsMessage = {
  source: typeof BRIDGE_SOURCE;
  type: "WS_MESSAGE";
  id: string;
  message: WsMessage;
};

export type BridgeMessage =
  | BridgePing
  | BridgePong
  | BridgeSetConnected
  | BridgeStatus
  | BridgeExecute
  | BridgeExecuteResult
  | BridgeSseStart
  | BridgeSseEvent
  | BridgeSseEnd
  | BridgeSseStop
  | BridgeWsConnect
  | BridgeWsSend
  | BridgeWsClose
  | BridgeWsMessage;

export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as Partial<BridgeMessage>;
  return msg.source === BRIDGE_SOURCE && typeof msg.type === "string";
}

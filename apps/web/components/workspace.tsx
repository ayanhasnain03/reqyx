"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@repo/ui/components/item";
import { Input } from "@repo/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@repo/ui/components/input-group";
import { Kbd, KbdGroup } from "@repo/ui/components/kbd";
import { Label } from "@repo/ui/components/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/resizable";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Separator } from "@repo/ui/components/separator";
import { Spinner } from "@repo/ui/components/spinner";
import { Switch } from "@repo/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import {
  HTTP_METHODS,
  activeVariables,
  createId,
  emptyKeyValue,
  type Collection,
  type Environment,
  type HttpMethod,
  type HttpResult,
  type RequestDraft,
  type RequestKind,
  type SseEvent,
  type WsMessage,
} from "@repo/core";
import { toast } from "sonner";
import {
  CableIcon,
  LogOutIcon,
  PlusIcon,
  RadioIcon,
  SaveIcon,
  SendIcon,
  Settings2Icon,
  Trash2Icon,
  UnplugIcon,
  UserIcon,
  WorkflowIcon,
} from "lucide-react";
import { setExtensionConnected } from "@/lib/bridge";
import {
  buildExecutePayload,
  resolveTransport,
  sendRequest,
  startSseSession,
  startWsSession,
  type Transport,
} from "@/lib/client";
import {
  addItemToCollection,
  createCollection,
  createFolder,
  createRequestRef,
  removeCollectionItem,
  renameCollectionItem,
  upsertCollectionRequest,
} from "@/lib/collections";
import { createDraft, draftFromKind } from "@/lib/draft";
import { defaultSettings, type LocalSettings } from "@/lib/history";
import { signOut, useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { AuthEditor } from "@/components/auth-editor";
import { BodyEditor } from "@/components/body-editor";
import { CodeGen } from "@/components/code-gen";
import { CollectionTree } from "@/components/collection-tree";
import { KeyValueEditor } from "@/components/key-value-editor";
import { ResponseView } from "@/components/response-view";
import { SseView } from "@/components/sse-view";
import { WebSocketView } from "@/components/websocket-view";
import { cn } from "@/lib/utils";

function draftFingerprint(draft: RequestDraft): string {
  return JSON.stringify({
    name: draft.name,
    kind: draft.kind,
    method: draft.method,
    url: draft.url,
    params: draft.params,
    headers: draft.headers,
    body: draft.body,
    bodyMode: draft.bodyMode,
    auth: draft.auth,
  });
}

type EditorTab = "params" | "headers" | "body" | "auth" | "code";

type ExtensionInfo = {
  installed: boolean;
  connected: boolean;
  version: string | null;
};

const methodClass: Record<HttpMethod, string> = {
  GET: "text-method-get-fg",
  POST: "text-method-post-fg",
  PUT: "text-method-put-fg",
  PATCH: "text-method-patch-fg",
  DELETE: "text-method-delete-fg",
  HEAD: "text-method-options-fg",
  OPTIONS: "text-method-options-fg",
};

type WorkspaceProps = {
  requestId: string;
  initialKind?: RequestKind;
};

export function Workspace({ requestId, initialKind }: WorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionData, isPending: sessionPending } = useSession();
  const user = sessionData?.user ?? null;
  const isNew = requestId === "new";

  const [draft, setDraft] = useState<RequestDraft>(() =>
    initialKind ? draftFromKind(initialKind) : createDraft(),
  );
  const [settings, setSettings] = useState<LocalSettings>(defaultSettings);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>("params");
  const [transport, setTransport] = useState<Transport>("browser");
  const [extension, setExtension] = useState<ExtensionInfo>({
    installed: false,
    connected: false,
    version: null,
  });
  const [result, setResult] = useState<HttpResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sseEvents, setSseEvents] = useState<SseEvent[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);
  const [wsMessages, setWsMessages] = useState<WsMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const loadedRequestIdRef = useRef<string | null>(null);
  const savedFingerprintRef = useRef<string>("");
  const saveRequestRef = useRef<() => Promise<RequestDraft | null>>(async () => null);
  const [isDirty, setIsDirty] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sseStopRef = useRef<(() => void) | null>(null);
  const wsSessionRef = useRef<{
    send: (data: string) => void;
    close: () => void;
  } | null>(null);

  const historyQuery = useQuery(trpc.history.list.queryOptions());
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const collectionsQuery = useQuery(trpc.collections.list.queryOptions());
  const environmentsQuery = useQuery(trpc.environments.list.queryOptions());

  const requestQuery = useQuery({
    ...trpc.history.getById.queryOptions({ id: requestId }),
    enabled: !isNew && !!requestId,
    retry: false,
  });

  const upsertMutation = useMutation(
    trpc.history.upsert.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.history.list.queryFilter());
        if (!isNew) {
          await queryClient.invalidateQueries(
            trpc.history.getById.queryFilter({ id: requestId }),
          );
        }
      },
    }),
  );

  const clearMutation = useMutation(
    trpc.history.clear.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.history.list.queryFilter());
        router.push("/r/new");
      },
    }),
  );

  const removeMutation = useMutation(
    trpc.history.remove.mutationOptions({
      onSuccess: async (_data, variables) => {
        await queryClient.invalidateQueries(trpc.history.list.queryFilter());
        await queryClient.invalidateQueries(trpc.collections.list.queryFilter());
        if (variables.id === requestId) {
          router.push("/r/new");
        }
      },
    }),
  );

  const settingsMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: async (next) => {
        setSettings({
          autoSaveHistory: next.autoSaveHistory,
          saveRequestBody: next.saveRequestBody,
          saveResponseMeta: next.saveResponseMeta,
        });
        if (next.activeEnvironmentId !== undefined) {
          setActiveEnvId(next.activeEnvironmentId);
        }
        await queryClient.invalidateQueries(trpc.settings.get.queryFilter());
      },
    }),
  );

  const collectionUpsertMutation = useMutation(
    trpc.collections.upsert.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.collections.list.queryFilter());
      },
    }),
  );

  const collectionRemoveMutation = useMutation(
    trpc.collections.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.collections.list.queryFilter());
      },
    }),
  );

  const environmentUpsertMutation = useMutation(
    trpc.environments.upsert.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.environments.list.queryFilter(),
        );
      },
    }),
  );

  const setActiveEnvMutation = useMutation(
    trpc.environments.setActive.mutationOptions({
      onSuccess: async (next) => {
        setActiveEnvId(next.id);
        await queryClient.invalidateQueries(
          trpc.environments.list.queryFilter(),
        );
        await queryClient.invalidateQueries(trpc.settings.get.queryFilter());
      },
    }),
  );

  useEffect(() => {
    void resolveTransport().then(({ transport: next, extension: ext }) => {
      setTransport(next);
      setExtension(ext);
    });
    const timer = window.setInterval(() => {
      void resolveTransport().then(({ transport: next, extension: ext }) => {
        setTransport(next);
        setExtension(ext);
      });
    }, 4000);
    return () => {
      window.clearInterval(timer);
      sseStopRef.current?.();
      wsSessionRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings({
        autoSaveHistory: settingsQuery.data.autoSaveHistory,
        saveRequestBody: settingsQuery.data.saveRequestBody,
        saveResponseMeta: settingsQuery.data.saveResponseMeta,
      });
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (environmentsQuery.data) {
      setEnvironments(environmentsQuery.data.items);
      setActiveEnvId(environmentsQuery.data.activeEnvironmentId);
    }
  }, [environmentsQuery.data]);

  useEffect(() => {
    if (isNew) {
      const kindKey = `new:${initialKind ?? "http"}`;
      if (loadedRequestIdRef.current !== kindKey) {
        loadedRequestIdRef.current = kindKey;
        const next = initialKind ? draftFromKind(initialKind) : createDraft();
        setDraft(next);
        savedFingerprintRef.current = draftFingerprint(next);
        setIsDirty(false);
        resetRuntime();
      }
      return;
    }

    if (requestQuery.isError) {
      toast.error("Request not found");
      router.replace("/r/new");
      return;
    }

    if (requestQuery.data && loadedRequestIdRef.current !== requestQuery.data.id) {
      loadedRequestIdRef.current = requestQuery.data.id;
      const next = createDraft(requestQuery.data);
      setDraft(next);
      savedFingerprintRef.current = draftFingerprint(next);
      setIsDirty(false);
      resetRuntime();
    }
  }, [
    isNew,
    initialKind,
    requestQuery.data,
    requestQuery.isError,
    router,
  ]);

  useEffect(() => {
    setIsDirty(draftFingerprint(draft) !== savedFingerprintRef.current);
  }, [draft]);

  function resetRuntime() {
    setResult(null);
    setSseEvents([]);
    setWsMessages([]);
    setSseConnected(false);
    setWsConnected(false);
    setSseError(null);
    sseStopRef.current?.();
    wsSessionRef.current?.close();
  }

  const history = historyQuery.data ?? [];
  const collections = collectionsQuery.data ?? [];
  const variables = useMemo(
    () => activeVariables(environments, activeEnvId),
    [environments, activeEnvId],
  );
  const executePayload = useMemo(
    () => buildExecutePayload(draft, variables),
    [draft, variables],
  );

  function patch(partial: Partial<RequestDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function markClean(next: RequestDraft) {
    savedFingerprintRef.current = draftFingerprint(next);
    setIsDirty(false);
  }

  function openRequest(id: string) {
    if (id === requestId) return;
    router.push(`/r/${id}`);
  }

  function newRequest(kind: RequestKind = "http") {
    if (kind === "http") {
      router.push("/r/new");
      return;
    }
    router.push(`/r/new?kind=${kind}`);
  }

  async function updateSettings(partial: Partial<LocalSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    await settingsMutation.mutateAsync(partial);
  }

  async function toggleExtension() {
    if (!extension.installed) {
      toast.error("Install the Reqyx extension first");
      return;
    }
    const next = await setExtensionConnected(!extension.connected);
    setExtension(next);
    setTransport(next.connected ? "extension" : "browser");
    toast.success(next.connected ? "Extension connected" : "Extension disconnected");
  }

  async function ensureRequestId(base: RequestDraft): Promise<RequestDraft> {
    const saved: RequestDraft = {
      ...base,
      id: base.id && base.id !== "new" ? base.id : createId(),
      name: base.name || base.url || "Untitled",
      updatedAt: Date.now(),
    };

    if (isNew || saved.id !== requestId) {
      router.replace(`/r/${saved.id}`);
      loadedRequestIdRef.current = saved.id;
    }

    return saved;
  }

  async function persistHistory(saved: RequestDraft, statusCode: number | null) {
    if (!settings.autoSaveHistory) return;
    try {
      await upsertMutation.mutateAsync({ ...saved, statusCode });
      markClean(saved);
    } catch {
      toast.error("Could not save request");
    }
  }

  async function persistCollection(collection: {
    id: string;
    name: string;
    items: Collection["items"];
    updatedAt: number;
  }) {
    await collectionUpsertMutation.mutateAsync({
      id: collection.id,
      name: collection.name,
      items: collection.items,
      updatedAt: collection.updatedAt,
    });
  }

  async function saveRequest(options?: { silent?: boolean }) {
    const saved = await ensureRequestId({
      ...draft,
      body: settings.saveRequestBody ? draft.body : draft.body,
      updatedAt: Date.now(),
      name: draft.name || draft.url || "Untitled",
    });

    try {
      await upsertMutation.mutateAsync({ ...saved, statusCode: null });
      setDraft(saved);
      markClean(saved);
      if (!options?.silent) toast.success("Saved");
      return saved;
    } catch {
      toast.error("Could not save request");
      return null;
    }
  }

  async function saveCurrentToCollection(
    collectionId: string,
    parentFolderId: string | null,
  ) {
    const saved = await saveRequest({ silent: true });
    if (!saved) return;

    const target = collections.find((item) => item.id === collectionId);
    if (!target) {
      toast.error("Collection not found");
      return;
    }

    const updated = upsertCollectionRequest(
      [target],
      collectionId,
      saved,
      parentFolderId,
    )[0]!;

    try {
      await persistCollection(updated);
      toast.success(`Saved to ${target.name}`);
    } catch {
      toast.error("Could not save to collection");
    }
  }

  async function handleCreateCollection(name: string) {
    const collection = createCollection(name);
    await persistCollection(collection);
    toast.success(`Created ${name}`);
  }

  async function handleRenameCollection(id: string, name: string) {
    const target = collections.find((item) => item.id === id);
    if (!target) return;
    await persistCollection({
      ...target,
      name,
      updatedAt: Date.now(),
    });
  }

  async function handleDeleteCollection(id: string) {
    await collectionRemoveMutation.mutateAsync({ id });
    toast.success("Collection deleted");
  }

  async function handleCreateFolder(
    collectionId: string,
    parentFolderId: string | null,
    name: string,
  ) {
    const target = collections.find((item) => item.id === collectionId);
    if (!target) return;
    const updated = addItemToCollection(
      target,
      parentFolderId,
      createFolder(name),
    );
    await persistCollection(updated);
  }

  async function handleRenameFolder(
    collectionId: string,
    folderId: string,
    name: string,
  ) {
    const target = collections.find((item) => item.id === collectionId);
    if (!target) return;
    await persistCollection({
      ...target,
      items: renameCollectionItem(target.items, folderId, name),
      updatedAt: Date.now(),
    });
  }

  async function handleDeleteFolder(collectionId: string, folderId: string) {
    const target = collections.find((item) => item.id === collectionId);
    if (!target) return;
    await persistCollection({
      ...target,
      items: removeCollectionItem(target.items, folderId),
      updatedAt: Date.now(),
    });
  }

  async function handleCreateRequest(
    collectionId: string,
    parentFolderId: string | null,
    kind: RequestKind,
    name: string,
  ) {
    const target = collections.find((item) => item.id === collectionId);
    if (!target) return;

    const draftNext = createDraft({
      ...draftFromKind(kind),
      name,
    });

    try {
      await upsertMutation.mutateAsync({ ...draftNext, statusCode: null });
    } catch {
      toast.error("Could not create request");
      return;
    }

    const updated = addItemToCollection(
      {
        ...target,
        requests: [draftNext, ...target.requests],
      },
      parentFolderId,
      createRequestRef(draftNext.id),
    );

    try {
      await persistCollection(updated);
      router.push(`/r/${draftNext.id}`);
      toast.success("Request created");
    } catch {
      toast.error("Could not add request to collection");
    }
  }

  async function handleRenameRequest(requestId: string, name: string) {
    const fromHistory = history.find((item) => item.id === requestId);
    const fromCollections = collections
      .flatMap((collection) => collection.requests)
      .find((item) => item.id === requestId);
    const source = fromHistory ?? fromCollections;
    if (!source) {
      if (draft.id === requestId) {
        patch({ name });
        const saved = await ensureRequestId({ ...draft, name });
        await upsertMutation.mutateAsync({ ...saved, statusCode: null });
        setDraft(saved);
        markClean(saved);
      }
      return;
    }

    const next = { ...createDraft(source), name, updatedAt: Date.now() };
    await upsertMutation.mutateAsync({ ...next, statusCode: null });
    if (draft.id === requestId) {
      setDraft(next);
      markClean(next);
    }
  }

  async function handleDeleteRequest(
    collectionId: string,
    itemId: string,
    _requestId: string,
  ) {
    const target = collections.find((item) => item.id === collectionId);
    if (!target) return;
    await persistCollection({
      ...target,
      items: removeCollectionItem(target.items, itemId),
      updatedAt: Date.now(),
    });
  }

  async function onSendHttp() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const { result: next, transport: used } = await sendRequest(
        executePayload,
        transport,
        controller.signal,
      );
      setTransport(used);
      setResult(next);

      if (settings.autoSaveHistory) {
        const prepared = await ensureRequestId({
          ...draft,
          body: settings.saveRequestBody ? draft.body : "",
        });
        setDraft({ ...prepared, body: draft.body });
        await persistHistory(
          prepared,
          settings.saveResponseMeta && next.ok ? next.status : null,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function onToggleSse() {
    if (sseConnected) {
      sseStopRef.current?.();
      sseStopRef.current = null;
      setSseConnected(false);
      return;
    }

    setSseError(null);
    setSseConnected(true);
    const session = await startSseSession(
      executePayload,
      transport,
      (event) => setSseEvents((items) => [event, ...items].slice(0, 200)),
      (error) => {
        setSseConnected(false);
        sseStopRef.current = null;
        if (error) setSseError(error);
      },
    );
    sseStopRef.current = session.stop;
    setTransport(session.transport);

    if (settings.autoSaveHistory) {
      const saved = await ensureRequestId({
        ...draft,
        name: draft.name || "SSE stream",
      });
      setDraft(saved);
      await persistHistory(saved, null);
    }
  }

  async function onToggleWs() {
    if (wsConnected) {
      wsSessionRef.current?.close();
      wsSessionRef.current = null;
      setWsConnected(false);
      return;
    }

    const session = startWsSession(
      executePayload.url.replace(/^http/i, "ws"),
      transport,
      (message) => {
        setWsMessages((items) => [...items, message].slice(-200));
        if (message.direction === "system" && message.data === "Connected") {
          setWsConnected(true);
        }
        if (message.direction === "system" && message.data === "Disconnected") {
          setWsConnected(false);
        }
      },
    );
    wsSessionRef.current = session;
    setTransport(session.transport);
    setWsConnected(true);

    if (settings.autoSaveHistory) {
      const saved = await ensureRequestId({
        ...draft,
        name: draft.name || "WebSocket",
      });
      setDraft(saved);
      void persistHistory(saved, null);
    }
  }

  function onPrimaryAction() {
    if (draft.kind === "sse") {
      void onToggleSse();
      return;
    }
    if (draft.kind === "websocket") {
      void onToggleWs();
      return;
    }
    void onSendHttp();
  }

  saveRequestRef.current = () => saveRequest();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveRequestRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function clearHistory() {
    await clearMutation.mutateAsync();
    toast.success("History cleared");
  }

  function persistEnvironmentVariables(
    envId: string,
    variablesNext: Environment["variables"],
  ) {
    const env = environments.find((item) => item.id === envId);
    if (!env) return;
    const next = environments.map((item) =>
      item.id === envId ? { ...item, variables: variablesNext } : item,
    );
    setEnvironments(next);
    void environmentUpsertMutation
      .mutateAsync({
        id: env.id,
        name: env.name,
        variables: variablesNext,
      })
      .catch(() => toast.error("Could not save environment"));
  }

  const primaryLabel =
    draft.kind === "sse"
      ? sseConnected
        ? "Stop"
        : "Listen"
      : draft.kind === "websocket"
        ? wsConnected
          ? "Disconnect"
          : "Connect"
        : loading
          ? "Sending"
          : "Send";

  const requestLoading = !isNew && requestQuery.isLoading;

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-dvh min-h-0 bg-background text-foreground"
    >
      <ResizablePanel
        defaultSize="20%"
        minSize="14%"
        maxSize="30%"
        className="flex min-h-0 flex-col bg-sidebar"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <p className="font-mono text-xs text-muted-foreground uppercase">
            Reqyx
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Account menu">
                <UserIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  {sessionPending ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : user ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {user.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Signed out</span>
                  )}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() =>
                    void signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          window.location.href = "/login";
                        },
                      },
                    })
                  }
                >
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2 px-3 pb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => newRequest("http")}
          >
            <PlusIcon data-icon="inline-start" />
            HTTP request
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => newRequest("sse")}
            >
              <RadioIcon data-icon="inline-start" />
              SSE
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => newRequest("websocket")}
            >
              <WorkflowIcon data-icon="inline-start" />
              WS
            </Button>
          </div>
        </div>

        <Separator />

        <div className="px-3 py-3">
          <Label className="mb-2 block font-mono text-[0.65rem] text-muted-foreground uppercase">
            Environment
          </Label>
          <Select
            value={activeEnvId ?? undefined}
            onValueChange={(value) => {
              setActiveEnvId(value);
              void setActiveEnvMutation.mutateAsync({ id: value });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {environments.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex min-h-0 flex-[1.4] flex-col">
          <CollectionTree
            collections={collections}
            activeRequestId={requestId}
            onOpenRequest={openRequest}
            onCreateCollection={handleCreateCollection}
            onRenameCollection={handleRenameCollection}
            onDeleteCollection={handleDeleteCollection}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateRequest={handleCreateRequest}
            onRenameRequest={handleRenameRequest}
            onDeleteRequest={handleDeleteRequest}
            onSaveCurrentTo={saveCurrentToCollection}
          />
        </div>

        <Separator />

        <div className="flex max-h-48 min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="font-mono text-[0.65rem] text-muted-foreground uppercase">
              History
            </p>
            {history.length > 0 ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear history"
                onClick={() => void clearHistory()}
              >
                <Trash2Icon />
              </Button>
            ) : null}
          </div>
          <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
            {historyQuery.isLoading ? (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Spinner />
                Loading…
              </div>
            ) : history.length === 0 ? (
              <Empty className="min-h-24 items-start justify-start border-0 p-2 text-left">
                <EmptyHeader className="items-start text-left">
                  <EmptyTitle>No requests yet</EmptyTitle>
                  <EmptyDescription>
                    Save with Ctrl+S or enable auto-save on send.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-0.5">
                {history.map((item) => (
                  <Item
                    key={item.id}
                    size="xs"
                    asChild
                    className={cn(item.id === requestId && "bg-muted")}
                  >
                    <button
                      type="button"
                      onClick={() => openRequest(item.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        void removeMutation.mutateAsync({ id: item.id });
                      }}
                    >
                      <ItemContent>
                        <ItemTitle
                          className={cn(
                            "font-mono text-[0.65rem] font-semibold",
                            item.kind === "http"
                              ? methodClass[item.method]
                              : "text-brand",
                          )}
                        >
                          {item.kind === "http"
                            ? item.method
                            : item.kind.toUpperCase()}
                        </ItemTitle>
                        <ItemDescription className="font-mono">
                          {item.url || item.name}
                        </ItemDescription>
                      </ItemContent>
                    </button>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </ScrollArea>
        </div>

        <Separator />
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <Settings2Icon className="size-3.5 text-muted-foreground" />
            <p className="font-mono text-[0.65rem] text-muted-foreground uppercase">
              Save options
            </p>
          </div>
          <p className="text-[0.7rem] text-muted-foreground">
            Press Ctrl+S to save. Auto-save on send is off by default.
          </p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="auto-save" className="text-xs font-normal">
              Auto-save on send
            </Label>
            <Switch
              id="auto-save"
              size="sm"
              checked={settings.autoSaveHistory}
              onCheckedChange={(checked) =>
                void updateSettings({ autoSaveHistory: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="save-body" className="text-xs font-normal">
              Save request body
            </Label>
            <Switch
              id="save-body"
              size="sm"
              checked={settings.saveRequestBody}
              onCheckedChange={(checked) =>
                void updateSettings({ saveRequestBody: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="save-meta" className="text-xs font-normal">
              Save status codes
            </Label>
            <Switch
              id="save-meta"
              size="sm"
              checked={settings.saveResponseMeta}
              onCheckedChange={(checked) =>
                void updateSettings({ saveResponseMeta: checked })
              }
            />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize="80%" minSize="50%" className="min-w-0">
        {requestLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading request…
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  placeholder="Request name"
                  aria-label="Request name"
                />
                {isDirty ? (
                  <Badge variant="secondary" className="shrink-0 font-mono text-[0.65rem]">
                    Unsaved
                  </Badge>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant={isDirty ? "default" : "outline"}
                  size="sm"
                  onClick={() => void saveRequest()}
                  className={cn(
                    isDirty && "bg-brand text-brand-foreground hover:bg-brand/90",
                  )}
                >
                  <SaveIcon data-icon="inline-start" />
                  Save
                  <KbdGroup className="ml-1 hidden sm:inline-flex">
                    <Kbd>Ctrl</Kbd>
                    <Kbd>S</Kbd>
                  </KbdGroup>
                </Button>
                <Badge
                  variant="secondary"
                  className={cn(
                    "rounded-md font-mono uppercase",
                    (transport === "extension" || transport === "proxy") &&
                      "bg-brand-muted text-brand",
                  )}
                >
                  {transport === "extension"
                    ? "Extension"
                    : transport === "proxy"
                      ? "Proxy"
                      : "Browser"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleExtension()}
                  disabled={!extension.installed}
                >
                  {extension.connected ? (
                    <UnplugIcon data-icon="inline-start" />
                  ) : (
                    <CableIcon data-icon="inline-start" />
                  )}
                  {extension.installed
                    ? extension.connected
                      ? "Disconnect"
                      : "Connect"
                    : "No extension"}
                </Button>
              </div>
            </header>
            <Separator />

            <div className="flex items-center gap-2 px-4 py-3">
              <Select
                value={draft.kind}
                onValueChange={(value) => {
                  const kind = value as RequestKind;
                  setDraft((current) =>
                    createDraft({
                      ...current,
                      kind,
                      url:
                        kind === "websocket"
                          ? current.url.replace(/^http/i, "ws")
                          : kind === "sse"
                            ? current.url.replace(/^ws/i, "http")
                            : current.url,
                      method: kind === "http" ? current.method : "GET",
                    }),
                  );
                }}
              >
                <SelectTrigger className="w-32 shrink-0 font-mono text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="sse">SSE</SelectItem>
                    <SelectItem value="websocket">WebSocket</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {draft.kind === "http" ? (
                <Select
                  value={draft.method}
                  onValueChange={(value) =>
                    patch({ method: value as HttpMethod })
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "w-28 shrink-0 font-mono text-xs font-semibold",
                      methodClass[draft.method],
                    )}
                    aria-label="HTTP method"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {HTTP_METHODS.map((method) => (
                        <SelectItem
                          key={method}
                          value={method}
                          className={cn(
                            "font-mono text-xs font-semibold",
                            methodClass[method],
                          )}
                        >
                          {method}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : null}

              <InputGroup className="h-8 min-w-0 flex-1">
                <InputGroupInput
                  value={draft.url}
                  onChange={(event) => patch({ url: event.target.value })}
                placeholder={
                  draft.kind === "websocket"
                    ? "ws://localhost:8080/ws"
                    : "http://localhost:8080/api"
                }
                  className="font-mono text-xs"
                  aria-label="Request URL"
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      onPrimaryAction();
                    }
                  }}
                />
                <InputGroupAddon align="inline-end" className="hidden sm:flex">
                  <InputGroupText>
                    <KbdGroup>
                      <Kbd>Ctrl</Kbd>
                      <Kbd>↵</Kbd>
                    </KbdGroup>
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>

              <Button
                className="bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={loading || !draft.url.trim()}
                onClick={onPrimaryAction}
              >
                {loading ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                {primaryLabel}
              </Button>
            </div>
            <Separator />

            <ResizablePanelGroup
              orientation="horizontal"
              className="min-h-0 flex-1"
            >
              <ResizablePanel defaultSize="50%" minSize="30%" className="min-w-0">
                <Tabs
                  value={tab}
                  onValueChange={(value) => setTab(value as EditorTab)}
                  className="flex h-full min-h-0 flex-col gap-0"
                >
                  <div className="px-3 py-2">
                    <TabsList>
                      <TabsTrigger value="params">Params</TabsTrigger>
                      <TabsTrigger value="headers">Headers</TabsTrigger>
                      {draft.kind === "http" ? (
                        <TabsTrigger value="body">Body</TabsTrigger>
                      ) : null}
                      <TabsTrigger value="auth">Auth</TabsTrigger>
                      <TabsTrigger value="code">Code</TabsTrigger>
                    </TabsList>
                  </div>
                  <Separator />
                  <TabsContent
                    value="params"
                    className="mt-0 min-h-0 flex-1 overflow-auto p-4 outline-none"
                  >
                    <div className="mb-3 flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">
                        Use {"{{baseUrl}}"} or other environment variables in
                        URL, headers, and body.
                      </p>
                      <KeyValueEditor
                        rows={
                          environments.find((item) => item.id === activeEnvId)
                            ?.variables ?? [emptyKeyValue()]
                        }
                        onChange={(variablesNext) => {
                          if (!activeEnvId) return;
                          void persistEnvironmentVariables(
                            activeEnvId,
                            variablesNext,
                          );
                        }}
                        keyPlaceholder="Variable"
                      />
                    </div>
                    <Separator className="my-4" />
                    <KeyValueEditor
                      rows={draft.params}
                      onChange={(params) => patch({ params })}
                      keyPlaceholder="Param"
                    />
                  </TabsContent>
                  <TabsContent
                    value="headers"
                    className="mt-0 min-h-0 flex-1 overflow-auto p-4 outline-none"
                  >
                    <KeyValueEditor
                      rows={draft.headers}
                      onChange={(headers) => patch({ headers })}
                      keyPlaceholder="Header"
                    />
                  </TabsContent>
                  <TabsContent
                    value="body"
                    className="mt-0 min-h-0 flex-1 overflow-auto p-4 outline-none"
                  >
                    <div className="mb-3">
                      <Select
                        value={draft.bodyMode}
                        onValueChange={(value) =>
                          patch({
                            bodyMode: value as RequestDraft["bodyMode"],
                          })
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="raw">Raw</SelectItem>
                            <SelectItem value="urlencoded">
                              x-www-form-urlencoded
                            </SelectItem>
                            <SelectItem value="formdata">form-data</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    {draft.bodyMode === "none" ? (
                      <p className="text-sm text-muted-foreground">
                        This request has no body.
                      </p>
                    ) : (
                      <BodyEditor
                        value={draft.body}
                        onChange={(body) => patch({ body })}
                      />
                    )}
                  </TabsContent>
                  <TabsContent
                    value="auth"
                    className="mt-0 min-h-0 flex-1 overflow-auto p-4 outline-none"
                  >
                    <AuthEditor
                      value={draft.auth}
                      onChange={(auth) => patch({ auth })}
                    />
                  </TabsContent>
                  <TabsContent
                    value="code"
                    className="mt-0 min-h-0 flex-1 overflow-hidden outline-none"
                  >
                    <CodeGen payload={executePayload} />
                  </TabsContent>
                </Tabs>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize="50%" minSize="30%" className="min-w-0">
                <section className="flex h-full min-h-0 flex-col bg-card">
                  {draft.kind === "sse" ? (
                    <SseView
                      events={sseEvents}
                      connected={sseConnected}
                      error={sseError}
                      onClear={() => setSseEvents([])}
                    />
                  ) : draft.kind === "websocket" ? (
                    <WebSocketView
                      messages={wsMessages}
                      connected={wsConnected}
                      onClear={() => setWsMessages([])}
                      onSend={(data) => {
                        wsSessionRef.current?.send(data);
                        setWsMessages((items) => [
                          ...items,
                          {
                            id: createId(),
                            direction: "out",
                            data,
                            at: Date.now(),
                          },
                        ]);
                      }}
                    />
                  ) : (
                    <>
                      <div className="px-4 py-2.5">
                        <p className="text-xs font-medium">Response</p>
                      </div>
                      <Separator />
                      <div className="min-h-0 flex-1">
                        <ResponseView result={result} loading={loading} />
                      </div>
                    </>
                  )}
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

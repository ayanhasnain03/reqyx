"use client";

import { useState } from "react";
import type {
  Collection,
  CollectionItem,
  HttpMethod,
  RequestDraft,
  RequestKind,
} from "@repo/core";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@repo/ui/components/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  ChevronRightIcon,
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const methodClass: Record<HttpMethod, string> = {
  GET: "text-method-get-fg",
  POST: "text-method-post-fg",
  PUT: "text-method-put-fg",
  PATCH: "text-method-patch-fg",
  DELETE: "text-method-delete-fg",
  HEAD: "text-method-options-fg",
  OPTIONS: "text-method-options-fg",
};

type PromptKind =
  | { type: "collection-create" }
  | { type: "collection-rename"; collectionId: string; current: string }
  | {
    type: "folder-create";
    collectionId: string;
    parentFolderId: string | null;
  }
  | {
    type: "folder-rename";
    collectionId: string;
    folderId: string;
    current: string;
  }
  | {
    type: "request-create";
    collectionId: string;
    parentFolderId: string | null;
    kind: RequestKind;
  }
  | {
    type: "request-rename";
    requestId: string;
    current: string;
  };

type ConfirmKind =
  | { type: "collection"; id: string; name: string }
  | { type: "folder"; collectionId: string; folderId: string; name: string }
  | {
    type: "request";
    collectionId: string;
    itemId: string;
    requestId: string;
    name: string;
  };

export type CollectionTreeProps = {
  collections: Collection[];
  activeRequestId: string;
  onOpenRequest: (id: string) => void;
  onCreateCollection: (name: string) => Promise<void>;
  onRenameCollection: (id: string, name: string) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
  onCreateFolder: (
    collectionId: string,
    parentFolderId: string | null,
    name: string,
  ) => Promise<void>;
  onRenameFolder: (
    collectionId: string,
    folderId: string,
    name: string,
  ) => Promise<void>;
  onDeleteFolder: (collectionId: string, folderId: string) => Promise<void>;
  onCreateRequest: (
    collectionId: string,
    parentFolderId: string | null,
    kind: RequestKind,
    name: string,
  ) => Promise<void>;
  onRenameRequest: (requestId: string, name: string) => Promise<void>;
  onDeleteRequest: (
    collectionId: string,
    itemId: string,
    requestId: string,
  ) => Promise<void>;
  onSaveCurrentTo: (
    collectionId: string,
    parentFolderId: string | null,
  ) => Promise<void>;
};

function requestById(
  collection: Collection,
  requestId: string,
): RequestDraft | undefined {
  return collection.requests.find((item) => item.id === requestId);
}

function promptTitle(prompt: PromptKind): string {
  switch (prompt.type) {
    case "collection-create":
      return "New collection";
    case "collection-rename":
      return "Rename collection";
    case "folder-create":
      return "New folder";
    case "folder-rename":
      return "Rename folder";
    case "request-create":
      return "New request";
    case "request-rename":
      return "Rename request";
  }
}

function promptDefault(prompt: PromptKind): string {
  switch (prompt.type) {
    case "collection-create":
      return "Ecommerce";
    case "collection-rename":
    case "folder-rename":
    case "request-rename":
      return prompt.current;
    case "folder-create":
      return "Auth";
    case "request-create":
      return prompt.kind === "http"
        ? "Get products"
        : prompt.kind === "sse"
          ? "Events stream"
          : "Realtime";
  }
}

export function CollectionTree({
  collections,
  activeRequestId,
  onOpenRequest,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateRequest,
  onRenameRequest,
  onDeleteRequest,
  onSaveCurrentTo,
}: CollectionTreeProps) {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [busy, setBusy] = useState(false);

  const isEmpty = collections.length === 0;

  const openPrompt = (next: PromptKind) => {
    setPrompt(next);
    setPromptValue(promptDefault(next));
  };

  const toggleOpen = (id: string, force?: boolean) => {
    setOpenIds((current) => ({
      ...current,
      [id]: force ?? !(current[id] ?? true),
    }));
  };

  const isOpen = (id: string) => openIds[id] ?? true;

  async function submitPrompt() {
    if (!prompt) return;
    const name = promptValue.trim();
    if (!name) return;
    setBusy(true);
    try {
      switch (prompt.type) {
        case "collection-create":
          await onCreateCollection(name);
          break;
        case "collection-rename":
          await onRenameCollection(prompt.collectionId, name);
          break;
        case "folder-create":
          await onCreateFolder(
            prompt.collectionId,
            prompt.parentFolderId,
            name,
          );
          break;
        case "folder-rename":
          await onRenameFolder(prompt.collectionId, prompt.folderId, name);
          break;
        case "request-create":
          await onCreateRequest(
            prompt.collectionId,
            prompt.parentFolderId,
            prompt.kind,
            name,
          );
          break;
        case "request-rename":
          await onRenameRequest(prompt.requestId, name);
          break;
      }
      setPrompt(null);
    } finally {
      setBusy(false);
    }
  }

  async function submitConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      switch (confirm.type) {
        case "collection":
          await onDeleteCollection(confirm.id);
          break;
        case "folder":
          await onDeleteFolder(confirm.collectionId, confirm.folderId);
          break;
        case "request":
          await onDeleteRequest(
            confirm.collectionId,
            confirm.itemId,
            confirm.requestId,
          );
          break;
      }
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className="font-mono text-[0.65rem] text-muted-foreground uppercase">
          Collections
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New collection"
          onClick={() => openPrompt({ type: "collection-create" })}
        >
          <PlusIcon />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        {isEmpty ? (
          <Empty className="min-h-24 items-start justify-start border-0 p-2 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>No collections</EmptyTitle>
              <EmptyDescription>
                Create one like Ecommerce, then add folders and requests.
              </EmptyDescription>
            </EmptyHeader>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => openPrompt({ type: "collection-create" })}
            >
              <FolderPlusIcon data-icon="inline-start" />
              New collection
            </Button>
          </Empty>
        ) : (
          <div className="flex flex-col gap-0.5">
            {collections.map((collection) => (
              <CollectionNode
                key={collection.id}
                collection={collection}
                activeRequestId={activeRequestId}
                isOpen={isOpen}
                toggleOpen={toggleOpen}
                onOpenRequest={onOpenRequest}
                openPrompt={openPrompt}
                setConfirm={setConfirm}
                onSaveCurrentTo={onSaveCurrentTo}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog
        open={!!prompt}
        onOpenChange={(open) => {
          if (!open) setPrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{prompt ? promptTitle(prompt) : ""}</DialogTitle>
            <DialogDescription>
              Enter a name. You can rename anytime from the context menu.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={promptValue}
            onChange={(event) => setPromptValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitPrompt();
              }
            }}
            placeholder="Name"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPrompt(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitPrompt()}
              disabled={busy || !promptValue.trim()}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirm?.name}?</DialogTitle>
            <DialogDescription>
              {confirm?.type === "collection"
                ? "This removes the collection and its folders. Requests stay in history."
                : confirm?.type === "folder"
                  ? "This removes the folder and nested items from the collection."
                  : "This removes the request from the collection. It stays in history."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitConfirm()}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type NodeShared = {
  collection: Collection;
  activeRequestId: string;
  isOpen: (id: string) => boolean;
  toggleOpen: (id: string, force?: boolean) => void;
  onOpenRequest: (id: string) => void;
  openPrompt: (prompt: PromptKind) => void;
  setConfirm: (confirm: ConfirmKind) => void;
  onSaveCurrentTo: (
    collectionId: string,
    parentFolderId: string | null,
  ) => Promise<void>;
};

function CollectionNode({
  collection,
  activeRequestId,
  isOpen,
  toggleOpen,
  onOpenRequest,
  openPrompt,
  setConfirm,
  onSaveCurrentTo,
}: NodeShared) {
  const open = isOpen(collection.id);

  return (
    <Collapsible open={open} onOpenChange={() => toggleOpen(collection.id)}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group flex items-center gap-0.5 rounded-md hover:bg-muted/70">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-xs"
              >
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-90",
                  )}
                />
                <FolderIcon className="size-3.5 shrink-0 text-brand" />
                <span className="truncate font-medium">{collection.name}</span>
              </button>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100"
              aria-label="Collection actions"
              onClick={(event) => {
                event.preventDefault();
                openPrompt({
                  type: "folder-create",
                  collectionId: collection.id,
                  parentFolderId: null,
                });
              }}
            >
              <FolderPlusIcon />
            </Button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={() =>
                openPrompt({
                  type: "request-create",
                  collectionId: collection.id,
                  parentFolderId: null,
                  kind: "http",
                })
              }
            >
              <FilePlusIcon />
              New request
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                openPrompt({
                  type: "folder-create",
                  collectionId: collection.id,
                  parentFolderId: null,
                })
              }
            >
              <FolderPlusIcon />
              New folder
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => void onSaveCurrentTo(collection.id, null)}
            >
              <PlusIcon />
              Save current here
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={() =>
                openPrompt({
                  type: "collection-rename",
                  collectionId: collection.id,
                  current: collection.name,
                })
              }
            >
              <PencilIcon />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={() =>
                setConfirm({
                  type: "collection",
                  id: collection.id,
                  name: collection.name,
                })
              }
            >
              <Trash2Icon />
              Delete
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        <div className="ml-3 flex flex-col gap-0.5 border-l border-border/70 pl-1.5">
          {collection.items.length === 0 ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">
              Empty — right-click to add
            </p>
          ) : (
            collection.items.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                {...{
                  collection,
                  activeRequestId,
                  isOpen,
                  toggleOpen,
                  onOpenRequest,
                  openPrompt,
                  setConfirm,
                  onSaveCurrentTo,
                }}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TreeItem({
  item,
  collection,
  activeRequestId,
  isOpen,
  toggleOpen,
  onOpenRequest,
  openPrompt,
  setConfirm,
  onSaveCurrentTo,
}: NodeShared & { item: CollectionItem }) {
  if (item.type === "folder") {
    const open = isOpen(item.id);
    return (
      <Collapsible open={open} onOpenChange={() => toggleOpen(item.id)}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="group flex items-center gap-0.5 rounded-md hover:bg-muted/70">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-xs"
                >
                  <ChevronRightIcon
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-90",
                    )}
                  />
                  <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.name}</span>
                </button>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100"
                aria-label="Add request"
                onClick={() =>
                  openPrompt({
                    type: "request-create",
                    collectionId: collection.id,
                    parentFolderId: item.id,
                    kind: "http",
                  })
                }
              >
                <FilePlusIcon />
              </Button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuGroup>
              <ContextMenuItem
                onClick={() =>
                  openPrompt({
                    type: "request-create",
                    collectionId: collection.id,
                    parentFolderId: item.id,
                    kind: "http",
                  })
                }
              >
                <FilePlusIcon />
                New request
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  openPrompt({
                    type: "folder-create",
                    collectionId: collection.id,
                    parentFolderId: item.id,
                  })
                }
              >
                <FolderPlusIcon />
                New folder
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => void onSaveCurrentTo(collection.id, item.id)}
              >
                <PlusIcon />
                Save current here
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem
                onClick={() =>
                  openPrompt({
                    type: "folder-rename",
                    collectionId: collection.id,
                    folderId: item.id,
                    current: item.name,
                  })
                }
              >
                <PencilIcon />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onClick={() =>
                  setConfirm({
                    type: "folder",
                    collectionId: collection.id,
                    folderId: item.id,
                    name: item.name,
                  })
                }
              >
                <Trash2Icon />
                Delete
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
        <CollapsibleContent>
          <div className="ml-3 flex flex-col gap-0.5 border-l border-border/70 pl-1.5">
            {item.children.map((child) => (
              <TreeItem
                key={child.id}
                item={child}
                collection={collection}
                activeRequestId={activeRequestId}
                isOpen={isOpen}
                toggleOpen={toggleOpen}
                onOpenRequest={onOpenRequest}
                openPrompt={openPrompt}
                setConfirm={setConfirm}
                onSaveCurrentTo={onSaveCurrentTo}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const request = requestById(collection, item.requestId);
  const active = item.requestId === activeRequestId;
  const label = request?.name || request?.url || "Untitled";
  const methodLabel =
    request?.kind === "http"
      ? request.method
      : (request?.kind ?? "http").toUpperCase();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => onOpenRequest(item.requestId)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/70",
            active && "bg-muted",
          )}
        >
          <span className="w-3.5 shrink-0" />
          <span
            className={cn(
              "w-10 shrink-0 font-mono text-[0.65rem] font-semibold",
              request?.kind === "http" && request
                ? methodClass[request.method]
                : "text-brand",
            )}
          >
            {methodLabel.slice(0, 6)}
          </span>
          <span className="truncate text-muted-foreground">{label}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuItem onClick={() => onOpenRequest(item.requestId)}>
            Open
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              openPrompt({
                type: "request-rename",
                requestId: item.requestId,
                current: label,
              })
            }
          >
            <PencilIcon />
            Rename
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() =>
            setConfirm({
              type: "request",
              collectionId: collection.id,
              itemId: item.id,
              requestId: item.requestId,
              name: label,
            })
          }
        >
          <Trash2Icon />
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

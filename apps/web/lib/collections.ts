import {
  createId,
  type Collection,
  type CollectionFolder,
  type CollectionItem,
  type CollectionRequestRef,
  type RequestDraft,
} from "@repo/core";

export function createCollection(name = "New collection"): Collection {
  return {
    id: createId(),
    name,
    items: [],
    requests: [],
    updatedAt: Date.now(),
  };
}

export function createFolder(name = "New folder"): CollectionFolder {
  return {
    type: "folder",
    id: createId(),
    name,
    children: [],
  };
}

export function createRequestRef(requestId: string): CollectionRequestRef {
  return {
    type: "request",
    id: createId(),
    requestId,
  };
}

export function collectRequestIds(items: CollectionItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.type === "request") {
      ids.push(item.requestId);
    } else {
      ids.push(...collectRequestIds(item.children));
    }
  }
  return ids;
}

export function collectionRequestIds(collection: Collection): string[] {
  return collectRequestIds(collection.items);
}

export function findRequestLocation(
  items: CollectionItem[],
  requestId: string,
  path: string[] = [],
): string[] | null {
  for (const item of items) {
    if (item.type === "request" && item.requestId === requestId) {
      return path;
    }
    if (item.type === "folder") {
      const found = findRequestLocation(item.children, requestId, [
        ...path,
        item.id,
      ]);
      if (found) return found;
    }
  }
  return null;
}

function mapItems(
  items: CollectionItem[],
  mapper: (item: CollectionItem) => CollectionItem | null,
): CollectionItem[] {
  const next: CollectionItem[] = [];
  for (const item of items) {
    if (item.type === "folder") {
      const mappedChildren = mapItems(item.children, mapper);
      const folder: CollectionFolder = {
        ...item,
        children: mappedChildren,
      };
      const mapped = mapper(folder);
      if (mapped) next.push(mapped);
    } else {
      const mapped = mapper(item);
      if (mapped) next.push(mapped);
    }
  }
  return next;
}

export function renameCollectionItem(
  items: CollectionItem[],
  itemId: string,
  name: string,
): CollectionItem[] {
  return mapItems(items, (item) => {
    if (item.id !== itemId) return item;
    if (item.type === "folder") {
      return { ...item, name };
    }
    return item;
  });
}

export function removeCollectionItem(
  items: CollectionItem[],
  itemId: string,
): CollectionItem[] {
  return mapItems(items, (item) => (item.id === itemId ? null : item));
}

export function removeRequestFromItems(
  items: CollectionItem[],
  requestId: string,
): CollectionItem[] {
  return mapItems(items, (item) => {
    if (item.type === "request" && item.requestId === requestId) return null;
    return item;
  });
}

function insertIntoFolder(
  items: CollectionItem[],
  folderId: string | null,
  child: CollectionItem,
): CollectionItem[] {
  if (folderId === null) {
    return [...items, child];
  }

  return items.map((item) => {
    if (item.type !== "folder") return item;
    if (item.id === folderId) {
      return { ...item, children: [...item.children, child] };
    }
    return {
      ...item,
      children: insertIntoFolder(item.children, folderId, child),
    };
  });
}

export function addItemToCollection(
  collection: Collection,
  parentFolderId: string | null,
  child: CollectionItem,
): Collection {
  return {
    ...collection,
    items: insertIntoFolder(collection.items, parentFolderId, child),
    updatedAt: Date.now(),
  };
}

export function upsertCollectionRequest(
  collections: Collection[],
  collectionId: string,
  draft: RequestDraft,
  parentFolderId: string | null = null,
): Collection[] {
  return collections.map((collection) => {
    if (collection.id !== collectionId) return collection;

    const existing = findRequestLocation(collection.items, draft.id);
    let items = collection.items;
    if (!existing) {
      items = insertIntoFolder(
        items,
        parentFolderId,
        createRequestRef(draft.id),
      );
    }

    const requests = [
      draft,
      ...collection.requests.filter((item) => item.id !== draft.id),
    ];

    return {
      ...collection,
      items,
      requests,
      updatedAt: Date.now(),
    };
  });
}


export function itemsFromLegacyRequestIds(
  requestIds: string[],
): CollectionItem[] {
  return requestIds.map((requestId) => createRequestRef(requestId));
}

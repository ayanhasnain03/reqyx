import { Workspace } from "@/components/workspace";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
};

export default async function RequestPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { kind } = await searchParams;
  const initialKind =
    kind === "http" || kind === "sse" || kind === "websocket" ? kind : undefined;

  return <Workspace requestId={id} initialKind={initialKind} />;
}

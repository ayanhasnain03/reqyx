import type { Environment, KeyValue } from "./types";

export function resolveVariables(
  input: string,
  variables: KeyValue[],
): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, name) => {
    const found = variables.find(
      (row) => row.enabled && row.key.trim() === name,
    );
    return found ? found.value : match;
  });
}

export function activeVariables(
  environments: Environment[],
  activeId: string | null,
): KeyValue[] {
  const env = environments.find((item) => item.id === activeId);
  return env?.variables.filter((row) => row.enabled && row.key.trim()) ?? [];
}

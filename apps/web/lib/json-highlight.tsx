import type { ReactNode } from "react";

type TokenKind = "key" | "string" | "number" | "boolean" | "null" | "punctuation";

const tokenClass: Record<TokenKind, string> = {
  key: "text-json-key",
  string: "text-json-string",
  number: "text-json-number",
  boolean: "text-json-boolean",
  null: "text-json-null",
  punctuation: "text-json-punctuation",
};

function token(kind: TokenKind, value: string, key: string): ReactNode {
  return (
    <span key={key} className={tokenClass[kind]}>
      {value}
    </span>
  );
}


export function highlightJson(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let index = 0;
  let expectingKey = false;
  let stack: Array<"object" | "array"> = [];

  const push = (kind: TokenKind, value: string) => {
    nodes.push(token(kind, value, `${index++}`));
  };

  while (i < source.length) {
    const char = source[i]!;

    if (char === " " || char === "\n" || char === "\r" || char === "\t") {
      let end = i + 1;
      while (end < source.length && /\s/.test(source[end]!)) end += 1;
      nodes.push(source.slice(i, end));
      i = end;
      continue;
    }

    if (char === "{" || char === "[" || char === "}" || char === "]" || char === "," || char === ":") {
      push("punctuation", char);
      if (char === "{") {
        stack.push("object");
        expectingKey = true;
      } else if (char === "[") {
        stack.push("array");
        expectingKey = false;
      } else if (char === "}" || char === "]") {
        stack.pop();
        expectingKey = stack[stack.length - 1] === "object";
      } else if (char === ",") {
        expectingKey = stack[stack.length - 1] === "object";
      } else if (char === ":") {
        expectingKey = false;
      }
      i += 1;
      continue;
    }

    if (char === '"') {
      let end = i + 1;
      let escaped = false;
      while (end < source.length) {
        const current = source[end]!;
        if (escaped) {
          escaped = false;
        } else if (current === "\\") {
          escaped = true;
        } else if (current === '"') {
          break;
        }
        end += 1;
      }
      const literal = source.slice(i, end + 1);
      push(expectingKey ? "key" : "string", literal);
      i = end + 1;
      continue;
    }

    if (/[-0-9]/.test(char)) {
      let end = i + 1;
      while (end < source.length && /[0-9.eE+-]/.test(source[end]!)) end += 1;
      push("number", source.slice(i, end));
      i = end;
      continue;
    }

    if (source.startsWith("true", i)) {
      push("boolean", "true");
      i += 4;
      continue;
    }
    if (source.startsWith("false", i)) {
      push("boolean", "false");
      i += 5;
      continue;
    }
    if (source.startsWith("null", i)) {
      push("null", "null");
      i += 4;
      continue;
    }

    nodes.push(char);
    i += 1;
  }

  return nodes;
}

import { createId, emptyKeyValue, type Environment } from "@repo/core";

export function defaultEnvironments(): Environment[] {
  return [
    {
      id: createId(),
      name: "Local",
      variables: [
        emptyKeyValue({ key: "baseUrl", value: "http://localhost:8080" }),
        emptyKeyValue({ key: "token", value: "" }),
      ],
    },
  ];
}

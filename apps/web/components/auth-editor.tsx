"use client";

import type { AuthConfig } from "@repo/core";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

type Props = {
  value: AuthConfig;
  onChange: (value: AuthConfig) => void;
};

export function AuthEditor({ value, onChange }: Props) {
  return (
    <FieldGroup className="max-w-lg">
      <Field>
        <FieldLabel>Type</FieldLabel>
        <Select
          value={value.type}
          onValueChange={(type) =>
            onChange({ ...value, type: type as AuthConfig["type"] })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">No Auth</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="apikey">API Key</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {value.type === "bearer" ? (
        <Field>
          <FieldLabel htmlFor="auth-token">Token</FieldLabel>
          <Input
            id="auth-token"
            value={value.token}
            onChange={(event) =>
              onChange({ ...value, token: event.target.value })
            }
            placeholder="eyJhbGciOi..."
            className="font-mono text-xs"
          />
        </Field>
      ) : null}

      {value.type === "basic" ? (
        <>
          <Field>
            <FieldLabel htmlFor="auth-user">Username</FieldLabel>
            <Input
              id="auth-user"
              value={value.username}
              onChange={(event) =>
                onChange({ ...value, username: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="auth-pass">Password</FieldLabel>
            <Input
              id="auth-pass"
              type="password"
              value={value.password}
              onChange={(event) =>
                onChange({ ...value, password: event.target.value })
              }
            />
          </Field>
        </>
      ) : null}

      {value.type === "apikey" ? (
        <>
          <Field>
            <FieldLabel htmlFor="auth-key">Key</FieldLabel>
            <Input
              id="auth-key"
              value={value.key}
              onChange={(event) =>
                onChange({ ...value, key: event.target.value })
              }
              placeholder="X-API-Key"
              className="font-mono text-xs"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="auth-value">Value</FieldLabel>
            <Input
              id="auth-value"
              value={value.value}
              onChange={(event) =>
                onChange({ ...value, value: event.target.value })
              }
              className="font-mono text-xs"
            />
          </Field>
          <Field>
            <FieldLabel>Add to</FieldLabel>
            <Select
              value={value.addTo}
              onValueChange={(addTo) =>
                onChange({
                  ...value,
                  addTo: addTo as AuthConfig["addTo"],
                })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="query">Query Param</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : null}
    </FieldGroup>
  );
}

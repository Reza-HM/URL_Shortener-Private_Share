import { z } from "zod";

export const TEXT_LIMIT = 1024 * 1024;
export const DEFAULT_FILE_LIMIT = 25 * 1024 * 1024;
export const ENVELOPE_OVERHEAD = 16 * 1024;
export const expirySchema = z.enum(["5m", "1h", "24h", "7d"]);
export type Expiry = z.infer<typeof expirySchema>;
export const durations: Record<Expiry, number> = {
  "5m": 300_000,
  "1h": 3_600_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
};
export const linkInput = z
  .object({
    destination: z.string().trim().min(1).max(8192),
    alias: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$/,
        "Use 4–48 letters, numbers or hyphens, starting and ending with a letter or number.",
      )
      .optional(),
    expiresIn: expirySchema.nullable().default(null),
  })
  .strict();
export const dropInput = z
  .object({
    kind: z.enum(["text", "code", "file"]),
    expiresIn: expirySchema.default("24h"),
    oneTime: z.boolean().default(false),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .optional(),
  })
  .strict();
export type LinkInput = z.infer<typeof linkInput>;
export type DropInput = z.infer<typeof dropInput>;
export interface CreatedShare {
  id: string;
  sharePath: string;
  managementPath: string;
  managementToken: string;
  expiresAt: string | null;
}
export interface DropMetadata {
  kind: "text" | "code" | "file";
  requiresPassword: boolean;
  oneTime: boolean;
  expiresAt: string;
  maxFileBytes: number;
}
export interface ManagedShare {
  id: string;
  kind: "link" | "drop";
  destination: string | null;
  code: string | null;
  createdAt: string;
  expiresAt: string | null;
  status: "active" | "expired" | "disabled" | "deleted" | "consumed";
  requests: number;
  oneTime: boolean;
  requiresPassword: boolean;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
}

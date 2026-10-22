import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const shares = pgTable(
  "shares",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull().$type<"link" | "drop">(),
    code: text("code").unique(),
    destination: text("destination"),
    payloadKind: text("payload_kind").$type<"text" | "code" | "file">(),
    storageKey: text("storage_key"),
    byteLength: integer("byte_length"),
    managementHash: text("management_hash").notNull(),
    passwordHash: text("password_hash"),
    oneTime: boolean("one_time").notNull().default(false),
    requests: integer("requests").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
  },
  (table) => [index("shares_expiry_idx").on(table.expiresAt)],
);
export const rateBuckets = pgTable("rate_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

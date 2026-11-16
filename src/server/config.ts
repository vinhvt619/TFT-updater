import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATA_MODE: z.enum(["demo", "real"]).default("real"),
  TARGET_SET: z.coerce.number().int().default(18),
  TARGET_GAME_MODE: z.string().default("standard"),
  DATABASE_URL: z.string().default("postgresql://tft:tft_local_only@localhost:5432/tft_tracker"),
  USE_PGLITE: z.string().optional().default("true"),
  TEST_DATABASE_URL: z.string().default("postgresql://tft:tft_local_only@localhost:5432/tft_tracker_test"),
  RAW_STORAGE_ROOT: z.string().default("./storage/raw"),
  SOURCES_CONFIG_PATH: z.string().default("./config/sources.json"),
  INGEST_ENABLED: z.string().transform((v) => v === "true").default("false"),
  INGEST_INTERVAL_MINUTES: z.coerce.number().int().default(120),
  FETCH_TIMEOUT_MS: z.coerce.number().int().default(60000),
  FETCH_MAX_BYTES: z.coerce.number().int().default(67108864),
  AUTO_PUBLISH: z.string().transform((v) => v === "true").default("false"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  RIOT_API_KEY: z.string().optional(),
  ACCOUNT_KEY_HMAC_SECRET: z.string().optional(),
  COMMUNITYDRAGON_VERSION: z.string().default("latest")
});

export type AppConfig = z.infer<typeof EnvSchema>;

export const env: AppConfig = EnvSchema.parse(process.env);

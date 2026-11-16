import { afterAll } from "vitest";
import { closeDb } from "../src/server/db/client";

afterAll(async () => {
  await closeDb();
});

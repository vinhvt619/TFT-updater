import { describe, it, expect } from "vitest";
import { getDb } from "../../src/server/db/client";
import { championSnapshots, evidenceRefs } from "../../src/server/db/schema";
import { GET as getEvidenceHandler } from "../../src/app/api/v1/evidence/[id]/route";
import { NextRequest } from "next/server";

describe("Evidence Endpoint & Recursive SourceRef Integrity", () => {
  it("Mọi sourceRefId trong champion snapshots đều resolve HTTP 200 từ endpoint /api/v1/evidence/[id]", async () => {
    const db = await getDb();
    const rows = await db.select().from(championSnapshots);
    expect(rows.length).toBeGreaterThan(0);

    const allSourceRefs = new Set<string>();
    const walk = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node.sourceRefIds)) {
        for (const s of node.sourceRefIds) {
          if (typeof s === "string" && s.trim()) allSourceRefs.add(s.trim());
        }
      }
      for (const k of Object.keys(node)) {
        if (typeof node[k] === "object") walk(node[k]);
      }
    };

    for (const r of rows) {
      walk(r.payload);
    }

    expect(allSourceRefs.size).toBeGreaterThan(0);

    // Không ID nào dùng Date.now() timestamp
    for (const refId of allSourceRefs) {
      expect(/_\d{13}(?:_|$)/.test(refId)).toBe(false);
    }

    // Mọi ID đều trả về HTTP 200 từ API route
    for (const refId of allSourceRefs) {
      const req = new NextRequest(`http://localhost:3000/api/v1/evidence/${refId}`);
      const res = await getEvidenceHandler(req, { params: Promise.resolve({ id: refId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).not.toBeNull();
      expect(json.data.id).toBe(refId);
      expect(json.data.datasetKind).toBe("real");
    }
  });
});

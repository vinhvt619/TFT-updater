export interface EndpointCheckResult {
  endpoint: string;
  status: number;
  expectedStatus: number[];
  passed: boolean;
  contentType: string | null;
  bodySnippet: string;
  durationMs: number;
  semanticErrors: string[];
  data?: any;
}

export async function checkAllEndpoints(port = 3002): Promise<{ allPassed: boolean; results: EndpointCheckResult[] }> {
  const baseUrl = `http://127.0.0.1:${port}`;
  const endpointsToCheck = [
    { path: "/api/health", expected: [200] },
    { path: "/api/ready", expected: [200] },
    { path: "/api/v1/releases", expected: [200] },
    { path: "/api/v1/data-status", expected: [200] },
    { path: "/api/v1/meta/sources/status", expected: [200] },
    { path: "/api/v1/meta/rankings?board=websites&mode=real", expected: [200] },
    { path: "/api/v1/meta/rankings?board=elite&mode=real", expected: [200] },
    { path: "/api/v1/champions/search?q=akali", expected: [200] },
    { path: "/meta/websites?mode=real", expected: [200] }
  ];

  const results: EndpointCheckResult[] = [];
  let allPassed = true;

  for (const item of endpointsToCheck) {
    const url = `${baseUrl}${item.path}`;
    const start = Date.now();
    const semanticErrors: string[] = [];

    try {
      const res = await fetch(url);
      const durationMs = Date.now() - start;
      const contentType = res.headers.get("content-type");
      const text = await res.text();
      let parsedData: any = undefined;
      if (contentType && contentType.includes("application/json")) {
        try {
          parsedData = JSON.parse(text);
        } catch {}
      }

      let passed = item.expected.includes(res.status);
      if (!passed) {
        semanticErrors.push(`Expected status ${item.expected.join(", ")}, got ${res.status}`);
      }

      // Deep semantic assertions
      if (item.path === "/api/v1/meta/rankings?board=websites&mode=real" && res.status === 200) {
        if (!parsedData) {
          semanticErrors.push("Response body is not valid JSON");
        } else {
          if (parsedData.datasetKind !== "real") {
            semanticErrors.push(`Expected datasetKind 'real', got '${parsedData.datasetKind}'`);
          }
          if (parsedData.publicationStatus !== "published") {
            semanticErrors.push(`Expected publicationStatus 'published', got '${parsedData.publicationStatus}'`);
          }
          if (parsedData.status !== "ranked") {
            semanticErrors.push(`Expected status 'ranked', got '${parsedData.status}'`);
          }
          if (!Array.isArray(parsedData.inputObservationIds) || parsedData.inputObservationIds.length === 0) {
            semanticErrors.push(`inputObservationIds is empty or not an array`);
          }
          if (!Array.isArray(parsedData.rows) || parsedData.rows.length === 0) {
            semanticErrors.push(`rows is empty or not an array`);
          } else {
            const hasRankedTier = parsedData.rows.some((r: any) => ["S", "A", "B", "C"].includes(r.tier));
            if (!hasRankedTier) {
              semanticErrors.push(`No rows with tier S, A, B, or C`);
            }
          }
          const rankedTotal =
            (parsedData.totals?.rankedTierS ?? parsedData.totals?.tierS ?? 0) +
            (parsedData.totals?.rankedTierA ?? parsedData.totals?.tierA ?? 0) +
            (parsedData.totals?.rankedTierB ?? parsedData.totals?.tierB ?? 0) +
            (parsedData.totals?.rankedTierC ?? parsedData.totals?.tierC ?? 0);
          if (rankedTotal <= 0) {
            semanticErrors.push(`Total ranked tier count is 0 (rankedTierS+A+B+C)`);
          }
        }
      }

      if (item.path === "/api/ready" && res.status === 200 && parsedData) {
        if (parsedData.status !== "ready" && parsedData.status !== "healthy" && !parsedData.ready) {
          semanticErrors.push(`Ready endpoint returned non-healthy status: ${JSON.stringify(parsedData)}`);
        }
      }

      if (item.path.includes("board=elite") && res.status === 200 && parsedData) {
        if (!parsedData.status || !["collecting", "ready", "stale", "error"].includes(parsedData.status)) {
          semanticErrors.push(`Elite endpoint status must be collecting|ready|stale|error, got: ${parsedData.status}`);
        }
        if (parsedData.ready === false && !parsedData.missingCredential) {
          semanticErrors.push("Elite endpoint not ready must declare missingCredential");
        }
      }

      if (item.path.includes("/api/v1/champions/search") && res.status === 200 && parsedData) {
        if (!parsedData.data || !Array.isArray(parsedData.data.items)) {
          semanticErrors.push("Champion search response missing data.items array");
        }
      }

      if (item.path === "/meta/websites?mode=real" && res.status === 200) {
        if (!text.includes("Tier") && !text.includes("đội hình") && !text.includes("Đội hình") && !text.includes("meta")) {
          semanticErrors.push("HTML body does not contain expected meta ranking content");
        }
      }

      if (semanticErrors.length > 0) {
        passed = false;
        allPassed = false;
      }

      results.push({
        endpoint: item.path,
        status: res.status,
        expectedStatus: item.expected,
        passed,
        contentType,
        bodySnippet: text.slice(0, 300),
        durationMs,
        semanticErrors,
        data: parsedData
      });

      const mark = passed ? "PASS" : "FAIL";
      console.log(`[Endpoint] ${item.path} -> ${res.status} (${durationMs}ms) [${mark}] ${semanticErrors.length > 0 ? "Errors: " + semanticErrors.join("; ") : ""}`);
    } catch (err: any) {
      allPassed = false;
      results.push({
        endpoint: item.path,
        status: 0,
        expectedStatus: item.expected,
        passed: false,
        contentType: null,
        bodySnippet: `ERROR: ${err.message}`,
        durationMs: Date.now() - start,
        semanticErrors: [`Connection error: ${err.message}`]
      });
      console.error(`[Endpoint] ${item.path} -> CONNECTION ERROR: ${err.message}`);
    }
  }

  return { allPassed, results };
}

if (process.argv[1]?.endsWith("check-production-endpoints.ts")) {
  checkAllEndpoints(3002).then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}

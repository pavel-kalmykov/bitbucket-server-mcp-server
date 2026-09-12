import { expect } from "vitest";
import { atLeast } from "./versions.js";
import { callAndParse, callRaw } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

const SECRET_SCANNING_SINCE = "8.5";

describeBitbucket(
  "secret-scanning supported",
  () => {
    test("list_secret_scanning_rules returns rules", async ({ mcp, repo }) => {
      const parsed = await callAndParse<unknown[]>(
        mcp.client,
        "list_secret_scanning_rules",
        {
          project: repo.projectKey,
          repository: repo.repoSlug,
        },
      );

      expect(Array.isArray(parsed)).toBe(true);
    });
  },
  atLeast(SECRET_SCANNING_SINCE),
);

describeBitbucket(
  "secret-scanning unsupported",
  () => {
    test("list_secret_scanning_rules returns error", async ({ mcp, repo }) => {
      const result = await callRaw(mcp.client, "list_secret_scanning_rules", {
        project: repo.projectKey,
        repository: repo.repoSlug,
      });

      expect(result.isError).toBe(true);
    });
  },
  !atLeast(SECRET_SCANNING_SINCE),
);

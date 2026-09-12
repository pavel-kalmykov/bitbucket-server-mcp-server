import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("branch restrictions", () => {
  test("list_branch_restrictions returns data", async ({ mcp, repo }) => {
    const r = await callAndParse<{ total: number; restrictions: unknown[] }>(
      mcp.client,
      "list_branch_restrictions",
      { project: repo.projectKey, repository: repo.repoSlug },
    );
    expect(typeof r.total).toBe("number");
    expect(Array.isArray(r.restrictions)).toBe(true);
  });
});

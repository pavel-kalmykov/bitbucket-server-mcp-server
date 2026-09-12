import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("default reviewers", () => {
  test("list_default_reviewer_conditions returns array", async ({
    mcp,
    repo,
  }) => {
    const r = await callAndParse<unknown[]>(
      mcp.client,
      "list_default_reviewer_conditions",
      { project: repo.projectKey, repository: repo.repoSlug },
    );
    expect(Array.isArray(r)).toBe(true);
  });
});

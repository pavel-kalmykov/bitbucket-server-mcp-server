import { expect } from "vitest";
import { callRaw } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("merge-checks", () => {
  test("manage_merge_checks returns an error for missing plugin", async ({
    mcp,
    repo,
  }) => {
    const result = await callRaw(mcp.client, "manage_merge_checks", {
      project: repo.projectKey,
      repository: repo.repoSlug,
      hookKey:
        "com.atlassian.bitbucket.server.bitbucket-build:requiredBuildsMergeCheck",
      settings: { requiredBuilds: 1 },
    });

    expect(result.isError).toBe(true);
  });
});

import { expect } from "vitest";
import { callRaw } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("insights", () => {
  test("get_build_status returns result for a commit", async ({
    mcp,
    repo,
  }) => {
    const result = await callRaw(mcp.client, "get_build_status", {
      commitId: repo.mainCommitId,
    });

    expect(result.isError).toBeFalsy();
  });
});

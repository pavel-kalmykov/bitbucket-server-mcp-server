import { expect } from "vitest";
import { test, describeBitbucket } from "./e2e-suite.js";
import { callAndParse } from "../tool-test-utils.js";

describeBitbucket("branches", () => {
  test("list_branches returns main and feature", async ({ mcp, pr }) => {
    const parsed = await callAndParse<{
      total: number;
      branches: Array<{ displayId: string }>;
    }>(mcp.client, "list_branches", {
      project: pr.projectKey,
      repository: pr.repoSlug,
    });

    expect(parsed.total).toBeGreaterThanOrEqual(2);
    const ids = parsed.branches.map((b) => b.displayId);
    expect(ids).toContain("main");
    expect(ids).toContain("feature");
  });

  test("manage_branches create creates a new branch", async ({ mcp, pr }) => {
    const parsed = await callAndParse<{ displayId: string }>(
      mcp.client,
      "manage_branches",
      {
        action: "create",
        project: pr.projectKey,
        repository: pr.repoSlug,
        branch: "e2e-branch",
        startPoint: pr.mainCommitId,
      },
    );

    expect(parsed.displayId).toBe("e2e-branch");
  });

  test("get_commit returns the main commit", async ({ mcp, pr }) => {
    const parsed = await callAndParse<{ id: string; message: string }>(
      mcp.client,
      "get_commit",
      {
        project: pr.projectKey,
        repository: pr.repoSlug,
        commitId: pr.mainCommitId,
      },
    );

    expect(parsed.id).toBe(pr.mainCommitId);
  });
});

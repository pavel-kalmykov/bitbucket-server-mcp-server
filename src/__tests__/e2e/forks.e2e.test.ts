import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("forks", () => {
  test("list_forks returns data", async ({ mcp, repo }) => {
    const r = await callAndParse<{ total: number }>(mcp.client, "list_forks", {
      project: repo.projectKey,
      repository: repo.repoSlug,
      limit: 1,
    });
    expect(typeof r.total).toBe("number");
  });

  test("fork_repository creates a fork", async ({ bb, mcp, repo }) => {
    const forkName = "e2e-fork-" + Date.now();
    const r = await callAndParse<{ slug: string; project: { key: string } }>(
      mcp.client,
      "fork_repository",
      {
        project: repo.projectKey,
        repository: repo.repoSlug,
        name: forkName,
      },
    );
    await bb.api.delete(`projects/${r.project.key}/repos/${r.slug}`);
  });
});

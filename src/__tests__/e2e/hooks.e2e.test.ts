import { expect } from "vitest";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";

describeBitbucket("hooks", () => {
  test("manage_repository_hooks enable flips a bundled hook", async ({
    mcp,
    repo,
  }) => {
    const parsed = await callAndParse<{ enabled: boolean; hookKey: string }>(
      mcp.client,
      "manage_repository_hooks",
      {
        action: "enable",
        project: repo.projectKey,
        repository: repo.repoSlug,
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
      },
    );

    expect(parsed.enabled).toBe(true);
  });

  test("manage_repository_hooks disable flips it back", async ({
    mcp,
    repo,
  }) => {
    const parsed = await callAndParse<{ enabled: boolean; hookKey: string }>(
      mcp.client,
      "manage_repository_hooks",
      {
        action: "disable",
        project: repo.projectKey,
        repository: repo.repoSlug,
        hookKey:
          "com.atlassian.bitbucket.server.bitbucket-bundled-hooks:force-push-hook",
      },
    );

    expect(parsed.enabled).toBe(false);
  });
});

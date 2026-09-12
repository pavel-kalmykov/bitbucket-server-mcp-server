import { describe, test as base } from "vitest";
import { readFileSync } from "node:fs";
import { activeVersion } from "./versions.js";
import {
  attachStartedBitbucket,
  startBitbucket,
  type StartedBitbucket,
} from "./bitbucket-container.js";
import { setupMcpAgainst, type McpAgainstBitbucket } from "./mcp-harness.js";

export interface RepoScenario {
  readonly projectKey: string;
  readonly repoSlug: string;
  readonly mainCommitId: string;
}

export interface PrScenario extends RepoScenario {
  readonly featureBranch: string;
  readonly prId: number;
}

/** Base-36 timestamp; unique across files and even across worker recycles. */
function uniqueSuffix(): string {
  return Date.now().toString(36);
}

async function commitFile(
  bb: StartedBitbucket,
  projectKey: string,
  repoSlug: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  sourceBranch?: string,
): Promise<string> {
  const form = new FormData();
  form.append("content", content);
  form.append("message", message);
  form.append("branch", branch);
  if (sourceBranch !== undefined) form.append("sourceBranch", sourceBranch);
  const result = await bb.api
    .put(`projects/${projectKey}/repos/${repoSlug}/browse/${path}`, {
      body: form,
    })
    .json<{ id: string }>();
  return result.id;
}

export interface BitbucketSuite {
  bb: StartedBitbucket;
  mcp: McpAgainstBitbucket;
  repo: RepoScenario;
  pr: PrScenario;
}

/**
 * The suite's resources as vitest fixtures. `bb` and `mcp` are worker
 * scoped, and vitest re-runs worker fixtures per file, so without an
 * orchestrator every file would boot its own container (~45s charged to
 * its first test). When `E2E_ATTACH_FILE` points at the descriptor
 * written by `scripts/e2e-up.ts`, `bb` attaches to that orchestrator's
 * container instead (instant, and `stop` is a no-op), which is what
 * keeps one container per version; the orchestrator owns the lifecycle.
 * `repo` and `pr` are file scoped and provision a unique project + repo
 * (plus a feature branch and an open PR for `pr`), so files never step
 * on each other's refs and no post-test cleanup is needed: in attach
 * mode the container dies with `scripts/e2e-down.ts`, otherwise with
 * the run.
 *
 * Setting these up counts against `testTimeout`, not `hookTimeout`: vitest
 * charges fixture setup to whichever test triggers it, and there is no
 * per-fixture timeout. `vitest.config.e2e.ts` sizes `testTimeout` for a
 * container boot because of this.
 */
export const test = base.extend<BitbucketSuite>({
  bb: [
    // The empty pattern is required, not stylistic: vitest reads the
    // destructuring to learn which fixtures this one depends on, and rejects
    // a plain parameter with FixtureParseError. This fixture depends on none.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const version = activeVersion();
      const attachFile = process.env.E2E_ATTACH_FILE;
      const bb = attachFile
        ? await attachStartedBitbucket(
            JSON.parse(readFileSync(attachFile, "utf8")).url,
            version.name,
          )
        : await startBitbucket(version);
      await use(bb);
      await bb.stop();
    },
    { scope: "worker" },
  ],
  mcp: [
    async ({ bb }, use) => {
      const mcp = await setupMcpAgainst(bb);
      await use(mcp);
      await mcp.close();
    },
    { scope: "worker" },
  ],
  repo: [
    async ({ bb }, use) => {
      const suffix = uniqueSuffix();
      const projectKey = `E2E${suffix.toUpperCase()}`;
      const repoSlug = `repo-${suffix}`;
      await bb.api.post("projects", {
        json: { key: projectKey, name: projectKey },
      });
      await bb.api.post(`projects/${projectKey}/repos`, {
        json: { name: repoSlug },
      });
      const mainCommitId = await commitFile(
        bb,
        projectKey,
        repoSlug,
        "main",
        "README.md",
        "hello\n",
        "init",
      );
      await use({ projectKey, repoSlug, mainCommitId });
    },
    { scope: "file" },
  ],
  pr: [
    async ({ bb, repo }, use) => {
      const featureBranch = "feature";
      await commitFile(
        bb,
        repo.projectKey,
        repo.repoSlug,
        featureBranch,
        "CHANGE.md",
        "change\n",
        "change",
        "main",
      );
      const pr = await bb.api
        .post(
          `projects/${repo.projectKey}/repos/${repo.repoSlug}/pull-requests`,
          {
            json: {
              title: "E2E PR",
              fromRef: {
                id: "refs/heads/feature",
                repository: {
                  slug: repo.repoSlug,
                  project: { key: repo.projectKey },
                },
              },
              toRef: {
                id: "refs/heads/main",
                repository: {
                  slug: repo.repoSlug,
                  project: { key: repo.projectKey },
                },
              },
            },
          },
        )
        .json<{ id: number }>();
      await use({ ...repo, featureBranch, prId: pr.id });
    },
    { scope: "file" },
  ],
});

/**
 * Names the suite after the version under test, so a CI log line says which
 * Bitbucket produced it. `enabled` is how a suite opts out on versions that
 * lack the feature it covers, in place of the version-partitioned lists the
 * matrix used to need.
 */
export function describeBitbucket(
  name: string,
  fn: () => void,
  enabled = true,
): void {
  describe.skipIf(!enabled)(`${name}: Bitbucket ${activeVersion().name}`, fn);
}

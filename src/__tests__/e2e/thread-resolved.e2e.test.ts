import { expect } from "vitest";
import { atLeast, THREAD_RESOLVED_SINCE } from "./versions.js";
import type { KyInstance } from "ky";
import { callAndParse } from "../tool-test-utils.js";
import { test, describeBitbucket } from "./e2e-suite.js";
import type { RestComment } from "../../generated/types.js";

type CommentPayload = Pick<
  RestComment,
  "id" | "version" | "state" | "severity"
> & { threadResolved?: boolean };

type CreateCommentArgs = {
  api: KyInstance;
  pr: { projectKey: string; repoSlug: string; prId: number };
  text: string;
};

async function createComment({
  api,
  pr,
  text,
}: CreateCommentArgs): Promise<CommentPayload> {
  return api
    .post(
      `projects/${pr.projectKey}/repos/${pr.repoSlug}/pull-requests/${pr.prId}/comments`,
      { json: { text } },
    )
    .json<CommentPayload>();
}

/**
 * Two mirrored suites (one per supported / unsupported partition) keep
 * the assertions unconditional. The "supported" suite expects
 * threadResolved to round-trip via the edit PUT; the "unsupported" suite
 * expects the server to silently swallow the field (the Bitbucket API
 * tolerates unknown properties), so the MCP can forward it without a
 * per-version branch of its own.
 *
 * Mutations go through the MCP client (`manage_comment`) so zod
 * validation, handler serialisation, and `formatResponse` are all part
 * of what the test exercises. The raw ky client on `bb.api` is only
 * used for setup (creating the seed comment, provisioning the repo),
 * which the MCP does not expose as tools.
 */

describeBitbucket(
  "threadResolved supported",
  () => {
    test("fresh comment starts with threadResolved=false", async ({
      bb,
      pr,
    }) => {
      const c = await createComment({ api: bb.api, pr, text: "needs review" });
      expect(c.threadResolved).toBe(false);
    });

    test("manage_comment edit {threadResolved:true} flips the flag without touching state/severity", async ({
      bb,
      mcp,
      pr,
    }) => {
      const c = await createComment({ api: bb.api, pr, text: "please look" });
      const updated = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: pr.projectKey,
          repository: pr.repoSlug,
          prId: pr.prId,
          commentId: c.id,
          version: c.version,
          threadResolved: true,
        },
      );
      expect(updated.threadResolved).toBe(true);
      expect(updated.state).toBe(c.state);
      expect(updated.severity).toBe(c.severity);
    });

    test("manage_comment edit {state:RESOLVED, threadResolved:true} updates both in one call", async ({
      bb,
      mcp,
      pr,
    }) => {
      const c = await createComment({ api: bb.api, pr, text: "fix this" });
      // Promote to BLOCKER first so `state: RESOLVED` has something to
      // toggle; both steps go through the MCP tool.
      const blocker = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: pr.projectKey,
          repository: pr.repoSlug,
          prId: pr.prId,
          commentId: c.id,
          version: c.version,
          severity: "BLOCKER",
        },
      );
      const resolved = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: pr.projectKey,
          repository: pr.repoSlug,
          prId: pr.prId,
          commentId: c.id,
          version: blocker.version,
          state: "RESOLVED",
          threadResolved: true,
        },
      );
      expect(resolved.state).toBe("RESOLVED");
      expect(resolved.threadResolved).toBe(true);
    });
  },
  atLeast(THREAD_RESOLVED_SINCE),
);

describeBitbucket(
  "threadResolved unsupported",
  () => {
    test("fresh comment omits the threadResolved field", async ({ bb, pr }) => {
      const c = await createComment({ api: bb.api, pr, text: "hey" });
      expect(c.threadResolved).toBeUndefined();
    });

    test("manage_comment edit {threadResolved:true} is silently ignored (server returns 200, field absent)", async ({
      bb,
      mcp,
      pr,
    }) => {
      const c = await createComment({ api: bb.api, pr, text: "check" });
      const updated = await callAndParse<CommentPayload>(
        mcp.client,
        "manage_comment",
        {
          action: "edit",
          project: pr.projectKey,
          repository: pr.repoSlug,
          prId: pr.prId,
          commentId: c.id,
          version: c.version,
          threadResolved: true,
        },
      );
      expect(updated.threadResolved).toBeUndefined();
    });
  },
  !atLeast(THREAD_RESOLVED_SINCE),
);

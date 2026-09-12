/**
 * One command per version: start the container, run the whole E2E suite
 * attached to it, stop the container. The suite attaches through
 * `E2E_ATTACH_FILE`, so all test files share the single container.
 *
 * Usage: node scripts/e2e-version.ts 8.9
 * (or: npm run test:e2e:version -- 8.9)
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { startBitbucket } from "../src/__tests__/e2e/bitbucket-container.js";
import { VERSIONS } from "../src/__tests__/e2e/versions.js";

// Local DX, same contract as setup-env.ts: pick up
// BITBUCKET_TIMEBOMB_LICENSE from `.env` when running outside vitest.
// No-op in CI, where the workflow injects the env directly.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const requested = process.argv[2];
const version = VERSIONS.find((v) => v.name === requested);
if (!version) {
  console.error(
    `Unknown version "${requested}". Available: ${VERSIONS.map((v) => v.name).join(", ")}`,
  );
  process.exit(1);
}

const bb = await startBitbucket(version);
const stateFile = `.e2e-container-${version.name}.json`;
writeFileSync(
  stateFile,
  JSON.stringify(
    {
      url: bb.url,
      version: version.name,
      containerId: bb.containerId,
      sharedDir: bb.sharedDir,
    },
    null,
    2,
  ),
);

try {
  const require = createRequire(import.meta.url);
  const vitestBin = join(
    dirname(require.resolve("vitest/package.json")),
    "vitest.mjs",
  );
  const child = spawnSync(
    process.execPath,
    [
      vitestBin,
      "run",
      "--config",
      "vitest.config.e2e.ts",
      `--project=e2e-${version.name}`,
    ],
    {
      stdio: "inherit",
      env: { ...process.env, E2E_ATTACH_FILE: stateFile },
    },
  );
  process.exitCode = child.status ?? 1;
} finally {
  await bb.stop();
  rmSync(stateFile, { force: true });
}

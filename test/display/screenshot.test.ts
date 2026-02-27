import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { handleCaptureScreenshot } from "../../src/handlers/screenshot-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, TestCleanup, hasDisplay } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe.skipIf(!hasDisplay())("Screenshot handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();

  beforeAll(async () => {
    ctx = await initContext();
  });

  afterEach(() => {
    cleanup.run();
  });

  it("captures a screenshot", async () => {
    const outputPath = join(FIXTURE_PATH, "screenshots", "test_capture.png");
    cleanup.track("screenshots");
    const res = await handleCaptureScreenshot(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/main.tscn",
      outputPath,
    });
    assertSuccess(res);
    expect(existsSync(outputPath)).toBe(true);
  });
});

import { describe, it, beforeAll } from "vitest";
import {
  handleGetUid,
  handleUpdateProjectUids,
} from "../../src/handlers/uid-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("UID handlers", () => {
  let ctx: ServerContext;

  beforeAll(async () => {
    ctx = await initContext();
  });

  it("gets UID for a file", async () => {
    const res = await handleGetUid(ctx, {
      projectPath: FIXTURE_PATH,
      filePath: "scenes/main.tscn",
    });
    // May or may not have a UID (depends on Godot version), but should not error
    assertSuccess(res);
  });

  it("updates project UIDs", async () => {
    const res = await handleUpdateProjectUids(ctx, {
      projectPath: FIXTURE_PATH,
    });
    assertSuccess(res);
  });
});

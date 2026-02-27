import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  handleManageAutoloads,
  handleListInputActions,
} from "../../src/handlers/settings-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Settings handlers", () => {
  let ctx: ServerContext;
  let originalProjectGodot: string;

  beforeAll(async () => {
    ctx = await initContext();
    // Backup project.godot since some tests may modify it
    originalProjectGodot = readFileSync(
      join(FIXTURE_PATH, "project.godot"),
      "utf-8",
    );
  });

  afterAll(() => {
    // Restore project.godot if it was backed up
    if (originalProjectGodot) {
      writeFileSync(
        join(FIXTURE_PATH, "project.godot"),
        originalProjectGodot,
        "utf-8",
      );
    }
  });

  it("lists autoloads", async () => {
    const res = await handleManageAutoloads(ctx, {
      projectPath: FIXTURE_PATH,
      action: "list",
    });
    assertSuccess(res);
  });

  it("adds and removes an autoload", async () => {
    const addRes = await handleManageAutoloads(ctx, {
      projectPath: FIXTURE_PATH,
      action: "add",
      name: "TestAutoload",
      scriptPath: "scripts/autoload/game_state.gd",
    });
    assertSuccess(addRes);

    const removeRes = await handleManageAutoloads(ctx, {
      projectPath: FIXTURE_PATH,
      action: "remove",
      name: "TestAutoload",
    });
    assertSuccess(removeRes);
  });

  it("lists input actions", () => {
    const res = handleListInputActions(ctx, {
      projectPath: FIXTURE_PATH,
    });
    const text = assertSuccess(res);
    expect(text).toContain("test_action");
  });
});

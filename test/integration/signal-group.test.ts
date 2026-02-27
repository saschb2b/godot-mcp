import { describe, it, beforeAll, beforeEach, afterEach } from "vitest";
import {
  handleConnectSignal,
  handleAddToGroup,
  handleRemoveFromGroup,
} from "../../src/handlers/signal-group-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, TestCleanup, copyFixture } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Signal & Group handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();
  const TEMP_SCENE = "scenes/test_siggroup.tscn";

  beforeAll(async () => {
    ctx = await initContext();
  });

  beforeEach(() => {
    copyFixture("scenes/with_nodes.tscn", TEMP_SCENE, cleanup);
  });

  afterEach(() => {
    cleanup.run();
  });

  it("adds a node to groups", async () => {
    const res = await handleAddToGroup(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player",
      groups: ["enemies", "actors"],
    });
    assertSuccess(res);
  });

  it("removes a node from a group", async () => {
    // First add
    await handleAddToGroup(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player",
      groups: ["test_group"],
    });

    const res = await handleRemoveFromGroup(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player",
      groups: ["test_group"],
    });
    assertSuccess(res);
  });

  it("connects a signal", async () => {
    // connect visibility_changed from Player to root
    const res = await handleConnectSignal(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      sourceNodePath: "root/Player",
      signalName: "visibility_changed",
      targetNodePath: "root",
      methodName: "_on_player_visibility_changed",
    });
    assertSuccess(res);
  });
});

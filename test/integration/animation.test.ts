import { describe, it, beforeAll, beforeEach, afterEach } from "vitest";
import {
  handleCreateAnimationPlayer,
  handleAddAnimation,
} from "../../src/handlers/animation-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, TestCleanup, copyFixture } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Animation handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();
  const TEMP_SCENE = "scenes/test_anim.tscn";

  beforeAll(async () => {
    ctx = await initContext();
  });

  beforeEach(() => {
    copyFixture("scenes/main.tscn", TEMP_SCENE, cleanup);
  });

  afterEach(() => {
    cleanup.run();
  });

  it("creates an animation player", async () => {
    const res = await handleCreateAnimationPlayer(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
    });
    assertSuccess(res);
  });

  it("creates an animation player with animations", async () => {
    const res = await handleCreateAnimationPlayer(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      animations: [
        {
          name: "idle",
          length: 1.0,
          loop: true,
        },
      ],
    });
    assertSuccess(res);
  });

  it("adds animation to existing player", async () => {
    // First create the player
    await handleCreateAnimationPlayer(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
    });

    const res = await handleAddAnimation(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/AnimationPlayer",
      animationName: "walk",
      length: 0.5,
    });
    assertSuccess(res);
  });
});

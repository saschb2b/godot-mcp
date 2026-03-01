import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  handleCreateScene,
  handleSaveScene,
  handleGetSceneTree,
  handleValidateScene,
  handleBatchOperations,
} from "../../src/handlers/scene-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, assertError, TestCleanup } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Scene handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();

  beforeAll(async () => {
    ctx = await initContext();
  });

  afterEach(() => {
    cleanup.run();
  });

  it("creates a Node2D scene", async () => {
    cleanup.track("scenes/test_created.tscn");
    const res = await handleCreateScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/test_created.tscn",
    });
    assertSuccess(res);
    expect(existsSync(join(FIXTURE_PATH, "scenes/test_created.tscn"))).toBe(
      true,
    );
  });

  it("creates a Node3D scene", async () => {
    cleanup.track("scenes/test_3d.tscn");
    const res = await handleCreateScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/test_3d.tscn",
      rootNodeType: "Node3D",
    });
    assertSuccess(res);
  });

  it("errors on missing scenePath", async () => {
    const res = await handleCreateScene(ctx, {
      projectPath: FIXTURE_PATH,
    });
    assertError(res);
  });

  it("errors on invalid project", async () => {
    const res = await handleCreateScene(ctx, {
      projectPath: "/nonexistent",
      scenePath: "scenes/x.tscn",
    });
    assertError(res);
  });

  it("reads scene tree", async () => {
    const res = await handleGetSceneTree(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/with_nodes.tscn",
    });
    const text = assertSuccess(res);
    expect(text).toContain("Player");
    expect(text).toContain("Sprite");
    expect(text).toContain("UI");
  });

  it("validates a valid scene", async () => {
    const res = await handleValidateScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/main.tscn",
    });
    assertSuccess(res);
  });

  it("saves scene to new path", async () => {
    cleanup.track("scenes/main_copy.tscn");
    const res = await handleSaveScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/main.tscn",
      newPath: "scenes/main_copy.tscn",
    });
    assertSuccess(res);
    expect(existsSync(join(FIXTURE_PATH, "scenes/main_copy.tscn"))).toBe(true);
  });

  describe("batch_operations", () => {
    it("errors on missing projectPath", async () => {
      const res = await handleBatchOperations(ctx, {});
      assertError(res);
    });

    it("errors on missing operations array", async () => {
      const res = await handleBatchOperations(ctx, {
        projectPath: FIXTURE_PATH,
      });
      assertError(res);
    });

    it("errors on empty operations array", async () => {
      const res = await handleBatchOperations(ctx, {
        projectPath: FIXTURE_PATH,
        operations: [],
      });
      assertError(res);
    });

    it("errors on invalid project path", async () => {
      const res = await handleBatchOperations(ctx, {
        projectPath: "/nonexistent",
        operations: [{ operation: "get_scene_tree", params: {} }],
      });
      assertError(res);
    });

    it("executes multiple operations in one process", async () => {
      cleanup.track("scenes/batch_test.tscn");
      const res = await handleBatchOperations(ctx, {
        projectPath: FIXTURE_PATH,
        operations: [
          {
            operation: "create_scene",
            params: {
              scenePath: "scenes/batch_test.tscn",
              rootNodeType: "Node2D",
            },
          },
          {
            operation: "add_node",
            params: {
              scenePath: "scenes/batch_test.tscn",
              nodeType: "Sprite2D",
              nodeName: "MySprite",
            },
          },
        ],
      });
      assertSuccess(res);
      expect(existsSync(join(FIXTURE_PATH, "scenes/batch_test.tscn"))).toBe(
        true,
      );
    });
  });
});

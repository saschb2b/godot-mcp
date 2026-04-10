/**
 * Regression tests for scenes that reference autoload singletons.
 *
 * Headless Godot fails to load() scenes whose scripts reference autoload
 * singletons (e.g. GameState.score) because autoloads aren't registered
 * in headless/script mode. These tests ensure every scene-touching
 * operation works on such scenes.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  handleAddNode,
  handleRemoveNode,
  handleReparentNode,
  handleDuplicateNode,
  handleRenameNode,
  handleSetNodeProperties,
  handleGetNodeProperties,
  handleAttachScript,
} from "../../src/handlers/node-handlers.js";
import {
  handleGetSceneTree,
  handleValidateScene,
  handleSaveScene,
} from "../../src/handlers/scene-handlers.js";
import {
  handleGetSceneInsights,
  handleGetNodeInsights,
} from "../../src/handlers/analysis-handlers.js";
import {
  handleConnectSignal,
  handleAddToGroup,
} from "../../src/handlers/signal-group-handlers.js";
import { handleCreateAnimationPlayer } from "../../src/handlers/animation-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, TestCleanup, copyFixture } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

/** Scene with a script that does `GameState.score += 1` (autoload reference). */
const AUTOLOAD_SCENE = "scenes/with_autoload_ref.tscn";

describe("Autoload regression — operations on scenes referencing autoload singletons", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();
  const TEMP_SCENE = "scenes/test_autoload.tscn";

  beforeAll(async () => {
    ctx = await initContext();
  });

  afterEach(() => {
    cleanup.run();
  });

  // --- Read-only operations (should never need load()) ---

  it("get_scene_tree works on autoload-referencing scene", () => {
    const res = handleGetSceneTree(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: AUTOLOAD_SCENE,
    });
    const text = assertSuccess(res);
    expect(text).toContain("Root");
    expect(text).toContain("Child");
    expect(text).toContain("uses_autoload.gd");
  });

  // --- Operations that use _load_scene() in GDScript ---

  it("add_node works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleAddNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodeType: "Label",
      nodeName: "ScoreLabel",
      parentNodePath: "root",
    });
    assertSuccess(res);

    const tree = handleGetSceneTree(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
    });
    expect(assertSuccess(tree)).toContain("ScoreLabel");
  });

  it("remove_node works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleRemoveNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Child",
    });
    assertSuccess(res);
  });

  it("reparent_node works on autoload-referencing scene", async () => {
    // Need at least 2 children to reparent between them
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    // First add a container node
    await handleAddNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodeType: "Node2D",
      nodeName: "Container",
      parentNodePath: "root",
    });
    const res = await handleReparentNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Child",
      newParentPath: "root/Container",
    });
    assertSuccess(res);
  });

  it("duplicate_node works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleDuplicateNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Child",
      newName: "ChildCopy",
    });
    assertSuccess(res);
  });

  it("rename_node works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleRenameNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Child",
      newName: "Sprite",
    });
    assertSuccess(res);
  });

  it("set_node_properties works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleSetNodeProperties(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Child",
      properties: { position: [50, 50] },
    });
    assertSuccess(res);
  });

  it("get_node_properties works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleGetNodeProperties(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root",
    });
    const text = assertSuccess(res);
    expect(text).toContain("name");
  });

  it("attach_script works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleAttachScript(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Child",
      scriptPath: "scripts/main.gd",
    });
    assertSuccess(res);
  });

  it("validate_scene works on autoload-referencing scene", async () => {
    const res = await handleValidateScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: AUTOLOAD_SCENE,
    });
    assertSuccess(res);
  });

  it("save_scene works on autoload-referencing scene", async () => {
    cleanup.track("scenes/autoload_copy.tscn");
    const res = await handleSaveScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: AUTOLOAD_SCENE,
      newPath: "scenes/autoload_copy.tscn",
    });
    assertSuccess(res);
  });

  it("get_scene_insights works on autoload-referencing scene", async () => {
    const res = await handleGetSceneInsights(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: AUTOLOAD_SCENE,
    });
    assertSuccess(res);
  });

  it("get_node_insights works on autoload-referencing script", async () => {
    const res = await handleGetNodeInsights(ctx, {
      projectPath: FIXTURE_PATH,
      scriptPath: "scripts/uses_autoload.gd",
    });
    assertSuccess(res);
  });

  it("connect_signal works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleConnectSignal(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      signalName: "ready",
      sourceNodePath: "root",
      targetNodePath: "root/Child",
      methodName: "_on_root_ready",
    });
    assertSuccess(res);
  });

  it("add_to_group works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleAddToGroup(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root",
      groups: ["players"],
    });
    assertSuccess(res);
  });

  it("create_animation_player works on autoload-referencing scene", async () => {
    copyFixture(AUTOLOAD_SCENE, TEMP_SCENE, cleanup);
    const res = await handleCreateAnimationPlayer(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      parentNodePath: "root",
    });
    assertSuccess(res);
  });
});

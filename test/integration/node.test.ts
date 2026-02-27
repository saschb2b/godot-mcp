import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
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
import { handleGetSceneTree } from "../../src/handlers/scene-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, assertError, TestCleanup, copyFixture } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Node handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();
  const TEMP_SCENE = "scenes/test_nodes.tscn";

  beforeAll(async () => {
    ctx = await initContext();
  });

  beforeEach(() => {
    copyFixture("scenes/with_nodes.tscn", TEMP_SCENE, cleanup);
  });

  afterEach(() => {
    cleanup.run();
  });

  it("adds a node", async () => {
    const res = await handleAddNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodeType: "Sprite2D",
      nodeName: "NewSprite",
      parentNodePath: "root",
    });
    assertSuccess(res);

    const tree = await handleGetSceneTree(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
    });
    expect(assertSuccess(tree)).toContain("NewSprite");
  });

  it("removes a node", async () => {
    const res = await handleRemoveNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/UI/Label",
    });
    assertSuccess(res);

    const tree = await handleGetSceneTree(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
    });
    expect(assertSuccess(tree)).not.toContain("Label");
  });

  it("reparents a node", async () => {
    const res = await handleReparentNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player/Sprite",
      newParentPath: "root/UI",
    });
    assertSuccess(res);
  });

  it("duplicates a node", async () => {
    const res = await handleDuplicateNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player/Sprite",
      newName: "SpriteCopy",
    });
    assertSuccess(res);

    const tree = await handleGetSceneTree(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
    });
    expect(assertSuccess(tree)).toContain("SpriteCopy");
  });

  it("renames a node", async () => {
    const res = await handleRenameNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player",
      newName: "Hero",
    });
    assertSuccess(res);
  });

  it("sets node properties", async () => {
    const res = await handleSetNodeProperties(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root/Player",
      properties: { position: [100, 200] },
    });
    assertSuccess(res);
  });

  it("gets node properties", async () => {
    const res = await handleGetNodeProperties(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root",
    });
    const text = assertSuccess(res);
    expect(text).toContain("name");
  });

  it("attaches a script", async () => {
    const res = await handleAttachScript(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: TEMP_SCENE,
      nodePath: "root",
      scriptPath: "scripts/main.gd",
    });
    assertSuccess(res);
  });

  it("errors on missing scene", async () => {
    const res = await handleAddNode(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: "scenes/nonexistent.tscn",
      nodeType: "Node2D",
      nodeName: "X",
    });
    assertError(res);
  });
});

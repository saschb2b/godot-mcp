import { describe, it, expect, beforeAll } from "vitest";
import {
  handleGetSceneInsights,
  handleGetNodeInsights,
} from "../../src/handlers/analysis-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, assertError } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Analysis handlers", () => {
  let ctx: ServerContext;

  beforeAll(async () => {
    ctx = await initContext();
  });

  describe("get_scene_insights", () => {
    it("errors on missing params", async () => {
      const res = await handleGetSceneInsights(ctx, {});
      assertError(res);
      expect(res.content[0]!.text).toContain("projectPath");
    });

    it("errors on invalid project", async () => {
      const res = await handleGetSceneInsights(ctx, {
        projectPath: "/nonexistent",
        scenePath: "scenes/main.tscn",
      });
      assertError(res);
      expect(res.content[0]!.text).toContain("Not a valid Godot project");
    });

    it("analyzes a scene", async () => {
      const res = await handleGetSceneInsights(ctx, {
        projectPath: FIXTURE_PATH,
        scenePath: "scenes/main.tscn",
      });
      const text = assertSuccess(res);
      const data = JSON.parse(text);
      expect(data.scene).toBe("scenes/main.tscn");
      expect(data.total_nodes).toBeGreaterThan(0);
      expect(data.node_types).toBeDefined();
      expect(data.root_type).toBeDefined();
    });
  });

  describe("get_node_insights", () => {
    it("errors on missing params", async () => {
      const res = await handleGetNodeInsights(ctx, {});
      assertError(res);
      expect(res.content[0]!.text).toContain("projectPath");
    });

    it("errors on nonexistent script", async () => {
      const res = await handleGetNodeInsights(ctx, {
        projectPath: FIXTURE_PATH,
        scriptPath: "scripts/nope.gd",
      });
      assertError(res);
      expect(res.content[0]!.text).toContain("does not exist");
    });

    it("analyzes a script", async () => {
      const res = await handleGetNodeInsights(ctx, {
        projectPath: FIXTURE_PATH,
        scriptPath: "scripts/main.gd",
      });
      const text = assertSuccess(res);
      const data = JSON.parse(text);
      expect(data.script).toBe("scripts/main.gd");
      expect(data.methods).toBeDefined();
    });
  });
});

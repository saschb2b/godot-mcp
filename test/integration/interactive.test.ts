import { describe, it, expect, beforeAll } from "vitest";
import {
  handleRunInteractive,
  handleSendInput,
  handleGameState,
  handleGameScreenshot,
  handleCallMethod,
  handleFindNodes,
  handleEvaluateExpression,
} from "../../src/handlers/interactive-handlers.js";
import { initContext } from "../setup.js";
import { assertError } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Interactive handlers", () => {
  let ctx: ServerContext;

  beforeAll(async () => {
    ctx = await initContext();
  });

  describe("run_interactive", () => {
    it("errors on missing projectPath", async () => {
      const res = await handleRunInteractive(ctx, {});
      assertError(res);
      expect(res.content[0]!.text).toContain("projectPath");
    });

    it("errors on invalid project", async () => {
      const res = await handleRunInteractive(ctx, {
        projectPath: "/nonexistent",
      });
      assertError(res);
      expect(res.content[0]!.text).toContain("Not a valid Godot project");
    });
  });

  describe("send_input", () => {
    it("errors on missing action", async () => {
      const res = await handleSendInput(ctx, {});
      assertError(res);
      expect(res.content[0]!.text).toContain("action");
    });

    it("errors on empty action", async () => {
      const res = await handleSendInput(ctx, { action: "" });
      assertError(res);
    });

    it("errors when no game is running", async () => {
      const res = await handleSendInput(ctx, { action: "move_up" });
      assertError(res);
      expect(res.content[0]!.text).toContain("run_interactive");
    });
  });

  describe("game_state", () => {
    it("errors when no game is running", async () => {
      const res = await handleGameState(ctx);
      assertError(res);
      expect(res.content[0]!.text).toContain("run_interactive");
    });
  });

  describe("game_screenshot", () => {
    it("errors when no game is running", async () => {
      const res = await handleGameScreenshot(ctx, {});
      assertError(res);
      expect(res.content[0]!.text).toContain("run_interactive");
    });
  });

  describe("call_method", () => {
    it("errors on missing nodePath", async () => {
      const res = await handleCallMethod(ctx, { method: "get_health" });
      assertError(res);
      expect(res.content[0]!.text).toContain("nodePath");
    });

    it("errors on missing method", async () => {
      const res = await handleCallMethod(ctx, { nodePath: "Player" });
      assertError(res);
      expect(res.content[0]!.text).toContain("method");
    });

    it("errors when no game is running", async () => {
      const res = await handleCallMethod(ctx, {
        nodePath: "Player",
        method: "take_damage",
        args: [10],
      });
      assertError(res);
      expect(res.content[0]!.text).toContain("run_interactive");
    });
  });

  describe("find_nodes", () => {
    it("errors when no game is running", async () => {
      const res = await handleFindNodes(ctx, { pattern: "Enemy*" });
      assertError(res);
      expect(res.content[0]!.text).toContain("run_interactive");
    });
  });

  describe("evaluate_expression", () => {
    it("errors on missing expression", async () => {
      const res = await handleEvaluateExpression(ctx, {});
      assertError(res);
      expect(res.content[0]!.text).toContain("expression");
    });

    it("errors on empty expression", async () => {
      const res = await handleEvaluateExpression(ctx, { expression: "" });
      assertError(res);
    });

    it("errors when no game is running", async () => {
      const res = await handleEvaluateExpression(ctx, {
        expression: "2 + 2",
      });
      assertError(res);
      expect(res.content[0]!.text).toContain("run_interactive");
    });
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import { handleRunTests } from "../../src/handlers/test-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertError } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Test runner handlers", () => {
  let ctx: ServerContext;

  beforeAll(async () => {
    ctx = await initContext();
  });

  it("errors on missing projectPath", async () => {
    const res = await handleRunTests(ctx, {});
    assertError(res);
    expect(res.content[0]!.text).toContain("projectPath");
  });

  it("errors on invalid project", async () => {
    const res = await handleRunTests(ctx, {
      projectPath: "/nonexistent/project",
    });
    assertError(res);
    expect(res.content[0]!.text).toContain("Not a valid Godot project");
  });

  it("errors when GUT is not installed", async () => {
    const res = await handleRunTests(ctx, {
      projectPath: FIXTURE_PATH,
    });
    const text = assertError(res);
    expect(text).toContain("GUT");
    expect(text).toContain("not installed");
  });

  it("errors on path traversal", async () => {
    const res = await handleRunTests(ctx, {
      projectPath: "/some/../../../etc",
    });
    assertError(res);
    expect(res.content[0]!.text).toContain("Invalid path");
  });

  it("accepts snake_case parameters", async () => {
    const res = await handleRunTests(ctx, {
      project_path: FIXTURE_PATH,
    });
    // Should get "GUT not installed" error, not "missing projectPath"
    const text = assertError(res);
    expect(text).toContain("GUT");
  });
});

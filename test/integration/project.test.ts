import { describe, it, expect, beforeAll } from "vitest";
import {
  handleListProjects,
  handleGetProjectInfo,
  handleGetGodotVersion,
} from "../../src/handlers/project-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, assertError } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";
import { dirname } from "path";

describe("Project handlers", () => {
  let ctx: ServerContext;

  beforeAll(async () => {
    ctx = await initContext();
  });

  it("get_godot_version returns a version string", async () => {
    const res = await handleGetGodotVersion(ctx);
    const text = assertSuccess(res);
    expect(text).toMatch(/^\d+\.\d+/);
  });

  it("list_projects finds the fixture", () => {
    const res = handleListProjects(ctx, {
      directory: dirname(FIXTURE_PATH),
    });
    const text = assertSuccess(res);
    const projects = JSON.parse(text) as { name: string }[];
    expect(projects.some((p) => p.name === "fixture")).toBe(true);
  });

  it("list_projects errors on missing directory", () => {
    const res = handleListProjects(ctx, {
      directory: "/nonexistent/path/xyz",
    });
    assertError(res);
  });

  it("get_project_info returns project metadata", async () => {
    const res = await handleGetProjectInfo(ctx, {
      projectPath: FIXTURE_PATH,
    });
    const text = assertSuccess(res);
    const info = JSON.parse(text) as { name: string };
    expect(info.name).toBe("MCP Test Fixture");
  });

  it("get_project_info errors on invalid project", async () => {
    const res = await handleGetProjectInfo(ctx, {
      projectPath: "/nonexistent",
    });
    assertError(res);
  });
});

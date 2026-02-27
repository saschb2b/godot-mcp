import { describe, it, expect } from "vitest";
import {
  normalizeParameters,
  convertCamelToSnakeCase,
  validatePath,
  createErrorResponse,
  isGodot44OrLater,
  findGodotProjects,
} from "../../src/utils.js";
import { FIXTURE_PATH } from "../setup.js";

describe("normalizeParameters", () => {
  it("converts snake_case keys to camelCase", () => {
    const result = normalizeParameters({
      project_path: "/foo",
      scene_path: "bar.tscn",
    });
    expect(result).toEqual({ projectPath: "/foo", scenePath: "bar.tscn" });
  });

  it("passes through camelCase keys unchanged", () => {
    const result = normalizeParameters({
      projectPath: "/foo",
      scenePath: "bar.tscn",
    });
    expect(result).toEqual({ projectPath: "/foo", scenePath: "bar.tscn" });
  });

  it("recursively normalizes nested objects", () => {
    const result = normalizeParameters({
      project_path: "/foo",
      properties: { node_name: "test" },
    });
    expect(result.properties).toEqual({ nodeName: "test" });
  });

  it("does not modify arrays", () => {
    const result = normalizeParameters({
      groups: ["a", "b"],
    });
    expect(result.groups).toEqual(["a", "b"]);
  });
});

describe("convertCamelToSnakeCase", () => {
  it("converts camelCase to snake_case using mappings", () => {
    const result = convertCamelToSnakeCase({
      projectPath: "/foo",
      scenePath: "bar.tscn",
    });
    expect(result).toEqual({ project_path: "/foo", scene_path: "bar.tscn" });
  });

  it("falls back to generic conversion for unmapped keys", () => {
    const result = convertCamelToSnakeCase({ customKey: "value" });
    expect(result).toEqual({ custom_key: "value" });
  });
});

describe("validatePath", () => {
  it("rejects paths with '..'", () => {
    expect(validatePath("../etc/passwd")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validatePath("")).toBe(false);
  });

  it("accepts normal paths", () => {
    expect(validatePath("scenes/main.tscn")).toBe(true);
    expect(validatePath("/absolute/path")).toBe(true);
  });
});

describe("createErrorResponse", () => {
  it("returns ToolResponse with isError true", () => {
    const response = createErrorResponse("something broke");
    expect(response.isError).toBe(true);
    expect(response.content[0]!.text).toBe("something broke");
  });

  it("includes possible solutions when provided", () => {
    const response = createErrorResponse("fail", ["try this", "or that"]);
    expect(response.content).toHaveLength(2);
    expect(response.content[1]!.text).toContain("try this");
  });
});

describe("isGodot44OrLater", () => {
  it("returns true for 4.4", () => {
    expect(isGodot44OrLater("4.4.1.stable")).toBe(true);
  });

  it("returns true for 4.6", () => {
    expect(isGodot44OrLater("4.6.stable")).toBe(true);
  });

  it("returns false for 4.3", () => {
    expect(isGodot44OrLater("4.3.0.stable")).toBe(false);
  });

  it("returns true for 5.0", () => {
    expect(isGodot44OrLater("5.0.0")).toBe(true);
  });

  it("returns false for garbage", () => {
    expect(isGodot44OrLater("not-a-version")).toBe(false);
  });
});

describe("findGodotProjects", () => {
  it("finds the test fixture project", () => {
    const projects = findGodotProjects(FIXTURE_PATH, false, false);
    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe("fixture");
  });
});

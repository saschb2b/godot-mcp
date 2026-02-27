import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

/** Extract JSON from stdout, filtering out Godot's engine banner and debug/info log lines. */
function extractJson(stdout: string): string {
  const filtered = stdout
    .split("\n")
    .filter(
      (l) =>
        !l.startsWith("Godot Engine") &&
        !l.startsWith("[DEBUG]") &&
        !l.startsWith("[INFO]") &&
        !l.startsWith("[WARNING]"),
    )
    .join("\n")
    .trim();
  return filtered;
}

export async function handleGetSceneInsights(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath) {
    return createErrorResponse(
      "Missing required parameters: projectPath and scenePath",
      ["Provide both the project directory and scene file path"],
    );
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
    ]);
  }

  const projectFile = join(args.projectPath, "project.godot");
  if (!existsSync(projectFile)) {
    return createErrorResponse(
      `Not a valid Godot project: ${args.projectPath}`,
      [
        "Ensure the path points to a directory containing a project.godot file",
        "Use list_projects to find valid Godot projects",
      ],
    );
  }

  try {
    const { stdout, stderr } = await executeOperation(
      ctx,
      "get_scene_insights",
      { scenePath: args.scenePath },
      args.projectPath,
    );

    if (stderr.includes("Failed to") || stderr.includes("ERROR")) {
      return createErrorResponse(`Failed to analyze scene: ${stderr}`, [
        "Ensure the scene path is correct",
        "Verify the scene file is valid",
      ]);
    }

    return { content: [{ type: "text", text: extractJson(stdout) }] };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to analyze scene: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleGetNodeInsights(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scriptPath) {
    return createErrorResponse(
      "Missing required parameters: projectPath and scriptPath",
      ["Provide both the project directory and script file path"],
    );
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scriptPath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
    ]);
  }

  const projectFile = join(args.projectPath, "project.godot");
  if (!existsSync(projectFile)) {
    return createErrorResponse(
      `Not a valid Godot project: ${args.projectPath}`,
      [
        "Ensure the path points to a directory containing a project.godot file",
        "Use list_projects to find valid Godot projects",
      ],
    );
  }

  const scriptFile = join(args.projectPath, args.scriptPath);
  if (!existsSync(scriptFile)) {
    return createErrorResponse(
      `Script file does not exist: ${args.scriptPath}`,
      ["Ensure the script path is correct"],
    );
  }

  try {
    const { stdout, stderr } = await executeOperation(
      ctx,
      "get_node_insights",
      { scriptPath: args.scriptPath },
      args.projectPath,
    );

    if (stderr.includes("Failed to") || stderr.includes("ERROR")) {
      return createErrorResponse(`Failed to analyze script: ${stderr}`, [
        "Ensure the script path is correct",
        "Verify the script file is valid GDScript",
      ]);
    }

    return { content: [{ type: "text", text: extractJson(stdout) }] };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to analyze script: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

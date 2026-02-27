import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
  logDebug,
  findGodotProjects,
  getProjectStructureAsync,
} from "../utils.js";
import { ensureGodotPath } from "../godot-path.js";
import { join, basename } from "path";
import { existsSync, readFileSync } from "fs";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

export function handleListProjects(
  ctx: ServerContext,
  args: any,
): ToolResponse {
  // Normalize parameters to camelCase
  args = normalizeParameters(args);

  if (!args.directory) {
    return createErrorResponse("Directory is required", [
      "Provide a valid directory path to search for Godot projects",
    ]);
  }

  if (!validatePath(args.directory)) {
    return createErrorResponse("Invalid directory path", [
      'Provide a valid path without ".." or other potentially unsafe characters',
    ]);
  }

  try {
    logDebug(
      ctx.debugMode,
      `Listing Godot projects in directory: ${args.directory}`,
    );
    if (!existsSync(args.directory)) {
      return createErrorResponse(
        `Directory does not exist: ${args.directory}`,
        ["Provide a valid directory path that exists on the system"],
      );
    }

    const recursive = args.recursive === true;
    const projects = findGodotProjects(
      args.directory,
      recursive,
      ctx.debugMode,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(projects, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to list projects: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure the directory exists and is accessible",
        "Check if you have permission to read the directory",
      ],
    );
  }
}

export async function handleGetProjectInfo(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  // Normalize parameters to camelCase
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse("Project path is required", [
      "Provide a valid path to a Godot project directory",
    ]);
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid project path", [
      'Provide a valid path without ".." or other potentially unsafe characters',
    ]);
  }

  try {
    // Ensure godotPath is set
    const godotPath = await ensureGodotPath(ctx);
    if (!godotPath) {
      return createErrorResponse(
        "Could not find a valid Godot executable path",
        [
          "Ensure Godot is installed correctly",
          "Set GODOT_PATH environment variable to specify the correct path",
        ],
      );
    }

    // Check if the project directory exists and contains a project.godot file
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

    logDebug(ctx.debugMode, `Getting project info for: ${args.projectPath}`);

    // Get Godot version
    const execOptions = { timeout: 10000 }; // 10 second timeout
    const { stdout } = await execFileAsync(
      godotPath,
      ["--version"],
      execOptions,
    );

    // Get project structure using the recursive method
    const projectStructure = await getProjectStructureAsync(
      args.projectPath,
      ctx.debugMode,
    );

    // Extract project name from project.godot file
    let projectName = basename(args.projectPath);
    try {
      const projectFileContent = readFileSync(projectFile, "utf8");
      const configNameMatch = /config\/name="([^"]+)"/.exec(projectFileContent);
      if (configNameMatch?.[1]) {
        projectName = configNameMatch[1];
        logDebug(ctx.debugMode, `Found project name in config: ${projectName}`);
      }
    } catch (error) {
      logDebug(ctx.debugMode, `Error reading project file: ${String(error)}`);
      // Continue with default project name if extraction fails
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              name: projectName,
              path: args.projectPath,
              godotVersion: stdout.trim(),
              structure: projectStructure,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to get project info: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleGetGodotVersion(
  ctx: ServerContext,
): Promise<ToolResponse> {
  try {
    // Ensure godotPath is set
    const godotPath = await ensureGodotPath(ctx);
    if (!godotPath) {
      return createErrorResponse(
        "Could not find a valid Godot executable path",
        [
          "Ensure Godot is installed correctly",
          "Set GODOT_PATH environment variable to specify the correct path",
        ],
      );
    }

    logDebug(ctx.debugMode, "Getting Godot version");
    const { stdout } = await execFileAsync(godotPath, ["--version"]);
    return {
      content: [
        {
          type: "text",
          text: stdout.trim(),
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(`Failed to get Godot version: ${errorMessage}`, [
      "Ensure Godot is installed correctly",
      "Check if the GODOT_PATH environment variable is set correctly",
    ]);
  }
}

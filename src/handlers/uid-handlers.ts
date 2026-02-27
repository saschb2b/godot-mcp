import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import { normalizeParameters, validatePath, createErrorResponse, isGodot44OrLater } from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { ensureGodotPath } from "../godot-path.js";
import { join } from "path";
import { existsSync } from "fs";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

export async function handleGetUid(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.filePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and filePath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.filePath)
  ) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
    ]);
  }

  try {
    if (!ctx.godotPath) {
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

    const filePath = join(args.projectPath, args.filePath);
    if (!existsSync(filePath)) {
      return createErrorResponse(
        `File does not exist: ${args.filePath}`,
        ["Ensure the file path is correct"],
      );
    }

    // Get Godot version to check if UIDs are supported
    const { stdout: versionOutput } = await execFileAsync(ctx.godotPath!, [
      "--version",
    ]);
    const version = versionOutput.trim();

    if (!isGodot44OrLater(version)) {
      return createErrorResponse(
        `UIDs are only supported in Godot 4.4 or later. Current version: ${version}`,
        [
          "Upgrade to Godot 4.4 or later to use UIDs",
          "Use resource paths instead of UIDs for this version of Godot",
        ],
      );
    }

    const params = {
      filePath: args.filePath,
    };

    const { stdout, stderr } = await executeOperation(
      ctx,
      "get_uid",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to get UID: ${stderr}`, [
        "Check if the file is a valid Godot resource",
        "Ensure the file path is correct",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `UID for ${args.filePath}: ${stdout.trim()}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to get UID: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleUpdateProjectUids(ctx: ServerContext, args: any): Promise<ToolResponse> {
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
    if (!ctx.godotPath) {
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

    // Get Godot version to check if UIDs are supported
    const { stdout: versionOutput } = await execFileAsync(ctx.godotPath!, [
      "--version",
    ]);
    const version = versionOutput.trim();

    if (!isGodot44OrLater(version)) {
      return createErrorResponse(
        `UIDs are only supported in Godot 4.4 or later. Current version: ${version}`,
        [
          "Upgrade to Godot 4.4 or later to use UIDs",
          "Use resource paths instead of UIDs for this version of Godot",
        ],
      );
    }

    const params = {
      projectPath: args.projectPath,
    };

    const { stdout, stderr } = await executeOperation(
      ctx,
      "resave_resources",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to update project UIDs: ${stderr}`,
        [
          "Check if the project is valid",
          "Ensure you have write permissions to the project directory",
        ],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Project UIDs updated successfully.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to update project UIDs: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

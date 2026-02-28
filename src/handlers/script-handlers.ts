import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export async function handleReadScript(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scriptPath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and scriptPath",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scriptPath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".."',
    ]);
  }

  try {
    const projectFile = join(args.projectPath, "project.godot");
    if (!existsSync(projectFile)) {
      return createErrorResponse(
        `Not a valid Godot project: ${args.projectPath}`,
        ["Ensure the path contains a project.godot file"],
      );
    }

    const scriptFile = join(args.projectPath, args.scriptPath);
    if (!existsSync(scriptFile)) {
      return createErrorResponse(
        `Script file does not exist: ${args.scriptPath}`,
        ["Ensure the script path is correct"],
      );
    }

    const params = { scriptPath: args.scriptPath };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "read_script",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to read script: ${stderr}`, [
        "Check if the script path is correct",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: stdout,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to read script: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export function handleWriteScript(ctx: ServerContext, args: any): ToolResponse {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scriptPath || args.content === undefined) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scriptPath, and content",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scriptPath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".."',
    ]);
  }

  try {
    const projectFile = join(args.projectPath, "project.godot");
    if (!existsSync(projectFile)) {
      return createErrorResponse(
        `Not a valid Godot project: ${args.projectPath}`,
        ["Ensure the path contains a project.godot file"],
      );
    }

    const scriptFile = join(args.projectPath, args.scriptPath);
    const scriptDir = dirname(scriptFile);

    // Create parent directories if needed
    if (!existsSync(scriptDir)) {
      mkdirSync(scriptDir, { recursive: true });
    }

    const existed = existsSync(scriptFile);
    writeFileSync(scriptFile, args.content, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: `Script ${existed ? "updated" : "created"}: ${args.scriptPath}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to write script: ${error?.message ?? "Unknown error"}`,
      [],
    );
  }
}

export async function handleValidateScript(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scriptPath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and scriptPath",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scriptPath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".."',
    ]);
  }

  try {
    const projectFile = join(args.projectPath, "project.godot");
    if (!existsSync(projectFile)) {
      return createErrorResponse(
        `Not a valid Godot project: ${args.projectPath}`,
        ["Ensure the path contains a project.godot file"],
      );
    }

    const scriptFile = join(args.projectPath, args.scriptPath);
    if (!existsSync(scriptFile)) {
      return createErrorResponse(
        `Script file does not exist: ${args.scriptPath}`,
        ["Ensure the script path is correct"],
      );
    }

    const params = { scriptPath: args.scriptPath };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "validate_script",
      params,
      args.projectPath,
    );

    const output = stdout.trim();
    const hasErrors = stderr.includes("SCRIPT_ERROR") || output.includes('"errors"');

    return {
      content: [
        {
          type: "text",
          text: output || (hasErrors ? stderr : "Script is valid: no errors found."),
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to validate script: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

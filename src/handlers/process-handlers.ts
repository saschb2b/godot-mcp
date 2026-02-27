import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
  logDebug,
} from "../utils.js";
import { ensureGodotPath } from "../godot-path.js";
import { join } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";

export async function handleLaunchEditor(
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

    logDebug(
      ctx.debugMode,
      `Launching Godot editor for project: ${args.projectPath}`,
    );
    const process = spawn(godotPath, ["-e", "--path", args.projectPath], {
      stdio: "pipe",
    });

    process.on("error", (err: Error) => {
      console.error("Failed to start Godot editor:", err);
    });

    return {
      content: [
        {
          type: "text",
          text: `Godot editor launched successfully for project at ${args.projectPath}.`,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(
      `Failed to launch Godot editor: ${errorMessage}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export function handleRunProject(
  ctx: ServerContext,
  args: any,
): ToolResponse {
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

    // Kill any existing process
    if (ctx.activeProcess) {
      logDebug(
        ctx.debugMode,
        "Killing existing Godot process before starting a new one",
      );
      ctx.activeProcess.process.kill();
    }

    const cmdArgs = ["-d", "--path", args.projectPath];
    if (args.scene && validatePath(args.scene)) {
      logDebug(ctx.debugMode, `Adding scene parameter: ${args.scene}`);
      cmdArgs.push(args.scene);
    }

    logDebug(ctx.debugMode, `Running Godot project: ${args.projectPath}`);
    const process = spawn(ctx.godotPath!, cmdArgs, { stdio: "pipe" });
    const output: string[] = [];
    const errors: string[] = [];

    process.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      output.push(...lines);
      lines.forEach((line: string) => {
        if (line.trim()) logDebug(ctx.debugMode, `[Godot stdout] ${line}`);
      });
    });

    process.stderr.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      errors.push(...lines);
      lines.forEach((line: string) => {
        if (line.trim()) logDebug(ctx.debugMode, `[Godot stderr] ${line}`);
      });
    });

    process.on("exit", (code: number | null) => {
      logDebug(ctx.debugMode, `Godot process exited with code ${code}`);
      if (ctx.activeProcess?.process === process) {
        ctx.activeProcess = null;
      }
    });

    process.on("error", (err: Error) => {
      console.error("Failed to start Godot process:", err);
      if (ctx.activeProcess?.process === process) {
        ctx.activeProcess = null;
      }
    });

    ctx.activeProcess = { process, output, errors };

    return {
      content: [
        {
          type: "text",
          text: `Godot project started in debug mode. Use get_debug_output to see output.`,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(
      `Failed to run Godot project: ${errorMessage}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export function handleStopProject(
  ctx: ServerContext,
): ToolResponse {
  if (!ctx.activeProcess) {
    return createErrorResponse("No active Godot process to stop.", [
      "Use run_project to start a Godot project first",
      "The process may have already terminated",
    ]);
  }

  logDebug(ctx.debugMode, "Stopping active Godot process");
  ctx.activeProcess.process.kill();
  const output = ctx.activeProcess.output;
  const errors = ctx.activeProcess.errors;
  ctx.activeProcess = null;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message: "Godot project stopped",
            finalOutput: output,
            finalErrors: errors,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function handleGetDebugOutput(
  ctx: ServerContext,
  args: any,
): ToolResponse {
  if (!ctx.activeProcess) {
    return createErrorResponse("No active Godot process.", [
      "Use run_project to start a Godot project first",
      "Check if the Godot process crashed unexpectedly",
    ]);
  }

  const errorsOnly = args?.errorsOnly === true;
  const tail = typeof args?.tail === "number" ? args.tail : 0;

  let output = ctx.activeProcess.output;
  let errors = ctx.activeProcess.errors;

  if (errorsOnly) {
    // Filter output to only lines containing error/warning indicators
    output = output.filter(
      (line: string) =>
        /ERROR|SCRIPT|WARNING|error:|Invalid/i.test(line) ||
        /^\s+at:/.test(line),
    );
  }

  if (tail > 0) {
    output = output.slice(-tail);
    errors = errors.slice(-tail);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            output,
            errors,
          },
          null,
          2,
        ),
      },
    ],
  };
}

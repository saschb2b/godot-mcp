import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
  logDebug,
  killProcess,
  snapshotExitedProcess,
} from "../utils.js";
import { ensureGodotPath } from "../godot-path.js";
import { cleanupInteractive, disconnectTcp } from "../tcp-client.js";
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

export async function handleRunProject(
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

    // Kill any existing process and wait for it to exit
    if (ctx.activeProcess) {
      logDebug(
        ctx.debugMode,
        "Killing existing Godot process before starting a new one",
      );
      await killProcess(ctx.activeProcess.process);
      ctx.activeProcess = null;
    }

    // Drop any leftover snapshot from a previous run — once a new process
    // starts, the old run's output is no longer the "most recent" data.
    ctx.lastExitedProcess = null;

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
      // Snapshot the captured output so get_debug_output keeps working
      // after the process is gone — vital for diagnosing fast crashes.
      snapshotExitedProcess(ctx, process, code, "exit");
    });

    process.on("error", (err: Error) => {
      console.error("Failed to start Godot process:", err);
      snapshotExitedProcess(ctx, process, null, "error");
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
    return createErrorResponse(`Failed to run Godot project: ${errorMessage}`, [
      "Ensure Godot is installed correctly",
      "Check if the GODOT_PATH environment variable is set correctly",
      "Verify the project path is accessible",
    ]);
  }
}

export async function handleStopProject(
  ctx: ServerContext,
): Promise<ToolResponse> {
  if (!ctx.activeProcess) {
    return createErrorResponse("No active Godot process to stop.", [
      "Use run_project to start a Godot project first",
      "The process may have already terminated",
    ]);
  }

  logDebug(ctx.debugMode, "Stopping active Godot process");
  const output = ctx.activeProcess.output;
  const errors = ctx.activeProcess.errors;

  // Disconnect TCP before killing process to avoid race with exit handler
  disconnectTcp(ctx);
  await killProcess(ctx.activeProcess.process);
  ctx.activeProcess = null;

  // Clean up interactive mode artifacts (autoload injection, receiver script)
  cleanupInteractive(ctx);

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
  // Prefer the live process. If it's gone, fall back to the snapshot of
  // the most recently exited process — that's the whole point of this
  // tool when the user is debugging an early crash.
  const isLive = ctx.activeProcess !== null;
  const source =
    ctx.activeProcess ??
    (ctx.lastExitedProcess
      ? {
          output: ctx.lastExitedProcess.output,
          errors: ctx.lastExitedProcess.errors,
        }
      : null);

  if (!source) {
    return createErrorResponse("No active or recently exited Godot process.", [
      "Use run_project to start a Godot project first",
      "Output is retained briefly after the process exits — if you see this, no run has happened yet this session",
    ]);
  }

  const errorsOnly = args?.errorsOnly === true;
  const tail = typeof args?.tail === "number" ? args.tail : 0;

  let output = source.output;
  let errors = source.errors;

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

  // When falling back to the snapshot, surface the exit metadata so the
  // caller can tell at a glance the process is no longer running.
  const payload: Record<string, unknown> = { output, errors };
  if (!isLive && ctx.lastExitedProcess) {
    payload.exited = true;
    payload.exitCode = ctx.lastExitedProcess.exitCode;
    payload.exitReason = ctx.lastExitedProcess.reason;
    payload.exitedAt = ctx.lastExitedProcess.exitedAt;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

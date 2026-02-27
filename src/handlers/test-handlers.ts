import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
  logDebug,
} from "../utils.js";
import { executeGodotArgs } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleRunTests(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse("Missing required parameter: projectPath", [
      "Provide the path to a Godot project directory",
    ]);
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid path", [
      'Provide a valid path without ".." or other potentially unsafe characters',
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

  const gutScript = join(args.projectPath, "addons", "gut", "gut_cmdln.gd");
  if (!existsSync(gutScript)) {
    return createErrorResponse(
      "GUT (Godot Unit Testing) is not installed in this project",
      [
        "Install GUT via the Godot Asset Library or clone it into addons/gut/",
        "Expected path: addons/gut/gut_cmdln.gd",
        "See https://gut.readthedocs.io/en/latest/Install.html",
      ],
    );
  }

  // Build GUT CLI arguments
  const godotArgs: string[] = [
    "--headless",
    "--path",
    args.projectPath,
    "-s",
    "res://addons/gut/gut_cmdln.gd",
    "-gexit",
    "-gdisable_colors",
  ];

  if (args.testDir) {
    const dir = args.testDir.startsWith("res://")
      ? args.testDir
      : `res://${args.testDir}`;
    godotArgs.push(`-gdir=${dir}`);
  }

  if (args.testScript) {
    godotArgs.push(`-gtest=${args.testScript}`);
  }

  if (args.testMethod) {
    godotArgs.push(`-gselect=${args.testMethod}`);
  }

  if (args.includeSubdirs !== false) {
    godotArgs.push("-ginclude_subdirs");
  }

  if (args.configPath) {
    const cfg = args.configPath.startsWith("res://")
      ? args.configPath
      : `res://${args.configPath}`;
    godotArgs.push(`-gconfig=${cfg}`);
  }

  if (args.logLevel !== undefined && args.logLevel !== null) {
    const level = Number(args.logLevel);
    if (level >= 0 && level <= 3) {
      godotArgs.push(`-glog=${level}`);
    }
  }

  const timeout =
    typeof args.timeout === "number" ? args.timeout * 1000 : 120_000;

  logDebug(ctx.debugMode, `Running GUT tests: ${godotArgs.join(" ")}`);

  try {
    const { stdout, stderr } = await executeGodotArgs(ctx, godotArgs, {
      timeout,
    });

    const summary = parseGutSummary(stdout);
    const passed = summary
      ? summary.failing === 0
      : !stdout.includes("Failing");

    const parts: string[] = [];

    if (summary) {
      parts.push(
        passed ? "All tests passed." : "Some tests failed.",
        "",
        `Scripts:  ${summary.scripts}`,
        `Passing:  ${summary.passing}`,
        `Failing:  ${summary.failing}`,
        `Pending:  ${summary.pending}`,
      );
    }

    parts.push("", "--- Full Output ---", stdout);

    if (stderr.trim()) {
      parts.push("", "--- Stderr ---", stderr);
    }

    return {
      content: [{ type: "text", text: parts.join("\n") }],
      ...(passed ? {} : { isError: true }),
    };
  } catch (error: unknown) {
    const execError = error as Error & {
      killed?: boolean;
      signal?: string;
    };

    if (execError.killed || execError.signal === "SIGTERM") {
      return createErrorResponse("Test execution timed out", [
        "Try running a specific test script with testScript parameter",
        "Increase the timeout parameter",
        "Check for infinite loops in test code",
      ]);
    }

    return createErrorResponse(`Failed to run tests: ${execError.message}`, [
      "Ensure Godot is installed correctly",
      "Verify GUT is installed in addons/gut/",
      "Check that test files exist in the test directory",
    ]);
  }
}

interface GutSummary {
  scripts: number;
  passing: number;
  failing: number;
  pending: number;
}

function parseGutSummary(stdout: string): GutSummary | null {
  const scripts = /Scripts:\s*(\d+)/.exec(stdout);
  const passing = /Passing tests:\s*(\d+)/.exec(stdout);
  const failing = /Failing tests:\s*(\d+)/.exec(stdout);
  const pending = /Pending tests:\s*(\d+)/.exec(stdout);

  if (scripts && passing && failing && pending) {
    return {
      scripts: parseInt(scripts[1]!, 10),
      passing: parseInt(passing[1]!, 10),
      failing: parseInt(failing[1]!, 10),
      pending: parseInt(pending[1]!, 10),
    };
  }

  return null;
}

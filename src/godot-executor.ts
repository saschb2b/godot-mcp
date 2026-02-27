import { promisify } from "util";
import { execFile } from "child_process";
import type { ServerContext } from "./context.js";
import type { OperationParams } from "./types.js";
import { logDebug, convertCamelToSnakeCase } from "./utils.js";
import { ensureGodotPath } from "./godot-path.js";

const execFileAsync = promisify(execFile);

export async function executeOperation(
  ctx: ServerContext,
  operation: string,
  params: OperationParams,
  projectPath: string,
): Promise<{ stdout: string; stderr: string }> {
  logDebug(
    ctx.debugMode,
    `Executing operation: ${operation} in project: ${projectPath}`,
  );
  logDebug(
    ctx.debugMode,
    `Original operation params: ${JSON.stringify(params)}`,
  );

  const snakeCaseParams = convertCamelToSnakeCase(params);
  logDebug(
    ctx.debugMode,
    `Converted snake_case params: ${JSON.stringify(snakeCaseParams)}`,
  );

  const godotPath = await ensureGodotPath(ctx);
  if (!godotPath) {
    throw new Error("Could not find a valid Godot executable path");
  }

  try {
    const paramsJson = JSON.stringify(snakeCaseParams);

    const args = [
      "--headless",
      "--path",
      projectPath,
      "--script",
      ctx.operationsScriptPath,
      operation,
      paramsJson,
    ];

    args.push("--debug-godot");

    logDebug(ctx.debugMode, `Executing: ${godotPath} ${args.join(" ")}`);

    const { stdout, stderr } = await execFileAsync(godotPath, args);

    return { stdout, stderr };
  } catch (error: unknown) {
    if (error instanceof Error && "stdout" in error && "stderr" in error) {
      const execError = error as Error & { stdout: string; stderr: string };
      return {
        stdout: execError.stdout,
        stderr: execError.stderr,
      };
    }

    throw error;
  }
}

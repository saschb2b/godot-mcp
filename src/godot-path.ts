import { existsSync } from "fs";
import { normalize } from "path";
import { promisify } from "util";
import { execFile } from "child_process";
import type { ServerContext } from "./context.js";
import { logDebug } from "./utils.js";

const execFileAsync = promisify(execFile);

export function isValidGodotPathSync(
  path: string,
  debugMode: boolean,
): boolean {
  try {
    logDebug(debugMode, `Quick-validating Godot path: ${path}`);
    return path === "godot" || existsSync(path);
  } catch (error) {
    logDebug(debugMode, `Invalid Godot path: ${path}, error: ${String(error)}`);
    return false;
  }
}

export async function isValidGodotPath(
  ctx: ServerContext,
  path: string,
): Promise<boolean> {
  if (ctx.validatedPaths.has(path)) {
    return ctx.validatedPaths.get(path)!;
  }

  try {
    logDebug(ctx.debugMode, `Validating Godot path: ${path}`);

    if (path !== "godot" && !existsSync(path)) {
      logDebug(ctx.debugMode, `Path does not exist: ${path}`);
      ctx.validatedPaths.set(path, false);
      return false;
    }

    await execFileAsync(path, ["--version"]);

    logDebug(ctx.debugMode, `Valid Godot path: ${path}`);
    ctx.validatedPaths.set(path, true);
    return true;
  } catch (error) {
    logDebug(
      ctx.debugMode,
      `Invalid Godot path: ${path}, error: ${String(error)}`,
    );
    ctx.validatedPaths.set(path, false);
    return false;
  }
}

export async function detectGodotPath(ctx: ServerContext): Promise<void> {
  if (ctx.godotPath && (await isValidGodotPath(ctx, ctx.godotPath))) {
    logDebug(ctx.debugMode, `Using existing Godot path: ${ctx.godotPath}`);
    return;
  }

  if (process.env.GODOT_PATH) {
    const normalizedPath = normalize(process.env.GODOT_PATH);
    logDebug(
      ctx.debugMode,
      `Checking GODOT_PATH environment variable: ${normalizedPath}`,
    );
    if (await isValidGodotPath(ctx, normalizedPath)) {
      ctx.godotPath = normalizedPath;
      logDebug(
        ctx.debugMode,
        `Using Godot path from environment: ${ctx.godotPath}`,
      );
      return;
    } else {
      logDebug(ctx.debugMode, `GODOT_PATH environment variable is invalid`);
    }
  }

  const osPlatform = process.platform;
  logDebug(
    ctx.debugMode,
    `Auto-detecting Godot path for platform: ${osPlatform}`,
  );

  const possiblePaths: string[] = ["godot"];

  if (osPlatform === "darwin") {
    possiblePaths.push(
      "/Applications/Godot.app/Contents/MacOS/Godot",
      "/Applications/Godot_4.app/Contents/MacOS/Godot",
      `${process.env.HOME}/Applications/Godot.app/Contents/MacOS/Godot`,
      `${process.env.HOME}/Applications/Godot_4.app/Contents/MacOS/Godot`,
      `${process.env.HOME}/Library/Application Support/Steam/steamapps/common/Godot Engine/Godot.app/Contents/MacOS/Godot`,
    );
  } else if (osPlatform === "win32") {
    possiblePaths.push(
      "C:\\Program Files\\Godot\\Godot.exe",
      "C:\\Program Files (x86)\\Godot\\Godot.exe",
      "C:\\Program Files\\Godot_4\\Godot.exe",
      "C:\\Program Files (x86)\\Godot_4\\Godot.exe",
      `${process.env.USERPROFILE}\\Godot\\Godot.exe`,
    );
  } else if (osPlatform === "linux") {
    possiblePaths.push(
      "/usr/bin/godot",
      "/usr/local/bin/godot",
      "/snap/bin/godot",
      `${process.env.HOME}/.local/bin/godot`,
    );
  }

  for (const path of possiblePaths) {
    const normalizedPath = normalize(path);
    if (await isValidGodotPath(ctx, normalizedPath)) {
      ctx.godotPath = normalizedPath;
      logDebug(ctx.debugMode, `Found Godot at: ${normalizedPath}`);
      return;
    }
  }

  logDebug(
    ctx.debugMode,
    `Warning: Could not find Godot in common locations for ${osPlatform}`,
  );
  console.error(
    `[SERVER] Could not find Godot in common locations for ${osPlatform}`,
  );
  console.error(
    `[SERVER] Set GODOT_PATH=/path/to/godot environment variable or pass { godotPath: '/path/to/godot' } in the config to specify the correct path.`,
  );

  if (ctx.strictPathValidation) {
    throw new Error(
      `Could not find a valid Godot executable. Set GODOT_PATH or provide a valid path in config.`,
    );
  } else {
    if (osPlatform === "win32") {
      ctx.godotPath = normalize("C:\\Program Files\\Godot\\Godot.exe");
    } else if (osPlatform === "darwin") {
      ctx.godotPath = normalize("/Applications/Godot.app/Contents/MacOS/Godot");
    } else {
      ctx.godotPath = normalize("/usr/bin/godot");
    }

    logDebug(
      ctx.debugMode,
      `Using default path: ${ctx.godotPath}, but this may not work.`,
    );
    console.error(
      `[SERVER] Using default path: ${ctx.godotPath}, but this may not work.`,
    );
    console.error(
      `[SERVER] This fallback behavior will be removed in a future version. Set strictPathValidation: true to opt-in to the new behavior.`,
    );
  }
}

export async function setGodotPath(
  ctx: ServerContext,
  customPath: string,
): Promise<boolean> {
  if (!customPath) {
    return false;
  }

  const normalizedPath = normalize(customPath);
  if (await isValidGodotPath(ctx, normalizedPath)) {
    ctx.godotPath = normalizedPath;
    logDebug(ctx.debugMode, `Godot path set to: ${normalizedPath}`);
    return true;
  }

  logDebug(
    ctx.debugMode,
    `Failed to set invalid Godot path: ${normalizedPath}`,
  );
  return false;
}

export async function ensureGodotPath(
  ctx: ServerContext,
): Promise<string | null> {
  if (!ctx.godotPath) {
    await detectGodotPath(ctx);
  }
  return ctx.godotPath;
}

import { resolve } from "path";
import { readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { ServerContext } from "../src/context.js";
import { detectGodotPath, setGodotPath } from "../src/godot-path.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export const FIXTURE_PATH = resolve(__dirname, "fixture");
export const OPERATIONS_SCRIPT = resolve(
  __dirname,
  "..",
  "src",
  "scripts",
  "godot_operations.gd",
);

/** Scan common directories for any Godot executable (handles versioned filenames). */
function findGodotExecutable(): string | null {
  if (process.platform !== "win32") return null;
  const dirs = [
    "C:\\Program Files\\Godot",
    "C:\\Program Files (x86)\\Godot",
    `${process.env.USERPROFILE}\\Godot`,
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir);
    const exe = files.find(
      (f) => f.toLowerCase().startsWith("godot") && f.endsWith(".exe"),
    );
    if (exe) return resolve(dir, exe);
  }
  return null;
}

export function createTestContext(): ServerContext {
  return new ServerContext({ debugMode: false }, OPERATIONS_SCRIPT);
}

export async function initContext(): Promise<ServerContext> {
  const ctx = createTestContext();
  await detectGodotPath(ctx);

  // If standard detection failed, try scanning directories for versioned names
  if (!ctx.godotPath || !existsSync(ctx.godotPath)) {
    const found = findGodotExecutable();
    if (found) {
      await setGodotPath(ctx, found);
    }
  }

  if (!ctx.godotPath) {
    throw new Error(
      "Godot not found. Set GODOT_PATH or install Godot in a standard location.",
    );
  }
  return ctx;
}

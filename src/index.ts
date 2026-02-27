#!/usr/bin/env node
/**
 * Godot MCP Server
 *
 * This MCP server provides tools for interacting with the Godot game engine.
 * It enables AI assistants to launch the Godot editor, run Godot projects,
 * capture debug output, and control project execution.
 */

import { fileURLToPath } from "url";
import { join, dirname, normalize } from "path";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import type { GodotServerConfig } from "./types.js";
import { ServerContext } from "./context.js";
import {
  detectGodotPath,
  isValidGodotPath,
  isValidGodotPathSync,
} from "./godot-path.js";
import { logDebug } from "./utils.js";
import { setupToolHandlers } from "./tool-router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(config?: GodotServerConfig) {
  const operationsScriptPath = join(
    __dirname,
    "scripts",
    "godot_operations.gd",
  );
  const ctx = new ServerContext(config ?? {}, operationsScriptPath);

  if (ctx.debugMode) {
    console.error(`[DEBUG] Operations script path: ${operationsScriptPath}`);
  }

  // Handle initial godot path from config
  if (config?.godotPath) {
    const normalizedPath = normalize(config.godotPath);
    ctx.godotPath = normalizedPath;
    logDebug(ctx.debugMode, `Custom Godot path provided: ${ctx.godotPath}`);

    if (!isValidGodotPathSync(ctx.godotPath, ctx.debugMode)) {
      console.warn(
        `[SERVER] Invalid custom Godot path provided: ${ctx.godotPath}`,
      );
      ctx.godotPath = null;
    }
  }

  const server = new Server(
    { name: "godot-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.onerror = (error) => console.error("[MCP Error]", error);

  setupToolHandlers(server, ctx);

  // Cleanup on exit
  process.on("SIGINT", () => {
    logDebug(ctx.debugMode, "Cleaning up resources");
    if (ctx.activeProcess) {
      logDebug(ctx.debugMode, "Killing active Godot process");
      ctx.activeProcess.process.kill();
      ctx.activeProcess = null;
    }
    void server.close().then(() => {
      process.exit(0);
    });
  });

  // Detect Godot path and start
  await detectGodotPath(ctx);

  if (!ctx.godotPath) {
    console.error("[SERVER] Failed to find a valid Godot executable path");
    console.error(
      "[SERVER] Please set GODOT_PATH environment variable or provide a valid path",
    );
    process.exit(1);
  }

  const isValid = await isValidGodotPath(ctx, ctx.godotPath);

  if (!isValid) {
    if (ctx.strictPathValidation) {
      console.error(`[SERVER] Invalid Godot path: ${ctx.godotPath}`);
      console.error(
        "[SERVER] Please set a valid GODOT_PATH environment variable or provide a valid path",
      );
      process.exit(1);
    } else {
      console.error(
        `[SERVER] Warning: Using potentially invalid Godot path: ${ctx.godotPath}`,
      );
      console.error(
        "[SERVER] This may cause issues when executing Godot commands",
      );
      console.error(
        "[SERVER] This fallback behavior will be removed in a future version. Set strictPathValidation: true to opt-in to the new behavior.",
      );
    }
  }

  console.error(`[SERVER] Using Godot at: ${ctx.godotPath}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Godot MCP server running on stdio");
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error("Failed to run server:", errorMessage);
  process.exit(1);
});

import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
  killProcess,
} from "../utils.js";
import { ensureGodotPath } from "../godot-path.js";
import {
  sendTcpCommand,
  cleanupInteractive,
  disconnectTcp,
} from "../tcp-client.js";
import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function handleRunInteractive(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse("Missing required parameter: projectPath", [
      "Provide the path to the Godot project directory",
    ]);
  }

  const projectFile = join(args.projectPath, "project.godot");
  if (!existsSync(projectFile)) {
    return createErrorResponse(
      `Not a valid Godot project: ${args.projectPath}`,
      ["Ensure the path contains a project.godot file"],
    );
  }

  // Copy input receiver script
  const scriptFilename = ".mcp_input_receiver.gd";
  const scriptDest = join(args.projectPath, scriptFilename);
  const receiverSrc = join(__dirname, "..", "scripts", "input_receiver.gd");
  copyFileSync(receiverSrc, scriptDest);

  // Save original project.godot and inject autoload
  const projectContent = readFileSync(projectFile, "utf-8");
  ctx.interactive.originalProjectGodot = projectContent;
  ctx.interactive.projectPath = args.projectPath;

  let modifiedContent: string;
  if (projectContent.includes("[autoload]")) {
    modifiedContent = projectContent.replace(
      "[autoload]",
      `[autoload]\n\n_McpInputReceiver="*res://${scriptFilename}"`,
    );
  } else {
    modifiedContent =
      projectContent +
      `\n[autoload]\n\n_McpInputReceiver="*res://${scriptFilename}"\n`;
  }
  writeFileSync(projectFile, modifiedContent);

  // Disconnect any existing TCP connection and kill existing process
  disconnectTcp(ctx);
  if (ctx.activeProcess) {
    await killProcess(ctx.activeProcess.process);
    ctx.activeProcess = null;
  }

  const godotPath = await ensureGodotPath(ctx);
  if (!godotPath) {
    return createErrorResponse("Could not find a valid Godot executable path", [
      "Ensure Godot is installed correctly",
      "Set GODOT_PATH environment variable",
    ]);
  }

  // Start the game
  const cmdArgs = ["-d", "--path", args.projectPath];
  if (args.scene && validatePath(args.scene)) {
    cmdArgs.push(args.scene);
  }

  const proc = spawn(godotPath, cmdArgs, { stdio: "pipe" });
  const output: string[] = [];
  const errors: string[] = [];

  proc.stdout.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n");
    output.push(...lines);
  });

  proc.stderr.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n");
    errors.push(...lines);
  });

  proc.on("exit", () => {
    cleanupInteractive(ctx);
    if (ctx.activeProcess?.process === proc) {
      ctx.activeProcess = null;
    }
  });

  proc.on("error", () => {
    cleanupInteractive(ctx);
    if (ctx.activeProcess?.process === proc) {
      ctx.activeProcess = null;
    }
  });

  ctx.activeProcess = { process: proc, output, errors };

  // Wait a moment for TCP server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    content: [
      {
        type: "text",
        text: `Game started in interactive mode with input receiver.\nUse send_input to send actions, game_state to check state, game_screenshot for live screenshots.\nStop with stop_project.`,
      },
    ],
  };
}

export async function handleSendInput(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  if (!args?.action) {
    return createErrorResponse("Missing required parameter: action", [
      'Provide the input action name (e.g., "move_up")',
    ]);
  }

  try {
    const response = await sendTcpCommand(ctx, {
      type: "input",
      action: args.action,
      pressed: args.pressed !== false,
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response),
        },
      ],
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg, [
      "Ensure the game is running via run_interactive",
    ]);
  }
}

export async function handleGameState(
  ctx: ServerContext,
): Promise<ToolResponse> {
  try {
    const response = await sendTcpCommand(ctx, { type: "get_state" });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg, [
      "Ensure the game is running via run_interactive",
    ]);
  }
}

export async function handleCallMethod(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  if (!args?.node_path && !args?.nodePath) {
    return createErrorResponse("Missing required parameter: nodePath", [
      'Provide the path to the target node (e.g., "Player")',
    ]);
  }
  if (!args?.method) {
    return createErrorResponse("Missing required parameter: method", [
      'Provide the method name to call (e.g., "take_damage")',
    ]);
  }

  try {
    const response = await sendTcpCommand(ctx, {
      type: "call_method",
      node_path: args.node_path ?? args.nodePath,
      method: args.method,
      args: args.args ?? [],
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg, [
      "Ensure the game is running via run_interactive",
    ]);
  }
}

export async function handleFindNodes(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  try {
    const command: Record<string, unknown> = { type: "find_nodes" };
    if (args?.pattern) command.pattern = args.pattern;
    if (args?.type_filter ?? args?.typeFilter)
      command.type_filter = args.type_filter ?? args.typeFilter;

    const response = await sendTcpCommand(ctx, command);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg, [
      "Ensure the game is running via run_interactive",
    ]);
  }
}

export async function handleGameScreenshot(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  const outputPath =
    args?.outputPath ??
    (ctx.interactive.projectPath
      ? join(ctx.interactive.projectPath, "screenshots", "capture.png")
      : "capture.png");

  try {
    const response = await sendTcpCommand(ctx, {
      type: "screenshot",
      output_path: outputPath,
    });

    if ((response as any).ok) {
      return {
        content: [
          {
            type: "text",
            text: `Screenshot captured from running game.\nSaved to: ${outputPath}\nSize: ${(response as any).size}`,
          },
        ],
      };
    }

    return createErrorResponse(
      `Screenshot failed: ${(response as any).error}`,
      [],
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg, [
      "Ensure the game is running via run_interactive",
    ]);
  }
}

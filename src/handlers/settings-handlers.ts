import type { ServerContext } from "../context.js";
import type { OperationParams, ToolResponse } from "../types.js";
import { normalizeParameters, validatePath, createErrorResponse } from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { ensureGodotPath } from "../godot-path.js";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);

export async function handleEditProjectSettings(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.settings) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and settings",
    ]);
  }

  if (!validatePath(args.projectPath)) {
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

    const params = { settings: args.settings };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "edit_project_settings",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to edit project settings: ${stderr}`,
        ["Check if the settings keys are valid"],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Project settings updated.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to edit project settings: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleManageAutoloads(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.action) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and action",
    ]);
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid path", [
      'Provide a valid path without ".."',
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

    if (args.action === "add") {
      if (!args.name || !args.scriptPath) {
        return createErrorResponse(
          "Missing required parameters for add",
          ["Provide name and scriptPath when adding an autoload"],
        );
      }
      const scriptFile = join(args.projectPath, args.scriptPath);
      if (!existsSync(scriptFile)) {
        return createErrorResponse(
          `Script file does not exist: ${args.scriptPath}`,
          ["Ensure the script path is correct"],
        );
      }
    }

    if (args.action === "remove") {
      if (!args.name) {
        return createErrorResponse(
          "Missing required parameters for remove",
          ["Provide name when removing an autoload"],
        );
      }
    }

    const params: OperationParams = {
      action: args.action,
    };
    if (args.name) params.name = args.name;
    if (args.scriptPath) params.scriptPath = args.scriptPath;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "manage_autoloads",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to manage autoloads: ${stderr}`,
        ["Check the autoload name and script path"],
      );
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
      `Failed to manage autoloads: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleExportProject(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.preset || !args.outputPath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, preset, and outputPath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.outputPath)
  ) {
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

    const exportPresetsFile = join(args.projectPath, "export_presets.cfg");
    if (!existsSync(exportPresetsFile)) {
      return createErrorResponse("No export_presets.cfg found", [
        "Configure export presets in the Godot editor first",
      ]);
    }

    const godotPath = await ensureGodotPath(ctx);
    if (!godotPath) {
      return createErrorResponse("Could not find Godot executable", [
        "Set GODOT_PATH environment variable",
      ]);
    }

    const exportFlag = args.debug ? "--export-debug" : "--export-release";
    const godotArgs = [
      "--headless",
      "--path",
      args.projectPath,
      exportFlag,
      args.preset,
      args.outputPath,
    ];

    const { stdout, stderr } = await execFileAsync(godotPath, godotArgs);

    if (stderr.includes("ERROR")) {
      return createErrorResponse(`Export failed: ${stderr}`, [
        "Check if the preset name matches one in export_presets.cfg",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Project exported successfully.\nPreset: ${args.preset}\nOutput: ${args.outputPath}\n\n${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to export project: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure the preset name is correct and export templates are installed",
      ],
    );
  }
}

export function handleListInputActions(ctx: ServerContext, args: any): ToolResponse {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse(
      "Missing required parameter: projectPath",
      ["Provide the path to the Godot project directory"],
    );
  }

  try {
    const projectFile = join(args.projectPath, "project.godot");
    if (!existsSync(projectFile)) {
      return createErrorResponse(
        `Not a valid Godot project: ${args.projectPath}`,
        ["Ensure the path contains a project.godot file"],
      );
    }

    const content = readFileSync(projectFile, "utf-8");
    const actions: Record<string, string[]> = {};

    // Input actions are in the [input] section as:
    // action_name={...events=[...]}
    const inputMatch = /\[input\]\s*\n([\s\S]*?)(?=\n\[|$)/.exec(content);
    if (!inputMatch) {
      return {
        content: [
          {
            type: "text",
            text: "No custom input actions found in project.godot.\nThe project may only use Godot's built-in actions (ui_accept, ui_cancel, etc.).",
          },
        ],
      };
    }

    const inputSection = inputMatch[1]!;
    const actionRegex = /^(\w+)=\{[^}]*"events":\s*\[([\s\S]*?)\]\s*\}/gm;
    let match;
    while ((match = actionRegex.exec(inputSection)) !== null) {
      const actionName = match[1]!;
      const eventsStr = match[2]!;
      const keys: string[] = [];

      // Extract physical key names from InputEventKey entries
      const keyMatches = eventsStr.matchAll(/"keycode":\s*(\d+)/g);
      for (const km of keyMatches) {
        keys.push(`keycode:${km[1]}`);
      }
      const physMatches = eventsStr.matchAll(/"physical_keycode":\s*(\d+)/g);
      for (const pm of physMatches) {
        keys.push(`physical:${pm[1]}`);
      }

      actions[actionName] = keys.length > 0 ? keys : ["(see project.godot)"];
    }

    // Also try the simpler Godot 4 format: action_name={...}
    // Some projects use a flat key=value format
    const simpleRegex = /^(\w+)=/gm;
    let simpleMatch;
    while ((simpleMatch = simpleRegex.exec(inputSection)) !== null) {
      const name = simpleMatch[1]!;
      if (!(name in actions)) {
        actions[name] = ["(see project.godot)"];
      }
    }

    const actionNames = Object.keys(actions);
    if (actionNames.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No custom input actions found in [input] section.",
          },
        ],
      };
    }

    const lines = actionNames.map(
      (name) => `  ${name}: ${actions[name]!.join(", ")}`,
    );

    return {
      content: [
        {
          type: "text",
          text: `Found ${actionNames.length} input action(s):\n${lines.join("\n")}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to list input actions: ${error?.message ?? "Unknown error"}`,
      [],
    );
  }
}

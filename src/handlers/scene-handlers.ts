import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
  convertCamelToSnakeCase,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleCreateScene(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  // Normalize parameters to camelCase
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath) {
    return createErrorResponse("Project path and scene path are required", [
      "Provide valid paths for both the project and the scene",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
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

    // Prepare parameters for the operation (already in camelCase)
    const params = {
      scenePath: args.scenePath,
      rootNodeType: args.rootNodeType ?? "Node2D",
    };

    // Execute the operation
    const { stdout, stderr } = await executeOperation(
      ctx,
      "create_scene",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to create scene: ${stderr}`, [
        "Check if the root node type is valid",
        "Ensure you have write permissions to the scene path",
        "Verify the scene path is valid",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Scene created successfully at: ${args.scenePath}\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to create scene: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleSaveScene(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  // Normalize parameters to camelCase
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and scenePath",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
    ]);
  }

  // If newPath is provided, validate it
  if (args.newPath && !validatePath(args.newPath)) {
    return createErrorResponse("Invalid new path", [
      'Provide a valid new path without ".." or other potentially unsafe characters',
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

    // Check if the scene file exists
    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        [
          "Ensure the scene path is correct",
          "Use create_scene to create a new scene first",
        ],
      );
    }

    // Prepare parameters for the operation (already in camelCase)
    const params: any = {
      scenePath: args.scenePath,
    };

    // Add optional parameters
    if (args.newPath) {
      params.newPath = args.newPath;
    }

    // Execute the operation
    const { stdout, stderr } = await executeOperation(
      ctx,
      "save_scene",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to save scene: ${stderr}`, [
        "Check if the scene file is valid",
        "Ensure you have write permissions to the output path",
        "Verify the scene can be properly packed",
      ]);
    }

    const savePath = args.newPath ?? args.scenePath;
    return {
      content: [
        {
          type: "text",
          text: `Scene saved successfully to: ${savePath}\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to save scene: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleGetSceneTree(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and scenePath",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params = { scenePath: args.scenePath };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "get_scene_tree",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to get scene tree: ${stderr}`, [
        "Check if the scene file is valid",
      ]);
    }

    return { content: [{ type: "text", text: stdout }] };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to get scene tree: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleValidateScene(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and scenePath",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.scenePath)) {
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params = { scenePath: args.scenePath };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "validate_scene",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to validate scene: ${stderr}`, [
        "Check if the scene file is valid",
      ]);
    }

    return { content: [{ type: "text", text: stdout }] };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to validate scene: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleBatchOperations(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse("Missing required parameter: projectPath", [
      "Provide the path to the Godot project directory",
    ]);
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid project path", [
      'Provide a valid path without ".."',
    ]);
  }

  if (!args.operations || !Array.isArray(args.operations)) {
    return createErrorResponse("Missing required parameter: operations", [
      "Provide an array of operations to execute",
      'Each operation must have "operation" (string) and "params" (object)',
    ]);
  }

  if (args.operations.length === 0) {
    return createErrorResponse("Operations array is empty", [
      "Provide at least one operation to execute",
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

    // Convert each operation's params from camelCase to snake_case
    const operations = args.operations.map(
      (op: { operation: string; params?: Record<string, unknown> }) => ({
        operation: op.operation,
        params: op.params ? convertCamelToSnakeCase(op.params) : {},
      }),
    );

    const { stdout, stderr } = await executeOperation(
      ctx,
      "batch",
      { operations },
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Batch operation failed: ${stderr}`, [
        "Check that all operations and their parameters are valid",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text:
            stdout ||
            `Batch of ${args.operations.length} operations completed.`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Batch operations failed: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

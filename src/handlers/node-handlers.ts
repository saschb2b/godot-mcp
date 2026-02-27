import type { ServerContext } from "../context.js";
import type { ToolResponse, OperationParams } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleAddNode(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  // Normalize parameters to camelCase
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodeType ||
    !args.nodeName
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodeType, and nodeName",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
  ) {
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
      nodeType: args.nodeType,
      nodeName: args.nodeName,
    };

    // Add optional parameters
    if (args.parentNodePath) {
      params.parentNodePath = args.parentNodePath;
    }

    if (args.properties) {
      params.properties = args.properties;
    }

    // Execute the operation
    const { stdout, stderr } = await executeOperation(
      ctx,
      "add_node",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to add node: ${stderr}`, [
        "Check if the node type is valid",
        "Ensure the parent node path exists",
        "Verify the scene file is valid",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Node '${args.nodeName}' of type '${args.nodeType}' added successfully to '${args.scenePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to add node: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleRemoveNode(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, and nodePath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params = { scenePath: args.scenePath, nodePath: args.nodePath };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "remove_node",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to remove node: ${stderr}`, [
        "Check if the node path exists",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Node '${args.nodePath}' removed.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to remove node: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleReparentNode(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodePath ||
    !args.newParentPath
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and newParentPath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      newParentPath: args.newParentPath,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "reparent_node",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to reparent node: ${stderr}`, [
        "Check if both node paths exist",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Node '${args.nodePath}' moved to '${args.newParentPath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to reparent node: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleDuplicateNode(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, and nodePath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params: OperationParams = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
    };
    if (args.newName) params.newName = args.newName;
    if (args.parentNodePath) params.parentNodePath = args.parentNodePath;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "duplicate_node",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to duplicate node: ${stderr}`, [
        "Check if the node path exists",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Node '${args.nodePath}' duplicated${args.newName ? ` as '${args.newName}'` : ""}.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to duplicate node: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleRenameNode(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodePath ||
    !args.newName
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and newName",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
  ) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".."',
    ]);
  }

  try {
    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      newName: args.newName,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "rename_node",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to rename node: ${stderr}`, [
        "Ensure the node path is correct",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: stdout || `Node renamed to '${args.newName}'`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to rename node: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleSetNodeProperties(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodePath ||
    !args.properties
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and properties",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      properties: args.properties,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "set_node_properties",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to set node properties: ${stderr}`,
        ["Check if the node path exists"],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Properties set successfully on '${args.nodePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to set node properties: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleGetNodeProperties(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, and nodePath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params: OperationParams = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
    };
    if (args.properties) params.properties = args.properties;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "get_node_properties",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to get node properties: ${stderr}`,
        ["Check if the node path exists"],
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
      `Failed to get node properties: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleAttachScript(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodePath ||
    !args.scriptPath
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and scriptPath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath) ||
    !validatePath(args.scriptPath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const scriptFullPath = join(args.projectPath, args.scriptPath);
    if (!existsSync(scriptFullPath)) {
      return createErrorResponse(
        `Script file does not exist: ${args.scriptPath}`,
        ["Ensure the script path is correct"],
      );
    }

    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      scriptPath: args.scriptPath,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "attach_script",
      params,
      args.projectPath,
    );

    // Check if the script was attached successfully (via API or .tscn injection)
    if (
      stdout.includes("attached to node:") ||
      stdout.includes("via .tscn injection")
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Script '${args.scriptPath}' attached to '${args.nodePath}'.\n\nOutput: ${stdout}`,
          },
        ],
      };
    }

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to attach script: ${stderr}`, [
        "Check if the node path and script path are correct",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Script '${args.scriptPath}' attached to '${args.nodePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    // executeOperation may throw even on success if Godot prints errors to stderr
    // (e.g., autoload compilation warnings). Check if stdout contains success.
    const stdout = error?.stdout ?? "";
    if (
      stdout.includes("attached to node:") ||
      stdout.includes("via .tscn injection")
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Script '${args.scriptPath}' attached to '${args.nodePath}'.\n\nOutput: ${stdout}`,
          },
        ],
      };
    }
    return createErrorResponse(
      `Failed to attach script: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleSetCollisionLayerMask(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, and nodePath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath)
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

    const scenePath = join(args.projectPath, args.scenePath);
    if (!existsSync(scenePath)) {
      return createErrorResponse(
        `Scene file does not exist: ${args.scenePath}`,
        ["Ensure the scene path is correct"],
      );
    }

    const params: OperationParams = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
    };
    if (args.collisionLayer !== undefined)
      params.collisionLayer = args.collisionLayer;
    if (args.collisionMask !== undefined)
      params.collisionMask = args.collisionMask;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "set_collision_layer_mask",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to set collision layer/mask: ${stderr}`,
        ["Check if the physics node path exists"],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Collision layer/mask set on '${args.nodePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to set collision layer/mask: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

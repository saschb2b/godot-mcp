import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleConnectSignal(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.sourceNodePath ||
    !args.signalName ||
    !args.targetNodePath ||
    !args.methodName
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, sourceNodePath, signalName, targetNodePath, and methodName",
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

    const params = {
      scenePath: args.scenePath,
      sourceNodePath: args.sourceNodePath,
      signalName: args.signalName,
      targetNodePath: args.targetNodePath,
      methodName: args.methodName,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "connect_signal",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to connect signal: ${stderr}`, [
        "Check if the signal and method names are correct",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Signal '${args.signalName}' connected from '${args.sourceNodePath}' to '${args.targetNodePath}.${args.methodName}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to connect signal: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleAddToGroup(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath || !args.groups) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and groups",
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

    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      groups: args.groups,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "add_to_group",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to add node to group: ${stderr}`, [
        "Check if the node path exists",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Node '${args.nodePath}' added to groups [${args.groups.join(", ")}].\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to add node to group: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleRemoveFromGroup(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath || !args.groups) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and groups",
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

    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      groups: args.groups,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "remove_from_group",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to remove node from group: ${stderr}`,
        ["Check if the node path exists"],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Node '${args.nodePath}' removed from groups [${args.groups.join(", ")}].\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to remove node from group: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

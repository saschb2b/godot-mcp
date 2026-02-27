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

export async function handleAddAnimation(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodePath ||
    !args.animationName
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and animationName",
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
      animationName: args.animationName,
    };
    if (args.length !== undefined) params.length = args.length;
    if (args.loop !== undefined) params.loop = args.loop;
    if (args.tracks) params.tracks = args.tracks;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "add_animation",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to add animation: ${stderr}`, [
        "Check if the AnimationPlayer node path exists",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Animation '${args.animationName}' added to '${args.nodePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to add animation: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleCreateAnimationPlayer(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath and scenePath",
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
    };
    if (args.parentNodePath) params.parentNodePath = args.parentNodePath;
    if (args.nodeName) params.nodeName = args.nodeName;
    if (args.animations) params.animations = args.animations;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "create_animation_player",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to create AnimationPlayer: ${stderr}`,
        ["Check if the parent node path exists"],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `AnimationPlayer '${args.nodeName ?? "AnimationPlayer"}' created.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to create AnimationPlayer: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

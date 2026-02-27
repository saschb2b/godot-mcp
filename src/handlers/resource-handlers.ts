import type { ServerContext } from "../context.js";
import type { OperationParams, ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleCreateResource(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.resourcePath || !args.resourceType) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, resourcePath, and resourceType",
    ]);
  }

  if (!validatePath(args.projectPath) || !validatePath(args.resourcePath)) {
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

    const params: any = {
      resourcePath: args.resourcePath,
      resourceType: args.resourceType,
    };
    if (args.scriptPath) params.scriptPath = args.scriptPath;
    if (args.properties) params.properties = args.properties;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "create_resource",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to create resource: ${stderr}`, [
        "Check if the resource type is valid",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Resource created at '${args.resourcePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to create resource: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleInstantiateScene(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.childScenePath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, and childScenePath",
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

    const params: OperationParams = {
      scenePath: args.scenePath,
      childScenePath: args.childScenePath,
    };
    if (args.parentNodePath) params.parentNodePath = args.parentNodePath;
    if (args.nodeName) params.nodeName = args.nodeName;
    if (args.position) params.position = args.position;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "instantiate_scene",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to instantiate scene: ${stderr}`, [
        "Check if the child scene path exists",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Scene '${args.childScenePath}' instantiated in '${args.scenePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to instantiate scene: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleLoadSprite(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (
    !args.projectPath ||
    !args.scenePath ||
    !args.nodePath ||
    !args.texturePath
  ) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and texturePath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath) ||
    !validatePath(args.nodePath) ||
    !validatePath(args.texturePath)
  ) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
    ]);
  }

  try {
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

    const texturePath = join(args.projectPath, args.texturePath);
    if (!existsSync(texturePath)) {
      return createErrorResponse(
        `Texture file does not exist: ${args.texturePath}`,
        [
          "Ensure the texture path is correct",
          "Upload or create the texture file first",
        ],
      );
    }

    const params = {
      scenePath: args.scenePath,
      nodePath: args.nodePath,
      texturePath: args.texturePath,
    };

    const { stdout, stderr } = await executeOperation(
      ctx,
      "load_sprite",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to load sprite: ${stderr}`, [
        "Check if the node path is correct",
        "Ensure the node is a Sprite2D, Sprite3D, or TextureRect",
        "Verify the texture file is a valid image format",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Sprite loaded successfully with texture: ${args.texturePath}\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to load sprite: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleExportMeshLibrary(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.outputPath) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, and outputPath",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.scenePath) ||
    !validatePath(args.outputPath)
  ) {
    return createErrorResponse("Invalid path", [
      'Provide valid paths without ".." or other potentially unsafe characters',
    ]);
  }

  try {
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

    const params: any = {
      scenePath: args.scenePath,
      outputPath: args.outputPath,
    };

    if (args.meshItemNames && Array.isArray(args.meshItemNames)) {
      params.meshItemNames = args.meshItemNames;
    }

    const { stdout, stderr } = await executeOperation(
      ctx,
      "export_mesh_library",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to export mesh library: ${stderr}`, [
        "Check if the scene contains valid 3D meshes",
        "Ensure the output path is valid",
        "Verify the scene file is valid",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `MeshLibrary exported successfully to: ${args.outputPath}\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to export mesh library: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

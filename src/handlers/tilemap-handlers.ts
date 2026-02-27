import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import { normalizeParameters, validatePath, createErrorResponse } from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleSetCells(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath || !args.cells) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and cells",
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
      nodePath: args.nodePath,
      cells: args.cells,
    };

    const { stdout, stderr } = await executeOperation(
      ctx,
      "set_cells",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to set cells: ${stderr}`, [
        "Check if the node path points to a valid TileMapLayer",
        "Ensure the scene file is valid",
        "Verify the TileMapLayer has a TileSet assigned",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Set ${args.cells.length} cells on TileMapLayer in '${args.scenePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to set cells: ${error?.message ?? "Unknown error"}`,
      [
        "Ensure Godot is installed correctly",
        "Check if the GODOT_PATH environment variable is set correctly",
        "Verify the project path is accessible",
      ],
    );
  }
}

export async function handleGetTileData(ctx: ServerContext, args: any): Promise<ToolResponse> {
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
      "get_tile_data",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to get tile data: ${stderr}`, [
        "Check if the node path points to a valid TileMapLayer",
      ]);
    }

    return { content: [{ type: "text", text: stdout }] };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to get tile data: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleCreateTileset(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.resourcePath || !args.atlasSources) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, resourcePath, and atlasSources",
    ]);
  }

  if (
    !validatePath(args.projectPath) ||
    !validatePath(args.resourcePath)
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

    const params: any = {
      resourcePath: args.resourcePath,
      atlasSources: args.atlasSources,
    };
    if (args.tileSize) params.tileSize = args.tileSize;
    if (args.customDataLayers) params.customDataLayers = args.customDataLayers;

    const { stdout, stderr } = await executeOperation(
      ctx,
      "create_tileset",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(`Failed to create tileset: ${stderr}`, [
        "Check if the texture paths are valid",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `TileSet created at '${args.resourcePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to create tileset: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

export async function handleSetCustomTileData(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath || !args.scenePath || !args.nodePath || !args.cells) {
    return createErrorResponse("Missing required parameters", [
      "Provide projectPath, scenePath, nodePath, and cells",
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
      cells: args.cells,
    };
    const { stdout, stderr } = await executeOperation(
      ctx,
      "set_custom_tile_data",
      params,
      args.projectPath,
    );

    if (stderr.includes("Failed to")) {
      return createErrorResponse(
        `Failed to set custom tile data: ${stderr}`,
        ["Check if the TileMapLayer node path exists"],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Custom tile data set on '${args.nodePath}'.\n\nOutput: ${stdout}`,
        },
      ],
    };
  } catch (error: any) {
    return createErrorResponse(
      `Failed to set custom tile data: ${error?.message ?? "Unknown error"}`,
      ["Ensure Godot is installed correctly"],
    );
  }
}

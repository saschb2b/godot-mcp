import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "./context.js";
import { logDebug } from "./utils.js";
import { TOOL_DEFINITIONS } from "./tool-definitions.js";
import * as processHandlers from "./handlers/process-handlers.js";
import * as projectHandlers from "./handlers/project-handlers.js";
import * as sceneHandlers from "./handlers/scene-handlers.js";
import * as nodeHandlers from "./handlers/node-handlers.js";
import * as animationHandlers from "./handlers/animation-handlers.js";
import * as tilemapHandlers from "./handlers/tilemap-handlers.js";
import * as resourceHandlers from "./handlers/resource-handlers.js";
import * as scriptHandlers from "./handlers/script-handlers.js";
import * as signalGroupHandlers from "./handlers/signal-group-handlers.js";
import * as uidHandlers from "./handlers/uid-handlers.js";
import * as settingsHandlers from "./handlers/settings-handlers.js";
import * as interactiveHandlers from "./handlers/interactive-handlers.js";
import * as screenshotHandlers from "./handlers/screenshot-handlers.js";

type HandlerFn = (ctx: ServerContext, args: any) => any;

const HANDLER_MAP: Record<string, HandlerFn> = {
  // Process management
  launch_editor: processHandlers.handleLaunchEditor,
  run_project: processHandlers.handleRunProject,
  stop_project: processHandlers.handleStopProject,
  get_debug_output: processHandlers.handleGetDebugOutput,

  // Project info
  list_projects: projectHandlers.handleListProjects,
  get_project_info: projectHandlers.handleGetProjectInfo,
  get_godot_version: projectHandlers.handleGetGodotVersion,

  // Scene operations
  create_scene: sceneHandlers.handleCreateScene,
  save_scene: sceneHandlers.handleSaveScene,
  get_scene_tree: sceneHandlers.handleGetSceneTree,
  validate_scene: sceneHandlers.handleValidateScene,

  // Node operations
  add_node: nodeHandlers.handleAddNode,
  remove_node: nodeHandlers.handleRemoveNode,
  reparent_node: nodeHandlers.handleReparentNode,
  duplicate_node: nodeHandlers.handleDuplicateNode,
  rename_node: nodeHandlers.handleRenameNode,
  set_node_properties: nodeHandlers.handleSetNodeProperties,
  get_node_properties: nodeHandlers.handleGetNodeProperties,
  attach_script: nodeHandlers.handleAttachScript,
  set_collision_layer_mask: nodeHandlers.handleSetCollisionLayerMask,

  // Animation
  add_animation: animationHandlers.handleAddAnimation,
  create_animation_player: animationHandlers.handleCreateAnimationPlayer,

  // Tilemap
  set_cells: tilemapHandlers.handleSetCells,
  get_tile_data: tilemapHandlers.handleGetTileData,
  create_tileset: tilemapHandlers.handleCreateTileset,
  set_custom_tile_data: tilemapHandlers.handleSetCustomTileData,

  // Resources
  create_resource: resourceHandlers.handleCreateResource,
  instantiate_scene: resourceHandlers.handleInstantiateScene,
  load_sprite: resourceHandlers.handleLoadSprite,
  export_mesh_library: resourceHandlers.handleExportMeshLibrary,

  // Scripts
  read_script: scriptHandlers.handleReadScript,
  write_script: scriptHandlers.handleWriteScript,

  // Signals & groups
  connect_signal: signalGroupHandlers.handleConnectSignal,
  add_to_group: signalGroupHandlers.handleAddToGroup,
  remove_from_group: signalGroupHandlers.handleRemoveFromGroup,

  // UID management
  get_uid: uidHandlers.handleGetUid,
  update_project_uids: uidHandlers.handleUpdateProjectUids,

  // Project settings
  edit_project_settings: settingsHandlers.handleEditProjectSettings,
  manage_autoloads: settingsHandlers.handleManageAutoloads,
  export_project: settingsHandlers.handleExportProject,
  list_input_actions: settingsHandlers.handleListInputActions,

  // Interactive mode
  run_interactive: interactiveHandlers.handleRunInteractive,
  send_input: interactiveHandlers.handleSendInput,
  game_state: interactiveHandlers.handleGameState,
  find_nodes: interactiveHandlers.handleFindNodes,
  game_screenshot: interactiveHandlers.handleGameScreenshot,

  // Screenshots
  capture_screenshot: screenshotHandlers.handleCaptureScreenshot,
  run_and_capture: screenshotHandlers.handleRunAndCapture,
};

export function setupToolHandlers(server: Server, ctx: ServerContext): void {
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    logDebug(ctx.debugMode, `Handling tool request: ${toolName}`);

    const handler = HANDLER_MAP[toolName];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    return await handler(ctx, request.params.arguments);
  });
}

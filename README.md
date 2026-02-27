# Godot MCP

[![](https://badge.mcpx.dev?type=server "MCP Server")](https://modelcontextprotocol.io/introduction)
[![Made with Godot](https://img.shields.io/badge/Godot%204.x-478CBF?style=flat&logo=godot%20engine&logoColor=white)](https://godotengine.org)
[![](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white "TypeScript")](https://www.typescriptlang.org/)
[![](https://img.shields.io/badge/License-MIT-red.svg "MIT License")](https://opensource.org/licenses/MIT)

```
                       (((((((             (((((((
                    (((((((((((           (((((((((((
                    (((((((((((((       (((((((((((((
                    (((((((((((((((((((((((((((((((((
     (((((      (((((((((((((((((((((((((((((((((((((((((      (((((
   (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
  ((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
    (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
      (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
       (((((((((@@@@@@@(((((((((((((((((((((((((@@@@@@@@((((((((((
       ((((((@@@@,,,,,@@@((((((((((((((((((((@@@,,,,,@@@@(((((((((
       (((((@@,,,,,,,,,@@(((((((@@@@@(((((((@@,,,,,,,,,@@@((((((((
       ((((((@@,,,,,,,@@(((((((@@@@@((((((((@@,,,,,,,@@@(((((((((
       (((((((((@@@@@@(((((((((@@@@@(((((((((((@@@@@@((((((((((((
       (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((
       @@@@@@@@@@@@@(((((((((((@@@@@@@@@@@@@@(((((((((((@@@@@@@@@@@@@@
       (((((((( @@@(((((((((((@@(((((((((((@@(((((((((((@@@ ((((((((
       ((((((((( @@(((((((((@@@(((((((((((@@@((((((((((@@ (((((((((
        ((((((((((@@@@@@@@@@@@@@(((((((((((@@@@@@@@@@@@@@((((((((((
         ((((((((((((((((((((((((((((((((((((((((((((((((((((((((
            (((((((((((((((((((((((((((((((((((((((((((((((((
                    (((((((((((((((((((((((((((((((((

          G O D O T    x    M O D E L   C O N T E X T   P R O T O C O L
```

A [Model Context Protocol](https://modelcontextprotocol.io/introduction) server that gives AI assistants full control over the Godot game engine. Build scenes, write scripts, run games, send input, capture screenshots, and query game state -- all through MCP tools.

> Fork of [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp), significantly extended with interactive game control, persistent TCP communication, script authoring, and more.

## What Can It Do?

This isn't just "launch editor and read logs". The MCP server can **build an entire game from scratch** -- create scenes, add and configure nodes, write GDScript files, wire up signals, set up tilemaps, then **run the game, play it via input commands, and observe the results through screenshots and state queries**.

### 45 Tools Across 7 Categories

**Project & Editor**
| Tool | Description |
|------|-------------|
| `launch_editor` | Open the Godot editor for a project |
| `run_project` | Run a project in debug mode |
| `get_debug_output` | Get console output/errors (supports filtering) |
| `stop_project` | Stop a running project |
| `get_godot_version` | Get installed Godot version |
| `list_projects` | Find Godot projects in a directory |
| `get_project_info` | Analyze project structure |

**Scene Management**
| Tool | Description |
|------|-------------|
| `create_scene` | Create a new scene with a root node type |
| `add_node` | Add nodes with properties |
| `remove_node` | Remove nodes from scenes |
| `rename_node` | Rename a node in a scene |
| `reparent_node` | Move a node to a different parent |
| `duplicate_node` | Duplicate a node (optionally to new parent) |
| `instantiate_scene` | Add a scene as a child instance |
| `set_node_properties` | Set properties on nodes |
| `get_node_properties` | Read node properties as JSON |
| `get_scene_tree` | Get full scene tree structure as JSON |
| `connect_signal` | Wire signals between nodes |
| `add_to_group` / `remove_from_group` | Manage node groups |
| `save_scene` | Save scene (or create variant) |
| `validate_scene` | Check for missing scripts, broken refs, etc. |

**Scripting**
| Tool | Description |
|------|-------------|
| `write_script` | Write or update a GDScript file (auto-creates directories) |
| `read_script` | Read GDScript file contents |
| `attach_script` | Attach a script to a node in a scene |

**Assets & Resources**
| Tool | Description |
|------|-------------|
| `load_sprite` | Load a texture into a Sprite2D node |
| `create_resource` | Create .tres resource files with typed properties |
| `create_tileset` | Create TileSet with atlas sources and custom data layers |
| `set_cells` | Place tiles on a TileMapLayer |
| `get_tile_data` | Read tile data from a TileMapLayer |
| `set_custom_tile_data` | Set custom data on tile cells |
| `export_mesh_library` | Export 3D scenes as MeshLibrary for GridMap |

**Animation & Physics**
| Tool | Description |
|------|-------------|
| `create_animation_player` | Create AnimationPlayer with pre-configured animations |
| `add_animation` | Add animations with tracks, keyframes, interpolation |
| `set_collision_layer_mask` | Set collision layers/masks (layer numbers or bitmask) |

**Project Configuration**
| Tool | Description |
|------|-------------|
| `edit_project_settings` | Edit project.godot (display, input, etc.) |
| `manage_autoloads` | Add, remove, or list autoload singletons |
| `list_input_actions` | Discover all input actions defined in a project |
| `get_uid` / `update_project_uids` | UID management (Godot 4.4+) |
| `export_project` | Export for target platform using presets |

**Interactive Game Control** (the big one)
| Tool | Description |
|------|-------------|
| `run_interactive` | Start game with injected TCP input receiver |
| `send_input` | Send input actions to the running game (move, jump, attack...) |
| `game_state` | Query live game state (HP, score, position, level, etc.) |
| `game_screenshot` | Capture the live game viewport as PNG |
| `run_and_capture` | Run game for N seconds, capture screenshot, stop |
| `capture_screenshot` | Render a scene to PNG (static, no runtime) |

## Interactive Mode

The standout feature. `run_interactive` injects a TCP server into the running game as a temporary autoload. The AI can then:

1. **Send inputs** -- `send_input(action: "move_right")` triggers the same input events as a real keypress
2. **Query state** -- `game_state()` returns health, score, turn, level, player position, game over status
3. **Take screenshots** -- `game_screenshot()` captures the live viewport with all runtime rendering
4. **Play the game** -- chain inputs and state queries to navigate levels, fight enemies, test mechanics

The TCP connection is persistent (single socket reused across commands). Everything is cleaned up automatically when the game stops -- the injected autoload is removed and `project.godot` is restored.

## Requirements

- [Godot Engine](https://godotengine.org/download) 4.x installed on your system
- Node.js 18+ and pnpm
- An MCP-compatible AI assistant (Claude Code, Cline, Cursor, etc.)

## Installation

```bash
git clone https://github.com/saschb2b/godot-mcp.git
cd godot-mcp
pnpm install
pnpm run build
```

### Configure with Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/absolute/path/to/godot-mcp/build/index.js"]
    }
  }
}
```

### Configure with Cline

Add to your Cline MCP settings:

```json
{
  "mcpServers": {
    "godot": {
      "command": "node",
      "args": ["/absolute/path/to/godot-mcp/build/index.js"],
      "disabled": false
    }
  }
}
```

### Configure with Cursor

Go to **Settings** > **Features** > **MCP** > **+ Add New MCP Server**:

- Name: `godot`
- Type: `command`
- Command: `node /absolute/path/to/godot-mcp/build/index.js`

### Environment Variables

| Variable     | Description                                         |
| ------------ | --------------------------------------------------- |
| `GODOT_PATH` | Path to Godot executable (overrides auto-detection) |
| `DEBUG`      | Set to `"true"` for verbose server logging          |

## Architecture

The server uses two execution strategies:

1. **Direct CLI** -- Simple operations (launch editor, get version, read files) call Godot CLI commands or manipulate files directly from TypeScript.
2. **Bundled GDScript** -- Complex scene operations use `godot_operations.gd`, a comprehensive script that runs via `godot --headless --script` to manipulate scene trees, nodes, and resources through the Godot API.
3. **TCP Input Receiver** -- Interactive mode injects `input_receiver.gd` as a temporary autoload that listens on port 9876 for JSON commands (input injection, state queries, viewport capture).

## Troubleshooting

| Problem                         | Solution                                              |
| ------------------------------- | ----------------------------------------------------- |
| Godot not found                 | Set `GODOT_PATH` environment variable                 |
| Connection issues               | Restart your AI assistant to reconnect MCP            |
| Invalid project path            | Ensure path contains a `project.godot` file           |
| Interactive mode not responding | Check that port 9876 is not in use by another process |
| Build errors                    | Run `pnpm install` then `pnpm run build`              |

## License

MIT -- see [LICENSE](LICENSE).

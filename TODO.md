# MCP Server Enhancement TODO

## High Priority

- [x] **`get_scene_tree`** — Read a scene's node tree, returning node names, types, properties, and hierarchy.
- [x] **`set_node_properties`** — Modify properties on existing nodes in a scene (position, scale, script, etc.).
- [x] **`attach_script`** — Assign a GDScript file to an existing node in a scene.
- [x] **`create_resource`** — Create .tres resource files with typed properties (e.g., ExitData, ItemData).
- [x] **`edit_project_settings`** — Modify project.godot entries (register autoloads, set input actions, display settings).

## Medium Priority

- [x] **`remove_node`** — Remove a node (and its children) from a scene.
- [x] **`reparent_node`** — Move a node to a different parent within the same scene.
- [x] **`connect_signal`** — Wire a signal from one node to a method on another node in a scene.
- [x] **`get_tile_data`** — Read existing tile cells from a TileMapLayer (complement to `set_cells`).

## Lower Priority

- [x] **`create_tileset`** — Create/configure TileSet resources with atlas sources and custom data layers.
- [x] **`export_project`** — Build/export projects for target platforms using configured presets.
- [x] **`validate_scene`** — Check a scene for common issues (missing scripts, textures, shapes, extreme positions).

## Round 2 — Advanced Features

### High Value

- [x] **`add_to_group`** / **`remove_from_group`** — Manage node group membership in scenes.
- [x] **`instantiate_scene`** — Add a scene as a child instance of another scene (e.g., spawn player in level).
- [x] **`add_animation`** — Add animations with tracks and keyframes to an existing AnimationPlayer.
- [x] **`read_script`** — Read GDScript file contents from a Godot project.

### Medium Value

- [x] **`set_custom_tile_data`** — Set custom data layer values on specific tile cells in a TileMapLayer.
- [x] **`duplicate_node`** — Clone a node within a scene with optional new name and parent.
- [x] **`get_node_properties`** — Read properties from a node (all non-default or specific list).

### Lower Value

- [x] **`create_animation_player`** — Create AnimationPlayer node with pre-configured animations.
- [x] **`manage_autoloads`** — Add, remove, or list autoload singletons in project.godot.
- [x] **`set_collision_layer_mask`** — Set collision layers/masks using layer numbers or raw bitmask.

## Round 3 — Visual Feedback

- [x] **`capture_screenshot`** — Render a scene and capture the viewport as a PNG screenshot for visual feedback.

## Round 4 — Interactive Game Control

- [x] **`run_interactive`** — Run a Godot project with injected TCP input receiver for interactive control.
- [x] **`send_input`** — Send input actions to a running interactive Godot project via TCP.
- [x] **`game_state`** — Query runtime game state (health, score, position, etc.) from autoloads.
- [x] **`game_screenshot`** — Capture a screenshot from a live running game with all runtime state.
- [x] **`list_input_actions`** — List all input actions defined in a project's project.godot.
- [x] **`write_script`** — Write or update a GDScript file in a Godot project.
- [x] **`rename_node`** — Rename a node in a scene while preserving all properties and connections.

## Round 5 — Infrastructure

- [x] **Modular architecture** — Split monolithic index.ts into handlers/, tool-router, tool-definitions, context, types, utils, etc.
- [x] **Automated tests** — 56 vitest integration tests calling handlers against real Godot + bundled fixture project.
- [x] **CI test pipeline** — GitHub Actions job with `chickensoft-games/setup-godot` + `xvfb-run` for headless testing.

## Round 6 — Bug Fixes & Improvements

### Bugs

- [x] **Race condition in `run_project` / `stop_project`** — `ctx.activeProcess.process.kill()` now awaits process exit via `killProcess()` helper before spawning a new one. (Upstream [#70](https://github.com/Coding-Solo/godot-mcp/issues/70))

### Already Fixed (upstream still open)

- [x] **JSON parsing errors on Windows** — Fixed by using `execFileAsync` (no shell, args as array) instead of `execAsync`. (Upstream [#49](https://github.com/Coding-Solo/godot-mcp/issues/49), [#20](https://github.com/Coding-Solo/godot-mcp/issues/20))
- [x] **False success on `add_node` / `create_scene`** — Same root cause as JSON parsing; `execFileAsync` fix resolves this. (Upstream [#55](https://github.com/Coding-Solo/godot-mcp/issues/55))
- [x] **Path traversal / RCE vulnerability** — `validatePath()` prevents escaping project directory. (Upstream [#64](https://github.com/Coding-Solo/godot-mcp/issues/64))
- [x] **Interactive game control** — `send_input`, `run_interactive`, `game_state`, `game_screenshot` tools. (Upstream [#68](https://github.com/Coding-Solo/godot-mcp/issues/68))
- [x] **Script binding & runtime tree** — `attach_script`, `game_state`, `edit_project_settings` cover these needs. (Upstream [#57](https://github.com/Coding-Solo/godot-mcp/issues/57))

## Round 7 — Runtime Introspection (extend existing TCP protocol)

Inspired by upstream [PR #72](https://github.com/Coding-Solo/godot-mcp/pull/72). Rather than adding a separate WebSocket bridge, extend our existing `input_receiver.gd` TCP protocol to support these commands.

### High Value

- [ ] **`call_method`** — Invoke a method on a live node by path (e.g., `player.take_damage(10)`). Powerful for testing game logic at runtime.
- [ ] **`evaluate_expression`** — Execute arbitrary GDScript expression at runtime and return the result. Useful for debugging and one-off queries.
- [x] **`find_nodes`** — Search the live runtime scene tree by name/type pattern. Useful for verifying spawned entities, finding nodes dynamically.

### Medium Value

- [ ] **`send_key` / `send_mouse_click` / `send_mouse_drag`** — Granular input simulation (keyboard keys, mouse clicks at coordinates, drag operations). Our `send_input` only supports named actions.
- [ ] **`wait_for_signal` / `wait_for_node`** — Block until a signal is emitted or a node appears in the tree. Useful for sequencing test steps.
- [ ] **`get_performance_metrics`** — Retrieve FPS, draw calls, memory usage, etc. via `Performance` singleton. Useful for optimization workflows.

### Lower Value

- [ ] **`reset_scene`** — Reload the current scene at runtime. Niche but handy for test loops.

## Round 8 — Static Analysis

- [ ] **`get_scene_insights`** — Analyze a scene's architecture: signal flows, dependency mapping, component relationships, behavioral patterns. Gives the AI deeper understanding than raw node trees. (Upstream [PR #52](https://github.com/Coding-Solo/godot-mcp/pull/52))
- [ ] **`get_node_insights`** — Behavioral profiling of scripts: method call classification, signal emission tracking, dependency extraction via preload/load/ClassDB. (Upstream [PR #52](https://github.com/Coding-Solo/godot-mcp/pull/52))

### Future Considerations

- [ ] **Multi-instance support** — Run multiple Godot processes with IDs (e.g., "server", "client1", "client2") for multiplayer testing. (Upstream [PR #56](https://github.com/Coding-Solo/godot-mcp/pull/56))
- [ ] **`run_tests` (GUT support)** — Run GUT (Godot Unit Test) tests via headless Godot and return structured results. Lets the AI write game logic, run tests, and iterate. (Upstream [#29](https://github.com/Coding-Solo/godot-mcp/issues/29))
- [ ] **Publish to NPM** — Make the fork installable via `npx` / `pnpm dlx`. (Upstream [#61](https://github.com/Coding-Solo/godot-mcp/issues/61))

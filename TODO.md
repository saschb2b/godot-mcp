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

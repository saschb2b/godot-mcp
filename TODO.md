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

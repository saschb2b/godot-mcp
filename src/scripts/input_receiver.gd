extends Node

# MCP Input Receiver — TCP server autoload that receives input commands
# from the MCP server and injects them into the running game via
# Input.parse_input_event(). Temporarily injected by the MCP server.
#
# Protocol: newline-delimited JSON over TCP on port 9876
# Commands:
#   {"action": "move_up", "pressed": true}
#   {"action": "move_up", "pressed": false}
#   {"type": "quit"}
#   {"type": "screenshot", "output_path": "/path/to/file.png"}
#   {"type": "get_state"}  — returns game node info
#   {"type": "find_nodes", "pattern": "Enemy*", "type_filter": "CharacterBody2D"}
#   {"type": "call_method", "node_path": "Player", "method": "take_damage", "args": [10]}

const PORT := 9876

var _server: TCPServer
var _client: StreamPeerTCP
var _buffer: String = ""

func _ready() -> void:
	_server = TCPServer.new()
	var err := _server.listen(PORT, "127.0.0.1")
	if err != OK:
		printerr("[MCP InputReceiver] Failed to listen on port " + str(PORT))
		return
	print("[MCP InputReceiver] Listening on 127.0.0.1:" + str(PORT))


func _process(_delta: float) -> void:
	if not _server:
		return

	# Accept new connections
	if _server.is_connection_available():
		_client = _server.take_connection()
		print("[MCP InputReceiver] Client connected")

	if not _client:
		return

	if _client.get_status() != StreamPeerTCP.STATUS_CONNECTED:
		return

	# Read available data
	var available := _client.get_available_bytes()
	if available <= 0:
		return

	var data := _client.get_utf8_string(available)
	if data.is_empty():
		return

	_buffer += data

	# Process complete lines
	while "\n" in _buffer:
		var newline_idx := _buffer.find("\n")
		var line := _buffer.substr(0, newline_idx).strip_edges()
		_buffer = _buffer.substr(newline_idx + 1)
		if not line.is_empty():
			_dispatch(line)


func _dispatch(json_str: String) -> void:
	var json := JSON.new()
	var err := json.parse(json_str)
	if err != OK:
		_send_response({"error": "Invalid JSON"})
		return

	var data: Dictionary = json.get_data()
	var cmd_type: String = data.get("type", "input")

	match cmd_type:
		"input":
			_handle_input(data)
		"quit":
			_send_response({"ok": true, "type": "quit"})
			get_tree().quit(0)
		"screenshot":
			_handle_screenshot(data)
		"get_state":
			_handle_get_state()
		"find_nodes":
			_handle_find_nodes(data)
		"call_method":
			_handle_call_method(data)
		_:
			# Default: treat as input action
			_handle_input(data)


func _handle_input(data: Dictionary) -> void:
	var action: String = data.get("action", "")
	if action.is_empty():
		_send_response({"error": "Missing action"})
		return

	var pressed: bool = data.get("pressed", true)

	var event := InputEventAction.new()
	event.action = action
	event.pressed = pressed

	Input.parse_input_event(event)
	if pressed:
		Input.action_press(action, data.get("strength", 1.0))
	else:
		Input.action_release(action)
	Input.flush_buffered_events()

	_send_response({"ok": true, "action": action, "pressed": pressed})


func _handle_screenshot(data: Dictionary) -> void:
	var output_path: String = data.get("output_path", "")
	if output_path.is_empty():
		_send_response({"error": "Missing output_path"})
		return

	# Wait one frame for rendering
	await get_tree().process_frame

	var image: Image = get_viewport().get_texture().get_image()
	if image == null:
		_send_response({"error": "Failed to capture viewport"})
		return

	var dir_path := output_path.get_base_dir()
	if not dir_path.is_empty():
		DirAccess.make_dir_recursive_absolute(dir_path)

	var save_err := image.save_png(output_path)
	if save_err != OK:
		_send_response({"error": "Failed to save: " + str(save_err)})
		return

	_send_response({"ok": true, "type": "screenshot", "path": output_path, "size": str(image.get_width()) + "x" + str(image.get_height())})


func _handle_get_state() -> void:
	var state := {}
	var scene := get_tree().current_scene

	if scene:
		state["scene"] = scene.name

		# Try to read common game state from autoloads
		var game_state_node := get_node_or_null("/root/GameState")
		if game_state_node:
			for prop in ["health", "max_health", "score", "turn", "current_level", "game_over"]:
				if prop in game_state_node:
					state[prop] = game_state_node.get(prop)

		# Try to get player position
		var player := scene.get_node_or_null("Player")
		if player and "grid_pos" in player:
			state["player_pos"] = str(player.grid_pos)

	_send_response({"ok": true, "type": "state", "state": state})


func _handle_call_method(data: Dictionary) -> void:
	var node_path_str: String = data.get("node_path", "")
	var method_name: String = data.get("method", "")
	if node_path_str.is_empty() or method_name.is_empty():
		_send_response({"error": "Missing node_path or method"})
		return

	var scene := get_tree().current_scene
	if not scene:
		_send_response({"error": "No current scene"})
		return

	var target: Node = scene.get_node_or_null(NodePath(node_path_str))
	if not target:
		# Also try absolute path from root
		target = get_node_or_null(NodePath(node_path_str))
	if not target:
		_send_response({"error": "Node not found: " + node_path_str})
		return

	if not target.has_method(method_name):
		_send_response({"error": "Method not found: " + method_name + " on " + target.get_class()})
		return

	var args: Array = data.get("args", [])
	var result = target.callv(method_name, args)
	_send_response({"ok": true, "type": "call_method", "node": node_path_str, "method": method_name, "result": _serialize_value(result)})


func _serialize_value(value: Variant) -> Variant:
	if value == null:
		return null
	if value is bool or value is int or value is float or value is String:
		return value
	if value is Vector2 or value is Vector3 or value is Color or value is Rect2:
		return str(value)
	if value is Array:
		var arr: Array = []
		for item in value:
			arr.append(_serialize_value(item))
		return arr
	if value is Dictionary:
		var dict := {}
		for key in value:
			dict[str(key)] = _serialize_value(value[key])
		return dict
	if value is Node:
		return {"_type": "Node", "name": value.name, "class": value.get_class()}
	if value is Resource:
		return {"_type": "Resource", "class": value.get_class(), "path": value.resource_path}
	return str(value)


func _handle_find_nodes(data: Dictionary) -> void:
	var pattern: String = data.get("pattern", "*")
	var type_filter: String = data.get("type_filter", "")
	var results: Array = []
	var scene := get_tree().current_scene
	if not scene:
		_send_response({"ok": true, "type": "find_nodes", "nodes": []})
		return
	_find_nodes_recursive(scene, pattern, type_filter, results, "")
	_send_response({"ok": true, "type": "find_nodes", "count": results.size(), "nodes": results})


func _find_nodes_recursive(node: Node, pattern: String, type_filter: String, results: Array, path_prefix: String) -> void:
	var node_path: String = path_prefix + "/" + node.name if not path_prefix.is_empty() else node.name
	var name_match := pattern.is_empty() or pattern == "*" or node.name.match(pattern)
	var type_match := type_filter.is_empty() or node.is_class(type_filter)
	if name_match and type_match:
		var info := {
			"name": node.name,
			"path": node_path,
			"type": node.get_class(),
		}
		if node is Node2D:
			info["position"] = str(node.position)
		elif node is Node3D:
			info["position"] = str(node.position)
		if not node.get_groups().is_empty():
			var groups: Array = []
			for g in node.get_groups():
				if not str(g).begins_with("_"):
					groups.append(str(g))
			if not groups.is_empty():
				info["groups"] = groups
		results.append(info)
	for child in node.get_children():
		_find_nodes_recursive(child, pattern, type_filter, results, node_path)


func _send_response(data: Dictionary) -> void:
	if _client and _client.get_status() == StreamPeerTCP.STATUS_CONNECTED:
		var json_str := JSON.stringify(data) + "\n"
		_client.put_data(json_str.to_utf8_buffer())

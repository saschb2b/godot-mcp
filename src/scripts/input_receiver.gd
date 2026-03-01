extends Node

# MCP Input Receiver — TCP server autoload that receives input commands
# from the MCP server and injects them into the running game via
# get_viewport().push_input(). Temporarily injected by the MCP server.
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
#   {"type": "evaluate_expression", "expression": "get_tree().current_scene.name"}
#   {"type": "send_key", "key": "space", "pressed": true}
#   {"type": "send_mouse_click", "x": 100, "y": 200, "button": "left"}
#   {"type": "send_mouse_drag", "from_x": 0, "from_y": 0, "to_x": 100, "to_y": 100}
#   {"type": "wait_for_signal", "node_path": "Player", "signal": "died", "timeout": 5.0}
#   {"type": "wait_for_node", "node_path": "Player/Sword", "timeout": 5.0}
#   {"type": "get_performance_metrics"}
#   {"type": "reset_scene"}
#   {"type": "get_runtime_errors", "clear": true}
#   {"type": "send_key_sequence", "keys": ["a", "b", {"wait": 500}, "c"], "delay_ms": 50}
#   {"type": "pause_game", "paused": true}
#   {"type": "set_property", "node_path": "Player", "property": "health", "value": 100}
#   {"type": "execute_script", "code": "var p = $Player\nreturn p.position"}
#   {"type": "subscribe_signals", "node_path": "/root/EventBus", "signals": ["score_changed"]}
#   {"type": "get_signal_events", "clear": true}


# Custom Logger that buffers runtime errors/warnings (Godot 4.5+)
class _McpLogger extends Logger:
	var _entries: Array[Dictionary] = []
	var _mutex := Mutex.new()

	func _log_error(function: String, file: String, line: int, code: String,
			rationale: String, _editor_notify: bool, error_type: int,
			script_backtraces: Array[ScriptBacktrace]) -> void:
		var type_name: String
		match error_type:
			Logger.ERROR_TYPE_ERROR:
				type_name = "error"
			Logger.ERROR_TYPE_WARNING:
				type_name = "warning"
			Logger.ERROR_TYPE_SCRIPT:
				type_name = "script_error"
			Logger.ERROR_TYPE_SHADER:
				type_name = "shader_error"
			_:
				type_name = "unknown"

		var backtraces_arr: Array = []
		for bt in script_backtraces:
			var frames: Array = []
			for i in bt.get_frame_count():
				frames.append({
					"file": bt.get_frame_file(i),
					"line": bt.get_frame_line(i),
					"function": bt.get_frame_function(i),
				})
			backtraces_arr.append(frames)

		var entry := {
			"type": type_name,
			"function": function,
			"file": file,
			"line": line,
			"code": code,
			"rationale": rationale,
			"backtraces": backtraces_arr,
		}

		_mutex.lock()
		_entries.append(entry)
		_mutex.unlock()

	func _log_message(message: String, error: bool) -> void:
		# Only buffer stderr messages (actual errors), not regular prints
		if not error:
			return
		_mutex.lock()
		_entries.append({
			"type": "stderr",
			"message": message,
		})
		_mutex.unlock()

	func get_and_clear() -> Array[Dictionary]:
		_mutex.lock()
		var result := _entries.duplicate()
		_entries.clear()
		_mutex.unlock()
		return result

	func get_all() -> Array[Dictionary]:
		_mutex.lock()
		var result := _entries.duplicate()
		_mutex.unlock()
		return result


const PORT := 9876

var _server: TCPServer
var _client: StreamPeerTCP
var _buffer: String = ""
var _logger: _McpLogger
var _signal_events: Array[Dictionary] = []
var _signal_subscriptions: Array[Dictionary] = []  # [{node, signal, callable}]

func _ready() -> void:
	_logger = _McpLogger.new()
	OS.add_logger(_logger)

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
		"evaluate_expression":
			_handle_evaluate_expression(data)
		"send_key":
			_handle_send_key(data)
		"send_mouse_click":
			_handle_send_mouse_click(data)
		"send_mouse_drag":
			_handle_send_mouse_drag(data)
		"wait_for_signal":
			_handle_wait_for_signal(data)
		"wait_for_node":
			_handle_wait_for_node(data)
		"get_performance_metrics":
			_handle_get_performance_metrics(data)
		"reset_scene":
			_handle_reset_scene()
		"get_runtime_errors":
			_handle_get_runtime_errors(data)
		"send_key_sequence":
			_handle_send_key_sequence(data)
		"pause_game":
			_handle_pause_game(data)
		"set_property":
			_handle_set_property(data)
		"execute_script":
			_handle_execute_script(data)
		"subscribe_signals":
			_handle_subscribe_signals(data)
		"get_signal_events":
			_handle_get_signal_events(data)
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

	# Send response before flushing — flush can trigger scene changes
	_send_response({"ok": true, "action": action, "pressed": pressed})
	get_viewport().push_input(event)
	if pressed:
		Input.action_press(action, data.get("strength", 1.0))
	else:
		Input.action_release(action)
	Input.flush_buffered_events()


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


func _handle_evaluate_expression(data: Dictionary) -> void:
	var expr_str: String = data.get("expression", "")
	if expr_str.is_empty():
		_send_response({"error": "Missing expression"})
		return

	# Collect autoload singletons as named inputs so expressions can reference them
	var input_names: PackedStringArray = PackedStringArray()
	var input_values: Array = []
	for child in get_tree().root.get_children():
		# Skip scene root and internal nodes (like this receiver)
		if child == get_tree().current_scene:
			continue
		if child.name.begins_with("_"):
			continue
		input_names.append(child.name)
		input_values.append(child)

	var expression := Expression.new()
	var parse_err := expression.parse(expr_str, input_names)
	if parse_err != OK:
		_send_response({"error": "Parse error: " + expression.get_error_text()})
		return

	var scene := get_tree().current_scene
	var base_instance: Object = scene if scene else self
	var result = expression.execute(input_values, base_instance)
	if expression.has_execute_failed():
		_send_response({"error": "Execution error: " + expression.get_error_text()})
		return

	_send_response({"ok": true, "type": "evaluate_expression", "result": _serialize_value(result)})


func _handle_send_key(data: Dictionary) -> void:
	var key_str: String = data.get("key", "")
	if key_str.is_empty():
		_send_response({"error": "Missing key"})
		return

	var keycode := OS.find_keycode_from_string(key_str)
	if keycode == KEY_NONE:
		_send_response({"error": "Unknown key: " + key_str})
		return

	var pressed: bool = data.get("pressed", true)
	var event := InputEventKey.new()
	event.keycode = keycode
	event.physical_keycode = keycode
	event.pressed = pressed
	event.shift_pressed = data.get("shift", false)
	event.ctrl_pressed = data.get("ctrl", false)
	event.alt_pressed = data.get("alt", false)
	event.meta_pressed = data.get("meta", false)

	# Send response before flushing — flush can trigger scene changes
	_send_response({"ok": true, "type": "send_key", "key": key_str, "pressed": pressed})
	get_viewport().push_input(event)
	Input.flush_buffered_events()


func _handle_send_mouse_click(data: Dictionary) -> void:
	var x: float = data.get("x", 0.0)
	var y: float = data.get("y", 0.0)
	var button_str: String = data.get("button", "left")
	var double_click: bool = data.get("double_click", false)

	var button_index: MouseButton
	match button_str:
		"left":
			button_index = MOUSE_BUTTON_LEFT
		"right":
			button_index = MOUSE_BUTTON_RIGHT
		"middle":
			button_index = MOUSE_BUTTON_MIDDLE
		_:
			_send_response({"error": "Unknown button: " + button_str + ". Use left, right, or middle"})
			return

	var pos := Vector2(x, y)

	# Send response BEFORE flushing events, because flush_buffered_events()
	# can trigger handlers that call change_scene_to_file(), which may delay
	# or prevent the TCP response from being sent in time.
	_send_response({"ok": true, "type": "send_mouse_click", "x": x, "y": y, "button": button_str})

	# Press
	var press := InputEventMouseButton.new()
	press.position = pos
	press.global_position = pos
	press.button_index = button_index
	press.pressed = true
	press.double_click = double_click
	get_viewport().push_input(press)

	# Release
	var release := InputEventMouseButton.new()
	release.position = pos
	release.global_position = pos
	release.button_index = button_index
	release.pressed = false
	get_viewport().push_input(release)

	Input.flush_buffered_events()


func _handle_send_mouse_drag(data: Dictionary) -> void:
	var from_x: float = data.get("from_x", 0.0)
	var from_y: float = data.get("from_y", 0.0)
	var to_x: float = data.get("to_x", 0.0)
	var to_y: float = data.get("to_y", 0.0)
	var steps: int = data.get("steps", 10)
	var button_str: String = data.get("button", "left")

	var button_index: MouseButton
	match button_str:
		"left":
			button_index = MOUSE_BUTTON_LEFT
		"right":
			button_index = MOUSE_BUTTON_RIGHT
		"middle":
			button_index = MOUSE_BUTTON_MIDDLE
		_:
			_send_response({"error": "Unknown button: " + button_str + ". Use left, right, or middle"})
			return

	var from := Vector2(from_x, from_y)
	var to := Vector2(to_x, to_y)

	# Press at start
	var press := InputEventMouseButton.new()
	press.position = from
	press.global_position = from
	press.button_index = button_index
	press.pressed = true
	get_viewport().push_input(press)

	# Motion events
	steps = max(steps, 1)
	for i in range(steps + 1):
		var t := float(i) / float(steps)
		var pos := from.lerp(to, t)
		var motion := InputEventMouseMotion.new()
		motion.position = pos
		motion.global_position = pos
		motion.button_mask = MOUSE_BUTTON_MASK_LEFT if button_str == "left" else (MOUSE_BUTTON_MASK_RIGHT if button_str == "right" else MOUSE_BUTTON_MASK_MIDDLE)
		get_viewport().push_input(motion)

	# Release at end
	var release := InputEventMouseButton.new()
	release.position = to
	release.global_position = to
	release.button_index = button_index
	release.pressed = false
	get_viewport().push_input(release)

	# Send response before flushing — flush can trigger scene changes
	_send_response({"ok": true, "type": "send_mouse_drag", "from": str(from), "to": str(to), "steps": steps})
	Input.flush_buffered_events()


func _handle_wait_for_signal(data: Dictionary) -> void:
	var node_path_str: String = data.get("node_path", "")
	var signal_name: String = data.get("signal", "")
	if node_path_str.is_empty() or signal_name.is_empty():
		_send_response({"error": "Missing node_path or signal"})
		return

	var timeout: float = data.get("timeout", 5.0)

	var scene := get_tree().current_scene
	if not scene:
		_send_response({"error": "No current scene"})
		return

	var target: Node = scene.get_node_or_null(NodePath(node_path_str))
	if not target:
		target = get_node_or_null(NodePath(node_path_str))
	if not target:
		_send_response({"error": "Node not found: " + node_path_str})
		return

	if not target.has_signal(signal_name):
		_send_response({"error": "Signal not found: " + signal_name + " on " + target.get_class()})
		return

	var elapsed := 0.0
	var received := false
	var cb := func():
		received = true

	target.connect(signal_name, cb, CONNECT_ONE_SHOT)

	while elapsed < timeout and not received:
		await get_tree().process_frame
		elapsed += get_process_delta_time()

	if received:
		_send_response({"ok": true, "type": "wait_for_signal", "node": node_path_str, "signal": signal_name, "timed_out": false, "elapsed": elapsed})
	else:
		if target.is_connected(signal_name, cb):
			target.disconnect(signal_name, cb)
		_send_response({"ok": true, "type": "wait_for_signal", "node": node_path_str, "signal": signal_name, "timed_out": true, "elapsed": timeout})


func _handle_wait_for_node(data: Dictionary) -> void:
	var node_path_str: String = data.get("node_path", "")
	if node_path_str.is_empty():
		_send_response({"error": "Missing node_path"})
		return

	var timeout: float = data.get("timeout", 5.0)

	var scene := get_tree().current_scene
	if not scene:
		_send_response({"error": "No current scene"})
		return

	var elapsed := 0.0
	while elapsed < timeout:
		var target: Node = scene.get_node_or_null(NodePath(node_path_str))
		if not target:
			target = get_node_or_null(NodePath(node_path_str))
		if target:
			_send_response({"ok": true, "type": "wait_for_node", "node_path": node_path_str, "found": true, "elapsed": elapsed})
			return
		await get_tree().process_frame
		elapsed += get_process_delta_time()

	_send_response({"ok": true, "type": "wait_for_node", "node_path": node_path_str, "found": false, "elapsed": timeout})


func _handle_get_performance_metrics(data: Dictionary) -> void:
	var metrics := {}

	# Core performance metrics from Performance singleton
	metrics["fps"] = Performance.get_monitor(Performance.TIME_FPS)
	metrics["frame_time"] = Performance.get_monitor(Performance.TIME_PROCESS)
	metrics["physics_time"] = Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)
	metrics["navigation_time"] = Performance.get_monitor(Performance.TIME_NAVIGATION_PROCESS)

	# Memory
	metrics["static_memory"] = Performance.get_monitor(Performance.MEMORY_STATIC)
	metrics["static_memory_max"] = Performance.get_monitor(Performance.MEMORY_STATIC_MAX)

	# Objects
	metrics["object_count"] = Performance.get_monitor(Performance.OBJECT_COUNT)
	metrics["resource_count"] = Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT)
	metrics["node_count"] = Performance.get_monitor(Performance.OBJECT_NODE_COUNT)
	metrics["orphan_node_count"] = Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)

	# Rendering
	metrics["draw_calls"] = Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	metrics["total_objects"] = Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)
	metrics["total_primitives"] = Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
	metrics["video_memory"] = Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED)

	# Physics
	metrics["active_2d_bodies"] = Performance.get_monitor(Performance.PHYSICS_2D_ACTIVE_OBJECTS)
	metrics["collision_2d_pairs"] = Performance.get_monitor(Performance.PHYSICS_2D_COLLISION_PAIRS)
	metrics["active_3d_bodies"] = Performance.get_monitor(Performance.PHYSICS_3D_ACTIVE_OBJECTS)
	metrics["collision_3d_pairs"] = Performance.get_monitor(Performance.PHYSICS_3D_COLLISION_PAIRS)

	# Filter to requested metrics if specified
	var requested: Array = data.get("metrics", [])
	if not requested.is_empty():
		var filtered := {}
		for key in requested:
			if key in metrics:
				filtered[key] = metrics[key]
		metrics = filtered

	_send_response({"ok": true, "type": "get_performance_metrics", "metrics": metrics})


func _handle_reset_scene() -> void:
	var scene_name: String = ""
	if get_tree().current_scene:
		scene_name = get_tree().current_scene.name
	var err := get_tree().reload_current_scene()
	if err != OK:
		_send_response({"error": "Failed to reload scene: " + str(err)})
		return
	_send_response({"ok": true, "type": "reset_scene", "scene": scene_name})


func _handle_get_runtime_errors(data: Dictionary) -> void:
	var clear: bool = data.get("clear", true)
	var entries: Array
	if clear:
		entries = _logger.get_and_clear()
	else:
		entries = _logger.get_all()
	_send_response({"ok": true, "type": "get_runtime_errors", "count": entries.size(), "errors": entries})


func _handle_send_key_sequence(data: Dictionary) -> void:
	var keys: Array = data.get("keys", [])
	if keys.is_empty():
		_send_response({"error": "Missing keys array"})
		return

	var default_delay_ms: int = data.get("delay_ms", 50)
	var keys_sent: int = 0

	for item in keys:
		if item is Dictionary:
			# Wait command: {"wait": 500}
			var wait_ms: int = item.get("wait", 0)
			if wait_ms > 0:
				await get_tree().create_timer(wait_ms / 1000.0).timeout
		elif item is String:
			var key_str: String = item
			var keycode := OS.find_keycode_from_string(key_str)
			if keycode == KEY_NONE:
				_send_response({"error": "Unknown key in sequence: " + key_str, "keys_sent": keys_sent})
				return

			# Press
			var press := InputEventKey.new()
			press.keycode = keycode
			press.physical_keycode = keycode
			press.pressed = true
			get_viewport().push_input(press)
			Input.flush_buffered_events()

			# Wait a frame for the game to process the press
			await get_tree().process_frame

			# Release
			var release := InputEventKey.new()
			release.keycode = keycode
			release.physical_keycode = keycode
			release.pressed = false
			get_viewport().push_input(release)
			Input.flush_buffered_events()

			keys_sent += 1

			# Default inter-key delay
			if default_delay_ms > 0:
				await get_tree().create_timer(default_delay_ms / 1000.0).timeout

	_send_response({"ok": true, "type": "send_key_sequence", "keys_sent": keys_sent})


func _handle_pause_game(data: Dictionary) -> void:
	var paused: bool = data.get("paused", true)
	get_tree().paused = paused
	_send_response({"ok": true, "type": "pause_game", "paused": paused})


func _handle_set_property(data: Dictionary) -> void:
	var node_path_str: String = data.get("node_path", "")
	var property: String = data.get("property", "")
	if node_path_str.is_empty() or property.is_empty():
		_send_response({"error": "Missing node_path or property"})
		return

	var scene := get_tree().current_scene
	if not scene:
		_send_response({"error": "No current scene"})
		return

	var target: Node = scene.get_node_or_null(NodePath(node_path_str))
	if not target:
		target = get_node_or_null(NodePath(node_path_str))
	if not target:
		_send_response({"error": "Node not found: " + node_path_str})
		return

	var value = data.get("value")

	# Convert array to Vector2/Vector3 if the existing property type expects it
	if value is Array:
		var current = target.get(property)
		if current is Vector2 and value.size() == 2:
			value = Vector2(value[0], value[1])
		elif current is Vector3 and value.size() == 3:
			value = Vector3(value[0], value[1], value[2])
		elif current is Color and value.size() >= 3:
			if value.size() == 4:
				value = Color(value[0], value[1], value[2], value[3])
			else:
				value = Color(value[0], value[1], value[2])

	target.set(property, value)
	var new_value = target.get(property)
	_send_response({"ok": true, "type": "set_property", "node": node_path_str, "property": property, "value": _serialize_value(new_value)})


func _handle_execute_script(data: Dictionary) -> void:
	var code: String = data.get("code", "")
	if code.is_empty():
		_send_response({"error": "Missing code"})
		return

	# Build a temporary GDScript with the code as a function body
	var script_source := "extends RefCounted\n\n"

	# Collect autoload references as variables
	var autoload_lines := ""
	for child in get_tree().root.get_children():
		if child == get_tree().current_scene:
			continue
		if child.name.begins_with("_"):
			continue
		autoload_lines += "var " + child.name + ": Node\n"

	if not autoload_lines.is_empty():
		script_source += autoload_lines + "\n"

	script_source += "var _scene: Node\n\n"
	script_source += "func _execute():\n"

	# Indent user code
	for line in code.split("\n"):
		script_source += "\t" + line + "\n"

	var script := GDScript.new()
	script.source_code = script_source
	var err := script.reload()
	if err != OK:
		_send_response({"error": "Script compilation error: " + str(err)})
		return

	var instance = script.new()

	# Set autoload references
	for child in get_tree().root.get_children():
		if child == get_tree().current_scene:
			continue
		if child.name.begins_with("_"):
			continue
		if child.name in instance:
			instance.set(child.name, child)

	instance._scene = get_tree().current_scene

	var result = instance._execute()
	_send_response({"ok": true, "type": "execute_script", "result": _serialize_value(result)})


func _handle_subscribe_signals(data: Dictionary) -> void:
	var node_path_str: String = data.get("node_path", "")
	var signal_names: Array = data.get("signals", [])
	if node_path_str.is_empty() or signal_names.is_empty():
		_send_response({"error": "Missing node_path or signals"})
		return

	var scene := get_tree().current_scene
	if not scene:
		_send_response({"error": "No current scene"})
		return

	var target: Node = scene.get_node_or_null(NodePath(node_path_str))
	if not target:
		target = get_node_or_null(NodePath(node_path_str))
	if not target:
		_send_response({"error": "Node not found: " + node_path_str})
		return

	var subscribed: Array = []
	for sig_name in signal_names:
		if not target.has_signal(sig_name):
			continue

		# Create a callback that captures signal info
		var cb := func(_a1 = null, _a2 = null, _a3 = null, _a4 = null, _a5 = null, _a6 = null):
			var args_arr: Array = []
			for a in [_a1, _a2, _a3, _a4, _a5, _a6]:
				if a != null:
					args_arr.append(_serialize_value(a))
			_signal_events.append({
				"signal": sig_name,
				"node": node_path_str,
				"args": args_arr,
				"time": Time.get_ticks_msec(),
			})

		target.connect(sig_name, cb)
		_signal_subscriptions.append({"node": target, "signal": sig_name, "callable": cb})
		subscribed.append(sig_name)

	_send_response({"ok": true, "type": "subscribe_signals", "node": node_path_str, "subscribed": subscribed})


func _handle_get_signal_events(data: Dictionary) -> void:
	var clear: bool = data.get("clear", true)
	var events := _signal_events.duplicate()
	if clear:
		_signal_events.clear()
	_send_response({"ok": true, "type": "get_signal_events", "count": events.size(), "events": events})


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

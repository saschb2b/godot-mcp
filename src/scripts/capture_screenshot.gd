extends SceneTree

# Capture a screenshot of a Godot scene by rendering it and saving the viewport as PNG.
# Usage: godot --path <project> --script capture_screenshot.gd <json_params>
# Unlike godot_operations.gd, this runs WITHOUT --headless to enable rendering.

var target_scene_path: String = ""
var output_path: String = ""
var wait_frames: int = 3
var override_width: int = 0
var override_height: int = 0
var frame_count: int = 0
var scene_loaded: bool = false

func _init():
	var args: PackedStringArray = OS.get_cmdline_args()

	# Find --script index to locate our JSON params
	var script_index: int = args.find("--script")
	if script_index == -1:
		printerr("[ERROR] Could not find --script argument")
		quit(1)
		return

	# Params JSON is at script_index + 2 (script_index + 1 is the script path itself)
	var params_index: int = script_index + 2
	if args.size() <= params_index:
		printerr("[ERROR] Usage: godot --path <project> --script capture_screenshot.gd <json_params>")
		quit(1)
		return

	var params_json: String = args[params_index]

	var json := JSON.new()
	var error: int = json.parse(params_json)
	if error != OK:
		printerr("[ERROR] Failed to parse JSON: " + json.get_error_message())
		quit(1)
		return

	var params: Dictionary = json.get_data()

	target_scene_path = params.get("scene_path", "")
	output_path = params.get("output_path", "")
	wait_frames = int(params.get("wait_frames", 3))
	override_width = int(params.get("width", 0))
	override_height = int(params.get("height", 0))

	if target_scene_path.is_empty():
		printerr("[ERROR] scene_path is required")
		quit(1)
		return

	if output_path.is_empty():
		printerr("[ERROR] output_path is required")
		quit(1)
		return

	# Apply resolution override if specified
	if override_width > 0 and override_height > 0:
		root.content_scale_size = Vector2i(override_width, override_height)
		DisplayServer.window_set_size(Vector2i(override_width, override_height))

	# Validate scene exists
	if not ResourceLoader.exists(target_scene_path):
		printerr("[ERROR] Scene file not found: " + target_scene_path)
		quit(1)
		return

	# Load and instantiate the scene
	var packed_scene: PackedScene = load(target_scene_path) as PackedScene
	if packed_scene == null:
		printerr("[ERROR] Failed to load scene: " + target_scene_path)
		quit(1)
		return

	var instance: Node = packed_scene.instantiate()
	root.add_child(instance)
	scene_loaded = true
	print("[INFO] Scene loaded: " + target_scene_path)


func _process(_delta: float) -> bool:
	if not scene_loaded:
		return false

	frame_count += 1
	if frame_count >= wait_frames:
		_capture_deferred.call_deferred()
	return false


func _capture_deferred() -> void:
	var image: Image = root.get_viewport().get_texture().get_image()
	if image == null:
		printerr("[ERROR] Failed to capture viewport image")
		quit(1)
		return

	# Ensure output directory exists
	var dir_path: String = output_path.get_base_dir()
	if not dir_path.is_empty():
		DirAccess.make_dir_recursive_absolute(dir_path)

	var err: int = image.save_png(output_path)
	if err != OK:
		printerr("[ERROR] Failed to save screenshot: error code " + str(err))
		quit(1)
		return

	print("[INFO] Screenshot saved: " + output_path)
	print("[INFO] Size: " + str(image.get_width()) + "x" + str(image.get_height()))
	quit(0)

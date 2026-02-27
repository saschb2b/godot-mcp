extends Node

# Autoload script that captures a screenshot after a delay and quits.
# Temporarily added to a project by the run_and_capture MCP tool.
# Since this runs as an autoload, the full game environment is available
# (other autoloads, main scene, _ready, etc.).

var output_path: String = ""
var duration: float = 3.0
var elapsed: float = 0.0
var captured: bool = false

func _ready() -> void:
	# Read params from a temp file placed by the MCP server
	var config_path: String = "res://.mcp_capture_config.json"
	if not FileAccess.file_exists(config_path):
		# Also try user:// path
		config_path = "user://.mcp_capture_config.json"
	if not FileAccess.file_exists(config_path):
		printerr("[ERROR] run_and_capture: config file not found")
		get_tree().quit(1)
		return

	var file := FileAccess.open(config_path, FileAccess.READ)
	var json_text := file.get_as_text()
	file.close()

	var json := JSON.new()
	var error: int = json.parse(json_text)
	if error != OK:
		printerr("[ERROR] run_and_capture: failed to parse config JSON")
		get_tree().quit(1)
		return

	var params: Dictionary = json.get_data()
	output_path = params.get("output_path", "")
	duration = float(params.get("duration", 3.0))

	if output_path.is_empty():
		printerr("[ERROR] run_and_capture: output_path is required")
		get_tree().quit(1)
		return

	print("[INFO] run_and_capture: will capture after " + str(duration) + "s")

func _process(delta: float) -> void:
	if captured:
		return

	elapsed += delta
	if elapsed >= duration:
		captured = true
		_do_capture.call_deferred()

func _do_capture() -> void:
	var image: Image = get_viewport().get_texture().get_image()
	if image == null:
		printerr("[ERROR] run_and_capture: failed to capture viewport image")
		get_tree().quit(1)
		return

	var dir_path: String = output_path.get_base_dir()
	if not dir_path.is_empty():
		DirAccess.make_dir_recursive_absolute(dir_path)

	var err: int = image.save_png(output_path)
	if err != OK:
		printerr("[ERROR] run_and_capture: failed to save screenshot (error " + str(err) + ")")
		get_tree().quit(1)
		return

	print("[INFO] Screenshot saved: " + output_path)
	print("[INFO] Size: " + str(image.get_width()) + "x" + str(image.get_height()))
	get_tree().quit(0)

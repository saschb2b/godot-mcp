import type {
  GodotProcess,
  ExitedProcessSnapshot,
  TcpState,
  InteractiveState,
  GodotServerConfig,
} from "./types.js";

export class ServerContext {
  godotPath: string | null = null;
  validatedPaths = new Map<string, boolean>();
  strictPathValidation = false;
  operationsScriptPath: string;
  debugMode: boolean;

  // Tool filtering
  toolsets: Set<string> | null = null;
  excludeTools = new Set<string>();
  readOnly = false;

  activeProcess: GodotProcess | null = null;
  /**
   * Snapshot of the most recently exited process, populated by
   * `snapshotExitedProcess()` from the child_process exit/error handlers.
   * Lets `get_debug_output` still return stdout/stderr after the process is
   * gone (e.g. when Godot crashes during startup before we can poll it).
   */
  lastExitedProcess: ExitedProcessSnapshot | null = null;

  tcp: TcpState = {
    socket: null,
    buffer: "",
    pendingResolve: null,
    pendingReject: null,
  };

  interactive: InteractiveState = {
    projectPath: null,
    originalProjectGodot: null,
  };

  constructor(config: GodotServerConfig, operationsScriptPath: string) {
    this.operationsScriptPath = operationsScriptPath;
    this.debugMode = config.debugMode ?? process.env.DEBUG === "true";
    this.strictPathValidation = config.strictPathValidation ?? false;

    if (config.toolsets && config.toolsets.length > 0) {
      this.toolsets = new Set(config.toolsets);
    }
    if (config.excludeTools && config.excludeTools.length > 0) {
      this.excludeTools = new Set(config.excludeTools);
    }
    if (config.readOnly) {
      this.readOnly = true;
    }
  }
}

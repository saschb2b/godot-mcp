import type { GodotProcess, TcpState, InteractiveState, GodotServerConfig } from "./types.js";

export class ServerContext {
  godotPath: string | null = null;
  validatedPaths = new Map<string, boolean>();
  strictPathValidation = false;
  operationsScriptPath: string;
  debugMode: boolean;

  activeProcess: GodotProcess | null = null;

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
    this.debugMode = config.debugMode ?? (process.env.DEBUG === "true");
    this.strictPathValidation = config.strictPathValidation ?? false;
  }
}

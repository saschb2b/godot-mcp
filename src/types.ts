import type * as net from "net";
import type { ChildProcess } from "child_process";

export interface GodotProcess {
  process: ChildProcess;
  output: string[];
  errors: string[];
}

/**
 * Snapshot of the most recently exited Godot process. Kept around so that
 * output/errors captured during the run can still be queried after the
 * process has gone away (e.g. crashed at startup, or quit on its own).
 */
export interface ExitedProcessSnapshot {
  output: string[];
  errors: string[];
  exitCode: number | null;
  exitedAt: number;
  reason: "exit" | "error";
}

export interface GodotServerConfig {
  godotPath?: string;
  debugMode?: boolean;
  godotDebugMode?: boolean;
  strictPathValidation?: boolean;
  toolsets?: string[];
  excludeTools?: string[];
  readOnly?: boolean;
}

export type OperationParams = Record<string, any>;

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}

export interface TcpState {
  socket: net.Socket | null;
  buffer: string;
  pendingResolve: ((value: Record<string, unknown>) => void) | null;
  pendingReject: ((reason: Error) => void) | null;
}

export interface InteractiveState {
  projectPath: string | null;
  originalProjectGodot: string | null;
}

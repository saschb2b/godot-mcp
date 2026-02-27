import * as net from "net";
import { join } from "path";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import type { ServerContext } from "./context.js";

export function ensureTcpConnection(
  ctx: ServerContext,
  port = 9876,
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    if (
      ctx.tcp.socket &&
      !ctx.tcp.socket.destroyed &&
      ctx.tcp.socket.writable
    ) {
      resolve(ctx.tcp.socket);
      return;
    }

    ctx.tcp.socket = null;
    ctx.tcp.buffer = "";

    const socket = net.createConnection(port, "127.0.0.1", () => {
      ctx.tcp.socket = socket;
      resolve(socket);
    });

    socket.on("data", (data) => {
      ctx.tcp.buffer += data.toString();
      while (ctx.tcp.buffer.includes("\n")) {
        const newlineIdx = ctx.tcp.buffer.indexOf("\n");
        const line = ctx.tcp.buffer.substring(0, newlineIdx).trim();
        ctx.tcp.buffer = ctx.tcp.buffer.substring(newlineIdx + 1);
        if (line && ctx.tcp.pendingResolve) {
          try {
            const response = JSON.parse(line);
            const resolve = ctx.tcp.pendingResolve;
            ctx.tcp.pendingResolve = null;
            ctx.tcp.pendingReject = null;
            resolve(response as Record<string, unknown>);
          } catch {
            const reject = ctx.tcp.pendingReject;
            ctx.tcp.pendingResolve = null;
            ctx.tcp.pendingReject = null;
            reject?.(new Error("Invalid JSON response from Godot"));
          }
        }
      }
    });

    socket.on("error", (err) => {
      ctx.tcp.socket = null;
      if (ctx.tcp.pendingReject) {
        const rej = ctx.tcp.pendingReject;
        ctx.tcp.pendingResolve = null;
        ctx.tcp.pendingReject = null;
        rej(
          new Error(
            `TCP connection error: ${err.message}. Is the game running via run_interactive?`,
          ),
        );
      }
      reject(
        new Error(
          `Cannot connect to Godot input receiver: ${err.message}. Is the game running via run_interactive?`,
        ),
      );
    });

    socket.on("close", () => {
      ctx.tcp.socket = null;
      if (ctx.tcp.pendingReject) {
        const rej = ctx.tcp.pendingReject;
        ctx.tcp.pendingResolve = null;
        ctx.tcp.pendingReject = null;
        rej(new Error("TCP connection closed by Godot"));
      }
    });
  });
}

export async function sendTcpCommand(
  ctx: ServerContext,
  command: Record<string, unknown>,
  port = 9876,
): Promise<Record<string, unknown>> {
  const socket = await ensureTcpConnection(ctx, port);

  return new Promise((resolve, reject) => {
    ctx.tcp.pendingResolve = resolve;
    ctx.tcp.pendingReject = reject;

    const timeout = setTimeout(() => {
      if (ctx.tcp.pendingReject) {
        ctx.tcp.pendingResolve = null;
        ctx.tcp.pendingReject = null;
        reject(new Error("TCP command timed out"));
      }
    }, 5000);

    const origResolve = resolve;
    ctx.tcp.pendingResolve = (value) => {
      clearTimeout(timeout);
      origResolve(value);
    };
    const origReject = reject;
    ctx.tcp.pendingReject = (reason) => {
      clearTimeout(timeout);
      origReject(reason);
    };

    socket.write(JSON.stringify(command) + "\n");
  });
}

export function disconnectTcp(ctx: ServerContext): void {
  if (ctx.tcp.socket && !ctx.tcp.socket.destroyed) {
    ctx.tcp.socket.destroy();
  }
  ctx.tcp.socket = null;
  ctx.tcp.buffer = "";
  ctx.tcp.pendingResolve = null;
  ctx.tcp.pendingReject = null;
}

export function cleanupInteractive(ctx: ServerContext): void {
  disconnectTcp(ctx);

  if (!ctx.interactive.projectPath) return;

  try {
    if (ctx.interactive.originalProjectGodot) {
      const projectFile = join(ctx.interactive.projectPath, "project.godot");
      writeFileSync(projectFile, ctx.interactive.originalProjectGodot);
    }

    const scriptPath = join(
      ctx.interactive.projectPath,
      ".mcp_input_receiver.gd",
    );
    if (existsSync(scriptPath)) unlinkSync(scriptPath);
  } catch {
    /* ignore cleanup errors */
  }

  ctx.interactive.projectPath = null;
  ctx.interactive.originalProjectGodot = null;
}

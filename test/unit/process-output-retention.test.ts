import { describe, it, expect, beforeEach } from "vitest";
import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";
import { ServerContext } from "../../src/context.js";
import { snapshotExitedProcess } from "../../src/utils.js";
import { handleGetDebugOutput } from "../../src/handlers/process-handlers.js";

/**
 * These tests cover the regression where get_debug_output returned
 * "No active Godot process" the moment the spawned Godot died, even
 * though stdout/stderr had already been captured during the run. The
 * fix snapshots that captured output into ctx.lastExitedProcess so
 * the tool keeps working post-mortem.
 *
 * Pure unit tests — we fake the ChildProcess via EventEmitter rather
 * than spawning a real Godot, so this stays fast and CI-portable.
 */

function fakeProcess(): ChildProcess {
  // ChildProcess is an EventEmitter at runtime; the fields the helper
  // touches (`process`, identity comparison) work fine on a plain emitter.
  return new EventEmitter() as unknown as ChildProcess;
}

function makeContext(): ServerContext {
  return new ServerContext({ debugMode: false }, "/dev/null");
}

describe("snapshotExitedProcess", () => {
  let ctx: ServerContext;

  beforeEach(() => {
    ctx = makeContext();
  });

  it("moves output/errors from activeProcess into lastExitedProcess", () => {
    const proc = fakeProcess();
    ctx.activeProcess = {
      process: proc,
      output: ["hello", "world"],
      errors: ["oops"],
    };

    snapshotExitedProcess(ctx, proc, 1, "exit");

    expect(ctx.activeProcess).toBeNull();
    expect(ctx.lastExitedProcess).not.toBeNull();
    expect(ctx.lastExitedProcess!.output).toEqual(["hello", "world"]);
    expect(ctx.lastExitedProcess!.errors).toEqual(["oops"]);
    expect(ctx.lastExitedProcess!.exitCode).toBe(1);
    expect(ctx.lastExitedProcess!.reason).toBe("exit");
    expect(ctx.lastExitedProcess!.exitedAt).toBeGreaterThan(0);
  });

  it("does nothing when the proc doesn't match activeProcess (stale handler)", () => {
    const procA = fakeProcess();
    const procB = fakeProcess();
    ctx.activeProcess = { process: procA, output: ["a"], errors: [] };

    snapshotExitedProcess(ctx, procB, 0, "exit");

    expect(ctx.activeProcess).not.toBeNull();
    expect(ctx.activeProcess.process).toBe(procA);
    expect(ctx.lastExitedProcess).toBeNull();
  });

  it("does nothing when activeProcess is already null", () => {
    const proc = fakeProcess();
    snapshotExitedProcess(ctx, proc, 0, "exit");
    expect(ctx.lastExitedProcess).toBeNull();
  });

  it("records 'error' as the reason when called from the error handler", () => {
    const proc = fakeProcess();
    ctx.activeProcess = { process: proc, output: [], errors: ["spawn EACCES"] };

    snapshotExitedProcess(ctx, proc, null, "error");

    expect(ctx.lastExitedProcess!.reason).toBe("error");
    expect(ctx.lastExitedProcess!.exitCode).toBeNull();
  });
});

describe("handleGetDebugOutput post-exit fallback", () => {
  let ctx: ServerContext;

  beforeEach(() => {
    ctx = makeContext();
  });

  it("returns captured output from a live process", () => {
    ctx.activeProcess = {
      process: fakeProcess(),
      output: ["frame 1", "frame 2"],
      errors: [],
    };

    const res = handleGetDebugOutput(ctx, {});

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0]!.text) as {
      output: string[];
      exited?: boolean;
    };
    expect(payload.output).toEqual(["frame 1", "frame 2"]);
    expect(payload.exited).toBeUndefined();
  });

  it("falls back to the snapshot after the process exits", () => {
    // Simulate a full lifecycle: process runs, captures output, then dies.
    const proc = fakeProcess();
    ctx.activeProcess = {
      process: proc,
      output: ["SCRIPT ERROR: at line 42", "Game crashed"],
      errors: ["At: res://scenes/dungeon.gd:42"],
    };
    snapshotExitedProcess(ctx, proc, 1, "exit");

    const res = handleGetDebugOutput(ctx, {});

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0]!.text) as {
      output: string[];
      errors: string[];
      exited: boolean;
      exitCode: number;
      exitReason: string;
    };
    expect(payload.output).toEqual([
      "SCRIPT ERROR: at line 42",
      "Game crashed",
    ]);
    expect(payload.errors).toEqual(["At: res://scenes/dungeon.gd:42"]);
    expect(payload.exited).toBe(true);
    expect(payload.exitCode).toBe(1);
    expect(payload.exitReason).toBe("exit");
  });

  it("respects errorsOnly filter against the snapshot", () => {
    const proc = fakeProcess();
    ctx.activeProcess = {
      process: proc,
      output: [
        "Engine started",
        "SCRIPT ERROR: invalid call",
        "regular log line",
        "ERROR: wrong texture",
      ],
      errors: [],
    };
    snapshotExitedProcess(ctx, proc, 1, "exit");

    const res = handleGetDebugOutput(ctx, { errorsOnly: true });

    const payload = JSON.parse(res.content[0]!.text) as { output: string[] };
    expect(payload.output).toContain("SCRIPT ERROR: invalid call");
    expect(payload.output).toContain("ERROR: wrong texture");
    expect(payload.output).not.toContain("Engine started");
    expect(payload.output).not.toContain("regular log line");
  });

  it("respects tail filter against the snapshot", () => {
    const proc = fakeProcess();
    ctx.activeProcess = {
      process: proc,
      output: ["a", "b", "c", "d", "e"],
      errors: [],
    };
    snapshotExitedProcess(ctx, proc, 0, "exit");

    const res = handleGetDebugOutput(ctx, { tail: 2 });

    const payload = JSON.parse(res.content[0]!.text) as { output: string[] };
    expect(payload.output).toEqual(["d", "e"]);
  });

  it("errors only when nothing has ever run this session", () => {
    const res = handleGetDebugOutput(ctx, {});

    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("No active or recently exited");
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  handleRunProject,
  handleGetDebugOutput,
} from "../../src/handlers/process-handlers.js";
import { killProcess } from "../../src/utils.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

/**
 * End-to-end check that the exit-handler wiring works against a real
 * Godot process. Pairs with the unit tests in
 * test/unit/process-output-retention.test.ts which cover the
 * conditional logic without Godot.
 */
describe("Process output retention (integration)", () => {
  let ctx: ServerContext;

  beforeAll(async () => {
    ctx = await initContext();
  });

  afterAll(async () => {
    if (ctx.activeProcess) {
      await killProcess(ctx.activeProcess.process);
    }
  });

  /** Poll until activeProcess is null or the deadline passes. */
  async function waitForExit(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (ctx.activeProcess !== null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  it("get_debug_output returns captured output after the process dies", async () => {
    const startRes = await handleRunProject(ctx, {
      projectPath: FIXTURE_PATH,
    });
    assertSuccess(startRes);
    expect(ctx.activeProcess).not.toBeNull();

    // Give Godot a moment to emit its startup banner to stdout.
    await new Promise((r) => setTimeout(r, 2000));

    // Force-kill from outside — simulates a fast crash where the user
    // had no chance to call get_debug_output before the process died.
    expect(ctx.activeProcess).not.toBeNull();
    ctx.activeProcess!.process.kill("SIGKILL");
    await waitForExit(5000);

    expect(ctx.activeProcess).toBeNull();
    expect(ctx.lastExitedProcess).not.toBeNull();

    const debugRes = handleGetDebugOutput(ctx, {});
    const text = assertSuccess(debugRes);
    const payload = JSON.parse(text) as {
      output: string[];
      errors: string[];
      exited?: boolean;
      exitCode?: number | null;
      exitReason?: string;
    };

    // We should see the captured stdout — Godot prints at least its
    // version banner before any user code runs.
    expect(Array.isArray(payload.output)).toBe(true);
    expect(payload.output.length).toBeGreaterThan(0);
    expect(payload.exited).toBe(true);
    expect(payload.exitReason).toBe("exit");
  }, 30000);

  it("lastExitedProcess is cleared when a new run starts", async () => {
    // Seed lastExitedProcess from the previous test (or by running again).
    if (!ctx.lastExitedProcess) {
      const seedStart = await handleRunProject(ctx, {
        projectPath: FIXTURE_PATH,
      });
      assertSuccess(seedStart);
      await new Promise((r) => setTimeout(r, 500));
      ctx.activeProcess!.process.kill("SIGKILL");
      await waitForExit(5000);
    }
    expect(ctx.lastExitedProcess).not.toBeNull();

    // A fresh run should drop the stale snapshot before populating
    // a new activeProcess — otherwise stale output could mix with live.
    const startRes = await handleRunProject(ctx, {
      projectPath: FIXTURE_PATH,
    });
    assertSuccess(startRes);
    expect(ctx.lastExitedProcess).toBeNull();
    expect(ctx.activeProcess).not.toBeNull();

    // Cleanup for afterAll.
    await killProcess(ctx.activeProcess!.process);
    await waitForExit(5000);
  }, 30000);
});

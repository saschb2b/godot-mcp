import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  handleReadScript,
  handleWriteScript,
} from "../../src/handlers/script-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, assertError, TestCleanup } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Script handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();

  beforeAll(async () => {
    ctx = await initContext();
  });

  afterEach(() => {
    cleanup.run();
  });

  it("reads an existing script", async () => {
    const res = await handleReadScript(ctx, {
      projectPath: FIXTURE_PATH,
      scriptPath: "scripts/main.gd",
    });
    const text = assertSuccess(res);
    expect(text).toContain("extends Node2D");
  });

  it("errors on nonexistent script", async () => {
    const res = await handleReadScript(ctx, {
      projectPath: FIXTURE_PATH,
      scriptPath: "scripts/nope.gd",
    });
    assertError(res);
  });

  it("writes a new script", () => {
    cleanup.track("scripts/test_new.gd");
    const content = 'extends Node\n\nfunc _ready():\n\tprint("hi")\n';
    const res = handleWriteScript(ctx, {
      projectPath: FIXTURE_PATH,
      scriptPath: "scripts/test_new.gd",
      content,
    });
    assertSuccess(res);
    expect(existsSync(join(FIXTURE_PATH, "scripts/test_new.gd"))).toBe(true);
    expect(readFileSync(join(FIXTURE_PATH, "scripts/test_new.gd"), "utf-8")).toBe(content);
  });

  it("creates directories when writing", () => {
    cleanup.track("scripts/sub");
    const res = handleWriteScript(ctx, {
      projectPath: FIXTURE_PATH,
      scriptPath: "scripts/sub/deep.gd",
      content: "extends Node\n",
    });
    assertSuccess(res);
    expect(existsSync(join(FIXTURE_PATH, "scripts/sub/deep.gd"))).toBe(true);
  });
});

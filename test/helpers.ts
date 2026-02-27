import { existsSync, unlinkSync, rmSync, copyFileSync } from "fs";
import { join } from "path";
import type { ToolResponse } from "../src/types.js";
import { FIXTURE_PATH } from "./setup.js";

/**
 * Assert that a handler response indicates success. Returns the text content.
 */
export function assertSuccess(response: ToolResponse): string {
  if (response.isError) {
    const text = response.content.map((c) => c.text).join("\n");
    throw new Error(`Expected success but got error:\n${text}`);
  }
  return response.content[0]!.text;
}

/**
 * Assert that a handler response indicates an error. Returns the error text.
 */
export function assertError(response: ToolResponse): string {
  if (!response.isError) {
    throw new Error(
      `Expected error but got success:\n${response.content[0]?.text}`,
    );
  }
  return response.content[0]!.text;
}

/**
 * Tracks files/dirs created during tests for automatic cleanup.
 */
export class TestCleanup {
  private files: string[] = [];

  /** Register a file (relative to fixture) for cleanup. Returns absolute path. */
  track(relativePath: string): string {
    const absolute = join(FIXTURE_PATH, relativePath);
    this.files.push(absolute);
    return absolute;
  }

  /** Remove all tracked files/dirs. */
  run(): void {
    for (const f of this.files) {
      try {
        if (existsSync(f)) rmSync(f, { recursive: true });
      } catch {
        /* best-effort */
      }
    }
    this.files = [];
  }
}

/**
 * Copy a fixture file to a temp name for mutation tests.
 * Returns the relative path of the copy (for use as scenePath, etc.).
 */
export function copyFixture(
  src: string,
  dest: string,
  cleanup: TestCleanup,
): string {
  copyFileSync(join(FIXTURE_PATH, src), join(FIXTURE_PATH, dest));
  cleanup.track(dest);
  return dest;
}

/**
 * Check if a display server is available.
 */
export function hasDisplay(): boolean {
  if (process.platform === "win32" || process.platform === "darwin") {
    return true;
  }
  return !!process.env.DISPLAY || !!process.env.WAYLAND_DISPLAY;
}

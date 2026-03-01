import { describe, it, expect } from "vitest";
import { forceWindowedMode } from "../../src/handlers/interactive-handlers.js";

describe("forceWindowedMode", () => {
  it("replaces fullscreen mode=3 with windowed mode=0", () => {
    const input = `[display]

display/window/size/viewport_width=1280
display/window/size/viewport_height=720
display/window/size/mode=3
`;
    const result = forceWindowedMode(input);
    expect(result).toContain("display/window/size/mode=0");
    expect(result).not.toContain("mode=3");
  });

  it("replaces exclusive fullscreen mode=4 with windowed mode=0", () => {
    const input = `display/window/size/mode=4`;
    const result = forceWindowedMode(input);
    expect(result).toContain("display/window/size/mode=0");
    expect(result).not.toContain("mode=4");
  });

  it("leaves windowed mode=0 unchanged", () => {
    const input = `display/window/size/mode=0`;
    const result = forceWindowedMode(input);
    expect(result).toBe(input);
  });

  it("leaves maximized mode=2 unchanged", () => {
    const input = `display/window/size/mode=2`;
    const result = forceWindowedMode(input);
    expect(result).toBe(input);
  });

  it("returns content unchanged when no mode setting exists", () => {
    const input = `[application]

config/name="MyGame"
`;
    const result = forceWindowedMode(input);
    expect(result).toBe(input);
  });
});

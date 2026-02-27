import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  handleCreateResource,
  handleInstantiateScene,
} from "../../src/handlers/resource-handlers.js";
import { initContext, FIXTURE_PATH } from "../setup.js";
import { assertSuccess, TestCleanup, copyFixture } from "../helpers.js";
import type { ServerContext } from "../../src/context.js";

describe("Resource handlers", () => {
  let ctx: ServerContext;
  const cleanup = new TestCleanup();

  beforeAll(async () => {
    ctx = await initContext();
  });

  afterEach(() => {
    cleanup.run();
  });

  it("creates a resource", async () => {
    cleanup.track("test_resource.tres");
    const res = await handleCreateResource(ctx, {
      projectPath: FIXTURE_PATH,
      resourcePath: "test_resource.tres",
      resourceType: "Resource",
    });
    assertSuccess(res);
    expect(existsSync(join(FIXTURE_PATH, "test_resource.tres"))).toBe(true);
  });

  it("instantiates a scene into another", async () => {
    const tempScene = copyFixture(
      "scenes/with_nodes.tscn",
      "scenes/test_instance.tscn",
      cleanup,
    );
    const res = await handleInstantiateScene(ctx, {
      projectPath: FIXTURE_PATH,
      scenePath: tempScene,
      childScenePath: "scenes/main.tscn",
      nodeName: "SubScene",
    });
    assertSuccess(res);
  });
});

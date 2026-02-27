import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import { normalizeParameters, validatePath, createErrorResponse, logDebug } from "../utils.js";
import { ensureGodotPath } from "../godot-path.js";
import { join, dirname } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function handleCaptureScreenshot(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse("Project path is required", [
      "Provide a valid path to a Godot project directory",
    ]);
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid project path", [
      'Provide a valid path without ".." or other potentially unsafe characters',
    ]);
  }

  try {
    const projectFile = join(args.projectPath, "project.godot");
    if (!existsSync(projectFile)) {
      return createErrorResponse(
        `Not a valid Godot project: ${args.projectPath}`,
        [
          "Ensure the path points to a directory containing a project.godot file",
          "Use list_projects to find valid Godot projects",
        ],
      );
    }

    const godotPath = await ensureGodotPath(ctx);
    if (!godotPath) {
      return createErrorResponse(
        "Could not find a valid Godot executable path",
        [
          "Ensure Godot is installed correctly",
          "Set GODOT_PATH environment variable",
        ],
      );
    }

    // Determine scene path
    let scenePath = args.scenePath as string | undefined;
    if (!scenePath) {
      // Read main scene from project.godot
      const projectContent = readFileSync(projectFile, "utf-8");
      const mainSceneMatch = /run\/main_scene\s*=\s*"([^"]+)"/.exec(
        projectContent,
      );
      if (mainSceneMatch?.[1]) {
        scenePath = mainSceneMatch[1];
      } else {
        return createErrorResponse(
          "No scene specified and no main scene configured in project",
          [
            "Provide a scenePath parameter",
            "Or configure a main scene in project.godot",
          ],
        );
      }
    } else {
      // Convert relative path to res:// if needed
      if (!scenePath.startsWith("res://")) {
        scenePath = "res://" + scenePath;
      }
    }

    // Validate scene file exists on disk
    const sceneRelative = scenePath.replace(/^res:\/\//, "");
    const sceneAbsolute = join(args.projectPath, sceneRelative);
    if (!existsSync(sceneAbsolute)) {
      return createErrorResponse(
        `Scene file does not exist: ${scenePath}`,
        [
          "Ensure the scene path is correct",
          "Use create_scene to create a new scene first",
        ],
      );
    }

    // Determine output path
    let outputPath =
      (args.outputPath as string | undefined) ??
      join(args.projectPath, "screenshots", "capture.png");

    // If just a filename, put it in the screenshots directory
    if (!outputPath.includes("/") && !outputPath.includes("\\")) {
      outputPath = join(args.projectPath, "screenshots", outputPath);
    }

    // Ensure .png extension
    if (!outputPath.toLowerCase().endsWith(".png")) {
      outputPath += ".png";
    }

    // Validate resolution override (both or neither)
    if ((args.width && !args.height) || (!args.width && args.height)) {
      return createErrorResponse(
        "Both width and height must be specified together for resolution override",
        [
          "Provide both width and height, or omit both to use project defaults",
        ],
      );
    }

    // Build params JSON for the capture script
    const captureParams: Record<string, unknown> = {
      scene_path: scenePath,
      output_path: outputPath,
      wait_frames: (args.waitFrames as number | undefined) ?? 3,
    };

    if (args.width && args.height) {
      captureParams.width = args.width;
      captureParams.height = args.height;
    }

    const captureScriptPath = join(
      __dirname,
      "..",
      "scripts",
      "capture_screenshot.gd",
    );

    // Build Godot args WITHOUT --headless (rendering required)
    const godotArgs = [
      "--path",
      args.projectPath as string,
      "--script",
      captureScriptPath,
      JSON.stringify(captureParams),
    ];

    logDebug(
      ctx.debugMode,
      `Capturing screenshot: ${godotPath} ${godotArgs.join(" ")}`,
    );

    const { stdout, stderr } = await execFileAsync(
      godotPath,
      godotArgs,
      { timeout: 30000 },
    );

    // Check for errors
    if (stderr.includes("[ERROR]")) {
      return createErrorResponse(
        `Screenshot capture failed: ${stderr}`,
        [
          "Check if the scene file is valid",
          "Ensure a display server is available (not a headless environment)",
          "Try increasing waitFrames for complex scenes",
        ],
      );
    }

    // Verify the output file was created
    if (!existsSync(outputPath)) {
      return createErrorResponse(
        "Screenshot file was not created. The capture process may have failed silently.",
        [
          "Check if you have write permissions to the output directory",
          "Try specifying an explicit outputPath",
          "Ensure a display server is available",
        ],
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Screenshot captured successfully.\nScene: ${scenePath}\nSaved to: ${outputPath}\n\n${stdout}`,
        },
      ],
    };
  } catch (error: unknown) {
    const execError = error as Error & {
      killed?: boolean;
      signal?: string;
      stderr?: string;
    };

    // Check for timeout
    if (execError.killed || execError.signal === "SIGTERM") {
      return createErrorResponse(
        "Screenshot capture timed out (30s). The scene may be too complex or Godot may have hung.",
        [
          "Try a simpler scene",
          "Check if Godot is functioning correctly",
          "Ensure a display server is available",
        ],
      );
    }

    // Check stderr from the failed process
    if (execError.stderr?.includes("[ERROR]")) {
      return createErrorResponse(
        `Screenshot capture failed: ${execError.stderr}`,
        [
          "Check if the scene file is valid",
          "Ensure a display server is available",
        ],
      );
    }

    return createErrorResponse(
      `Failed to capture screenshot: ${execError.message}`,
      [
        "Ensure Godot is installed correctly",
        "Ensure a display server is available (not a headless/CI environment)",
        "Check if the GODOT_PATH environment variable is set correctly",
      ],
    );
  }
}

export async function handleRunAndCapture(ctx: ServerContext, args: any): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse(
      "Missing required parameter: projectPath",
      ["Provide the path to the Godot project directory"],
    );
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid project path", [
      'Provide a valid path without ".."',
    ]);
  }

  const projectFile = join(args.projectPath, "project.godot");
  if (!existsSync(projectFile)) {
    return createErrorResponse(
      `Not a valid Godot project: ${args.projectPath}`,
      ["Ensure the path contains a project.godot file"],
    );
  }

  const duration = typeof args.duration === "number" ? args.duration : 3;
  const outputPath =
    args.outputPath ?? join(args.projectPath, "screenshots", "capture.png");

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Copy the capture script into the project
  const scriptFilename = ".mcp_run_and_capture.gd";
  const scriptDest = join(args.projectPath, scriptFilename);
  const captureScriptSrc = join(
    __dirname,
    "..",
    "scripts",
    "run_and_capture.gd",
  );
  copyFileSync(captureScriptSrc, scriptDest);

  // Write config file for the capture script to read
  const configPath = join(args.projectPath, ".mcp_capture_config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      output_path: outputPath,
      duration: duration,
    }),
  );

  // Read project.godot and inject autoload
  const projectContent = readFileSync(projectFile, "utf-8");
  let modifiedContent: string;

  if (projectContent.includes("[autoload]")) {
    modifiedContent = projectContent.replace(
      "[autoload]",
      `[autoload]\n\n_McpCapture="*res://${scriptFilename}"`,
    );
  } else {
    modifiedContent =
      projectContent +
      `\n[autoload]\n\n_McpCapture="*res://${scriptFilename}"\n`;
  }
  writeFileSync(projectFile, modifiedContent);

  const godotPath = await ensureGodotPath(ctx);
  if (!godotPath) {
    // Restore project.godot before returning error
    writeFileSync(projectFile, projectContent);
    return createErrorResponse(
      "Could not find a valid Godot executable path",
      [
        "Ensure Godot is installed correctly",
        "Set GODOT_PATH environment variable",
      ],
    );
  }

  try {
    // Run the project (NOT headless -- needs rendering)
    const timeout = (Number(duration) + 15) * 1000; // duration + 15s buffer
    const { stdout, stderr } = await execFileAsync(
      godotPath,
      ["--path", args.projectPath],
      { timeout },
    );

    // Check for capture success
    if (stdout.includes("[INFO] Screenshot saved:")) {
      return {
        content: [
          {
            type: "text",
            text: `Screenshot captured after ${duration}s of gameplay.\nSaved to: ${outputPath}\n\n${stdout}`,
          },
        ],
      };
    }

    if (stderr.includes("[ERROR]")) {
      return createErrorResponse(`run_and_capture failed: ${stderr}`, [
        "Check if the project runs without errors",
        "Ensure a display server is available",
      ]);
    }

    return {
      content: [
        {
          type: "text",
          text: `Project ran for ${duration}s.\nOutput: ${stdout}\nErrors: ${stderr}`,
        },
      ],
    };
  } catch (error: unknown) {
    const execError = error as Error & {
      killed?: boolean;
      signal?: string;
      stderr?: string;
      stdout?: string;
    };

    // Timeout is expected if the capture somehow didn't trigger quit
    if (execError.killed || execError.signal === "SIGTERM") {
      // Check if screenshot was saved before timeout
      if (existsSync(outputPath)) {
        return {
          content: [
            {
              type: "text",
              text: `Screenshot captured (process timed out but file exists).\nSaved to: ${outputPath}`,
            },
          ],
        };
      }
      return createErrorResponse(
        "run_and_capture timed out without capturing a screenshot.",
        [
          "Try increasing the duration",
          "Check if the project runs correctly",
        ],
      );
    }

    // execFile may throw but still have stdout with success info
    if (execError.stdout?.includes("[INFO] Screenshot saved:")) {
      return {
        content: [
          {
            type: "text",
            text: `Screenshot captured after ${duration}s of gameplay.\nSaved to: ${outputPath}\n\n${execError.stdout}`,
          },
        ],
      };
    }

    return createErrorResponse(
      `run_and_capture failed: ${execError.message}`,
      [
        "Ensure Godot is installed correctly",
        "Ensure a display server is available",
      ],
    );
  } finally {
    // Clean up: restore project.godot, remove temp files
    writeFileSync(projectFile, projectContent);

    try {
      if (existsSync(scriptDest)) unlinkSync(scriptDest);
    } catch {
      /* ignore cleanup errors */
    }

    try {
      if (existsSync(configPath)) unlinkSync(configPath);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

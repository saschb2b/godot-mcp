# Contributing to Godot MCP

Thank you for considering contributing to Godot MCP! This document outlines the process for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in the Issues section
- Include detailed steps to reproduce the bug
- Include any relevant logs or screenshots
- Specify your environment (OS, Godot version, Node.js version)

### Suggesting Enhancements

- Check if the enhancement has already been suggested in the Issues section
- Clearly describe the enhancement and its benefits
- Consider how the enhancement fits into the project's scope

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bugfix (`git checkout -b feature/amazing-feature`)
3. Make your changes following the [tool checklist](#adding-new-tools)
4. Run the full CI validation: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm build && pnpm test`
5. Commit your changes with clear commit messages
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Process

### Setting Up the Development Environment

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build: `pnpm build`
4. Run tests: `pnpm test` (requires Godot installed — set `GODOT_PATH` if not in a standard location)
5. For development with auto-rebuild: `pnpm watch`

### Key Commands

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `pnpm build`        | TypeScript compile + copy GDScript files to build/ |
| `pnpm test`         | Run all vitest tests (requires Godot installed)    |
| `pnpm lint`         | ESLint with strict TypeScript checking             |
| `pnpm format:check` | Prettier formatting check                          |
| `pnpm typecheck`    | `tsc --noEmit`                                     |

### Project Structure

```
godot-mcp/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── context.ts            # ServerContext class (runtime state)
│   ├── tool-definitions.ts   # MCP tool schemas (JSON)
│   ├── tool-router.ts        # Maps tool names → handler functions
│   ├── godot-executor.ts     # Spawns headless Godot (execFileAsync)
│   ├── godot-path.ts         # Godot binary path resolution
│   ├── tcp-client.ts         # TCP connection to interactive sessions
│   ├── types.ts              # Shared TypeScript types
│   ├── utils.ts              # normalizeParameters, validatePath, etc.
│   ├── handlers/             # One file per domain
│   │   ├── analysis-handlers.ts
│   │   ├── animation-handlers.ts
│   │   ├── interactive-handlers.ts
│   │   ├── node-handlers.ts
│   │   ├── process-handlers.ts
│   │   ├── project-handlers.ts
│   │   ├── resource-handlers.ts
│   │   ├── scene-handlers.ts
│   │   ├── screenshot-handlers.ts
│   │   ├── script-handlers.ts
│   │   ├── settings-handlers.ts
│   │   ├── signal-group-handlers.ts
│   │   ├── test-handlers.ts
│   │   ├── tilemap-handlers.ts
│   │   └── uid-handlers.ts
│   └── scripts/              # GDScript files copied to build/
│       ├── godot_operations.gd    # Headless operations (scene/node/resource manipulation)
│       ├── input_receiver.gd      # TCP server injected into running games
│       ├── capture_screenshot.gd  # Screenshot capture script
│       └── run_and_capture.gd     # Run + capture script
├── test/
│   ├── setup.ts              # Creates ServerContext for tests
│   ├── helpers.ts            # assertSuccess(), assertError(), TestCleanup
│   ├── unit/                 # Pure function tests
│   ├── integration/          # Handler tests against real Godot
│   ├── display/              # Screenshot tests (auto-skip without display)
│   └── fixture/              # Minimal Godot 4.x project for tests
├── build/                    # Compiled output (generated)
├── CLAUDE.md                 # Instructions for Claude Code
├── TODO.md                   # Planned features and progress
└── vitest.config.ts          # Test runner config
```

### Architecture

There are two types of tools:

**Headless tools** — spawn a Godot process that runs a GDScript, performs an operation, outputs the result, and exits. These use `executeOperation()` in `godot-executor.ts` which invokes `godot_operations.gd`.

**Interactive tools** — send JSON commands over TCP to a running Godot game that has `input_receiver.gd` injected as a temporary autoload. These use `sendTcpCommand()` in `tcp-client.ts`.

All handlers share the same signature: `async (ctx: ServerContext, args: any) => ToolResponse`.

### Adding New Tools

Every new tool must be reflected in **all** of these:

1. **GDScript** — Add the operation in the appropriate `.gd` file:
   - Headless operations: `src/scripts/godot_operations.gd`
   - TCP commands: `src/scripts/input_receiver.gd`
   - Or invoke an external script via `executeGodotArgs()` (e.g., GUT runner)
2. **Handler** — Add or create a handler function in `src/handlers/*.ts`
3. **Tool definition** — Add the JSON schema in `src/tool-definitions.ts`
4. **Router** — Wire the handler in `src/tool-router.ts`
5. **Tests** — Add at least parameter validation tests in `test/integration/`
6. **README.md** — Update the tool count and the relevant tool table
7. **TODO.md** — Check off the item if it was planned

#### Handler Pattern

```typescript
import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  normalizeParameters,
  validatePath,
  createErrorResponse,
} from "../utils.js";
import { executeOperation } from "../godot-executor.js";
import { join } from "path";
import { existsSync } from "fs";

export async function handleYourTool(
  ctx: ServerContext,
  args: any,
): Promise<ToolResponse> {
  args = normalizeParameters(args);

  if (!args.projectPath) {
    return createErrorResponse("Missing required parameter: projectPath", [
      "Provide the path to a Godot project directory",
    ]);
  }

  if (!validatePath(args.projectPath)) {
    return createErrorResponse("Invalid path", [
      'Provide a valid path without ".." or other potentially unsafe characters',
    ]);
  }

  const projectFile = join(args.projectPath, "project.godot");
  if (!existsSync(projectFile)) {
    return createErrorResponse(
      `Not a valid Godot project: ${args.projectPath}`,
      ["Ensure the path points to a directory containing a project.godot file"],
    );
  }

  try {
    const { stdout, stderr } = await executeOperation(
      ctx,
      "your_operation",
      { scenePath: args.scenePath },
      args.projectPath,
    );

    return { content: [{ type: "text", text: stdout }] };
  } catch (error: any) {
    return createErrorResponse(`Failed: ${error?.message ?? "Unknown error"}`, [
      "Ensure Godot is installed correctly",
    ]);
  }
}
```

### Conventions

- Use `pnpm` (not `npm` or `yarn`)
- Use `execFileAsync` (not `execAsync`) for Godot — avoids shell, fixes Windows JSON parsing
- Always `normalizeParameters(args)` at handler entry to support both camelCase and snake_case
- Always `validatePath()` on user-provided paths before filesystem access
- Error responses use `createErrorResponse()` with helpful `possibleSolutions`
- Use `killProcess()` (awaits exit) instead of bare `.kill()` for process cleanup

### Cross-Platform Compatibility

- Use `path.join()` instead of hardcoded path separators
- Use `execFileAsync` with args as array (no shell interpolation)
- Test on different operating systems if possible
- Consider different Godot installation locations (`GODOT_PATH` env var)

### Debugging

1. Set the `DEBUG` environment variable to `true`
2. Use the MCP Inspector: `pnpm inspector`
3. Check stderr output for `[SERVER]` prefixed log messages

## Testing

- Integration tests call handlers directly against a real Godot engine + a bundled fixture project at `test/fixture/`
- No mocking — full stack verification (handler -> Godot executor -> GDScript -> filesystem)
- Tests run sequentially — Godot can't handle parallel headless instances on the same project
- Display-dependent tests auto-skip when no display server is available
- Always run `pnpm test` before submitting a PR

## CI Pipeline

GitHub Actions runs on every push:

1. **Lint** — `pnpm lint`
2. **Format** — `pnpm format:check`
3. **Typecheck** — `pnpm typecheck`
4. **Test** — Installs Godot via `chickensoft-games/setup-godot`, then `xvfb-run pnpm test`

All four must pass for a PR to merge.

## Questions?

If you have any questions about contributing, feel free to open an issue for discussion.

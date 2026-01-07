#!/usr/bin/env bun
/**
 * Ralph Wiggum Loop for OpenCode
 *
 * Implementation of the Ralph Wiggum technique - continuous self-referential
 * AI loops for iterative development. Based on ghuntley.com/ralph/
 */

import { $ } from "bun";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const VERSION = "1.0.0";

// Parse arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Ralph Wiggum Loop - Iterative AI development with OpenCode

Usage:
  ralph "<prompt>" [options]

Arguments:
  prompt              Task description for the AI to work on

Options:
  --max-iterations N  Maximum iterations before stopping (default: unlimited)
  --completion-promise TEXT  Phrase that signals completion (default: COMPLETE)
  --model MODEL       Model to use (e.g., anthropic/claude-sonnet)
  --no-plugins        Disable non-auth OpenCode plugins for this run
  --no-commit         Don't auto-commit after each iteration
  --version, -v       Show version
  --help, -h          Show this help

Examples:
  ralph "Build a REST API for todos"
  ralph "Fix the auth bug" --max-iterations 10
  ralph "Add tests" --completion-promise "ALL TESTS PASS" --model openai/gpt-5.1

How it works:
  1. Sends your prompt to OpenCode
  2. AI works on the task
  3. Checks output for completion promise
  4. If not complete, repeats with same prompt
  5. AI sees its previous work in files
  6. Continues until promise detected or max iterations

To stop manually: Ctrl+C or run /cancel-ralph in OpenCode

Learn more: https://ghuntley.com/ralph/
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(`ralph ${VERSION}`);
  process.exit(0);
}

// Parse options
let prompt = "";
let maxIterations = 0; // 0 = unlimited
let completionPromise = "COMPLETE";
let model = "";
let autoCommit = true;
let disablePlugins = false;

const promptParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === "--max-iterations") {
    const val = args[++i];
    if (!val || isNaN(parseInt(val))) {
      console.error("Error: --max-iterations requires a number");
      process.exit(1);
    }
    maxIterations = parseInt(val);
  } else if (arg === "--completion-promise") {
    const val = args[++i];
    if (!val) {
      console.error("Error: --completion-promise requires a value");
      process.exit(1);
    }
    completionPromise = val;
  } else if (arg === "--model") {
    const val = args[++i];
    if (!val) {
      console.error("Error: --model requires a value");
      process.exit(1);
    }
    model = val;
  } else if (arg === "--no-commit") {
    autoCommit = false;
  } else if (arg === "--no-plugins") {
    disablePlugins = true;
  } else if (arg.startsWith("-")) {
    console.error(`Error: Unknown option: ${arg}`);
    console.error("Run 'ralph --help' for available options");
    process.exit(1);
  } else {
    promptParts.push(arg);
  }
}

prompt = promptParts.join(" ");

if (!prompt) {
  console.error("Error: No prompt provided");
  console.error("Usage: ralph \"Your task description\" [options]");
  console.error("Run 'ralph --help' for more information");
  process.exit(1);
}

// State file path
const stateDir = join(process.cwd(), ".opencode");
const statePath = join(stateDir, "ralph-loop.state.json");

interface RalphState {
  active: boolean;
  iteration: number;
  maxIterations: number;
  completionPromise: string;
  prompt: string;
  startedAt: string;
  model: string;
}

// Create or update state
function saveState(state: RalphState): void {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function loadState(): RalphState | null {
  if (!existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return null;
  }
}

function clearState(): void {
  if (existsSync(statePath)) {
    try {
      require("fs").unlinkSync(statePath);
    } catch {}
  }
}

function loadPluginsFromConfig(configPath: string): string[] {
  if (!existsSync(configPath)) {
    return [];
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    // Basic JSONC support: strip // and /* */ comments.
    const withoutBlock = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutLine = withoutBlock.replace(/^\s*\/\/.*$/gm, "");
    const parsed = JSON.parse(withoutLine);
    const plugins = parsed?.plugin;
    return Array.isArray(plugins) ? plugins.filter(p => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function ensureFilteredPluginsConfig(): string {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  const configPath = join(stateDir, "ralph-opencode.no-plugins.json");
  const userConfigPath = join(process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? "", ".config"), "opencode", "opencode.json");
  const projectConfigPath = join(process.cwd(), ".opencode", "opencode.json");
  const plugins = [
    ...loadPluginsFromConfig(userConfigPath),
    ...loadPluginsFromConfig(projectConfigPath),
  ];
  const filtered = Array.from(new Set(plugins)).filter(p => p !== "ralph-wiggum");
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        plugin: filtered,
      },
      null,
      2,
    ),
  );
  return configPath;
}

// Build the full prompt with iteration context
function buildPrompt(state: RalphState): string {
  return `
# Ralph Wiggum Loop - Iteration ${state.iteration}

You are in an iterative development loop. Work on the task below until you can genuinely complete it.

## Your Task

${state.prompt}

## Instructions

1. Read the current state of files to understand what's been done
2. Make progress on the task
3. Run tests/verification if applicable
4. When the task is GENUINELY COMPLETE, output:
   <promise>${state.completionPromise}</promise>

## Critical Rules

- ONLY output <promise>${state.completionPromise}</promise> when the task is truly done
- Do NOT lie or output false promises to exit the loop
- If stuck, try a different approach
- Check your work before claiming completion
- The loop will continue until you succeed

## Current Iteration: ${state.iteration}${state.maxIterations > 0 ? ` / ${state.maxIterations}` : " (unlimited)"}

Now, work on the task. Good luck!
`.trim();
}

// Check if output contains the completion promise
function checkCompletion(output: string, promise: string): boolean {
  const promisePattern = new RegExp(`<promise>\\s*${escapeRegex(promise)}\\s*</promise>`, "i");
  return promisePattern.test(output);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectPlaceholderPluginError(output: string): boolean {
  return output.includes("ralph-wiggum is not yet ready for use. This is a placeholder package.");
}

// Main loop
async function runRalphLoop(): Promise<void> {
  // Check if a loop is already running
  const existingState = loadState();
  if (existingState?.active) {
    console.error(`Error: A Ralph loop is already active (iteration ${existingState.iteration})`);
    console.error(`Started at: ${existingState.startedAt}`);
    console.error(`To cancel it, press Ctrl+C in its terminal or delete ${statePath}`);
    process.exit(1);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    Ralph Wiggum Loop                            ║
║            Iterative AI Development with OpenCode                ║
╚══════════════════════════════════════════════════════════════════╝
`);

  // Initialize state
  const state: RalphState = {
    active: true,
    iteration: 1,
    maxIterations,
    completionPromise,
    prompt,
    startedAt: new Date().toISOString(),
    model,
  };

  saveState(state);

  console.log(`Task: ${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}`);
  console.log(`Completion promise: ${completionPromise}`);
  console.log(`Max iterations: ${maxIterations > 0 ? maxIterations : "unlimited"}`);
  if (model) console.log(`Model: ${model}`);
  if (disablePlugins) console.log("OpenCode plugins: non-auth plugins disabled");
  console.log("");
  console.log("Starting loop... (Ctrl+C to stop)");
  console.log("═".repeat(68));

  // Track current subprocess for cleanup on SIGINT
  let currentProc: ReturnType<typeof Bun.spawn> | null = null;

  // Set up signal handler for graceful shutdown
  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) {
      console.log("\nForce stopping...");
      process.exit(1);
    }
    stopping = true;
    console.log("\nGracefully stopping Ralph loop...");

    // Kill the subprocess if it's running
    if (currentProc) {
      try {
        currentProc.kill();
      } catch {
        // Process may have already exited
      }
    }

    clearState();
    console.log("Loop cancelled.");
    process.exit(0);
  });

  // Main loop
  while (true) {
    // Check max iterations
    if (maxIterations > 0 && state.iteration > maxIterations) {
      console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
      console.log(`║  Max iterations (${maxIterations}) reached. Loop stopped.`);
      console.log(`╚══════════════════════════════════════════════════════════════════╝`);
      clearState();
      break;
    }

    console.log(`\n🔄 Iteration ${state.iteration}${maxIterations > 0 ? ` / ${maxIterations}` : ""}`);
    console.log("─".repeat(68));

    // Build the prompt
    const fullPrompt = buildPrompt(state);

    try {
      // Build command arguments
      const cmdArgs = ["run"];
      if (model) {
        cmdArgs.push("-m", model);
      }
      cmdArgs.push(fullPrompt);

      const env = { ...process.env };
      if (disablePlugins) {
        env.OPENCODE_CONFIG = ensureFilteredPluginsConfig();
      }

      // Run opencode using spawn for better argument handling
      currentProc = Bun.spawn(["opencode", ...cmdArgs], {
        env,
        stdout: "pipe",
        stderr: "pipe",
      });
      const proc = currentProc;

      const stdoutPromise = new Response(proc.stdout).text();
      const stderrPromise = new Response(proc.stderr).text();
      const [result, stderr, exitCode] = await Promise.all([
        stdoutPromise,
        stderrPromise,
        proc.exited,
      ]);
      currentProc = null; // Clear reference after subprocess completes

      if (stderr) {
        console.error(stderr);
      }

      console.log(result);

      if (detectPlaceholderPluginError(stderr) || detectPlaceholderPluginError(result)) {
        console.error(
          "\n❌ OpenCode tried to load the npm plugin 'ralph-wiggum', which is a placeholder package.",
        );
        console.error(
          "Remove 'ralph-wiggum' from your opencode.json plugin list, or re-run with --no-plugins.",
        );
        clearState();
        process.exit(1);
      }

      if (exitCode !== 0) {
        console.error(`\n❌ OpenCode exited with code ${exitCode}. Stopping the loop.`);
        clearState();
        process.exit(exitCode);
      }

      // Check for completion
      if (checkCompletion(result, completionPromise)) {
        console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
        console.log(`║  ✅ Completion promise detected: <promise>${completionPromise}</promise>`);
        console.log(`║  Task completed in ${state.iteration} iteration(s)`);
        console.log(`╚══════════════════════════════════════════════════════════════════╝`);
        clearState();
        break;
      }

      // Auto-commit if enabled
      if (autoCommit) {
        try {
          // Check if there are changes to commit
          const status = await $`git status --porcelain`.text();
          if (status.trim()) {
            await $`git add -A`;
            await $`git commit -m "Ralph iteration ${state.iteration}: work in progress"`.quiet();
            console.log(`📝 Auto-committed changes`);
          }
        } catch {
          // Git commit failed, that's okay
        }
      }

      // Update state for next iteration
      state.iteration++;
      saveState(state);

      // Small delay between iterations
      await new Promise(r => setTimeout(r, 1000));

    } catch (error) {
      console.error(`\n❌ Error in iteration ${state.iteration}:`, error);
      console.log("Continuing to next iteration...");
      state.iteration++;
      saveState(state);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Run the loop
runRalphLoop().catch(error => {
  console.error("Fatal error:", error);
  clearState();
  process.exit(1);
});

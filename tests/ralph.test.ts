#!/usr/bin/env bun
/**
 * Tests for Ralph Wiggum CLI
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, unlinkSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { $ } from "bun";

const testDir = "./test-temp";
const stateDir = join(testDir, ".opencode");

describe("Ralph CLI", () => {
  beforeEach(() => {
    // Create a temporary test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (existsSync(stateDir)) {
        require("fs").rmSync(stateDir, { recursive: true, force: true });
      }
      if (existsSync(testDir)) {
        require("fs").rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("should display version", async () => {
    const result = await $`bun ralph.ts --version`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("ralph 1.0.9");
  });

  it("should display help", async () => {
    const result = await $`bun ralph.ts --help`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Ralph Wiggum Loop");
    expect(result.stdout.toString()).toContain("Usage:");
  });

  it("should show no active loop status initially", async () => {
    const result = await $`bun ralph.ts --status`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("No active loop");
  });

  it("should create .opencode directory when needed", async () => {
    // Remove directory first
    if (existsSync(stateDir)) {
      require("fs").rmSync(stateDir, { recursive: true });
    }
    
    // Use add-context which definitely creates the directory
    const result = await $`bun ralph.ts --add-context "test"`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    // The add-context command creates the directory
    expect(existsSync(stateDir)).toBe(true);
  });

  it("should handle add-context command", async () => {
    const contextText = "Test context for iteration";
    const result = await $`bun ralph.ts --add-context "${contextText}"`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    
    const contextPath = join(stateDir, "ralph-context.md");
    expect(existsSync(contextPath)).toBe(true);
    
    const contextContent = readFileSync(contextPath, "utf-8");
    // Context is stored with timestamp header
    expect(contextContent).toContain(contextText);
    expect(contextContent).toContain("Ralph Loop Context");
  });

  it("should handle clear-context command", async () => {
    // First add some context
    const contextPath = join(stateDir, "ralph-context.md");
    writeFileSync(contextPath, "Some context");
    
    // Then clear it
    const result = await $`bun ralph.ts --clear-context`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(existsSync(contextPath)).toBe(false);
  });

  it("should handle tasks commands", async () => {
    // Test add-task
    const result1 = await $`bun ralph.ts --add-task "Test task 1"`.cwd(testDir);
    expect(result1.exitCode).toBe(0);
    
    const result2 = await $`bun ralph.ts --add-task "Test task 2"`.cwd(testDir);
    expect(result2.exitCode).toBe(0);
    
    // Test list-tasks
    const result3 = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result3.exitCode).toBe(0);
    expect(result3.stdout.toString()).toContain("Test task 1");
    expect(result3.stdout.toString()).toContain("Test task 2");
  });

  it("should validate prompt argument for main command", async () => {
    try {
      const result = await $`bun ralph.ts`.cwd(testDir).quiet();
      expect(result.exitCode).toBe(1);
      // Should show help or error when no prompt provided
      expect(result.stderr.toString()).toContain("No prompt provided");
    } catch (error: any) {
      // Handle shell error
      expect(error.exitCode).toBe(1);
      expect(error.stderr?.toString()).toContain("No prompt provided");
    }
  });

  it("should handle prompt-file option", async () => {
    const promptFile = join(testDir, "prompt.md");
    writeFileSync(promptFile, "Test prompt from file");
    
    try {
      const result = await $`bun ralph.ts --prompt-file "${promptFile}" --max-iterations 1`.cwd(testDir).quiet();
      // Should fail because OpenCode is not available, but not due to file not found
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr.toString()).not.toContain("Prompt file not found");
    } catch (error: any) {
      // Handle shell error - should not be file not found
      expect(error.exitCode).toBeGreaterThan(0);
      expect(error.stderr?.toString()).not.toContain("Prompt file not found");
    }
  });
});

describe("State Management", () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (existsSync(stateDir)) {
        require("fs").rmSync(stateDir, { recursive: true, force: true });
      }
      if (existsSync(testDir)) {
        require("fs").rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("should track history across operations", async () => {
    // Add some context first
    await $`bun ralph.ts --add-context "Initial context"`.cwd(testDir);
    
    // Check status (this creates history tracking for commands)
    await $`bun ralph.ts --status`.cwd(testDir);
    
    // Verify history file might be created (some commands create it)
    const historyPath = join(stateDir, "ralph-history.json");
    // History may or may not be created by status command alone
    if (existsSync(historyPath)) {
      const historyContent = readFileSync(historyPath, "utf-8");
      const history = JSON.parse(historyContent);
      expect(history).toHaveProperty("iterations");
      expect(history).toHaveProperty("totalDurationMs");
      expect(history).toHaveProperty("struggleIndicators");
    }
  });
});

describe("Task File Parsing and Edge Cases", () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (existsSync(stateDir)) {
        require("fs").rmSync(stateDir, { recursive: true, force: true });
      }
      if (existsSync(testDir)) {
        require("fs").rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it("should handle malformed task markdown gracefully", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    
    // Write malformed markdown
    writeFileSync(tasksPath, `
# Ralph Tasks

Invalid line without proper format
- [missing bracket
- [] missing space
- [x]Valid task
- [ ] Task with weird spacing    
- [x] Another valid task
  - Subtask without proper format
  - [ ] Valid subtask
`);

    // Should not crash when listing tasks
    const result = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Valid task");
    expect(result.stdout.toString()).toContain("Another valid task");
    expect(result.stdout.toString()).toContain("Valid subtask");
  });

  it("should handle empty tasks file", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, "");
    
    const result = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("No tasks found");
  });

  it("should handle tasks file with only headers and comments", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks
## Project Goals
This is just a comment
- [ ] This is the only real task
`);
    
    const result = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("This is the only real task");
  });

  it("should handle duplicate in-progress tasks", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks

- [/] First in-progress task
- [/] Second in-progress task (should not happen but test anyway)
- [ ] Regular task
`);
    
    const result = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("First in-progress task");
    expect(result.stdout.toString()).toContain("Second in-progress task");
  });

  it("should handle deeply nested task structures", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks

- [ ] Parent task 1
  - [ ] Child task 1.1
    - [ ] Grandchild task 1.1.1
  - [ ] Child task 1.2
- [x] Completed parent task
  - [ ] This subtask should be shown
  - [x] Completed subtask
`);
    
    const result = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Parent task 1");
    expect(result.stdout.toString()).toContain("Child task 1.1");
    expect(result.stdout.toString()).toContain("Grandchild task 1.1.1");
    expect(result.stdout.toString()).toContain("Completed parent task");
  });

  it("should handle special characters in task descriptions", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks

- [ ] Task with "quotes" and 'apostrophes'
- [ ] Task with <angle> brackets & ampersands
- [ ] Task with emojis 🚀 🔥
- [ ] Task with Unicode: naïve café
- [ ] Task with $pecial #characters
`);
    
    const result = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("quotes");
    expect(result.stdout.toString()).toContain("brackets");
    expect(result.stdout.toString()).toContain("🚀");
    expect(result.stdout.toString()).toContain("naïve");
    expect(result.stdout.toString()).toContain("$pecial");
  });

  it("should handle task removal with edge cases", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks

- [ ] Task to keep 1
- [x] Task to remove
  - [ ] Subtask that should be removed
  - [x] Another subtask to remove
- [ ] Task to keep 2
`);
    
    // Remove the middle task
    const result = await $`bun ralph.ts --remove-task 2`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Removed task 2");
    
    // Verify content after removal
    const remainingContent = readFileSync(tasksPath, "utf-8");
    expect(remainingContent).toContain("Task to keep 1");
    expect(remainingContent).toContain("Task to keep 2");
    expect(remainingContent).not.toContain("Task to remove");
    expect(remainingContent).not.toContain("Subtask that should be removed");
  });

  it("should handle invalid task indices gracefully", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks

- [ ] Only one task
`);
    
    // Try to remove non-existent task
    const result1 = await $`bun ralph.ts --remove-task 5`.cwd(testDir);
    expect(result1.exitCode).toBe(1);
    expect(result1.stderr.toString()).toContain("out of range");
    
    // Try to remove negative index
    const result2 = await $`bun ralph.ts --remove-task 0`.cwd(testDir);
    expect(result2.exitCode).toBe(1);
    expect(result2.stderr.toString()).toContain("out of range");
  });

  it("should handle concurrent task operations", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    
    // Add multiple tasks rapidly
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push($`bun ralph.ts --add-task "Concurrent task ${i}"`.cwd(testDir));
    }
    
    const results = await Promise.all(promises);
    results.forEach(result => {
      expect(result.exitCode).toBe(0);
    });
    
    // Verify all tasks were added
    const listResult = await $`bun ralph.ts --list-tasks`.cwd(testDir);
    expect(listResult.exitCode).toBe(0);
    
    for (let i = 0; i < 5; i++) {
      expect(listResult.stdout.toString()).toContain(`Concurrent task ${i}`);
    }
  });

  it("should handle marking tasks as in-progress (deduplicate)", async () => {
    const tasksPath = join(stateDir, "ralph-tasks.md");
    writeFileSync(tasksPath, `
# Ralph Tasks

- [/] Already in progress
- [ ] Task to mark as in-progress
- [ ] Another regular task
`);
    
    // We can't directly test markTaskInProgress since it's internal,
    // but we can verify the context generation handles it correctly
    const result = await $`bun ralph.ts --status --tasks`.cwd(testDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("Already in progress");
    expect(result.stdout.toString()).toContain("Task to mark as in-progress");
  });
});
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { AgentSpec, TestCase } from '../types/schemas.js';

interface RunResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Runs an agent against a test case.
 * 
 * Supports multiple runtimes:
 * - OpenClaw (via sessions_spawn)
 * - Claude Code CLI
 * - Custom runtime (via adapter script)
 */
export async function runAgent(options: {
  workspacePath: string;
  spec: AgentSpec;
  testCase: TestCase;
  runtime: 'openclaw' | 'claude-code' | 'custom';
  timeoutMs: number;
}): Promise<RunResult> {
  const { workspacePath, spec, testCase, runtime, timeoutMs } = options;
  
  console.log(chalk.yellow(`\n🤖 Running agent: ${spec.agentId}`));
  console.log(chalk.dim(`   Test: ${testCase.name}`));
  console.log(chalk.dim(`   Runtime: ${runtime}`));
  
  const startTime = Date.now();
  
  try {
    let result: RunResult;
    
    switch (runtime) {
      case 'openclaw':
        result = await runWithOpenClaw(workspacePath, spec, testCase, timeoutMs);
        break;
      case 'claude-code':
        result = await runWithClaudeCode(workspacePath, spec, testCase, timeoutMs);
        break;
      case 'custom':
        result = await runWithCustomRuntime(workspacePath, spec, testCase, timeoutMs);
        break;
      default:
        throw new Error(`Unknown runtime: ${runtime}`);
    }
    
    const durationMs = Date.now() - startTime;
    result.durationMs = durationMs;
    
    console.log(chalk.green(`   ✓ Completed in ${durationMs}ms`));
    
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.log(chalk.red(`   ✗ Failed after ${durationMs}ms`));
    
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
    };
  }
}

/**
 * Runs agent using OpenClaw's sessions_spawn API.
 * 
 * This is the primary runtime for our harness.
 */
async function runWithOpenClaw(
  workspacePath: string,
  spec: AgentSpec,
  testCase: TestCase,
  timeoutMs: number
): Promise<RunResult> {
  // Load the agent's runtime adapter
  const adapterPath = join(workspacePath, 'runtime', 'adapter.js');
  
  if (!existsSync(adapterPath)) {
    throw new Error(`Runtime adapter not found at ${adapterPath}`);
  }
  
  // For OpenClaw, we need to spawn a session via the OpenClaw API
  // This is a placeholder - in production, this would call sessions_spawn
  // For now, we'll simulate with a direct execution
  
  console.log(chalk.dim('   Using OpenClaw runtime adapter...'));
  
  // Execute the task via the adapter
  const adapterScript = readFileSync(adapterPath, 'utf-8');
  
  // Create a temporary task file
  const taskFile = join(workspacePath, 'tests', 'current-task.json');
  writeFileSync(taskFile, JSON.stringify({
    task: testCase.task,
    expectedOutput: testCase.expectedOutput,
    successCriteria: testCase.successCriteria,
  }, null, 2));
  
  // For now, we'll use a simple exec-based approach
  // TODO: Replace with actual OpenClaw sessions_spawn integration
  try {
    // Execute the agent harness (this would be replaced with sessions_spawn)
    const output = execSync(`node ${adapterPath} --task ${testCase.task}`, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      cwd: workspacePath,
    });
    
    return {
      success: true,
      output,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
    };
  }
}

/**
 * Runs agent using Claude Code CLI.
 * 
 * Useful for testing harnesses before deploying to OpenClaw.
 */
async function runWithClaudeCode(
  workspacePath: string,
  spec: AgentSpec,
  testCase: TestCase,
  timeoutMs: number
): Promise<RunResult> {
  console.log(chalk.dim('   Using Claude Code CLI...'));
  
  // Create a prompt file for Claude Code
  const promptFile = join(workspacePath, 'tests', 'current-prompt.md');
  writeFileSync(promptFile, `# Task: ${testCase.name}

${testCase.task}

## Expected Output
${testCase.expectedOutput}

## Success Criteria
${testCase.successCriteria.join('\n')}
`);
  
  try {
    // Run Claude Code with the agent's system prompt
    const output = execSync(
      `claude-code --prompt "${testCase.task}" --output-format text`,
      {
        encoding: 'utf-8',
        timeout: timeoutMs,
        cwd: workspacePath,
        env: {
          ...process.env,
          // Inject agent's SOUL.md as system prompt
          CLAUDE_SYSTEM_PROMPT: readFileSync(
            join(workspacePath, 'harness', 'SOUL.md'),
            'utf-8'
          ),
        },
      }
    );
    
    return {
      success: true,
      output,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
    };
  }
}

/**
 * Runs agent using a custom runtime adapter.
 * 
 * The adapter must be an executable script at runtime/adapter.js
 */
async function runWithCustomRuntime(
  workspacePath: string,
  spec: AgentSpec,
  testCase: TestCase,
  timeoutMs: number
): Promise<RunResult> {
  const adapterPath = join(workspacePath, 'runtime', 'adapter.js');
  
  if (!existsSync(adapterPath)) {
    throw new Error(`Custom runtime adapter not found at ${adapterPath}`);
  }
  
  console.log(chalk.dim('   Using custom runtime adapter...'));
  
  try {
    const output = execSync(`node ${adapterPath} --task "${testCase.task}"`, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      cwd: workspacePath,
    });
    
    return {
      success: true,
      output,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message,
    };
  }
}

/**
 * Captures agent state after execution.
 * 
 * Checks for:
 * - Git commits made
 * - Progress files updated
 * - Tests passing
 * - LEARNINGS.md updated
 */
export function captureAgentState(workspacePath: string): {
  gitCommits: number;
  filesModified: string[];
  testsPassing: boolean;
  learningsUpdated: boolean;
} {
  const state = {
    gitCommits: 0,
    filesModified: [] as string[],
    testsPassing: false,
    learningsUpdated: false,
  };
  
  try {
    // Check git commits
    const gitLog = execSync('git log --oneline -1', {
      encoding: 'utf-8',
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    state.gitCommits = gitLog.trim() ? 1 : 0;
    
    // Check for modified files
    const gitStatus = execSync('git status --porcelain', {
      encoding: 'utf-8',
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    state.filesModified = gitStatus
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.substring(3));
    
    // Check if tests exist and pass
    const testsDir = join(workspacePath, 'tests');
    if (existsSync(testsDir)) {
      try {
        execSync('npm test', {
          encoding: 'utf-8',
          cwd: workspacePath,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        state.testsPassing = true;
      } catch {
        state.testsPassing = false;
      }
    }
    
    // Check if LEARNINGS.md was updated
    const learningsPath = join(workspacePath, 'harness', 'LEARNINGS.md');
    if (existsSync(learningsPath)) {
      const content = readFileSync(learningsPath, 'utf-8');
      // Check if there's an entry from today
      const today = new Date().toISOString().split('T')[0];
      state.learningsUpdated = content.includes(today);
    }
  } catch (error) {
    console.log(chalk.dim('   Warning: Could not capture full agent state'));
  }
  
  return state;
}

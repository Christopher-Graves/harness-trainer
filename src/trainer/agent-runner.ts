import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { AgentSpec, TestCase } from '../types/schemas.js';
import dotenv from 'dotenv';

// Load .env for API keys
dotenv.config();

/**
 * Simple progress dots for showing activity during long operations.
 * Appends dots to a single line — works in all terminals.
 */
let progressTimer: NodeJS.Timeout | null = null;

function startProgress(message: string) {
  process.stdout.write(`   ${message}`);
  
  progressTimer = setInterval(() => {
    process.stdout.write('.');
  }, 1000);
  
  return () => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
      process.stdout.write('\n');
    }
  };
}

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
 * Runs agent using OpenRouter API (simulating OpenClaw agent execution).
 * 
 * This allows testing the full loop without needing OpenClaw runtime.
 * Uses the agent's SOUL.md as system prompt.
 */
async function runWithOpenClaw(
  workspacePath: string,
  spec: AgentSpec,
  testCase: TestCase,
  timeoutMs: number
): Promise<RunResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set in .env file');
  }
  
  console.log(chalk.dim('   Using OpenRouter API (OpenClaw mode)...'));
  
  // Load agent's SOUL.md for system prompt
  const soulPath = join(workspacePath, 'harness', 'SOUL.md');
  if (!existsSync(soulPath)) {
    throw new Error(`SOUL.md not found at ${soulPath}`);
  }
  const systemPrompt = readFileSync(soulPath, 'utf-8');
  
  // Build the user prompt from test case
  const userPrompt = buildAgentPrompt(testCase, spec);
  
  // Call OpenRouter API
  const model = spec.model?.primary || 'anthropic/claude-sonnet-4-6';
  
  console.log(chalk.dim(`   Model: ${model}`));
  console.log(chalk.dim(`   Task: ${testCase.name}`));
  console.log(chalk.dim(`   Timeout: ${Math.round(timeoutMs / 1000)}s`));
  
  // Show progress while waiting for API
  const stopProgress = startProgress('Calling LLM API');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Christopher-Graves/harness-trainer',
        'X-Title': 'Harness Trainer',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Stop spinner
    stopProgress();
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }
    
    const data = await response.json();
    const output = data.choices?.[0]?.message?.content || '';
    const tokenUsage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
    
    if (!output) {
      throw new Error('Empty response from API (no content in choices)');
    }
    
    // Save output to file for inspection
    const outputPath = join(workspacePath, 'tests', 'last-output.md');
    writeFileSync(outputPath, output);
    
    console.log(chalk.dim(`   Tokens: ${tokenUsage.prompt_tokens} → ${tokenUsage.completion_tokens}`));
    
    return {
      success: true,
      output,
      tokenUsage: {
        input: tokenUsage.prompt_tokens,
        output: tokenUsage.completion_tokens,
      },
    };
  } catch (error: any) {
    // Stop spinner on error
    stopProgress();
    
    // Provide clear error messages
    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = `Timeout: Agent took longer than ${Math.round(timeoutMs / 1000)}s. Try increasing timeout or check API key.`;
    } else if (error.message.includes('API key')) {
      errorMessage = 'API Key Error: Check your OPENROUTER_API_KEY in .env file';
    } else if (error.message.includes('401')) {
      errorMessage = 'Authentication Error (401): Invalid API key';
    } else if (error.message.includes('429')) {
      errorMessage = 'Rate Limit (429): Too many requests. Wait a moment and retry.';
    } else if (error.message.includes('402')) {
      errorMessage = 'Insufficient Credits (402): Add credits at https://openrouter.ai/settings/credits';
    } else if (error.message.includes('500') || error.message.includes('503')) {
      errorMessage = 'API Server Error: OpenRouter is having issues. Retry in a minute.';
    }
    
    console.log(chalk.red(`   ✗ ${errorMessage}`));
    
    return {
      success: false,
      output: '',
      error: errorMessage,
    };
  }
}

/**
 * Builds the prompt sent to the agent.
 */
function buildAgentPrompt(testCase: TestCase, spec: AgentSpec): string {
  return `You are ${spec.agentId} — ${spec.role}.

## Your Task
${testCase.task}

## What Success Looks Like
${testCase.expectedOutput}

## Success Criteria
${testCase.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

**Instructions:**
- Follow your SOUL.md instructions
- Complete the task above
- Output only your final work (no meta-commentary)

Begin:`;
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

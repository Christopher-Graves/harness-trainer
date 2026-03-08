import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { EvalResult, TestCase, EvalSuite } from '../types/schemas.js';

// Spinner animation (same as agent-runner)
// Updates in-place on a single line.
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerTimer: NodeJS.Timeout | null = null;

function startSpinner(message: string) {
  let frameIndex = 0;
  
  // Write initial spinner
  process.stdout.write(`   ${chalk.dim(spinnerFrames[0])} ${message}`);
  
  spinnerTimer = setInterval(() => {
    const frame = spinnerFrames[frameIndex % spinnerFrames.length];
    // Move cursor to beginning of line, clear it, write new frame
    process.stdout.write(`\r\x1b[K   ${chalk.dim(frame)} ${message}`);
    frameIndex++;
  }, 80);
  
  return () => {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
      // Clear the spinner line
      process.stdout.write('\r\x1b[K');
    }
  };
}

/**
 * Evaluates an agent harness against its test suite.
 * 
 * Uses a Judge model (Opus) to score agent performance on five dimensions:
 * - Task Completion (40%): Did it finish the task?
 * - Error Recovery (25%): How did it handle errors?
 * - Clean State (20%): Git commits, progress files, tests passing
 * - Token Efficiency (10%): Tokens used vs. baseline
 * - Self-Learn (5%): LEARNINGS.md updated with insights
 */
export async function evaluateHarness(options: {
  workspacePath: string;
  judgeModel: string;
  agentOutput: string;
  testCase: TestCase;
}): Promise<EvalResult> {
  const { workspacePath, judgeModel, agentOutput, testCase } = options;
  
  console.log(chalk.blue(`\n🔍 Evaluating: ${testCase.name}`));
  console.log(chalk.dim(`   Judge model: ${judgeModel}`));
  
  // Build the eval prompt
  const evalPrompt = buildEvalPrompt(testCase, agentOutput);
  
  // Call the Judge model
  const judgeResponse = await callJudgeModel(evalPrompt, judgeModel);
  
  // Parse the response
  const parsed = parseJudgeResponse(judgeResponse);
  
  // Calculate weighted overall score
  const overallScore = calculateOverallScore(parsed.scores);
  
  const result: EvalResult = {
    taskId: testCase.name,
    timestamp: new Date().toISOString(),
    scores: parsed.scores,
    overallScore,
    feedback: parsed.feedback,
    suggestions: parsed.suggestions,
  };
  
  // Log results
  console.log(chalk.green(`   ✓ Overall: ${overallScore.toFixed(3)}`));
  console.log(chalk.dim(`   - Task Completion: ${parsed.scores.taskCompletion.toFixed(3)}`));
  console.log(chalk.dim(`   - Error Recovery: ${parsed.scores.errorRecovery.toFixed(3)}`));
  console.log(chalk.dim(`   - Clean State: ${parsed.scores.cleanState.toFixed(3)}`));
  console.log(chalk.dim(`   - Token Efficiency: ${parsed.scores.tokenEfficiency.toFixed(3)}`));
  console.log(chalk.dim(`   - Self-Learn: ${parsed.scores.selfLearn.toFixed(3)}`));
  
  // Save detailed eval log
  const logsDir = join(workspacePath, 'logs');
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `eval-${testCase.name}-${Date.now()}.json`);
  writeFileSync(logPath, JSON.stringify({
    testCase,
    agentOutput,
    judgeResponse,
    result,
  }, null, 2));
  
  return result;
}

/**
 * Builds the evaluation prompt for the Judge model.
 * 
 * Based on Anthropic's eval patterns and Karpathy's AutoResearch.
 */
function buildEvalPrompt(testCase: TestCase, agentOutput: string): string {
  return `You are an expert evaluator of AI agent performance. Your job is to score an agent's output on a specific test case.

## Test Case
**Name:** ${testCase.name}
**Description:** ${testCase.description}
**Task:** ${testCase.task}

### Expected Output
${testCase.expectedOutput}

### Success Criteria
${testCase.successCriteria.join('\n')}

## Agent Output
${agentOutput}

## Scoring Rubric

Score each dimension from 0.0 to 1.0:

1. **Task Completion (40% weight)**
   - 1.0: Task fully completed, all success criteria met
   - 0.7: Task mostly complete, minor gaps
   - 0.4: Partial progress, significant gaps
   - 0.0: Task not attempted or completely failed

2. **Error Recovery (25% weight)**
   - 1.0: Errors handled gracefully, recovery attempted, user informed
   - 0.7: Some error handling, partial recovery
   - 0.4: Errors acknowledged but not resolved
   - 0.0: Errors ignored or caused crash

3. **Clean State (20% weight)**
   - 1.0: Git commits made, progress files updated, tests passing
   - 0.7: Some state updates, minor issues
   - 0.4: Partial state management
   - 0.0: No state changes or left in broken state

4. **Token Efficiency (10% weight)**
   - 1.0: Efficient, no wasted tokens, concise output
   - 0.7: Reasonably efficient, minor verbosity
   - 0.4: Some unnecessary verbosity
   - 0.0: Extremely verbose, wasted tokens

5. **Self-Learn (5% weight)**
   - 1.0: LEARNINGS.md updated with specific insights
   - 0.5: Some reflection, generic insights
   - 0.0: No self-learning

## Output Format

Return ONLY valid JSON with this exact structure:

{
  "scores": {
    "taskCompletion": 0.0-1.0,
    "errorRecovery": 0.0-1.0,
    "cleanState": 0.0-1.0,
    "tokenEfficiency": 0.0-1.0,
    "selfLearn": 0.0-1.0
  },
  "feedback": "2-3 sentences explaining the overall performance",
  "suggestions": ["specific actionable improvement 1", "suggestion 2", "suggestion 3"]
}

Do not include any text before or after the JSON.`;
}

/**
 * Calls the Judge model to evaluate agent output.
 * 
 * Uses OpenRouter API for Opus access.
 */
async function callJudgeModel(prompt: string, model: string): Promise<string> {
  // Check for OpenRouter API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set. Judge requires API access.');
  }
  
  // Start spinner while waiting for judge
  const stopSpinner = startSpinner('Evaluating agent output...');
  
  // Call OpenRouter API
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Christopher-Graves/harness-trainer',
      'X-Title': 'Harness Trainer Judge',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-5-sonnet-20241022', // Using Sonnet for cost efficiency
      messages: [
        {
          role: 'system',
          content: 'You are an expert evaluator of AI agent performance. You score agents on task completion, error recovery, clean state, token efficiency, and self-learning. Return ONLY valid JSON with scores, feedback, and suggestions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temp for consistent scoring
      max_tokens: 1000,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Judge API call failed: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  
  // Stop spinner
  stopSpinner();
  
  return data.choices[0].message.content;
}

/**
 * Parses the Judge model's JSON response.
 */
function parseJudgeResponse(response: string): {
  scores: EvalResult['scores'];
  feedback: string;
  suggestions: string[];
} {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in judge response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      scores: {
        taskCompletion: parsed.scores?.taskCompletion ?? 0.5,
        errorRecovery: parsed.scores?.errorRecovery ?? 0.5,
        cleanState: parsed.scores?.cleanState ?? 0.5,
        tokenEfficiency: parsed.scores?.tokenEfficiency ?? 0.5,
        selfLearn: parsed.scores?.selfLearn ?? 0.5,
      },
      feedback: parsed.feedback ?? 'No feedback provided',
      suggestions: parsed.suggestions ?? [],
    };
  } catch (error) {
    console.error(chalk.red('Failed to parse judge response:'), error);
    console.error(chalk.dim('Raw response:'), response);
    
    // Return default scores on parse failure
    return {
      scores: {
        taskCompletion: 0.5,
        errorRecovery: 0.5,
        cleanState: 0.5,
        tokenEfficiency: 0.5,
        selfLearn: 0.5,
      },
      feedback: 'Parse error - returning default scores',
      suggestions: ['Fix judge response parsing'],
    };
  }
}

/**
 * Calculates weighted overall score from individual scores.
 */
function calculateOverallScore(scores: EvalResult['scores']): number {
  const weights = {
    taskCompletion: 0.40,
    errorRecovery: 0.25,
    cleanState: 0.20,
    tokenEfficiency: 0.10,
    selfLearn: 0.05,
  };
  
  return (
    scores.taskCompletion * weights.taskCompletion +
    scores.errorRecovery * weights.errorRecovery +
    scores.cleanState * weights.cleanState +
    scores.tokenEfficiency * weights.tokenEfficiency +
    scores.selfLearn * weights.selfLearn
  );
}

/**
 * Loads an eval suite from a workspace.
 */
export function loadEvalSuite(workspacePath: string): EvalSuite {
  const evalSuitePath = join(workspacePath, 'tests', 'eval-suite.json');
  
  if (!readFileSync) {
    throw new Error(`Eval suite not found at ${evalSuitePath}`);
  }
  
  return JSON.parse(readFileSync(evalSuitePath, 'utf-8'));
}

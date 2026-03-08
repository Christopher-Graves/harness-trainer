import { z } from 'zod';
import { readFileSync } from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// AGENT SPEC SCHEMA
// The input to harness generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads and validates an agent spec from a JSON file.
 */
export function loadSpec(specPath: string): AgentSpec {
  const content = readFileSync(specPath, 'utf-8');
  const parsed = JSON.parse(content);
  return AgentSpecSchema.parse(parsed);
}

export const ToolSchema = z.object({
  name: z.string().describe('Tool identifier (e.g., "web_search", "exec")'),
  type: z.enum(['api', 'internal', 'system', 'custom']).describe('Tool category'),
  description: z.string().optional().describe('What this tool does'),
  config: z.record(z.unknown()).optional().describe('Tool-specific configuration'),
});

export type Tool = z.infer<typeof ToolSchema>;

export const AgentSpecSchema = z.object({
  agentId: z.string().describe('Unique identifier for this agent'),
  role: z.string().describe('One-sentence role description'),
  responsibilities: z.array(z.string()).describe('List of key responsibilities'),
  skills: z.array(z.string()).describe('Required capabilities'),
  tools: z.array(ToolSchema).describe('Tools this agent can use'),
  plan: z.string().describe('High-level workflow description'),
  runtime: z.enum(['openclaw', 'claude-code', 'custom']).describe('Target runtime environment'),
  model: z.object({
    primary: z.string().describe('Primary model (e.g., "anthropic/claude-sonnet-4-6")'),
    fallbacks: z.array(z.string()).optional().describe('Fallback models in order'),
  }).optional().describe('Model configuration'),
  workspace: z.string().optional().describe('Custom workspace path (defaults to agentId)'),
});

export type AgentSpec = z.infer<typeof AgentSpecSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// HARNESS FILES SCHEMA
// Generated output structure
// ─────────────────────────────────────────────────────────────────────────────

export const HarnessFilesSchema = z.object({
  soul: z.string().describe('SOUL.md content'),
  agents: z.string().describe('AGENTS.md content'),
  memory: z.string().describe('MEMORY.md content'),
  learnings: z.string().describe('Initial LEARNINGS.md content'),
  toolsConfig: z.string().optional().describe('tools.json or openclaw.json tools section'),
  tests: z.array(z.object({
    name: z.string(),
    description: z.string(),
    input: z.string(),
    expectedOutput: z.string(),
    scoringRubric: z.object({
      taskCompletion: z.number().min(0).max(1),
      errorRecovery: z.number().min(0).max(1),
      cleanState: z.number().min(0).max(1),
      tokenEfficiency: z.number().min(0).max(1),
      selfLearn: z.number().min(0).max(1),
    }),
  })).describe('Test suite'),
  runtimeAdapter: z.string().optional().describe('Runtime-specific adapter code'),
});

export type HarnessFiles = z.infer<typeof HarnessFilesSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION SCHEMA
// Scoring results from the Judge
// ─────────────────────────────────────────────────────────────────────────────

export const EvalResultSchema = z.object({
  taskId: z.string(),
  timestamp: z.string(),
  scores: z.object({
    taskCompletion: z.number().min(0).max(1),
    errorRecovery: z.number().min(0).max(1),
    cleanState: z.number().min(0).max(1),
    tokenEfficiency: z.number().min(0).max(1),
    selfLearn: z.number().min(0).max(1),
  }),
  overallScore: z.number().min(0).max(1),
  feedback: z.string(),
  suggestions: z.array(z.string()),
  agentOutput: z.string().optional().describe('Agent\'s actual output'),
  errors: z.array(z.string()).optional().describe('Errors encountered during execution'),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING SESSION SCHEMA
// Tracks the full training loop
// ─────────────────────────────────────────────────────────────────────────────

export const TrainingSessionSchema = z.object({
  agentId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  iterations: z.number(),
  evalResults: z.array(EvalResultSchema),
  harnessVersions: z.array(z.object({
    version: z.number(),
    timestamp: z.string(),
    changes: z.array(z.string()),
    score: z.number(),
  })),
  finalScore: z.number().min(0).max(1).optional(),
  status: z.enum(['running', 'completed', 'failed']),
});

export type TrainingSession = z.infer<typeof TrainingSessionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME CONFIGURATION
// Adapter-specific settings
// ─────────────────────────────────────────────────────────────────────────────

export const OpenClawConfigSchema = z.object({
  agentId: z.string(),
  workspace: z.string(),
  model: z.string(),
  tools: z.object({
    deny: z.array(z.string()).optional(),
    exec: z.object({
      security: z.enum(['deny', 'allowlist', 'full']),
      ask: z.enum(['off', 'on-miss', 'always']),
    }).optional(),
  }).optional(),
  subagents: z.object({
    allowAgents: z.array(z.string()),
  }).optional(),
});

export type OpenClawConfig = z.infer<typeof OpenClawConfigSchema>;

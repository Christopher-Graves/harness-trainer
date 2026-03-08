#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { generateHarness } from './generator/generator.js';
import { runTrainingSession } from './trainer/trainer.js';
import { loadEvalSuite } from './judge/evaluator.js';
import { AgentSpecSchema } from './types/schemas.js';

// Load .env file if it exists
dotenv.config();

const program = new Command();

program
  .name('harness-trainer')
  .description('Autonomous agent harness training framework')
  .version('0.1.0');

/**
 * Generate a new agent harness from a spec.
 */
program
  .command('generate')
  .description('Generate agent harness from spec file')
  .argument('<spec>', 'Path to agent spec JSON file')
  .option('-o, --output <path>', 'Output directory for agent workspace', 'agent-workspaces')
  .option('--force', 'Overwrite existing workspace', false)
  .action(async (specPath: string, options: { output: string; force: boolean }) => {
    try {
      console.log(chalk.blue('🔧 Generating agent harness...'));
      
      // Resolve paths
      const specFullPath = resolve(specPath);
      const outputDir = resolve(options.output);
      
      // Load and validate spec
      if (!existsSync(specFullPath)) {
        console.error(chalk.red(`Error: Spec file not found: ${specFullPath}`));
        process.exit(1);
      }
      
      const specContent = readFileSync(specFullPath, 'utf-8');
      const spec = AgentSpecSchema.parse(JSON.parse(specContent));
      
      console.log(chalk.dim(`   Spec: ${specFullPath}`));
      console.log(chalk.dim(`   Agent: ${spec.agentId}`));
      console.log(chalk.dim(`   Output: ${outputDir}`));
      
      // Generate harness
      const workspacePath = await generateHarness({
        spec,
        outputDir,
        force: options.force,
      });
      
      console.log(chalk.green('\n✓ Harness generated successfully!'));
      console.log(chalk.dim(`   Workspace: ${workspacePath}`));
      console.log(chalk.dim(`\nNext steps:`));
      console.log(chalk.dim(`   1. Review generated files in ${workspacePath}/harness/`));
      console.log(chalk.dim(`   2. Customize SOUL.md and AGENTS.md as needed`));
      console.log(chalk.dim(`   3. Run: harness-trainer train ${workspacePath}`));
      
    } catch (error) {
      console.error(chalk.red('\n✗ Generation failed:'));
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Run a training session.
 */
program
  .command('train')
  .description('Run training session for an agent')
  .argument('<workspace>', 'Path to agent workspace')
  .option('-i, --iterations <n>', 'Number of training iterations', '10')
  .option('-j, --judge <model>', 'Judge model to use', 'anthropic/claude-3-5-sonnet-20241022')
  .option('-r, --runtime <type>', 'Runtime to use (openclaw|claude-code|custom)', 'openclaw')
  .option('-t, --timeout <ms>', 'Timeout per iteration in ms', '300000')
  .option('-o, --output <path>', 'Output directory for results', 'results')
  .action(async (workspace: string, options: { 
    iterations: string; 
    judge: string; 
    runtime: 'openclaw' | 'claude-code' | 'custom'; 
    timeout: string;
    output: string;
  }) => {
    try {
      // Check for API key
      if (!process.env.OPENROUTER_API_KEY) {
        console.error(chalk.red('\n⚠ Error: OPENROUTER_API_KEY not set'));
        console.error(chalk.dim('   Create a .env file or export the environment variable'));
        console.error(chalk.dim('   Get your key at: https://openrouter.ai/keys'));
        console.error(chalk.dim('\n   Example .env:'));
        console.error(chalk.dim('   OPENROUTER_API_KEY=sk-or-v1-your-key-here'));
        process.exit(1);
      }
      
      console.log(chalk.blue('🎯 Starting training session...'));
      
      // Resolve paths
      const workspacePath = resolve(workspace);
      const outputPath = resolve(options.output);
      const iterations = parseInt(options.iterations, 10);
      const timeoutMs = parseInt(options.timeout, 10);
      
      // Validate workspace
      if (!existsSync(workspacePath)) {
        console.error(chalk.red(`Error: Workspace not found: ${workspacePath}`));
        process.exit(1);
      }
      
      const specPath = join(workspacePath, 'spec.json');
      if (!existsSync(specPath)) {
        console.error(chalk.red(`Error: spec.json not found in workspace`));
        process.exit(1);
      }
      
      const evalSuitePath = join(workspacePath, 'tests', 'eval-suite.json');
      if (!existsSync(evalSuitePath)) {
        console.error(chalk.red(`Error: eval-suite.json not found in workspace/tests/`));
        process.exit(1);
      }
      
      console.log(chalk.dim(`   Workspace: ${workspacePath}`));
      console.log(chalk.dim(`   Iterations: ${iterations}`));
      console.log(chalk.dim(`   Judge: ${options.judge}`));
      console.log(chalk.dim(`   Runtime: ${options.runtime}`));
      console.log(chalk.dim(`   Timeout: ${timeoutMs}ms`));
      console.log(chalk.dim(`   Output: ${outputPath}`));
      
      // Run training
      const session = await runTrainingSession({
        workspacePath,
        iterations,
        judgeModel: options.judge,
        outputPath,
        runtime: options.runtime,
        timeoutMs,
      });
      
      console.log(chalk.green('\n✓ Training session completed!'));
      console.log(chalk.dim(`   Final score: ${session.finalScore?.toFixed(3)}`));
      console.log(chalk.dim(`   Results: ${outputPath}`));
      
    } catch (error) {
      console.error(chalk.red('\n✗ Training failed:'));
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Evaluate a harness without training.
 */
program
  .command('eval')
  .description('Evaluate harness on test suite (single run)')
  .argument('<workspace>', 'Path to agent workspace')
  .option('-t, --test <name>', 'Specific test to run (default: all)')
  .option('-j, --judge <model>', 'Judge model to use', 'anthropic/claude-3-5-sonnet-20241022')
  .option('-r, --runtime <type>', 'Runtime to use (openclaw|claude-code|custom)', 'openclaw')
  .action(async (workspace: string, options: { 
    test?: string; 
    judge: string; 
    runtime: 'openclaw' | 'claude-code' | 'custom';
  }) => {
    try {
      // Check for API key
      if (!process.env.OPENROUTER_API_KEY) {
        console.error(chalk.red('\n⚠ Error: OPENROUTER_API_KEY not set'));
        console.error(chalk.dim('   Create a .env file or export the environment variable'));
        process.exit(1);
      }
      
      console.log(chalk.blue('🔍 Evaluating harness...'));
      
      const workspacePath = resolve(workspace);
      
      // Load eval suite
      const evalSuite = loadEvalSuite(workspacePath);
      
      // Filter tests if specific test requested
      const tests = options.test
        ? evalSuite.tests.filter(t => t.name === options.test)
        : evalSuite.tests;
      
      if (tests.length === 0) {
        console.error(chalk.red(`Error: Test not found: ${options.test}`));
        process.exit(1);
      }
      
      console.log(chalk.dim(`   Workspace: ${workspacePath}`));
      console.log(chalk.dim(`   Tests: ${tests.length}`));
      console.log(chalk.dim(`   Judge: ${options.judge}`));
      
      // Run each test
      for (const testCase of tests) {
        console.log(chalk.yellow(`\n📍 Testing: ${testCase.name}`));
        
        // TODO: Import and call evaluateHarness
        // For now, just show placeholder
        console.log(chalk.dim('   Evaluation not yet fully implemented'));
        console.log(chalk.dim('   Run "harness-trainer train" for full training loop'));
      }
      
    } catch (error) {
      console.error(chalk.red('\n✗ Evaluation failed:'));
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * List available test cases.
 */
program
  .command('list-tests')
  .description('List test cases in an agent workspace')
  .argument('<workspace>', 'Path to agent workspace')
  .action((workspace: string) => {
    try {
      const workspacePath = resolve(workspace);
      const evalSuitePath = join(workspacePath, 'tests', 'eval-suite.json');
      
      if (!existsSync(evalSuitePath)) {
        console.error(chalk.red(`Error: eval-suite.json not found`));
        process.exit(1);
      }
      
      const evalSuite = JSON.parse(readFileSync(evalSuitePath, 'utf-8'));
      
      console.log(chalk.blue(`\n📋 Test cases in ${workspacePath}:\n`));
      
      evalSuite.tests.forEach((test: any, i: number) => {
        console.log(chalk.white(`${i + 1}. ${test.name}`));
        console.log(chalk.dim(`   ${test.description}`));
        console.log(chalk.dim(`   Task: ${test.task.substring(0, 100)}...`));
        console.log();
      });
      
    } catch (error) {
      console.error(chalk.red('\n✗ Failed to list tests:'));
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

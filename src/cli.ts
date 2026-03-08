#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { AgentSpecSchema } from './types/schemas.js';
import { generateHarness } from './generator/generator.js';
import { runTrainingSession } from './trainer/trainer.js';
import { evaluateHarness } from './judge/evaluator.js';

const program = new Command();

program
  .name('harness-trainer')
  .description('Autonomous agent harness training framework')
  .version('0.1.0');

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE COMMAND
// Creates a new agent workspace from a spec
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('generate')
  .description('Generate a new agent workspace from an agent spec')
  .requiredOption('--spec <path>', 'Path to agent spec JSON file')
  .option('--output <path>', 'Output directory for agent workspace', './agent-workspaces')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔧 Reading agent spec...'));
      const specPath = resolve(options.spec);
      const specContent = readFileSync(specPath, 'utf-8');
      const spec = JSON.parse(specContent);
      
      // Validate spec
      const validatedSpec = AgentSpecSchema.parse(spec);
      
      console.log(chalk.green(`✓ Validated spec for agent: ${validatedSpec.agentId}`));
      console.log(chalk.blue('🏗️  Generating harness files...'));
      
      // Generate harness
      const outputDir = resolve(options.output);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      const harnessFiles = await generateHarness(validatedSpec);
      const workspacePath = join(outputDir, validatedSpec.agentId);
      
      // Write files
      mkdirSync(workspacePath, { recursive: true });
      mkdirSync(join(workspacePath, 'harness'), { recursive: true });
      mkdirSync(join(workspacePath, 'tests'), { recursive: true });
      mkdirSync(join(workspacePath, 'runtime'), { recursive: true });
      
      writeFileSync(join(workspacePath, 'harness', 'SOUL.md'), harnessFiles.soul);
      writeFileSync(join(workspacePath, 'harness', 'AGENTS.md'), harnessFiles.agents);
      writeFileSync(join(workspacePath, 'harness', 'MEMORY.md'), harnessFiles.memory);
      writeFileSync(join(workspacePath, 'harness', 'LEARNINGS.md'), harnessFiles.learnings);
      
      if (harnessFiles.toolsConfig) {
        writeFileSync(join(workspacePath, 'tools.json'), harnessFiles.toolsConfig);
      }
      
      if (harnessFiles.runtimeAdapter) {
        writeFileSync(join(workspacePath, 'runtime', 'adapter.js'), harnessFiles.runtimeAdapter);
      }
      
      // Write test suite
      writeFileSync(
        join(workspacePath, 'tests', 'eval-suite.json'),
        JSON.stringify({ tests: harnessFiles.tests }, null, 2)
      );
      
      // Write agent spec for reference
      writeFileSync(
        join(workspacePath, 'spec.json'),
        JSON.stringify(validatedSpec, null, 2)
      );
      
      console.log(chalk.green('✓ Harness generated successfully!'));
      console.log(chalk.dim(`   Workspace: ${workspacePath}`));
      console.log(chalk.dim(`   Files: SOUL.md, AGENTS.md, MEMORY.md, LEARNINGS.md, eval-suite.json`));
      
    } catch (error: any) {
      console.error(chalk.red('✗ Error:'), error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN COMMAND
// Runs the training loop
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('train')
  .description('Run a training session to improve an agent harness')
  .requiredOption('--workspace <path>', 'Path to agent workspace')
  .option('--iterations <number>', 'Number of training iterations', '10')
  .option('--judge-model <model>', 'Model to use for judging (default: opus)', 'anthropic/claude-opus-4-6')
  .option('--output <path>', 'Output directory for training results', './output')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🎯 Starting training session...'));
      const workspacePath = resolve(options.workspace);
      const iterations = parseInt(options.iterations);
      
      const session = await runTrainingSession({
        workspacePath,
        iterations,
        judgeModel: options.judgeModel,
        outputPath: resolve(options.output),
      });
      
      console.log(chalk.green('✓ Training session completed!'));
      console.log(chalk.dim(`   Final score: ${session.finalScore?.toFixed(3)}`));
      console.log(chalk.dim(`   Iterations: ${session.iterations}`));
      console.log(chalk.dim(`   Results: ${resolve(options.output)}`));
      
    } catch (error: any) {
      console.error(chalk.red('✗ Training failed:'), error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// EVAL COMMAND
// Evaluates a harness against its test suite
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('eval')
  .description('Evaluate an agent harness against its test suite')
  .requiredOption('--workspace <path>', 'Path to agent workspace')
  .option('--judge-model <model>', 'Model to use for judging', 'anthropic/claude-opus-4-6')
  .option('--output <path>', 'Output path for eval results', './output/eval-results.json')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📊 Evaluating harness...'));
      const workspacePath = resolve(options.workspace);
      
      const results = await evaluateHarness({
        workspacePath,
        judgeModel: options.judgeModel,
      });
      
      // Write results
      const outputPath = resolve(options.output);
      mkdirSync(join(outputPath, '..'), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(results, null, 2));
      
      console.log(chalk.green('✓ Evaluation completed!'));
      console.log(chalk.dim(`   Results: ${outputPath}`));
      
      // Print summary
      const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
      console.log(chalk.dim(`   Average score: ${avgScore.toFixed(3)}`));
      
    } catch (error: any) {
      console.error(chalk.red('✗ Evaluation failed:'), error.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────

program.parse();

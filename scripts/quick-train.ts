#!/usr/bin/env tsx
/**
 * Quick Train — One command to rule them all
 * 
 * Usage: tsx scripts/quick-train.ts <agent-spec> [iterations]
 * Example: tsx scripts/quick-train.ts specs/linkedin-writer.json 5
 */

import dotenv from 'dotenv';
import { generateHarness } from '../src/generator/generator.js';
import { runTrainingSession } from '../src/trainer/trainer.js';
import { loadSpec } from '../src/types/schemas.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

// Load .env file from project root
dotenv.config();

async function quickTrain(specPath: string, iterations: number = 3) {
  console.log(chalk.blue('\n🚀 Quick Train — Harness Trainer\n'));
  
  // Step 1: Load spec
  console.log(chalk.dim('Step 1: Loading spec...'));
  const spec = loadSpec(specPath);
  console.log(chalk.dim(`   ✓ Agent: ${spec.agentId}`));
  console.log(chalk.dim(`   ✓ Role: ${spec.role}`));
  
  // Step 2: Generate harness
  console.log(chalk.dim('\nStep 2: Generating harness...'));
  const outputDir = join(process.cwd(), 'agent-workspaces');
  const workspacePath = await generateHarness({ spec, outputDir, force: false });
  console.log(chalk.green(`   ✓ Generated: ${workspacePath}`));
  
  // Step 3: Run training
  console.log(chalk.dim(`\nStep 3: Training agent (${iterations} iterations)...`));
  console.log(chalk.dim('   This may take a few minutes per iteration\n'));
  
  const session = await runTrainingSession({
    workspacePath: workspacePath,
    iterations,
    judgeModel: 'anthropic/claude-sonnet-4-6',
    outputPath: join(process.cwd(), 'results'),
    runtime: spec.runtime || 'openclaw',
    timeoutMs: 120000, // 2 minutes per iteration
  });
  
  const results = session.evalResults;
  
  // Step 4: Show summary
  console.log(chalk.blue('\n✅ Training Complete!\n'));
  console.log(chalk.bold('Results Summary:'));
  console.log(chalk.dim('─'.repeat(50)));
  
  results.forEach((result, i) => {
    const score = result.judgeResponse?.overallScore || 0;
    const status = score >= 8 ? '🟢' : score >= 6 ? '🟡' : '🔴';
    console.log(`${status} Iteration ${i + 1}: ${score.toFixed(1)}/10`);
    
    if (result.judgeResponse?.feedback) {
      console.log(chalk.dim(`   ${result.judgeResponse.feedback.slice(0, 100)}...`));
    }
  });
  
  const avgScore = results.reduce((sum, r) => sum + (r.judgeResponse?.overallScore || 0), 0) / results.length;
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.bold(`Average Score: ${avgScore.toFixed(1)}/10`));
  
  const shareableFile = `${spec.agentId}-results.md`;
  console.log(chalk.dim(`\n📄 Full results: results/${spec.agentId}-${new Date().toISOString().split('T')[0]}.md`));
  console.log(chalk.green(`📎 Shareable results: results/${shareableFile}`));
  
  console.log(chalk.blue('\n💡 Next Steps:'));
  console.log('   1. Open results/' + shareableFile);
  console.log('   2. Send that file to your AI assistant');
  console.log('   3. Edit harness/SOUL.md based on feedback');
  console.log('   4. Run again to see if scores improve:');
  console.log(chalk.dim(`      npm run quick -- specs/${spec.agentId}.json ${iterations}`));
  console.log('');
}

// Parse command line args
const args = process.argv.slice(2);
const specPath = args[0];
const iterations = parseInt(args[1]) || 3;

if (!specPath) {
  console.error(chalk.red('Error: Missing agent spec path'));
  console.error('Usage: tsx scripts/quick-train.ts <spec-path> [iterations]');
  console.error('Example: tsx scripts/quick-train.ts specs/linkedin-writer.json 5');
  process.exit(1);
}

quickTrain(specPath, iterations).catch(err => {
  console.error(chalk.red('\n❌ Error:'), err.message);
  process.exit(1);
});

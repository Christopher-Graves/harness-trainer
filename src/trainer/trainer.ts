import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { TrainingSession, EvalResult, AgentSpec, TestCase } from '../types/schemas.js';
import { evaluateHarness } from '../judge/evaluator.js';
import { runAgent, captureAgentState } from './agent-runner.js';

interface TrainingOptions {
  workspacePath: string;
  iterations: number;
  judgeModel: string;
  outputPath: string;
  runtime: 'openclaw' | 'claude-code' | 'custom';
  timeoutMs: number;
}

/**
 * Runs a complete training session.
 * 
 * The training loop:
 * 1. Load agent workspace and spec
 * 2. For each iteration:
 *    a. Pick a test case from eval-suite.json
 *    b. Run agent with current harness
 *    c. Capture agent state
 *    d. Judge model scores output
 *    e. If score improved, keep harness changes
 *    f. Log learnings
 * 3. Output final harness + score history
 */
export async function runTrainingSession(options: TrainingOptions): Promise<TrainingSession> {
  const { workspacePath, iterations, judgeModel, outputPath, runtime, timeoutMs } = options;
  
  // Load agent spec
  const specPath = join(workspacePath, 'spec.json');
  if (!existsSync(specPath)) {
    throw new Error(`Agent spec not found at ${specPath}`);
  }
  const spec: AgentSpec = JSON.parse(readFileSync(specPath, 'utf-8'));
  
  // Load eval suite
  const evalSuitePath = join(workspacePath, 'tests', 'eval-suite.json');
  if (!existsSync(evalSuitePath)) {
    throw new Error(`Eval suite not found at ${evalSuitePath}`);
  }
  const evalSuite = JSON.parse(readFileSync(evalSuitePath, 'utf-8'));
  
  // Initialize session
  const session: TrainingSession = {
    agentId: spec.agentId,
    startedAt: new Date().toISOString(),
    iterations,
    evalResults: [],
    harnessVersions: [],
    status: 'running',
  };
  
  console.log(chalk.blue(`\n🎯 Training ${spec.agentId} for ${iterations} iterations...`));
  console.log(chalk.dim(`   Judge model: ${judgeModel}`));
  console.log(chalk.dim(`   Runtime: ${runtime}`));
  console.log(chalk.dim(`   Workspace: ${workspacePath}`));
  
  // Training loop
  for (let i = 0; i < iterations; i++) {
    console.log(chalk.yellow(`\n📍 Iteration ${i + 1}/${iterations}`));
    
    // Pick test case (round-robin for now)
    const testIndex = i % evalSuite.tests.length;
    const testCase = evalSuite.tests[testIndex];
    
    console.log(chalk.dim(`   Test: ${testCase.name}`));
    console.log(chalk.dim(`   Task: ${testCase.description}`));
    
    // Run agent
    const runResult = await runAgent({
      workspacePath,
      spec,
      testCase,
      runtime,
      timeoutMs,
    });
    
    if (!runResult.success) {
      console.log(chalk.red(`   ✗ Agent failed: ${runResult.error}`));
      
      // Record failure
      const evalResult: EvalResult = {
        taskId: testCase.name,
        timestamp: new Date().toISOString(),
        scores: {
          taskCompletion: 0.0,
          errorRecovery: 0.0,
          cleanState: 0.0,
          tokenEfficiency: 0.5,
          selfLearn: 0.0,
        },
        overallScore: 0.0,
        feedback: `Agent failed: ${runResult.error}`,
        suggestions: ['Fix agent execution error'],
      };
      
      session.evalResults.push(evalResult);
      continue;
    }
    
    // Capture agent state
    const agentState = captureAgentState(workspacePath);
    console.log(chalk.dim(`   State: ${agentState.gitCommits} commits, ${agentState.filesModified.length} files modified, learnings: ${agentState.learningsUpdated ? '✓' : '✗'}`));
    
    // Judge the output
    const evalResult = await evaluateHarness({
      workspacePath,
      judgeModel,
      agentOutput: runResult.output,
      testCase,
    });
    
    session.evalResults.push(evalResult);
    
    // Track harness version
    const currentScore = evalResult.overallScore;
    const previousScore = session.harnessVersions.length > 0 
      ? session.harnessVersions[session.harnessVersions.length - 1].score 
      : 0;
    
    const versionChanges = [
      `Iteration ${i + 1}: ${testCase.name}`,
      `Score: ${previousScore.toFixed(3)} → ${currentScore.toFixed(3)}`,
    ];
    
    if (currentScore > previousScore) {
      console.log(chalk.green(`   ✓ Score improved: ${previousScore.toFixed(3)} → ${currentScore.toFixed(3)}`));
      versionChanges.push('Harness mutation: KEEP changes');
      
      // TODO: Mutate harness to keep improvements
      // await mutateHarness(workspacePath, evalResult, 'keep');
    } else if (currentScore < previousScore) {
      console.log(chalk.red(`   ✗ Score regressed: ${previousScore.toFixed(3)} → ${currentScore.toFixed(3)}`));
      versionChanges.push('Harness mutation: REVERT changes');
      
      // TODO: Revert harness changes
      // await revertHarness(workspacePath);
    } else {
      console.log(chalk.dim(`   → Score unchanged: ${currentScore.toFixed(3)}`));
      versionChanges.push('Harness mutation: NO CHANGE');
    }
    
    session.harnessVersions.push({
      version: i + 1,
      timestamp: new Date().toISOString(),
      changes: versionChanges,
      score: currentScore,
    });
  }
  
  // Calculate final score
  const finalScore = session.evalResults.reduce((sum, r) => sum + r.overallScore, 0) / session.evalResults.length;
  session.finalScore = finalScore;
  session.completedAt = new Date().toISOString();
  session.status = 'completed';
  
  // Write results
  mkdirSync(outputPath, { recursive: true });
  const resultsPath = join(outputPath, `training-${spec.agentId}-${Date.now()}.json`);
  writeFileSync(resultsPath, JSON.stringify(session, null, 2));
  
  console.log(chalk.green('\n✓ Training session completed!'));
  console.log(chalk.dim(`   Final score: ${finalScore.toFixed(3)}`));
  console.log(chalk.dim(`   Results saved: ${resultsPath}`));
  
  // Generate summary report
  generateTrainingReport(session, outputPath);
  
  return session;
}

/**
 * Generates a human-readable training report.
 */
function generateTrainingReport(session: TrainingSession, outputPath: string): void {
  const reportPath = join(outputPath, `training-report-${session.agentId}.md`);
  const shareablePath = join(outputPath, `${session.agentId}-results.md`);
  
  const report = `# Training Report: ${session.agentId}

**Started:** ${new Date(session.startedAt).toLocaleString()}
**Completed:** ${new Date(session.completedAt!).toLocaleString()}
**Iterations:** ${session.iterations}
**Final Score:** ${session.finalScore!.toFixed(3)}

## Score History

| Iteration | Test | Score | Change |
|-----------|------|-------|--------|
${session.harnessVersions.map(v => `| ${v.version} | ${v.changes[0]} | ${v.score.toFixed(3)} | ${v.changes.find(c => c.includes('→')) || 'N/A'} |`).join('\n')}

## Key Findings

### Best Performance
- **Iteration:** ${Math.max(...session.evalResults.map((r, i) => r.overallScore * 1000 + i)) % 1000}
- **Score:** ${Math.max(...session.evalResults.map(r => r.overallScore)).toFixed(3)}
- **Task:** ${session.evalResults.find(r => r.overallScore === Math.max(...session.evalResults.map(e => e.overallScore)))?.taskId}

### Worst Performance
- **Iteration:** ${session.evalResults.findIndex(r => r.overallScore === Math.min(...session.evalResults.map(e => e.overallScore))) + 1}
- **Score:** ${Math.min(...session.evalResults.map(r => r.overallScore)).toFixed(3)}
- **Task:** ${session.evalResults.find(r => r.overallScore === Math.min(...session.evalResults.map(e => e.overallScore)))?.taskId}

## Suggestions from Judge

${[...new Set(session.evalResults.flatMap(r => r.suggestions))].map(s => `- ${s}`).join('\n')}

## Next Steps

1. Review worst-performing test cases
2. Implement judge suggestions
3. Re-run training with improved harness
`;
  
  writeFileSync(reportPath, report);
  console.log(chalk.dim(`   Report saved: ${reportPath}`));
  
  // Generate shareable results file (clean, copy-paste friendly)
  generateShareableResults(session, shareablePath);
}

/**
 * Generates a clean, shareable results file for sending to humans.
 * This is designed to be copied/pasted or attached to messages.
 */
function generateShareableResults(session: TrainingSession, outputPath: string): void {
  const avgScore = session.finalScore?.toFixed(2) || '0.00';
  const bestScore = Math.max(...session.evalResults.map(r => r.overallScore)).toFixed(2);
  const worstScore = Math.min(...session.evalResults.map(r => r.overallScore)).toFixed(2);
  
  const shareable = `# 🎯 Training Results: ${session.agentId}

**Date:** ${new Date(session.completedAt!).toLocaleDateString()}
**Iterations:** ${session.iterations}
**Average Score:** ${avgScore}/10
**Best:** ${bestScore}/10 | **Worst:** ${worstScore}/10

---

## 📊 Performance Summary

${session.harnessVersions.map((v, i) => {
  const result = session.evalResults[i];
  const emoji = result.overallScore >= 8 ? '🟢' : result.overallScore >= 6 ? '🟡' : '🔴';
  return `${emoji} **Iteration ${v.version}** — ${result.overallScore.toFixed(2)}/10
   Test: ${result.taskId}
   ${result.feedback ? 'Feedback: ' + result.feedback : ''}`;
}).join('\n\n')}

---

## 🎓 Key Learnings

### What Worked Well
${session.evalResults
  .filter(r => r.overallScore >= 7)
  .map(r => `- **${r.taskId}**: ${r.suggestions.filter(s => !s.toLowerCase().includes('improve')).join(' ') || 'Strong performance'}`)
  .join('\n') || '- No high-scoring iterations yet'}

### What Needs Improvement
${[...new Set(session.evalResults.flatMap(r => r.suggestions))].slice(0, 5).map(s => `- ${s}`).join('\n') || '- No specific suggestions'}

---

## 📋 Full Details

### Iteration Breakdown
| # | Test | Score | Status |
|---|------|-------|--------|
${session.harnessVersions.map((v, i) => {
  const result = session.evalResults[i];
  const status = result.overallScore >= 8 ? 'Good' : result.overallScore >= 6 ? 'OK' : 'Needs Work';
  return `| ${v.version} | ${result.taskId} | ${result.overallScore.toFixed(2)} | ${status} |`;
}).join('\n')}

### Top 3 Suggestions
1. ${[...new Set(session.evalResults.flatMap(r => r.suggestions))][0] || 'N/A'}
2. ${[...new Set(session.evalResults.flatMap(r => r.suggestions))][1] || 'N/A'}
3. ${[...new Set(session.evalResults.flatMap(r => r.suggestions))][2] || 'N/A'}

---

## 🚀 Next Actions

- [ ] Review iterations scored < 6
- [ ] Implement top 3 suggestions
- [ ] Re-run training with improved harness
- [ ] Compare scores to measure improvement

---

*Generated by Harness Trainer v0.1.0*
*Share this file with your team or AI assistant*
`;
  
  writeFileSync(outputPath, shareable);
  console.log(chalk.green(`   ✓ Shareable results: ${outputPath}`));
  console.log(chalk.dim(`     (Send this file to your AI assistant)`));
}

/**
 * Mutates the harness based on eval feedback.
 * 
 * This is the core "learning" mechanism.
 * 
 * Strategies:
 * 1. Edit SOUL.md instructions based on feedback
 * 2. Add/remove tools based on what was needed
 * 3. Update AGENTS.md workflows
 * 4. Add new test cases for edge cases discovered
 */
export async function mutateHarness(
  workspacePath: string,
  evalResult: EvalResult,
  action: 'keep' | 'revert' | 'modify'
): Promise<void> {
  console.log(chalk.dim(`   Mutating harness: ${action}`));
  
  // TODO: Implement harness mutation
  // This is where the magic happens - we need to:
  // 1. Parse the judge's suggestions
  // 2. Decide which changes to make
  // 3. Edit SOUL.md / AGENTS.md accordingly
  // 4. Commit the changes
  
  // For now, just log the suggestions
  console.log(chalk.dim('   Suggestions:'));
  evalResult.suggestions.forEach(s => console.log(chalk.dim(`     - ${s}`)));
}

/**
 * Reverts harness to previous version.
 */
export async function revertHarness(workspacePath: string): Promise<void> {
  console.log(chalk.dim('   Reverting harness to previous version...'));
  
  // TODO: Implement harness revert
  // This would use git to revert changes to harness files
}

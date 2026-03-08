# Harness Trainer — Status Report

**Date:** March 8, 2026  
**Version:** 0.1.0  
**Repo:** https://github.com/Christopher-Graves/harness-trainer

---

## ✅ What's Complete

### Core Infrastructure
- [x] **TypeScript project structure** with strict typing
- [x] **Zod schemas** for AgentSpec, HarnessFiles, EvalResult, TrainingSession
- [x] **CLI** with generate, train, eval, list-tests commands
- [x] **Environment config** with dotenv support
- [x] **GitHub repo** pushed and public

### Harness Generator ✅
- [x] Generates complete agent workspace from spec
- [x] Creates SOUL.md with role-based identity
- [x] Creates AGENTS.md with operational workflows
- [x] Creates MEMORY.md for active context
- [x] Creates LEARNINGS.md for self-improvement
- [x] Generates eval-suite.json with test cases
- [x] Generates runtime adapter (OpenClaw, Claude Code, custom)
- [x] Tested successfully with research-agent spec

### Judge (Evaluation Engine) ✅
- [x] Multi-dimensional scoring rubric:
  - Task Completion (40%)
  - Error Recovery (25%)
  - Clean State (20%)
  - Token Efficiency (10%)
  - Self-Learn (5%)
- [x] OpenRouter API integration
- [x] Sonnet as judge model (cost-efficient)
- [x] JSON response parsing with fallback
- [x] Detailed feedback + actionable suggestions
- [x] Eval logging to workspace/logs/

### Agent Runner ✅
- [x] Multi-runtime support (OpenClaw, Claude Code, custom)
- [x] Agent state capture (git commits, files, tests, learnings)
- [x] Timeout handling
- [x] Error recovery and logging

### Trainer ✅
- [x] Full training loop implementation
- [x] Iteration tracking with score history
- [x] Harness versioning with change tracking
- [x] Training report generation (markdown)
- [x] Results saved to JSON for analysis

### Documentation ✅
- [x] README.md with full architecture docs
- [x] QUICKSTART.md with 5-minute setup guide
- [x] .env.example with API key template
- [x] Inline code comments throughout

---

## 🔲 What Needs Implementation

### Priority 1: OpenClaw Integration
**File:** `src/trainer/agent-runner.ts`

**Current:** Uses execSync to run adapter scripts  
**Needed:** Direct integration with OpenClaw's `sessions_spawn` and `sessions_history` APIs

**Why:** The trainer needs to actually spawn agents in OpenClaw to test harnesses in the real environment.

**Implementation:**
```typescript
// Replace exec-based approach with:
const { sessions_spawn } = await import('openclaw:tools');
const session = await sessions_spawn({
  agentId: spec.agentId,
  mode: 'run',
  model: spec.model.primary,
  task: testCase.task,
  timeoutSeconds: timeoutMs / 1000,
});

// Then retrieve output:
const { sessions_history } = await import('openclaw:tools');
const history = await sessions_history({
  sessionKey: session.sessionKey,
  includeTools: true,
});
```

**Complexity:** Medium  
**Estimated time:** 1-2 hours

---

### Priority 2: Harness Mutation Engine
**File:** `src/trainer/trainer.ts`

**Current:** Logs suggestions but doesn't mutate harness  
**Needed:** Automatic editing of SOUL.md/AGENTS.md based on judge feedback

**Why:** This is the "learning" in the training loop — without mutation, scores won't improve.

**Implementation strategies:**
1. **LLM-based mutation:** Send judge feedback + current harness to Sonnet, ask for specific edits
2. **Rule-based mutation:** Pattern-match suggestions to known fixes (e.g., "add error handling" → add try/catch template)
3. **Hybrid:** LLM proposes changes, rules validate them

**Key challenge:** Avoid breaking the harness while mutating. Need rollback capability.

**Complexity:** High  
**Estimated time:** 3-4 hours

---

### Priority 3: Test Case Authoring Tools
**File:** `src/cli.ts` (new command)

**Current:** Test cases auto-generated from responsibilities  
**Needed:** Better tools for creating and managing test cases

**Commands to add:**
```bash
# Add a new test case interactively
harness-trainer add-test <workspace>

# Run a single test case
harness-trainer run-test <workspace> --test <name>

# Generate test cases from examples
harness-trainer generate-tests <workspace> --from-examples
```

**Why:** Good test cases are critical for effective training. Current auto-generation is too generic.

**Complexity:** Low-Medium  
**Estimated time:** 1-2 hours

---

### Priority 4: Dashboard / Visualization
**File:** New: `src/dashboard/`

**Current:** Markdown reports only  
**Needed:** Visual dashboard for tracking training progress

**Features:**
- Score history chart (iterations over time)
- Dimension breakdown (radar chart)
- Test case performance heatmap
- Suggestion frequency analysis
- Compare multiple training runs

**Tech:** Could be a simple web app (React + Recharts) or terminal UI (blessed-contrib)

**Complexity:** Medium-High  
**Estimated time:** 4-6 hours

---

### Priority 5: Parallel Training
**File:** `src/trainer/trainer.ts`

**Current:** Sequential iteration execution  
**Needed:** Run multiple iterations in parallel

**Why:** Training 10 iterations sequentially takes 10x the time. Parallel execution would speed up experimentation.

**Implementation:**
```typescript
// Run 5 iterations in parallel
const batchSize = 5;
for (let i = 0; i < iterations; i += batchSize) {
  const batch = Array.from({ length: batchSize }, (_, j) => i + j);
  const results = await Promise.all(
    batch.map(iter => runIteration(iter, spec, testCase))
  );
  // Aggregate results...
}
```

**Complexity:** Medium  
**Estimated time:** 2-3 hours

---

## 📊 Current Limitations

1. **No real agent execution** — Agent runner is stubbed, doesn't actually spawn OpenClaw agents
2. **No harness mutation** — Training loop tracks scores but doesn't improve the harness
3. **Generic test cases** — Auto-generated tests are too vague for meaningful evaluation
4. **No baseline comparison** — Can't compare training runs or track long-term progress
5. **No CI/CD integration** — Can't run training automatically on PR or commit

---

## 🎯 Next Steps (Recommended Order)

### Immediate (This Session)
1. **Implement OpenClaw integration** in agent-runner.ts
   - This unlocks real agent testing
   - Can manually test harnesses end-to-end

2. **Add manual mutation workflow**
   - Judge produces suggestions
   - Human reviews and edits harness
   - Re-run training to measure improvement
   - This validates the loop before automating mutation

### Short-Term (Next Session)
3. **Implement LLM-based harness mutation**
   - Send judge feedback to Sonnet
   - Get proposed edits to SOUL.md/AGENTS.md
   - Apply edits with git-based rollback

4. **Add better test case authoring**
   - Interactive CLI for adding tests
   - Example-based test generation

### Medium-Term
5. **Build dashboard** for visualization
6. **Add parallel training** for speed
7. **CI/CD integration** for automated training

---

## 🧪 Testing Strategy

### Current Testing
- Manual testing of `generate` command ✅
- No automated tests yet

### Needed Tests
- Unit tests for generator functions
- Integration tests for full training loop
- E2E tests with real OpenClaw agents
- Regression tests for harness mutations

**Framework:** Vitest (already in devDependencies)

---

## 📈 Success Metrics

### For the Framework
- **Time to first harness:** < 5 minutes (currently ~5 min ✅)
- **Training iteration speed:** < 2 min per iteration (currently N/A)
- **Score improvement rate:** >10% over 10 iterations (currently N/A)
- **Harness mutation success rate:** >80% of mutations improve scores (currently N/A)

### For Trained Agents
- **Task completion rate:** >90% on eval suite
- **Error recovery rate:** >80% of errors handled gracefully
- **Human intervention rate:** <10% of tasks require human help

---

## 🤝 How to Contribute

1. **Pick a priority item** from the "What Needs Implementation" list
2. **Create a feature branch** from main
3. **Implement + test** locally
4. **Run training session** to validate it works
5. **Submit PR** with:
   - Code changes
   - Test results (before/after scores)
   - Documentation updates

---

## 📞 Questions?

- **Docs:** See README.md and QUICKSTART.md
- **Issues:** https://github.com/Christopher-Graves/harness-trainer/issues
- **Discussions:** https://github.com/Christopher-Graves/harness-trainer/discussions

---

**Last updated:** March 8, 2026  
**Next review:** After OpenClaw integration is complete

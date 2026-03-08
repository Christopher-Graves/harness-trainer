# Quickstart Guide

Get your first agent harness trained in 5 minutes.

## Prerequisites

1. **Node.js 18+** installed
2. **OpenRouter API key** (get free at https://openrouter.ai/keys)
3. **Git** configured with SSH access to GitHub

## Setup

```bash
# Clone the repo
git clone git@github-tony:Christopher-Graves/harness-trainer.git
cd harness-trainer

# Install dependencies
npm install

# Copy .env.example to .env and add your API key
cp .env.example .env
# Edit .env and add: OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

## Step 1: Generate an Agent Harness

Use the included research agent spec:

```bash
npm run generate -- --spec specs/research-agent.json
```

This creates `agent-workspaces/research-agent/` with:
- `harness/SOUL.md` - Agent identity and rules
- `harness/AGENTS.md` - Operational workflows
- `harness/MEMORY.md` - Active context
- `harness/LEARNINGS.md` - Self-learning log
- `tests/eval-suite.json` - Test cases with scoring rubrics
- `runtime/adapter.js` - OpenClaw runtime adapter
- `spec.json` - Original spec for reference

## Step 2: Review and Customize

Edit the generated files to match your needs:

```bash
code agent-workspaces/research-agent/harness/SOUL.md
code agent-workspaces/research-agent/harness/AGENTS.md
code agent-workspaces/research-agent/tests/eval-suite.json
```

**Key files to customize:**
- **SOUL.md**: Agent's identity, rules, voice
- **AGENTS.md**: Step-by-step workflows
- **eval-suite.json**: Add/modify test cases for your agent's specific tasks

## Step 3: Run a Training Session

```bash
npm run train -- agent-workspaces/research-agent -i 5 -r openclaw
```

**Options:**
- `-i, --iterations <n>`: Number of training iterations (default: 10)
- `-r, --runtime <type>`: Runtime (openclaw | claude-code | custom)
- `-j, --judge <model>`: Judge model (default: Sonnet)
- `-t, --timeout <ms>`: Timeout per iteration (default: 300000ms)

**What happens:**
1. Loads agent workspace and test suite
2. For each iteration:
   - Picks a test case (round-robin)
   - Runs agent with current harness
   - Captures agent state (git commits, files, learnings)
   - Judge model scores output on 5 dimensions
   - Tracks score improvements/regressions
3. Generates training report with insights

## Step 4: Review Results

After training completes:

```bash
# View training report
code results/training-report-research-agent.md

# View detailed JSON results
code results/training-research-agent-<timestamp>.json

# View eval logs
code agent-workspaces/research-agent/logs/
```

**The report shows:**
- Score history across iterations
- Best/worst performing tests
- Judge suggestions for improvement
- Next steps for optimization

## Step 5: Iterate

Based on the training results:

1. **Review worst-performing tests** - What tasks did the agent struggle with?
2. **Read judge feedback** - Specific suggestions for improvement
3. **Edit harness files** - Update SOUL.md/AGENTS.md to address weaknesses
4. **Re-run training** - Compare scores to measure improvement

```bash
# After editing harness, run again
npm run train -- agent-workspaces/research-agent -i 10
```

## Commands Reference

```bash
# Generate new agent harness
npm run generate -- --spec <spec.json>

# Run training session
npm run train -- <workspace> -i 10

# Evaluate without training (single run)
npm run eval -- <workspace>

# List test cases
npm run list-tests -- <workspace>

# Show help
npm run cli -- --help
```

## Example: Creating a Custom Agent

1. **Create a spec file** (`specs/my-agent.json`):

```json
{
  "agentId": "my-agent",
  "role": "What does this agent do?",
  "responsibilities": ["task1", "task2"],
  "skills": ["skill1", "skill2"],
  "tools": [...],
  "plan": "High-level workflow",
  "runtime": "openclaw",
  "model": {
    "primary": "anthropic/claude-sonnet-4-6",
    "fallbacks": ["anthropic/claude-sonnet-4-5"]
  }
}
```

2. **Generate harness**:
```bash
npm run generate -- --spec specs/my-agent.json
```

3. **Add test cases** to `agent-workspaces/my-agent/tests/eval-suite.json`:

```json
{
  "tests": [
    {
      "name": "test-basic-task",
      "description": "What does this test?",
      "task": "Specific task description",
      "expectedOutput": "What should the agent produce?",
      "successCriteria": [
        "Criterion 1",
        "Criterion 2"
      ]
    }
  ]
}
```

4. **Train**:
```bash
npm run train -- agent-workspaces/my-agent -i 10
```

## Troubleshooting

### "OPENROUTER_API_KEY not set"
- Create a `.env` file with your key
- Or export: `export OPENROUTER_API_KEY=sk-or-v1-...`

### "Runtime adapter not found"
- Make sure `runtime/adapter.js` exists in workspace
- Or use `-r claude-code` for Claude Code CLI runtime

### "Agent failed: timeout"
- Increase timeout: `-t 600000` (10 minutes)
- Or optimize agent to complete tasks faster

### Low scores on specific dimensions
- **Task Completion**: Improve SOUL.md instructions
- **Error Recovery**: Add error handling workflows to AGENTS.md
- **Clean State**: Ensure agent commits git, updates LEARNINGS.md
- **Token Efficiency**: Reduce verbosity in SOUL.md
- **Self-Learn**: Add mandatory LEARNINGS.md updates to AGENTS.md

## Next Steps

- **Read the full README.md** for architecture details
- **Study the research agent spec** in `specs/research-agent.json`
- **Join the discussion**: https://github.com/Christopher-Graves/harness-trainer/issues
- **Contribute**: PRs welcome for new features!

---

**Happy Training! 🎯**

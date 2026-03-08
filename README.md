# Harness Trainer

**Autonomous agent harness training framework** — inspired by [Karpathy's AutoResearch](https://github.com/karpathy/autoresearch) and [Anthropic's effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

Instead of training model weights, we train **agent harnesses**: the prompts, workflows, tool configurations, and evaluation suites that make agents effective at their roles.

## What This Does

Given an **Agent Spec** (role, responsibilities, skills, tools, plan), Harness Trainer:

1. **Generates** a complete agent workspace with SOUL.md, AGENTS.md, MEMORY.md, tests, and runtime adapters
2. **Runs eval loops** where the agent attempts tasks while a Judge model scores performance
3. **Mutates the harness** based on feedback, keeping improvements
4. **Outputs** a battle-tested harness ready for production use with frontier models

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Input: Agent Spec                                      │
│  { role, responsibilities, skills, tools, plan }        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Harness Generator                                      │
│  - SOUL.md (identity + rules)                          │
│  - AGENTS.md (operations)                              │
│  - tests/ (eval suite)                                 │
│  - runtime/ (adapter for OpenClaw/Claude Code/custom)  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Training Loop                                          │
│  1. Generate task from feature list                    │
│  2. Run agent with current harness                     │
│  3. Judge model scores output                          │
│  4. Mutate harness if score improved                   │
│  5. Log learnings, repeat                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Output: Battle-tested harness + score history          │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Generate a new agent workspace from a spec
npm run generate -- --spec ./specs/research-agent.json

# Run a training session
npm run train -- --workspace ./agent-workspaces/research-agent --iterations 10

# Evaluate a harness against a test suite
npm run eval -- --workspace ./agent-workspaces/research-agent
```

## Project Structure

```
harness-trainer/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── generator/          # Harness file generation
│   ├── trainer/            # Training loop orchestration
│   ├── judge/              # Scoring/evaluation logic
│   ├── runtime/            # Runtime adapters (OpenClaw, Claude Code, etc.)
│   └── types/              # TypeScript types + Zod schemas
├── specs/                  # Example agent specs
├── templates/              # Harness file templates
├── agent-workspaces/       # Generated agent workspaces (gitignored)
└── output/                 # Training outputs (gitignored)
```

## Scoring Rubric

Agents are scored on five dimensions:

| Metric | Weight | Description |
|--------|--------|-------------|
| **Task Completion** | 40% | % of defined features/subtasks completed |
| **Error Recovery** | 25% | # errors encountered → # successfully resolved |
| **Clean State** | 20% | Git commits, progress files, tests passing |
| **Token Efficiency** | 10% | Tokens used vs. baseline for same task |
| **Self-Learn** | 5% | LEARNINGS.md updated with actionable insights |

## Runtime Adapters

Harness Trainer is runtime-agnostic. Built-in adapters:

- **OpenClaw** — Full integration with OpenClaw agent framework
- **Claude Code** — For standalone Claude Code projects
- **Custom** — Bring your own runtime adapter

## License

MIT

---

*"The Architect doesn't build products. The Architect builds the builders."*

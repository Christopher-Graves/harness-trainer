# Harness Trainer — Simple Agent Training

**Train AI agents to get better at specific tasks through iterative testing.**

---

## **Quick Start (5 Minutes)**

### **1. Clone & Install**

```bash
# On your Mac or PC
git clone https://github.com/Christopher-Graves/harness-trainer.git
cd harness-trainer
npm install
```

### **2. Set API Key (for Judge only)**

The Judge needs an API key to score agent outputs. Agent being trained can use local models.

```bash
# Get key from: https://openrouter.ai/keys
cp .env.example .env
# Edit .env and add your key:
# OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### **3. Generate an Agent**

```bash
# Use built-in example or create your own spec
npm run generate -- specs/linkedin-writer.json
```

This creates: `agent-workspaces/linkedin-writer/`

### **4. Train the Agent**

```bash
# Run 3 training iterations
npm run train -- agent-workspaces/linkedin-writer -i 3
```

**What happens:**
- Spawns agent with test tasks
- Judge scores each output (1-10)
- Shows you what worked/didn't
- Saves results to `results/` folder

### **5. Review Results**

```bash
# See all training runs
npm run list

# View latest results
cat results/linkedin-writer-YYYY-MM-DD.md
```

---

## **Commands**

### **Generate Agent**
```bash
npm run generate -- specs/your-agent.json
```

### **Train Agent**
```bash
# Basic: 3 iterations
npm run train -- agent-workspaces/your-agent

# Advanced: 10 iterations, specific model
npm run train -- agent-workspaces/your-agent -i 10 -m ollama/llama3:8b
```

### **Evaluate Once**
```bash
# Run judge on existing agent output
npm run eval -- agent-workspaces/your-agent
```

### **List Results**
```bash
# Show all training sessions
npm run list
```

---

## **Create Your Own Agent Spec**

Create a JSON file in `specs/`:

```json
{
  "agentId": "my-agent",
  "role": "What it does",
  "responsibilities": [
    "Task 1",
    "Task 2",
    "Task 3"
  ],
  "tools": [
    {
      "name": "tool-name",
      "type": "api or internal",
      "description": "What it does"
    }
  ],
  "plan": "Step 1 → Step 2 → Step 3",
  "runtime": "openclaw or claude-code",
  "model": {
    "primary": "anthropic/claude-sonnet-4-6",
    "fallbacks": ["ollama/llama3:8b"]
  }
}
```

Then: `npm run generate -- specs/my-agent.json`

---

## **How Training Works**

```
┌─────────────────────────────────────────────────────────┐
│  1. GENERATE                                            │
│     Spec → SOUL.md, AGENTS.md, Tests                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. RUN AGENT                                           │
│     Spawns agent with test tasks                        │
│     Can use: Local models (Ollama) or API (Sonnet)      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. JUDGE OUTPUT                                        │
│     Scores on: Completion, Tone, Value, Efficiency      │
│     Uses: OpenRouter API (Sonnet, cheap)                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. SHOW RESULTS                                        │
│     Score: 6.2/10                                       │
│     Feedback: "Hook weak, add vulnerability"            │
│     You edit harness → Run again → Score improves       │
└─────────────────────────────────────────────────────────┘
```

---

## **Using Local Models**

### **For Agent Training (Free)**
```bash
# If you have Ollama running locally
npm run train -- agent-workspaces/my-agent -m ollama/llama3:8b
```

### **For Judge (Needs API)**
The Judge **must** use an API model (can't be local) because:
- Needs to be objective third party
- Can't have same blind spots as agent being trained
- Uses cheap model (Sonnet ~$0.01 per eval)

**Supported local runtimes:**
- `ollama/llama3:8b`
- `ollama/mistral:7b`
- `ollama/qwen2.5:7b`
- Any Ollama model you have running

---

## **Example Training Session**

```bash
# Generate LinkedIn Writer
npm run generate -- specs/linkedin-writer.json

# Train it (uses your .env API key for Judge)
npm run train -- agent-workspaces/linkedin-writer -i 5

# Output:
# Iteration 1: Score 5.8/10 — Hook too generic
# Iteration 2: Score 6.4/10 — Better, still sounds AI-ish
# Iteration 3: Score 7.1/10 — Good! More specific examples
# ...
# Results saved to: results/linkedin-writer-2026-03-08.md
```

---

## **What Gets Generated**

```
agent-workspaces/your-agent/
├── harness/
│   ├── SOUL.md       # Agent's identity & rules
│   ├── AGENTS.md     # How to operate
│   ├── MEMORY.md     # Active context
│   └── LEARNINGS.md  # Session log
├── tests/
│   └── eval-suite.json  # Test cases
├── runtime/
│   └── adapter.js       # Runtime integration
└── spec.json            # Original spec
```

---

## **Next Steps After Training**

1. **Review results** — See what improved, what didn't
2. **Edit harness** — Tweak SOUL.md based on Judge feedback
3. **Re-train** — Run again to validate improvements
4. **Deploy** — Copy harness to your actual OpenClaw workspace

---

## **Troubleshooting**

### **"OPENROUTER_API_KEY not set"**
```bash
cp .env.example .env
# Edit .env and add: OPENROUTER_API_KEY=sk-or-v1-...
```

### **"Agent not found"**
```bash
# Make sure you generated it first
npm run generate -- specs/your-agent.json
```

### **"Model not available"**
```bash
# For local models, make sure Ollama is running:
ollama serve

# Or use API model:
npm run train -- agent-workspaces/agent -m anthropic/claude-sonnet-4-6
```

---

## **Contributing**

1. Fork repo
2. Create feature branch
3. Test with real agent
4. Submit PR with before/after scores

---

**Built for:** Testing and improving AI agent instructions through iterative training.

**Status:** Alpha — Core loop works, automation coming soon.

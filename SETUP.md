# 🚀 Setup Guide — Harness Trainer

## Quick Setup (2 Minutes)

### Step 1: Get OpenRouter API Key

1. Go to: https://openrouter.ai/keys
2. Sign in (Google/GitHub)
3. Create a new key
4. Copy the key (starts with `sk-or-v1-`)

### Step 2: Add to .env File

```bash
# In your harness-trainer folder:
cd harness-trainer

# Create .env file with your key:
echo "OPENROUTER_API_KEY=sk-or-v1-YOUR-ACTUAL-KEY-HERE" > .env
```

**Or manually create `.env` file:**
```
OPENROUTER_API_KEY=sk-or-v1-YOUR-ACTUAL-KEY-HERE
```

### Step 3: Test It Works

```bash
# Run a quick 2-iteration training:
npm run quick -- specs/linkedin-writer.json 2
```

**Expected output:**
```
🚀 Quick Train — Harness Trainer
Step 1: Loading spec...
Step 2: Generating harness...
Step 3: Training agent (2 iterations)...

📍 Iteration 1/2
🤖 Running agent...
✓ Completed in 3421ms
🔍 Evaluating...
✓ Overall: 7.234

✅ Training Complete!
Average Score: 7.1/10
📎 Shareable results: results/linkedin-writer-results.md
```

---

## Cost Estimate

**Per training session (5 iterations):**
- Agent execution: ~$0.05-0.10 (Sonnet)
- Judge scoring: ~$0.02-0.05 (Sonnet)
- **Total: ~$0.10-0.15 per session**

**To reduce costs:**
- Use local models for agent (Ollama) — FREE
- Keep Judge on API (needs objectivity) — ~$0.02 per eval

---

## Using Local Models (Optional)

If you have Ollama running:

1. **Edit the spec** (`specs/linkedin-writer.json`):
```json
{
  "model": {
    "primary": "ollama/llama3:8b"
  }
}
```

2. **Make sure Ollama is running:**
```bash
ollama serve
```

3. **Train (agent is free, judge still needs API key):**
```bash
npm run quick -- specs/linkedin-writer.json 5
```

---

## Troubleshooting

### "OPENROUTER_API_KEY not set"
```bash
# Check .env file exists:
cat .env

# Should show:
# OPENROUTER_API_KEY=sk-or-v1-xxxxx

# If not, create it:
echo "OPENROUTER_API_KEY=sk-or-v1-your-key" > .env
```

### "Model not found" (for local models)
```bash
# Pull the model first:
ollama pull llama3:8b

# Or use API model:
# Edit spec to use: "anthropic/claude-sonnet-4-6"
```

### "Workspace already exists"
```bash
# Remove old workspace:
rm -rf agent-workspaces/linkedin-writer

# Or use --force:
npm run generate -- specs/linkedin-writer.json --force
```

---

## What You Get

After training, you'll have:

1. **`results/linkedin-writer-results.md`** — Shareable results file
   - Send this to your AI assistant
   - Shows scores, feedback, suggestions

2. **`agent-workspaces/linkedin-writer/harness/`** — Agent files
   - SOUL.md, AGENTS.md, MEMORY.md, LEARNINGS.md
   - Edit these based on feedback

3. **`results/training-report-*.md`** — Full technical report
   - Detailed breakdown of each iteration

---

## Next Steps After Training

1. **Open** `results/linkedin-writer-results.md`
2. **Read** the judge's feedback
3. **Edit** `harness/SOUL.md` to address weaknesses
4. **Re-run** training to see if scores improve
5. **Repeat** until you're happy with performance

---

**Questions?** See `README.md` for full docs or `EXAMPLE-RESULTS.md` for sample output.

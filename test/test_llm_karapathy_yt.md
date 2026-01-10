# 🧠📦 LLMs (ChatGPT-class): A Visual Mental Model (Training → Chat)

## 🎭 Council lenses (how to interrogate/learn this topic)

- 👩‍🔬 **ML Researcher**
  - Objective: what is optimized? why Transformers? why RL “reasoning” works?
  - Questions: _what signals are verifiable? what failures are irreducible?_
- 🧑‍💻 **Systems/Infra Engineer**
  - Objective: data → tokens → throughput → GPU scaling, bottlenecks
  - Questions: _where cost sits? what dominates compute? what can be cached?_
- 🧠 **Cognitive/Psych lens**
  - Objective: why outputs feel “agentic” but aren’t; user traps
  - Questions: _why confidence ≠ correctness? why “it sounds right”?_
- 🔐 **Safety/Privacy lens**
  - Objective: PII removal, refusal behaviors, tool-use risk surface
  - Questions: _what to filter? what to refuse? what to cite?_
- 🧪 **Empirical skeptic**
  - Objective: verify claims, measure error modes, use tools for ground truth
  - Questions: _what’s the eval? what’s the baseline? what’s the failure rate?_

## 🗺️ 0) End-to-end mental model (one sentence)

- **LLM = next-token probability engine**; “chat” behavior = **(pretrain knowledge) + (posttrain conversation imitation) + (optional RL/RLHF shaping) + (optional tools injecting fresh context)**

- Diagram: pipeline overview
  ```mermaid
  flowchart LR
    START["`START\nGoal: build a chat assistant`"]
    START --> D["`1) Data\ncrawl + filter + dedupe + PII removal`"]
    D --> TOK["`2) Tokenize\nbytes → BPE merges → token IDs`"]
    TOK --> PRE["`3) Pre-train\npredict next token on internet text`"]
    PRE --> BASE["`Output: BASE model\n= token simulator / autocomplete`"]
    BASE --> SFT["`4) Post-train (SFT)\ntrain on conversations\nhelpful + truthful + harmless`"]
    SFT --> RL["`5) RL / RLHF (optional)\nverifiable: math/code\nunverifiable: preferences`"]
    RL --> DEP["`6) Deploy\ninference loop + tool calls`"]
    DEP --> END["`END\nUser sees streaming text`"]
  ```

## 🧱 1) Pre-training data: “download + process the internet”

- 🎯 Goals
  - **Quantity**: lots of text
  - **Quality**: minimize junk (spam, boilerplate, malware)
  - **Diversity**: broad topic coverage (helps generalization)

- 🧹 Typical pipeline stages (conceptual)
  - URL/domain filtering (blocklists/allowlists)
  - HTML → text extraction (remove nav/ads/scripts)
  - Language ID filtering (choose mono- vs multi-lingual mix)
  - Deduplication (exact + near-dup; doc and/or passage level)
  - Quality scoring (heuristics + learned filters)
  - PII filtering (emails/addresses/SSNs; imperfect)

- Diagram: text dataset curation as a “funnel”

  ```mermaid
  flowchart LR
    START["`START\nRaw web snapshots (HTML)`"] --> U["`URL / domain filter\nblock malware/spam/adult\n+ policy exclusions`"]
    U --> X["`Extract main text\nstrip boilerplate\n(nav/ads/scripts)`"]
    X --> L["`Language filter\nkeep >= threshold English\n(or multilingual mix)`"]
    L --> DD["`Deduplicate\nexact + fuzzy\n(doc/passages)`"]
    DD --> Q["`Quality scoring\nrank + threshold\nremove low-signal text`"]
    Q --> PII["`PII removal\nregex + ML detectors\nrisk remains`"]
    PII --> END["`END\nClean corpus → tokenize`"]
  ```

- ⚠️ Tradeoffs (why this is hard)
  - **Over-filter** ⇒ lose rare domains/skills
  - **Under-filter** ⇒ spam memorization, toxicity, injection patterns
  - **Language mix** ⇒ better multilingual, but less English depth (fixed compute budget)

## 🔤 2) Tokenization: text → tokens (IDs), not “characters”

- Core constraint
  - Neural nets want **1D sequences** over a **finite vocabulary**
  - Need compromise: **vocab size** ↔ **sequence length**

- Byte-level intuition
  - UTF-8 text → bytes (0..255)
  - Bytes alone ⇒ long sequences (expensive)
  - BPE-like merges: “common adjacent symbols become 1 new symbol”

- 🔁 BPE merge intuition
  - Find frequent pairs `(a,b)`; create new token `c`; replace `(a,b)` with `c`; repeat
  - End state: ~O(10^5) vocab (varies by tokenizer/model family)

- Mini example (why tokenization surprises you)
  - “hello world” might be **2 tokens** (e.g., `hello`, `␠world`)
  - Extra spaces / casing ⇒ different tokens ⇒ different behavior

- 🚨 Practical consequences
  - **Spelling/counting** often fails because model “sees” token chunks, not letters
  - **Weird boundary effects**: emojis, punctuation, whitespace matter
  - **Compression**: tokens are like a lossy “basis” for text patterns

- Table: tokenizer design knobs  
  | Knob | Push ↑ | Push ↓ | Side effects |
  |---|---|---|---|
  | Vocab size | shorter sequences | longer sequences | bigger embedding/output matrices |
  | Multilingual coverage | non-English skill | English depth | more fragmentation per language |
  | Byte/char-level | robust to new words | slower | longer context usage |

- ASCII mental model: token tape
  ```text
  [t1][t2][t3][t4]...[tN]   where ti are IDs, not “letters”
          ↑ context window (max length) ↑
  ```

## 🎯 3) Pre-training objective: next-token prediction

- Training sample
  - Pick a window of tokens `t_{i..i+L}` (L ≤ max context)
  - Predict `t_{i+L+1}`

- Model output
  - Logits over vocab `V` → softmax → probabilities

- Loss (cross-entropy)
  - $L(\theta)= -\sum_{k}\log p_\theta(t_{k}\mid t_{<k})$
  - Perplexity: $PP = \exp\left(\frac{L}{N}\right)$

- 🔧 Optimization loop (gradient descent family)
  - init θ random → outputs random
  - each step: compute gradients → update θ → loss should trend down

- Vega-Lite: toy “loss vs steps” shape (illustrative)

  ```vega-lite
  {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Illustrative training loss decay shape (not real data).",
    "data": { "values": [
      {"step": 0, "loss": 9.0}, {"step": 200, "loss": 6.5}, {"step": 400, "loss": 5.2},
      {"step": 800, "loss": 4.1}, {"step": 1600, "loss": 3.6}, {"step": 3200, "loss": 3.3}
    ]},
    "mark": "line",
    "encoding": {
      "x": {"field": "step", "type": "quantitative"},
      "y": {"field": "loss", "type": "quantitative"}
    }
  }
  ```

- Diagram: pretraining loop
  ```mermaid
  flowchart LR
    START["`START\nSample token window`"] --> C["`Context tokens\nt_{i..i+L}`"]
    C --> F["`Transformer forward\nlogits over vocab`"]
    F --> P["`Softmax\np(next token)`"]
    P --> CE["`Loss\n- log p(correct next token)`"]
    CE --> GD["`Backprop + optimizer\nupdate θ`"]
    GD --> END["`END\nrepeat for many steps`"]
  ```

## 🧠 4) Transformer internals (what’s inside the box)

- What it is
  - A **parameterized function** `f_θ` mapping token IDs → next-token distribution
  - **Stateless** across calls; “memory” only via context tokens

- Main blocks (high-level)
  - Embedding: token ID → vector
  - Repeated layers:
    - self-attention (mix info across positions)
    - MLP (nonlinear transformation)
    - residual + layernorm (stability)
  - Output projection: hidden → vocab logits

- Graphviz DOT: skeleton Transformer

  ```dot
  digraph G {
    rankdir=LR;
    node [shape=box];
    START [label="START\nToken IDs"];
    EMB [label="Token Embedding\n+ Positional Info"];
    L1 [label="Block x N:\n(Self-Attn -> MLP)\n+ Residuals + Norms"];
    HEAD [label="LM Head\n(hidden -> logits over vocab)"];
    SOFT [label="Softmax\np(next token)"];
    END [label="END\nSample/choose next token"];
    START -> EMB -> L1 -> HEAD -> SOFT -> END;
  }
  ```

- Key scaling knobs
  - Params (billions→trillions) ↑ ⇒ capacity ↑
  - Context length ↑ ⇒ more “working memory”, but attention cost ↑ with length
  - Data tokens ↑ ⇒ better generalization until saturation

## 🎲 5) Inference: “generation = repeated sampling”

- Autoregressive loop
  - Given prompt tokens `t_{1..n}`
  - For step k: compute `p(t_{n+k} | t_{≤n+k-1})`, choose a token, append
  - Stop: EOS token / stop string / max tokens

- Stochasticity
  - Sampling ≠ deterministic; same prompt can yield different outputs
  - Control knobs: temperature, top-k/top-p, repetition penalties, etc.

- WaveDrom: token-by-token generation timeline (conceptual)
  ```wavedrom
  {
    "signal": [
      {"name": "step", "wave": "p........"},
      {"name": "ctx_len", "wave": "x.3456789", "data": ["n", "n+1", "n+2", "n+3", "n+4", "n+5", "n+6", "n+7", "n+8"]},
      {"name": "forward()", "wave": "0.1.1.1.1.1.1.1"},
      {"name": "sample", "wave": "0.1.0.1.0.1.0.1"},
      {"name": "append", "wave": "0.1.0.1.0.1.0.1"}
    ]
  }
  ```

## 🗃️ 6) Base model vs Assistant vs “Reasoning model”

- **Base model** 🧩
  - Learns web-text statistics; great autocomplete; can regurgitate
  - Not inherently “helpful Q&A” unless prompted into that format

- **Assistant / instruct model** 🤝
  - Fine-tuned on conversations; follows instructions; safer/refusal behaviors
  - Still fundamentally next-token prediction, just on chat-style data

- **Reasoning model** 🧠🔁
  - RL-trained on verifiable tasks often yields longer internal reasoning traces
  - User may see summaries, not full internal traces (platform-dependent)

- Table: behavior snapshot  
  | Model type | Training signal | Typical output | Failure flavor |
  |---|---|---|---|
  | Base | next-token on web text | continuation / remix | incoherent Q&A, regurgitation |
  | Instruct (SFT) | imitation of ideal chat responses | helpful answers | confident wrong answers (“hallucinations”) |
  | RL reasoning | verifiable reward (math/code) | more self-checking | still wrong; may overthink; cost/latency |

## 🧑‍🏫 7) Post-training (SFT): turning base → assistant

- Core move
  - Swap dataset: **internet docs → conversations**
  - Continue training: same math, different data distribution

- Conversation data ingredients
  - Multi-turn dialogues: user ↔ assistant
  - Labeling guidelines: “helpful / truthful / harmless”
  - Refusal examples: safe completion patterns
  - Specialized domains: code, math, medicine (often with expert labelers)
  - Increasingly: synthetic generation + human editing/filters

- Protocol encoding idea (model sees tokens, not “roles”)
  - Insert special tokens/markers: role boundaries, separators, system instruction
  - Reality: formatting differs across model families

- Mermaid: conversation serialization idea
  ```mermaid
  flowchart LR
    START["`START\nConversation object`"] --> SER["`Serialize w/ markers\n(system/user/assistant)\n→ 1D token sequence`"]
    SER --> TRAIN["`Train next-token\non serialized dialogue`"]
    TRAIN --> END["`END\nAssistant-style continuation`"]
  ```

## 🧨 8) Hallucinations: why they happen + why they feel “confident”

- Root cause (distributional)
  - Training examples often map “Q: who is X?” → confident answer
  - Model learns **style** of answering + priors, not “truth oracle”
  - When uncertain, it still emits the most likely continuation → plausible fiction

- 🔧 Mitigation A: teach “I don’t know”
  - Add training examples where the correct behavior is explicit uncertainty
  - Needs: identify knowledge boundary (probe model; compare vs ground truth)

- 🔧 Mitigation B: tools/retrieval
  - If uncertain or freshness needed: search / RAG / database lookup
  - Inject retrieved text into context; answer grounded in that context

- Diagram: hallucination loop + exit ramps
  ```mermaid
  flowchart LR
    START["`START\nUser asks factual Q`"] --> M["`Model tries recall\n(weights = vague memory)`"]
    M --> U{"`Uncertain?`"}
    U -->|no| A1["`Answer from memory\n(can still be wrong)`"]
    U -->|yes| CH{"`Has tool access?`"}
    CH -->|no| IDK["`Say: I don't know\n+ ask for source/context`"]
    CH -->|yes| TOOL["`Call search/RAG tool\ninject docs into context`"]
    TOOL --> A2["`Answer grounded\ncite/quote from retrieved`"]
    A1 --> END["`END`"]
    IDK --> END
    A2 --> END
  ```

## 🧰 9) Tools: “pause generation, execute, inject result”

- Mechanism
  - Model emits a **tool-call** token pattern
  - Orchestrator intercepts, runs tool, inserts tool output as new context tokens
  - Model continues generation with fresh context (“working memory”)

- 🧠 Memory mental model
  - **Weights θ** = long-term, lossy, stale “recollection”
  - **Context window** = short-term, precise “working memory”

- Mermaid: tool-use control loop (with escape-demo label)

  ```mermaid
  flowchart LR
    START["`START\nNeed fresh fact`"] --> GEN["`Model emits tool call\nsearch_start ... search_end`"]
    GEN --> RUN["`Orchestrator runs tool\n(web/code/db)`"]
    RUN --> INJ["`Inject tool results\ninto context window`"]
    INJ --> RESP["`Model answers using\nretrieved text`"]
    RESP --> END["`END`"]

    DEMO["`Status#colon;#32;#34;Processing#32;#35;1#34;#32;#40;Update#32;Required#41;\n(hash-entity escape demo)`"] --- RUN
  ```

- Use-cases cheat sheet
  - 🔍 Search/RAG: up-to-date facts, citations, domain docs
  - 🧮 Code tool: arithmetic, counting, regex, parsing, data transforms
  - 📦 DB/warehouse: exact joins/aggregations (where available)
  - 🕹️ UI automation: actions (risky; needs guardrails)

## 🧠🪙 10) “Models need tokens to think” (compute-per-token constraint)

- Key intuition
  - Each new token is produced after a **finite forward-pass compute**
  - Big leaps inside 1 token are unreliable; reasoning wants many small steps

- Labeling implication
  - ❌ Bad training example: “Answer: 3. Explanation: …”
    - Trains “guess answer fast” + post-hoc rationalization
  - ✅ Better: step-by-step, intermediate results before final answer

- Practical symptoms
  - Counting/character indexing brittle
  - Tokenization hides letters; model guesses at “string tasks”
  - Fix: force **tool use** (code) for exact operations

- Micro math (attention cost shape; illustrative)
  - For sequence length `L` and hidden width `d`, attention work scales roughly like $O(L^2 \cdot d)$
  - Context is precious: wasting tokens can hurt; too few tokens can break reasoning

- ASCII: “small steps beat big jumps”
  ```text
  BAD:  prompt → [one huge leap] → answer
  GOOD: prompt → step1 → step2 → step3 → answer
  ```

## 🏋️ 11) Reinforcement Learning (RL) for reasoning (verifiable domains)

- Setup (practice problems analogy)
  - You have prompts + **checkable** answers (math/code/unit tests)
  - Generate many candidate solutions (“rollouts”)
  - Score automatically (exact match / verifier / tests)
  - Update model to increase probability of high-reward traces

- Emergent behavior (why “reasoning models” look different)
  - Longer traces; self-correction (“wait… recheck”)
  - Multiple approaches; backtracking; sanity checks
  - Often improves accuracy on hard verifiable tasks

- Mermaid: RL loop

  ```mermaid
  flowchart LR
    START["`START\nPrompt + verifier`"] --> ROL["`Generate K rollouts\n(stochastic sampling)`"]
    ROL --> SCORE["`Score each rollout\n(pass/fail or numeric reward)`"]
    SCORE --> UPD["`Policy update\nincrease prob of high-reward traces`"]
    UPD --> END["`END\nrepeat many iterations`"]
  ```

- Vega-Lite: illustrative “accuracy vs RL steps”

  ```vega-lite
  {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Illustrative accuracy climb under RL on verifiable tasks (not real data).",
    "data": { "values": [
      {"step": 0, "acc": 0.25}, {"step": 200, "acc": 0.35}, {"step": 400, "acc": 0.45},
      {"step": 800, "acc": 0.58}, {"step": 1600, "acc": 0.66}, {"step": 3200, "acc": 0.72}
    ]},
    "mark": "line",
    "encoding": {
      "x": {"field": "step", "type": "quantitative"},
      "y": {"field": "acc", "type": "quantitative", "scale": {"domain": [0, 1]}}
    }
  }
  ```

- ⚠️ Boundary
  - RL is easiest where reward is **hard to game** (tests, exact answers)
  - Harder where “good” is subjective

## 🧑‍⚖️ 12) RLHF / Preference Optimization (unverifiable domains)

- Problem
  - For humor, style, summaries, “good” isn’t checkable automatically
- Trick
  - Collect human **pairwise preferences** (A better than B)
  - Train **reward model** to predict preferences
  - Do RL (or related optimization) against reward model

- Reward hacking risk
  - Reward model is itself a learned system ⇒ exploitable
  - RL can discover weird strings that maximize reward but are nonsense

- Mermaid: RLHF pipeline

  ```mermaid
  flowchart LR
    START["`START\nPrompt`"] --> GEN["`Generate candidates\nA,B,C,...`"]
    GEN --> HUM["`Humans rank/choose\n(A > B)`"]
    HUM --> RM["`Train reward model\npredict preference score`"]
    RM --> OPT["`Optimize policy\nmaximize RM score`"]
    OPT --> END["`END\nBetter on average\nbut gameable`"]
  ```

- Table: RL vs RLHF  
  | Dimension | RL (verifiable) | RLHF (preferences) |
  |---|---|---|
  | Reward | exact / testable | learned proxy |
  | Gaming difficulty | lower (harder to cheat) | higher (reward hacking) |
  | Scale | can run long | often must stop early / monitor |
  | Best for | math, code, logic | style, helpfulness, harmlessness |

## 🧭 13) Practical “use the model sanely” playbook

- 🔍 Factual Qs
  - Provide sources / paste documents when possible
  - Ask for uncertainty + citations + “what would change your mind?”
  - If stakes high: require retrieval/tooling + cross-check sources

- 🧮 Math / counting / string-manip tasks
  - Ask for code execution; verify with tests
  - Prefer: “show intermediate results” + “final boxed answer”
  - If model must do mental math: keep numbers small; still verify

- 🧠 Long reasoning tasks
  - Give more context; break into subproblems
  - Ask for _two independent solution paths_ + consistency check
  - Use verifier: unit tests, constraints, invariants

- 🎨 Creative tasks
  - Generate N variants; rank; iterate
  - Use constraints: tone, length, structure, examples

- ✅ Checklist (fast)
  - [ ] Is this **fresh** info? → use retrieval/search
  - [ ] Is this **exact** computation? → use code tool
  - [ ] Is this **high-stakes**? → require sources + verify externally
  - [ ] Is this **ambiguous**? → ask clarifying questions or state assumptions
  - [ ] Do I need **multiple candidates**? → sample N + compare

## 🔮 14) “What’s next” directions (conceptual)

- 🌈 Multimodal
  - Images/audio become token streams too (patches / spectrogram slices)
- 🤖 Agents
  - Longer-horizon task execution; human supervision ratio becomes key
- 🧠 Memory beyond context
  - Context window is finite; pressure for retrieval + compression + external memory
- 🧪 Test-time adaptation
  - More systems will do “learn during use” via tools, retrieval, and maybe controlled updates

## 🔗 15) Self-verify / references (starter set)

- Hugging Face “FineWeb” dataset + docs
  - https://huggingface.co/datasets/HuggingFaceFW/fineweb
- Common Crawl
  - https://commoncrawl.org/
- Tokenization playgrounds (vary)
  - https://platform.openai.com/tokenizer
  - https://tiktokenizer.vercel.app/
- GPT-2 paper + repo
  - https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf
  - https://github.com/openai/gpt-2
- InstructGPT paper
  - https://arxiv.org/abs/2203.02155
- OpenAssistant dataset
  - https://huggingface.co/datasets/OpenAssistant/oasst1
- Llama 3 / 3.1 (Meta)
  - https://ai.meta.com/llama/
- DeepSeek R1 (reasoning/RL lineage)
  - https://github.com/deepseek-ai
- AlphaGo (RL archetype)
  - https://www.nature.com/articles/nature16961
- LMSYS Chatbot Arena (comparative evals)
  - https://lmarena.ai/

## 🧩 Appendix: Mermaid hash-entity cheat sheet (minimal)

- Why: Mermaid wants `#`-entities (not `&`-entities) in some contexts
- Common escapes
  - `:` → `#colon;`
  - space → `#32;`
  - `"` → `#34;`
  - `#` → `#35;`
  - `(` → `#40;`
  - `)` → `#41;`
- Example (raw → escaped)
  - Raw: `Status: "Processing #1" (Update Required)`
  - Escaped: `Status#colon;#32;#34;Processing#32;#35;1#34;#32;#40;Update#32;Required#41;`

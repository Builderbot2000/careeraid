---
layout: default
title: Development Process
nav_order: 6
---

# Development Process

{: .no_toc }

CareerAid is built using an AI-native development loop — a structured workflow that integrates LLM assistance at each phase while keeping human judgment at the decision gates that matter.

<details open markdown="block">
  <summary>Contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Flowchart

```mermaid
flowchart TD
    IN[/"📥 Raw Inputs · /docs/inputs.md"/]

    subgraph SPEC["2 · Requirements & Spec"]
        S1[Draft spec with AI] --> S2["Review & refine [H]"]
        S2 --> S3[Convert to acceptance criteria]
        S3 --> S4{Experiment\nor Feature?}
        S4 -->|Experiment| S5["Create spike/* branch [O]"]
    end

    subgraph TEST["3 · Test Definition"]
        T1[Generate tests with AI] --> T2["Add behavioral & adversarial cases [H]"]
        T2 --> T3[Commit tests first]
    end

    subgraph IMPL["4 · Implementation"]
        I1["Create feature/* branch"] --> I2[Implement with AI]
        I2 --> I3{Tests green?}
        I3 -->|No| I2
        I3 -->|Yes| I4[Refactor continuously]
    end

    subgraph INT["5 · Integration"]
        G1[Commit with spec refs] --> G2[Open PR]
        G2 --> G3["Code review [H]"]
        G3 --> G4[Merge to main]
    end

    subgraph REL["6 · Release"]
        R1[Build & deploy beta] --> R2["Staged rollout / feature flags [O][S]"]
    end

    subgraph OBS["7 · Feedback & Observability"]
        O1["Collect logs, errors & user feedback\n→ /docs/feedback.md"] --> O2[Review metrics & system behavior]
    end

    DG{"8 · Decision Gate\nEvaluate success criteria [H]"}

    subgraph ITER["9 · Iteration"]
        IT1["Update spec & backlog\n→ /docs/decisions.md"]
    end

    DONE(["✅ Promote"])

    IN --> SPEC
    S4 -->|Feature| TEST
    S5 --> TEST
    TEST --> IMPL
    IMPL --> INT
    INT --> REL
    REL --> OBS
    OBS --> DG
    DG -->|Promote| DONE
    DG -->|Rollback| REL
    DG -->|Iterate| ITER
    ITER --> SPEC
```

**Legend:** `[H]` Human required · `[O]` Optional · `[S]` Scale-related

---

## Loop Steps

### 1. Input Collection

Capture raw inputs (notes, user feedback, ideas) into `/docs/inputs.md`.

### 2. Requirements & Spec

1. Draft requirements/spec in `/docs/spec.md` using AI assistance.
2. **[H]** Review and refine spec for clarity, scope, and testability.
3. Convert requirements into explicit, testable acceptance criteria within the spec.
4. Classify items (validated / hypothesis / speculative) and decide: experiment vs full feature.
5. **[O]** Create a `spike/*` branch for low-confidence experiments.

### 3. Test Definition

1. Generate initial test cases via AI into `/tests/*`.
2. **[H]** Review tests and add behavioral and adversarial cases.
3. Commit tests first — they establish the baseline contract.

### 4. Implementation

1. Create a `feature/*` branch.
2. Implement using AI assistance (editor chat/autocomplete).
3. Ensure all tests pass with a minimal diff and adherence to the style guide.
4. Run tests locally until green; refactor continuously while keeping tests passing.

### 5. Integration

1. Commit changes with references to spec sections.
2. Open a pull request.
3. **[H]** Conduct code review (optionally AI-assisted).
4. Merge to main when tests and review pass.

### 6. Release

1. Build and release an experimental beta.
2. **[O][S]** Use staged rollout or feature flags if available.

### 7. Feedback & Observability

1. Collect logs, errors, and user feedback into `/docs/feedback.md`.
2. Review basic metrics and system behavior.

### 8. Decision Gate

**[H]** Evaluate against predefined success criteria. Decide: **promote** / **rollback** / **iterate**. Record decision in `/docs/decisions.md`.

### 9. Iteration

Update `/docs/spec.md` and the backlog based on feedback, then repeat from Step 2.

---

## Supporting Files

| File | Purpose |
|---|---|
| `/docs/spec.md` | Requirements + acceptance criteria (source of truth) |
| `/docs/inputs.md` | Raw inputs |
| `/docs/feedback.md` | Real-world observations |
| `/docs/decisions.md` | Iteration memory |
| `/tests/` | Validation contract |
| `CONTRIBUTING.md` | Style guide + constraints |

---

## Always-On Constraints

- Maintain basic data/schema discipline (migrations, compatibility)
- Follow security hygiene (secrets, dependencies, access control)
- Monitor basic performance and cost (latency, API usage)

# AI-Native Development Loop (Manual / Tool-Based)

## 1. Input Collection
1. Capture raw inputs (notes, stakeholder transcripts, user feedback, ideas) into `/docs/inputs.md`.

## 2. Requirements & Spec
2. Draft requirements/spec in `/docs/spec.md` using AI assistance (e.g., GitHub Copilot / Cursor chat).
3. Manually review and refine spec for clarity, scope, and testability.  [H]
4. Convert requirements into explicit, testable acceptance criteria within `/docs/spec.md`.
5. Classify items (validated / hypothesis / speculative) and decide: experiment vs full feature.
6. (Optional) Create spike branch `spike/*` for low-confidence experiments.  [O]

## 3. Test Definition
7. Generate initial test cases via AI into `/tests/*` (unit/integration).
8. Manually review tests and add behavioral + adversarial cases.  [H]
9. Commit tests first (establish baseline contract).

## 4. Implementation
10. Create feature branch `feature/*`.
11. Implement using AI assistance (editor chat/autocomplete).
12. Ensure: all tests pass + minimal diff + adherence to style guide (`CONTRIBUTING.md`).
13. Run tests locally (e.g., pytest, jest) until green.
14. Perform small, continuous refactors while keeping tests passing.

## 5. Integration
15. Commit changes with references to spec sections.
16. Open pull request (PR).
17. Conduct manual code review (optionally AI-assisted).  [H]
18. Merge to main when tests and review pass.

## 6. Release
19. Build and release experimental beta (manual deploy or CI).
20. (Optional) Use staged rollout or feature flags if available.  [O][S]

## 7. Feedback & Observability
21. Collect logs, errors, and user feedback into `/docs/feedback.md`.
22. Review basic metrics and system behavior (manual dashboards/logs).

## 8. Decision Gate
23. Evaluate against predefined success criteria.
24. Decide: promote / rollback / iterate; record in `/docs/decisions.md`.  [H]

## 9. Iteration
25. Update `/docs/spec.md` and backlog based on feedback.
26. Repeat loop from Step 2.

---

## Supporting Structure

- `/docs/spec.md` → requirements + acceptance criteria (source of truth)
- `/docs/inputs.md` → raw inputs
- `/docs/feedback.md` → real-world observations
- `/docs/decisions.md` → iteration memory
- `/tests/` → validation contract
- `CONTRIBUTING.md` → style guide + constraints

---

## Always-On Constraints

- Maintain basic data/schema discipline (migrations, compatibility)
- Follow security hygiene (secrets, dependencies, access control)
- Monitor basic performance and cost (latency, API usage)

---

## Tags

- [H] Human required  
- [O] Optional (safe to skip early)  
- [S] Scale-related (add as system grows)
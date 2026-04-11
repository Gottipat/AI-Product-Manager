# Benchmark Slide Summary

> PPT-friendly benchmark summary for the AI Product Manager system

## Headline Result

### Expected comparison result on this branch

| System            | Passed | Failed | Takeaway                                                                    |
| ----------------- | -----: | -----: | --------------------------------------------------------------------------- |
| `current_system`  |     38 |      0 | Stateful project memory and accountability flow passes all benchmark checks |
| `transcript_only` |     32 |      6 | Baseline misses continuity, carry-forward, and final project-state checks   |

Source:

- [README.md](/Users/kumarsashank/dev/AI-Product-Manager/README.md#L215)
- [benchmark/README.md](/Users/kumarsashank/dev/AI-Product-Manager/benchmark/README.md#L139)

## Latest Saved Benchmark Report

Latest saved JSON report:

- [2026-04-05T07-58-33-653Z-onboarding_growth_initiative_v1.json](/Users/kumarsashank/dev/AI-Product-Manager/benchmark/reports/2026-04-05T07-58-33-653Z-onboarding_growth_initiative_v1.json)

Summary:

| Scenario                          | Meetings Processed | Passed | Failed |
| --------------------------------- | -----------------: | -----: | -----: |
| `onboarding_growth_initiative_v1` |                  5 |     36 |      2 |

## Week-by-Week Results

| Week | Meeting          | Passed | Failed | What was validated                                                                                                    |
| ---- | ---------------- | -----: | -----: | --------------------------------------------------------------------------------------------------------------------- |
| 1    | Kickoff          |      7 |      0 | Guest checkout, pricing guardrails, identity dependency, phase-one question, and summary coverage                     |
| 2    | Status Review    |      6 |      0 | Fallback proposal, finance thread, phase-one continuity, identity-team blocker, and beta framing                      |
| 3    | Scope & Risk     |      6 |      0 | Support macros, dashboard, pricing thread, beta risk, and April 29 launch-risk context                                |
| 4    | Replan           |      5 |      1 | Launch readiness review, launch, compliance, guardrails, and replan framing                                           |
| 5    | Launch Readiness |      8 |      1 | Duplicate account, launch comms, workaround, stale-question suppression, launch/compliance/dashboard summary coverage |

## Failing Checks In Latest Saved Report

| Week | Check Type               | Target            | Result |
| ---- | ------------------------ | ----------------- | ------ |
| 4    | `meeting_summary_phrase` | `May 6`           | Failed |
| 5    | `meeting_item_presence`  | `cannibalization` | Failed |

Interpretation:

- Week 4 under-emphasized the new `May 6` target date in the generated summary.
- Week 5 did not turn `cannibalization` into a strong enough structured item title.

## Final Project-State Checks

| Check                                                          | Expected     | Result |
| -------------------------------------------------------------- | ------------ | ------ |
| Phase-one decision status                                      | `completed`  | Passed |
| Launch comms status                                            | `pending`    | Passed |
| `qa needs phase one decision` should not remain open           | no open item | Passed |
| `guest checkout inclusion in phase one` should not remain open | no open item | Passed |

## Trend Across Saved Runs

| Saved Report                                                    | Passed | Failed |
| --------------------------------------------------------------- | -----: | -----: |
| `2026-04-05T07-48-44-318Z-onboarding_growth_initiative_v1.json` |     33 |      5 |
| `2026-04-05T07-55-31-135Z-onboarding_growth_initiative_v1.json` |     36 |      2 |
| `2026-04-05T07-58-33-653Z-onboarding_growth_initiative_v1.json` |     36 |      2 |

## What These Test Cases Actually Check

The benchmark is scenario-based regression, not just generic unit testing.

For each meeting sequence, the harness checks:

- required item titles are present
- forbidden stale item titles stay absent
- key PM phrases appear in the executive or detailed summary
- final project-state statuses are correct
- resolved carry-over questions do not remain open

Scenario source:

- [scenario.json](/Users/kumarsashank/dev/AI-Product-Manager/benchmark/scenarios/onboarding_growth_initiative/scenario.json)

Validation logic:

- [run-longitudinal-eval.ts](/Users/kumarsashank/dev/AI-Product-Manager/benchmark/run-longitudinal-eval.ts#L365)
- [run-longitudinal-eval.ts](/Users/kumarsashank/dev/AI-Product-Manager/benchmark/run-longitudinal-eval.ts#L417)

## Screenshot Recommendation

For a clean PPT slide, use one of these:

1. [docs/BENCHMARK_SLIDE_SUMMARY.md](/Users/kumarsashank/dev/AI-Product-Manager/docs/BENCHMARK_SLIDE_SUMMARY.md)
2. [benchmark/README.md](/Users/kumarsashank/dev/AI-Product-Manager/benchmark/README.md#L139)
3. [README.md](/Users/kumarsashank/dev/AI-Product-Manager/README.md#L215)

Best narrative:

- top of slide: `Stateful AI Product Manager vs Transcript-Only Baseline`
- middle of slide: `38/0 vs 32/6`
- bottom of slide: week-by-week validation or final project-state checks

# Paper Outline

> Draft outline for the first research paper on this system

## Working Titles

Choose one of these depending on audience:

### More academic

`AI Product Manager: A Stateful System for Multi-Meeting Accountability, Decision Memory, and Deadline-Aware Minutes of Meeting`

### More product-systems focused

`From Meeting Notes to Execution Memory: Longitudinal Accountability Tracking for Recurring Product Meetings`

### More direct and bold

`Longitudinal Meeting Intelligence for Product Teams`

## One-Sentence Thesis

A stateful system that stores and reconciles project memory across recurring meetings produces more reliable and operationally useful minutes than single-meeting AI note-taking systems.

## Core Research Questions

### RQ1

Can persistent project memory improve the quality of recurring-meeting minutes compared to transcript-only summarization?

### RQ2

Does deterministic reconciliation reduce false closures and improve unresolved-question tracking?

### RQ3

Can person and team accountability signals improve PM usefulness beyond generic action-item extraction?

### RQ4

Can the system make trustworthy readiness judgments for launches and delivery reviews?

## Main Claims To Support

- Cross-meeting memory matters.
- Retrieval alone is not enough.
- Memory invalidation and reconciliation are necessary for trust.
- False closure is a critical failure mode.
- PM usefulness requires owner, deadline, and state transition accuracy, not just fluent summaries.

## Proposed Contributions

### Contribution 1

A formal task definition for `longitudinal meeting intelligence` over recurring product meetings.

### Contribution 2

A persistent project-memory schema linking meetings, items, owners, deadlines, and lifecycle transitions.

### Contribution 3

A deterministic reconciliation layer that updates or invalidates prior project state before final MoM generation.

### Contribution 4

A benchmark dataset and evaluation rubric for multi-meeting accountability and readiness reasoning.

### Contribution 5

Empirical evidence that the full stateful system outperforms transcript-only and retrieval-only baselines on PM-focused metrics.

## Paper Structure

## 1. Introduction

### What to say

- AI note takers are now strong at transcription and one-shot summaries.
- Product teams need something different: continuity, accountability, and readiness tracking over time.
- Current systems often append notes without updating project state.
- This leads to missed deadlines, stale open questions, and false confidence.
- We propose a stateful AI Product Manager system that maintains and reconciles project memory across recurring meetings.

### End with

- task definition
- method summary
- contributions list

## 2. Related Work

Cover these groups:

- meeting summarization
- action-item detection and rephrasing
- long-term conversational memory
- retrieval-augmented long-context systems
- enterprise meeting intelligence products

### Papers to cite

- MeetingBank
- Automatic Rephrasing of Transcripts-based Action Items
- Keep Me Updated!
- Beyond Goldfish Memory

### Product landscape

Briefly contrast against:

- Otter
- Fireflies
- Fathom
- Granola
- Avoma

Do not turn this into a marketing section.
Use it only to motivate the gap between note-taking and execution memory.

## 3. Task Definition

Define the task:

- input at meeting `t`
- persistent project memory from meetings `< t`
- output:
  - updated structured project state
  - PM-grade MoM
  - readiness signal

Formally define:

- canonical project items
- transitions
- owner attribution
- false closure
- unresolved question carry-forward

## 4. System Overview

Introduce the pipeline:

1. transcript ingestion
2. structured extraction
3. project context retrieval
4. deterministic reconciliation
5. final MoM synthesis
6. state persistence

### Figure 1

System architecture diagram showing:

- transcript input
- database memory
- reconciliation module
- LLM generation step
- final outputs

## 5. Persistent Memory Schema

Describe the core entities:

- meetings
- transcript events
- meeting items
- progress updates
- owner and team fields
- relation edges such as `related_prior_item_id`

Explain why explicit relations matter:

- carry-forward
- resolve
- block
- supersede

## 6. Reconciliation Algorithm

This is one of the most publishable sections.

Describe:

- candidate item matching against prior project memory
- evidence retrieval from transcript
- status inference rules
- invalidation of stale or synthetic alerts
- question-resolution logic
- cascade completion for carry-forward descendants
- readiness gate

### Algorithm box

Include pseudocode for:

- `ReconcileMeeting(project_memory, current_transcript, extracted_items)`

## 7. Dataset

Reference [DATASET_SPEC.md](/Users/kumarsashank/dev/AI-Product-Manager/docs/DATASET_SPEC.md).

Describe:

- project sequences
- meeting counts
- annotation scheme
- owner labels
- lifecycle transitions
- readiness labels

### Table 1

Dataset summary:

- number of projects
- number of meetings
- average meetings per project
- total items
- transition counts by type

## 8. Experimental Setup

### Systems to compare

- `Transcript-only`
  Single-meeting MoM generation with no historical state

- `Transcript + retrieval`
  Current transcript plus retrieved previous summaries and items, but no structured reconciliation

- `Stateful system without deterministic reconciliation`
  Persistent memory, but LLM handles continuity alone

- `Full AI Product Manager system`
  Persistent memory plus deterministic reconciliation plus readiness gating

### Evaluation metrics

Reference [EVAL_RUBRIC.md](/Users/kumarsashank/dev/AI-Product-Manager/docs/EVAL_RUBRIC.md).

Must include:

- extraction F1
- owner accuracy
- due-date accuracy
- transition accuracy
- false-closure rate
- unresolved-question carry-forward accuracy
- readiness accuracy
- human PM rating

## 9. Results

### Table 2

Structured extraction results

### Table 3

Lifecycle transition results

### Table 4

False-closure and false-ready comparison

### Table 5

Human evaluation results

### Table 6

Ablation results

### What you want to show

- full system lowers false closures
- full system improves unresolved-question tracking
- full system improves PM usefulness
- retrieval only is not enough

## 10. Qualitative Case Studies

Show 2 to 4 project sequences.

Good case studies:

- a question that remains open across 3 meetings and is finally resolved
- a deadline that passes without an update and gets surfaced as a concern
- a launch-readiness review where transcript-only summary is optimistic but the stateful system flags blockers
- a team-owned dependency that should not be hallucinated into a person-owned task

## 11. Failure Analysis

Be honest here.

Expected failure buckets:

- wrong owner type
- generic or weak item titles
- false-ready judgments
- missing indirect resolutions
- over-linking of related items
- synthetic alerts leaking into source-of-truth memory

This section will make the paper stronger, not weaker.

## 12. Discussion

Discuss:

- why execution memory is different from note-taking
- why auditability matters for enterprise adoption
- when deterministic rules should override the model
- where human review is still necessary

## 13. Limitations

Include:

- synthetic-data bias
- English-first assumptions
- dependence on transcript quality
- difficulty of ambiguous ownership
- domain bias toward product and launch workflows

## 14. Ethical And Privacy Considerations

Discuss:

- meeting consent
- internal sensitivity
- PII and customer data
- misuse of automated accountability systems
- human override and review requirements

## 15. Conclusion

End with:

- summary of results
- importance of longitudinal memory
- roadmap for broader meeting-intelligence systems

## Abstract Skeleton

Use this as a starting point:

```text
AI meeting assistants are increasingly effective at transcription and single-meeting summarization, but product and engineering teams require continuity across recurring meetings rather than isolated notes. We introduce a stateful AI Product Manager system that maintains persistent project memory, reconciles new meeting evidence against prior tasks, questions, and decisions, and generates deadline-aware Minutes of Meeting with explicit accountability signals. We formalize the task of longitudinal meeting intelligence, propose a reconciliation-based architecture, and evaluate it on a benchmark of recurring product meetings annotated for owners, deadlines, lifecycle transitions, and readiness labels. Compared with transcript-only and retrieval-only baselines, our system improves unresolved-question tracking, reduces false closures, and produces outputs that human product managers rate as more useful for real project execution.
```

## Figures To Prepare

### Figure 1

System architecture

### Figure 2

Memory lifecycle for one canonical item across multiple meetings

### Figure 3

Example of false closure in a baseline versus corrected carry-forward in the full system

### Figure 4

Readiness gate example for a launch review

## Tables To Prepare

### Table 1

Dataset statistics

### Table 2

Extraction metrics

### Table 3

Lifecycle transition metrics

### Table 4

False-closure and readiness metrics

### Table 5

Human evaluation

### Table 6

Ablation study

## Artifact Checklist

Before submission, prepare:

- code
- benchmark spec
- evaluation harness
- annotation guidelines
- sample data
- model prompts or system description
- reproducibility instructions

## Target Venue Families

Good targets:

- ACL Industry Track
- EMNLP Industry Track
- NAACL Industry Track
- CHI for workflow / human-AI collaboration angle
- KDD Applied Data Science or industry-track style venues if the benchmark becomes large enough

The exact venue should depend on where your strongest result lands:

- NLP benchmark and state tracking -> ACL / EMNLP / NAACL
- product workflow and human trust -> CHI

## 8-Week Writing Plan

### Week 1

- finalize task definition
- lock dataset schema
- define baselines

### Week 2

- finish benchmark harness
- annotate first test set

### Week 3

- run baselines
- run full system

### Week 4

- run human evaluations
- collect preference judgments

### Week 5

- write introduction, related work, and method

### Week 6

- write results and failure analysis

### Week 7

- write discussion, ethics, and limitations

### Week 8

- polish figures
- tighten abstract
- do internal reviews

## What Will Make This Paper Strong

- clear problem framing
- real benchmark with sequential evaluation
- strong false-closure analysis
- honest human evaluation
- strong ablation showing reconciliation matters

## What Will Make It Weak

- only showing nicer summaries
- no lifecycle metrics
- no human PM evaluation
- no baseline comparison
- no evidence trace or auditability story

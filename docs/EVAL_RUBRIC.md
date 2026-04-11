# Longitudinal Evaluation Rubric

> Benchmark and human-evaluation rubric for an AI Product Manager system

## Goal

This evaluation is designed to answer:

`Does the system help product and engineering teams execute better over time, or does it only write decent summaries?`

The system should be evaluated on sequential meeting processing with persistent project memory.

## Evaluation Layers

We need three layers of evaluation:

1. `Extraction quality`
2. `State-tracking quality`
3. `PM usefulness quality`

Single-meeting summary quality alone is not enough.

## Evaluation Protocol

For each project sequence:

1. start with empty project memory
2. process meeting 1
3. persist the system outputs
4. process meeting 2 using system state from meeting 1
5. continue sequentially through the sequence
6. score outputs after each meeting

The model must not see future meetings.

## Output Artifacts To Score

For each meeting, collect:

- executive summary
- detailed MoM
- extracted items
- lifecycle transitions applied to prior items
- owner assignments
- readiness label
- explanation or evidence trace

## Automatic Metrics

### 1. Item Extraction F1

Compare generated items to gold meeting items.

Measure:

- precision
- recall
- F1

Compute both:

- exact title / type match
- canonical-item match after normalization

### 2. Owner Attribution Accuracy

For each extracted item with ownership:

- owner person accuracy
- owner team accuracy
- owner-type accuracy: `individual`, `team`, `unknown`

### 3. Deadline Accuracy

Measure:

- due date exact match
- due date extraction precision / recall
- invalid due date rate

### 4. Lifecycle Transition Accuracy

For each prior canonical item, compare the system transition to the gold transition:

- `introduced`
- `carried_forward`
- `resolved`
- `blocked`
- `deadline_changed`
- `reassigned`
- `superseded`
- `overdue_without_update`

Recommended metrics:

- micro F1
- macro F1
- per-transition confusion matrix

### 5. False-Closure Rate

This is one of the most important trust metrics.

Definition:

- the percentage of items the system marked `completed` or `resolved` when the gold label says they were not actually resolved

Track separately for:

- tasks
- questions
- blockers
- dependencies

### 6. Unresolved-Question Carry-Forward Accuracy

Definition:

- among gold unresolved questions, how often the system keeps them alive until explicit resolution

This should be measured separately from generic item carry-forward.

### 7. Overdue Alert Precision

Definition:

- among system-generated overdue or missing-status alerts, how many are actually justified by the gold labels

### 8. Readiness Label Accuracy

Compare system label to gold:

- `ready`
- `at_risk`
- `blocked`
- `not_applicable`

Recommended metrics:

- accuracy
- macro F1
- false-ready rate

### 9. Evidence Grounding Coverage

Definition:

- percentage of extracted items or transitions that include a valid supporting transcript span

### 10. MoM Structural Validity

Check whether output MoM contains:

- valid executive summary
- detailed summary
- highlights
- items
- no blank highlight bodies
- no malformed priority or status fields

## Human Evaluation

Human judges should include:

- senior PMs
- engineering managers
- product ops leads

Each meeting output should be rated independently by at least 2 raters.

## Human Scoring Rubric

Score each category as:

- `0` = poor / unreliable
- `1` = partial / inconsistent
- `2` = strong / reliable

Maximum score per meeting: `20`

### 1. Continuity Across Meetings

- `0`: treats the meeting in isolation
- `1`: some continuity is present but incomplete
- `2`: clearly carries forward relevant prior tasks, questions, and risks

### 2. Accountability By Owner

- `0`: actions are vague or ownerless
- `1`: some owners are captured but gaps remain
- `2`: individual and team accountability are clearly represented

### 3. Deadline Awareness

- `0`: dates are ignored or misused
- `1`: dates are listed but not reasoned about
- `2`: near-due and overdue items are surfaced appropriately

### 4. Decision Memory

- `0`: decisions are forgotten or confused
- `1`: some decisions are retained
- `2`: later outputs correctly reflect prior decisions and close related questions

### 5. Unresolved Question Tracking

- `0`: questions disappear or get duplicated badly
- `1`: some questions are carried forward
- `2`: questions persist until explicitly resolved

### 6. Launch / Delivery Risk Reasoning

- `0`: no meaningful risk analysis
- `1`: risks are listed but shallow
- `2`: risks are tied to owners, blockers, deadlines, and project outcome

### 7. No Hallucinated Closures

- `0`: frequent false closure
- `1`: occasional false closure or ambiguity
- `2`: closes items only when the evidence is strong

### 8. PM-Quality Writing

- `0`: generic notes
- `1`: useful but shallow
- `2`: sharp PM-grade synthesis with decisions, tradeoffs, and next steps

### 9. Database-Worthy Structured Extraction

- `0`: items are too noisy to store reliably
- `1`: mostly usable but inconsistent
- `2`: structured outputs are good enough for persistent project memory

### 10. Operational Usefulness

- `0`: would not use this to run follow-up
- `1`: useful as a reference only
- `2`: useful for real project execution and follow-up

## Recommended Acceptance Thresholds

### System quality bar

- `16/20` average human score on the test set
- false-closure rate under `5%`
- readiness false-positive rate under `10%`
- owner-type accuracy above `90%`
- unresolved-question carry-forward accuracy above `85%`

### Internal ship gate

Before calling the system production-ready:

- no blank or malformed MoM payloads
- no invalid enum or schema failures in the test harness
- no false-ready summary on blocker-heavy sequences
- auditable evidence trace for every status update

## Pairwise Comparison Protocol

To compare this system against a baseline:

1. generate outputs from both systems on the same project sequence
2. blind the outputs
3. ask judges which one they would trust to run the next week of project follow-up

Primary preference question:

`Which output would you rather use as the operating memory for this project next week?`

That question is more valuable than generic "which summary reads better?"

## Error Taxonomy

Every failed example should be labeled with an error type.

Suggested taxonomy:

- missed_item
- hallucinated_item
- wrong_owner
- wrong_team
- wrong_due_date
- false_closure
- missed_resolution
- stale_question_resurfaced
- missed_overdue_alert
- incorrect_readiness_judgment
- low-quality_summary
- weak_evidence_trace

## Benchmark Reporting Template

When reporting results, include:

- extraction metrics
- lifecycle metrics
- readiness metrics
- human evaluation averages
- pairwise preference win rate
- top 20 failure cases
- breakdown by meeting type

## Minimum Benchmark Table Set

The paper should include at least:

1. item extraction table
2. lifecycle transition table
3. false-closure and false-ready table
4. human evaluation table
5. ablation table

## Ablations To Run

Required ablations:

- no project memory
- transcript plus retrieved summaries only
- transcript plus open items only
- full system without deterministic reconciliation
- full system with deterministic reconciliation
- full system without readiness gate

These ablations will make the paper much stronger.

## Weekly Internal Review Sheet

For live dogfooding, use this short form after each project sequence:

- Did the system carry forward the right open items?
- Did it miss any critical owner?
- Did it close anything too early?
- Did it surface deadline or launch risk before a human would?
- Would a PM trust this output without re-reading the full transcript?

## Recommendation For This Repo

Short-term, use:

- the 5-meeting onboarding scenario already created
- 10 more curated multi-meeting sequences
- 3 human evaluators
- one baseline: transcript-only MoM generation
- one improved system: current accountability branch

That is enough to produce an internal benchmark report before the larger dataset exists.

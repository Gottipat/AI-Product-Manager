# Longitudinal Dataset Specification

> Dataset design for evaluating an AI Product Manager system over recurring meetings

## Purpose

This dataset is not for single-meeting note generation.
It is for `longitudinal project-state tracking` across recurring product meetings.

The system under test should process meetings in chronological order and maintain persistent memory about:

- owners
- teams
- tasks
- deadlines
- blockers
- dependencies
- open questions
- decisions
- readiness risk

The dataset should let us answer one core question:

`Does the system behave like a reliable AI Product Manager over time, not just a good meeting summarizer?`

## Scope

Each dataset entry is a `project sequence`, not an isolated transcript.

Recommended initial target:

- 100 project sequences
- 4 to 12 meetings per sequence
- 6 to 12 participants per project
- cross-functional roles: PM, Engineering, Design, Data, QA, Customer Success, Marketing, Security, Leadership
- a mix of launch planning, weekly product reviews, roadmap syncs, incident follow-ups, and go-to-market reviews

## Design Principles

- Meetings must be processed sequentially.
- Gold labels must reflect state transitions across meetings.
- A later meeting may resolve, block, or supersede prior items.
- The source of truth is always the raw transcript plus any explicitly provided meeting metadata.
- Synthetic accountability alerts are not gold facts.
- The benchmark must penalize false closures more heavily than missed optimizations.

## Core Tasks

The dataset should support these tasks:

1. `Current-meeting extraction`
   Extract decisions, action items, blockers, dependencies, questions, deadlines, and risks from the current transcript.

2. `Cross-meeting reconciliation`
   Reconcile current evidence against previously open items.

3. `Lifecycle state tracking`
   Determine whether prior items remain open, are blocked, were resolved, or became overdue without status update.

4. `Accountability attribution`
   Identify whether accountability belongs to an individual, a team, or is still unknown.

5. `PM-grade minutes generation`
   Produce minutes of meeting that reflect current discussion and prior project memory.

6. `Readiness judgment`
   Estimate whether the project is ready, at risk, or blocked based on current and prior evidence.

## Unit Of Annotation

There are four annotation units:

- `Project sequence`
- `Meeting`
- `Canonical project item`
- `Item transition event`

## Recommended Directory Layout

```text
dataset/
  project_sequences/
    project_0001/
      project.json
      meetings/
        001/
          transcript.txt
          meeting_metadata.json
          gold_mom.json
          gold_items.json
          gold_state_delta.json
        002/
          transcript.txt
          meeting_metadata.json
          gold_mom.json
          gold_items.json
          gold_state_delta.json
      gold_project_memory.json
```

## Project-Level Schema

Suggested `project.json`:

```json
{
  "project_id": "project_0001",
  "project_name": "Onboarding Growth Initiative",
  "domain": "B2B SaaS",
  "meeting_cadence": "weekly",
  "primary_goal": "Improve activation and reduce onboarding drop-off",
  "participants": [
    {
      "person_id": "person_kumar",
      "name": "Kumar",
      "role": "Product Manager",
      "team": "Product"
    }
  ],
  "global_context": {
    "launch_target": "2026-05-06",
    "project_type": "launch_readiness",
    "priority": "high"
  }
}
```

## Meeting Metadata Schema

Suggested `meeting_metadata.json`:

```json
{
  "meeting_id": "project_0001_meeting_003",
  "sequence_number": 3,
  "title": "Week 3 Launch Risk Review",
  "meeting_type": "weekly_product_review",
  "occurred_at": "2026-04-21T10:00:00Z",
  "duration_minutes": 45,
  "participants_present": ["person_kumar", "person_subhash", "person_priya"],
  "context_note": "Recurring launch-readiness review for onboarding growth initiative"
}
```

## Canonical Item Schema

Every persistent project fact should roll up to a canonical item identity.

Suggested fields:

```json
{
  "canonical_item_id": "item_0042",
  "item_type": "action_item",
  "title": "Finalize pricing experiment guardrails",
  "description": "Align pricing exposure in guest flow with finance constraints",
  "owner_type": "individual",
  "owner_person_id": "person_kumar",
  "owner_team_id": null,
  "priority": "high",
  "due_date": "2026-04-14",
  "introduced_in_meeting_id": "project_0001_meeting_001",
  "current_status": "in_progress"
}
```

## Supported Item Types

Use a constrained ontology:

- `action_item`
- `decision`
- `question`
- `risk`
- `blocker`
- `dependency`
- `deadline`
- `commitment`
- `project_update`
- `announcement`
- `key_takeaway`
- `reference`

## Status Model

Recommended status vocabulary:

- `pending`
- `in_progress`
- `blocked`
- `completed`
- `deferred`
- `cancelled`
- `unknown`

For research evaluation, keep the transition labels separate from the current status.

## Transition Labels

Each meeting can generate `gold_state_delta.json` describing how project memory should change.

Recommended transition labels:

- `introduced`
- `carried_forward`
- `resolved`
- `blocked`
- `deadline_changed`
- `reassigned`
- `superseded`
- `overdue_without_update`
- `mentioned_without_status_change`
- `invalid_or_hallucinated`

Suggested record:

```json
{
  "meeting_id": "project_0001_meeting_004",
  "transitions": [
    {
      "canonical_item_id": "item_0042",
      "transition_type": "resolved",
      "status_before": "in_progress",
      "status_after": "completed",
      "resolved_by_item_id": "meeting_item_008",
      "evidence_spans": [
        {
          "speaker": "Kumar",
          "text": "Finance approved the pricing experiment guardrails."
        }
      ]
    }
  ]
}
```

## Owner Annotation Rules

Ownership is a first-class label.

### Owner types

- `individual`
- `team`
- `unknown`

### Required owner fields

- `owner_type`
- `owner_person_id`
- `owner_team_id`
- `owner_display_name`

### Examples

- `Kumar` -> individual
- `Identity team` -> team
- `Support team` -> team
- no explicit owner in transcript -> unknown

### Important rule

If the meeting mentions a team dependency but no individual owner, do not hallucinate a person.

## Evidence Annotation Rules

Every gold item and transition should have evidence.

Recommended evidence fields:

- `transcript_span_id`
- `speaker`
- `raw_text`
- `line_number`
- `confidence`

Evidence should allow us to audit:

- why an item was introduced
- why it was considered resolved
- why it stayed open
- why it became blocked

## Gold MoM Schema

Suggested `gold_mom.json`:

```json
{
  "executive_summary": "Concise PM-grade summary grounded in the meeting and project memory.",
  "detailed_summary_markdown": "## Decisions\n...\n## Risks\n...\n## Open Questions\n...",
  "main_topics": ["Beta readiness", "Pricing guardrails", "Identity dependency"],
  "highlights": [
    {
      "highlight_type": "outcome",
      "content": "April 29 beta was moved to May 6.",
      "importance": 9,
      "keywords": ["beta", "timeline", "replan"]
    }
  ],
  "readiness_label": "at_risk",
  "readiness_rationale": "Compliance, dashboard reliability, and duplicate-account QA risk remain unresolved."
}
```

## Readiness Labels

Recommended meeting-level readiness labels:

- `ready`
- `at_risk`
- `blocked`
- `not_applicable`

This should be annotated at the meeting level and optionally at the project milestone level.

## Split Strategy

Split by `project sequence`, never by meeting.

Recommended split:

- train: 70%
- validation: 15%
- test: 15%

Avoid leakage from:

- same project storyline appearing in multiple splits
- near-duplicate synthetic scripts
- same item graph paraphrased across splits

## Data Sources

Use three lanes:

1. `Synthetic but realistic sequences`
   Good for early iteration and controlled edge cases.

2. `Human-authored simulation sequences`
   PMs or EMs write realistic transcripts from actual workflows.

3. `Real design-partner data`
   Collected with explicit consent, redaction, and governance.

## Recommended Build Order

### Phase 1

- 50 synthetic project sequences
- manually reviewed by PMs
- optimized for edge cases:
  - overdue deadlines
  - ownership ambiguity
  - decision superseding old questions
  - status updates without explicit closure words

### Phase 2

- 25 human-authored realistic sequences
- richer interruptions, ambiguity, and inconsistent speaker behavior

### Phase 3

- 10 to 20 real customer pilot sequences
- fully redacted and consented

## Benchmark Protocol

The benchmark runner must simulate the real product loop:

1. initialize empty project memory
2. process meeting 1
3. persist system outputs
4. process meeting 2 using stored memory
5. continue sequentially
6. score outputs after each meeting

This is critical.
The system must not see future meetings when generating current outputs.

## Core Benchmark Outputs

For each meeting, capture:

- generated MoM
- extracted items
- updated project memory
- state transitions applied
- owner assignments
- readiness label
- supporting evidence trace

## Automatic Metrics

This dataset should support:

- item extraction precision / recall / F1
- owner attribution precision / recall
- team-vs-individual classification accuracy
- due-date accuracy
- lifecycle transition accuracy
- false-closure rate
- unresolved-question carry-forward accuracy
- readiness label accuracy
- MoM structure validity

## Human Evaluation

PMs and EMs should score:

- continuity
- trustworthiness
- accountability usefulness
- launch-readiness usefulness
- hallucinated closure severity
- overall PM quality

## Privacy And Governance

For real data:

- explicit participant consent
- redaction of PII and customer secrets
- data retention policy
- enterprise access control
- annotator confidentiality agreements

## Failure Cases The Dataset Must Contain

The benchmark should intentionally include:

- ambiguous owners
- team-owned blockers
- indirect status updates
- decisions that resolve old questions
- deadlines mentioned without status
- stale tasks never revisited
- conflicting updates across meetings
- false optimism in launch-readiness discussions

## Minimum Viable Benchmark For This Repo

Short-term target for this codebase:

- 20 project sequences
- 5 meetings each
- 100 meetings total
- 300 to 500 canonical items
- 1,000+ lifecycle transition labels
- 3 independent human raters on the test set

## Deliverables

To claim a publishable benchmark, we should ship:

- dataset spec
- annotation guidelines
- benchmark runner
- train / validation / test splits
- baseline system results
- error analysis notebook
- human evaluation protocol

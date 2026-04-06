# AI Product Manager Research And Company Plan

Date: 2026-04-05
Branch reference: `feat/accountability-ai-pm`
Latest pushed commit at time of writing: `44c047d`

## Core Thesis

Most AI note takers are getting very good at capture, summary, search, and follow-up generation.
That layer is becoming table stakes.

The real wedge for this product is not "better notes."
It is "persistent execution intelligence":

- Who owns what
- What changed since the last meeting
- What was promised but never updated
- Which deadlines are at risk
- Which questions are still unresolved
- Which decisions actually closed prior uncertainty
- Whether the project is truly on track, not just well summarized

If we execute well, the company should not position itself as another AI meeting notes app.
It should position itself as an `AI Product Manager` or `execution memory layer` for recurring cross-functional work.

## Market Read

As of 2026-04-05, the market is crowded and strong.
The category leaders already cover transcript capture, summaries, search, integrations, and workflow automation.

### What current players are doing well

- Fireflies positions around transcribe, summarize, search, analyze, conversation intelligence, tasks, and 200+ AI skills. Its official site says it is used across `1 million+ companies`, supports `100+ languages`, offers task creation after meetings, and has an MCP server plus enterprise controls. Source: https://fireflies.ai/
- Otter positions around a meeting agent, AI chat, automated summaries, action items, and integrations into Jira, Asana, Salesforce, Slack, and more. Its business plan is listed from `$19.99/month per user`. Source: https://otter.ai/
- Fathom positions around AI summaries, search, action items, "Ask Fathom", and shared visibility across meetings. Its official site emphasizes shared source of truth, pattern spotting, and `Product & Engineering` support for tracking feature requests. Pricing includes free, premium, team, and business tiers. Source: https://www.fathom.ai/ and https://www.fathom.ai/pricing
- Granola is winning on UX and bot-free capture. Its official site says it transcribes local computer audio directly with `no meeting bots`, provides customizable templates, and helps with post-meeting action items. Pricing shows `$14/user/month` business and `$35/user/month` enterprise. Source: https://www.granola.ai/ and https://www.granola.ai/pricing
- Avoma is closer to workflow intelligence than many others. Its official site emphasizes searchable knowledge base, CRM sync, topic detection, keyword tracking, and org alerts. Pricing starts around `$19` to `$39` per recorder seat annually. Source: https://www.avoma.com/product/meeting-assistant and https://www.avoma.com/pricing

### The opening in the market

The category messaging still clusters around:

- recording
- transcription
- summaries
- AI chat
- CRM sync
- coaching
- generic action items

The opportunity is narrower and more painful:

- recurring internal product meetings
- cross-functional planning
- delivery reviews
- launch readiness
- unresolved questions over time
- missed deadlines without status updates
- accountability by person and team
- decision-memory that updates state instead of just appending notes

That is a much sharper wedge than "meeting notes for everyone."

## Research Read

The literature supports the idea that memory and status invalidation are still open technical problems.

- `MeetingBank` argues that annotated meeting corpora are scarce and introduces a benchmark aligned to real minutes and metadata. Source: https://aclanthology.org/2023.acl-long.906/
- `Automatic Rephrasing of Transcripts-based Action Items` shows that transcript-derived action items need normalization into coherent, self-contained artifacts. Source: https://aclanthology.org/2021.findings-acl.253/
- `Keep Me Updated! Memory Management in Long-term Conversations` explicitly argues that older memory becoming outdated causes later confusion, and proposes mechanisms that eliminate invalidated or redundant memory. Source: https://aclanthology.org/2022.findings-emnlp.276/
- `Beyond Goldfish Memory` shows that long-horizon settings are materially different from short-context dialogue, and that retrieval plus summarization and recall outperform standard short-context approaches. Source: https://aclanthology.org/2022.acl-long.356/

### The paper-worthy gap

There is plenty of work on:

- summarizing a single meeting
- detecting action items
- generating cleaner action-item phrasing
- long-term conversational memory in general

There is much less on:

- `multi-meeting project state tracking`
- `explicit resolution of prior questions and commitments`
- `deadline-aware accountability reasoning`
- `person and team ownership memory`
- `readiness judgments grounded in project memory`

That gap fits this repo unusually well.

## Product Direction

### What this product should become

Not an AI note taker.
An `execution intelligence system for product teams`.

### Product promise

After every recurring meeting, the system should:

- ingest the raw transcript
- extract structured project facts
- reconcile them against prior project memory
- update statuses and ownership records
- detect stale or overdue work
- generate PM-quality minutes
- surface launch or delivery concerns before humans miss them

### Best initial ICP

Start with one tight wedge:

- product managers
- engineering managers
- founders running weekly product reviews
- cross-functional launch teams at 10 to 200 person B2B SaaS companies

Why this wedge works:

- lots of recurring meetings
- lots of status ambiguity
- lots of cross-team dependencies
- enough pain to pay
- smaller sales motion than enterprise revenue intelligence

### What not to do first

Do not start as:

- a generic consumer note taker
- a lecture summary product
- a generic sales intelligence clone
- a broad "meeting assistant for every team" tool

Those markets are already crowded and heavily optimized.

## Technical Moat

Your moat should be `stateful project memory`, not just prompting.

### The core objects you should own in the database

- `meetings`
- `transcript_events`
- `meeting_items`
- `progress_updates`
- `project_memory_edges`
- `owners`
- `teams`
- `deadlines`
- `decision_records`
- `question_records`

### The relations that matter

- `related_prior_item_id`
- `source_item_id`
- `resolved_by_item_id`
- `blocked_by_item_id`
- `supersedes_item_id`
- `owner_type`
- `owner_person_id`
- `owner_team_id`
- `status_source_meeting_id`
- `deadline_source_meeting_id`

### The system behavior that should differentiate you

- deterministic status reconciliation before final MoM synthesis
- explicit invalidation of outdated memory
- synthetic accountability alerts kept separate from source-of-truth facts
- readiness gates that prevent optimistic summaries when blockers remain
- person and team accountability ledgers
- confidence on every extracted state transition
- human review UI for disputed or low-confidence updates

## Research Paper Plan

### Working title

`From Meeting Notes to Execution Memory: Longitudinal Accountability Tracking for Recurring Product Meetings`

### Stronger variant

`AI Product Manager: A Stateful System for Multi-Meeting Accountability, Decision Memory, and Deadline-Aware Minutes of Meeting`

### Main claim

A stateful pipeline that combines transcript-grounded extraction, persistent project memory, and deterministic reconciliation produces more useful and reliable project-management minutes than single-meeting note-taking systems.

### Research contributions

- a formal task definition for `longitudinal meeting intelligence`
- a schema for persistent project memory across meetings
- a reconciliation algorithm for status carry-forward, resolution, and overdue detection
- an evaluation framework for accountability and continuity
- a benchmark dataset of sequential product meetings with human labels

### Dataset plan

Build a dataset of recurring project meetings, not one-off transcripts.

Each sequence should contain:

- 4 to 12 meetings per project
- raw transcripts
- per-meeting MoM gold summaries
- action items with owners
- deadlines
- blockers
- questions
- decisions
- explicit state transitions
- human labels for resolved, still open, slipped, blocked, and missing update

### Label schema

For each item in each meeting:

- `introduced`
- `carried_forward`
- `resolved`
- `blocked`
- `overdue_without_update`
- `reassigned`
- `superseded`
- `invalid_or_hallucinated`

### Baselines

You need credible baselines.

- single-meeting LLM summarization only
- transcript plus retrieved past summaries without structured reconciliation
- transcript plus retrieved past items without status invalidation
- your full system with deterministic reconciliation

### Metrics

Standard summary metrics are not enough.

You need execution-aware metrics:

- action-item precision and recall
- owner precision and recall
- deadline extraction accuracy
- prior-item resolution accuracy
- unresolved-question carry-forward accuracy
- false-closure rate
- overdue-alert precision
- launch-readiness judgment accuracy
- human PM preference ranking

### Evaluation design

Run blind human evaluation with:

- senior PMs
- engineering managers
- product ops leads

Ask them to score:

- continuity
- accountability
- trustworthiness
- usefulness for follow-up
- launch-risk awareness
- hallucinated closure rate

### Paper structure

1. Problem definition
2. Related work
3. System design
4. Memory schema and reconciliation algorithm
5. Dataset construction
6. Experimental setup
7. Quantitative results
8. Human evaluation
9. Failure analysis
10. Ethical and privacy considerations

## Company Plan

### Positioning

`AI Product Manager for recurring team execution`

Short version:

`It remembers what your team committed to, what changed, and what is slipping before you do.`

### Product packaging

Do not sell "minutes of meeting."
Sell:

- weekly product review memory
- launch readiness intelligence
- cross-functional accountability
- decision trail and unresolved question tracking

### Initial feature bundle

- transcript ingestion
- PM-grade MoM
- cross-meeting project memory
- owner and team accountability
- overdue and stale-item alerts
- launch readiness view
- audit trail for why the system believes something is open or resolved

### Expansion paths

- Jira, Linear, Asana sync
- Slack nudges for overdue owners
- sprint planning carry-over suggestions
- launch checklist generation
- customer feedback to roadmap signal extraction
- multi-project portfolio reporting for heads of product

### Pricing hypothesis

Do not underprice against generic note takers.
Your pricing should reflect workflow ownership and execution risk reduction.

Suggested early pricing experiments:

- Team plan: `$25` to `$39` per active manager per month
- Project memory add-on: project-based pricing for cross-functional accountability
- Enterprise: security, SSO, retention policies, private deployment, admin analytics

Do not charge purely per meeting recorder seat if your real value is project continuity.

### GTM

Start bottom-up with PMs and EMs, then expand to org-level rollups.

Best early channels:

- founder and PM communities
- engineering manager communities
- launch/readiness playbooks
- case studies on "how we caught missed deadlines before launch"
- PM workflow content, not generic AI content

### Proof points you should aim to publish

- reduction in missed carry-over tasks
- reduction in false "everything is on track" meeting summaries
- faster launch-readiness reviews
- improved PM trust scores over generic note takers

## 90-Day Execution Plan

### Phase 1: System hardening

- sharpen owner extraction for person vs team
- add explicit `resolved_by` and `supersedes` relations
- build a review UI for low-confidence status transitions
- add audit traces for every carried-forward or resolved item
- add launch-readiness scorecards with blocking rules

### Phase 2: Dataset creation

- collect 50 to 100 synthetic but realistic multi-meeting project sequences
- label them with PM-grade longitudinal annotations
- recruit 5 to 10 real design partners for private pilot data with consent
- define gold labels for owner, deadline, status change, and unresolved question continuity

### Phase 3: Evaluation and write-up

- run baseline comparisons
- run human PM evaluation
- publish failure taxonomy
- prepare preprint and demo assets

### Phase 4: Design-partner launch

- onboard 3 to 5 product teams
- measure trust and retention
- observe where humans override the system
- turn overrides into training and rules improvements

## Biggest Risks

- hallucinated closures will destroy trust faster than mediocre summaries
- privacy and consent are non-negotiable, especially with internal product meetings
- if the product looks like a generic note taker, you will get dragged into a pricing war
- if the system updates project state without auditability, PMs will not trust it
- if you skip human evaluation, the paper will be weak even if the demo is impressive

## Non-Negotiable Product Principles

- raw transcript is always the source of truth
- structured project memory is a first-class artifact
- deterministic reconciliation happens before final summary generation
- synthetic alerts are clearly separated from factual meeting evidence
- every status transition must be explainable
- a low-confidence conclusion should stay open, not be auto-closed

## Immediate Next Moves

- merge `feat/accountability-ai-pm` to `dev`
- create a `docs/DATASET_SPEC.md`
- create a `docs/EVAL_RUBRIC.md`
- implement an `evidence trail` UI on the meeting detail page
- add `owner_type`, `owner_person_id`, and `owner_team_id` formally to the schema
- design a launch-readiness dashboard rather than only text MoMs

## Sources

- Fireflies official product page: https://fireflies.ai/
- Fireflies pricing: https://fireflies.ai/pricing
- Otter official product page: https://otter.ai/
- Fathom official product page: https://www.fathom.ai/
- Fathom pricing: https://www.fathom.ai/pricing
- Granola official product page: https://www.granola.ai/
- Granola pricing: https://www.granola.ai/pricing
- Avoma meeting assistant: https://www.avoma.com/product/meeting-assistant
- Avoma pricing: https://www.avoma.com/pricing
- MeetingBank: https://aclanthology.org/2023.acl-long.906/
- Automatic Rephrasing of Transcripts-based Action Items: https://aclanthology.org/2021.findings-acl.253/
- Keep Me Updated! Memory Management in Long-term Conversations: https://aclanthology.org/2022.findings-emnlp.276/
- Beyond Goldfish Memory: https://aclanthology.org/2022.acl-long.356/

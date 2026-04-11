# Project Status

This document is the clearest snapshot of what the project currently achieves,
what is reliable enough to demo, and what is still under active development.

## Product Goal

Build an `AI Product Manager` for recurring meetings:

- remember context across multiple meetings in the same project
- generate useful Minutes of Meeting from current and historical context
- track owners, deadlines, blockers, and unresolved questions
- improve accountability rather than just summarizing conversation

## What Is Working Well

### Reliable Today

- Transcript upload flow
- Context-aware MoM generation
- Structured extraction of action items and open questions
- Project-level item tracking and status updates
- Longitudinal benchmark harness
- Dockerized local setup

### Good Demo Path

The best review flow is:

1. Create a project.
2. Upload a transcript.
3. Review the generated MoM.
4. Review extracted items.
5. Upload a follow-up meeting in the same project.
6. Show continuity across meetings.

## Major Achievements

- Moved beyond single-meeting summaries into project memory
- Added accountability-oriented item extraction and carry-forward logic
- Added longitudinal benchmark evaluation against a transcript-only baseline
- Built a researcher-friendly framing around PM-quality meeting intelligence
- Added task workspace features for reviewing and updating extracted work
- Added multiple capture paths so the system can evolve beyond transcript upload

## Evidence Of Progress

Current benchmark expectation for the built-in comparison scenario:

- `current_system`: `38 passed / 0 failed`
- `transcript_only`: `32 passed / 6 failed`

This matters because it shows the stateful system outperforming a
transcript-only baseline on continuity and accountability behavior.

See:

- [../benchmark/README.md](../benchmark/README.md)
- [BENCHMARK_SLIDE_SUMMARY.md](./BENCHMARK_SLIDE_SUMMARY.md)

## Experimental Or In-Progress Areas

### Join With Bot

Current status:

- usable for experimentation and demos
- can fail depending on Google auth, waiting room, or meeting permissions

Why it is still preview-stage:

- 2FA and session reliability are outside the app’s control
- Google Meet UI and auth behavior can change

### Chrome Extension Capture

Current status:

- audio capture is supported
- transcript extraction is still being improved for multi-speaker accuracy

Why it is still in progress:

- Google Meet captions arrive as incremental DOM updates rather than stable
  final utterances
- reliable speaker attribution for multiple speakers is still a hard DOM problem

### Audio Transcription Experiments

Current status:

- optional experimentation path only
- not the recommended path for the main product walkthrough

## Stable Vs Experimental Summary

| Capability                      | Status       | Recommendation               |
| ------------------------------- | ------------ | ---------------------------- |
| Transcript upload               | Stable       | Use for the main demo        |
| Context-aware MoM               | Stable       | Use for evaluation           |
| Item tracking and filters       | Stable       | Use for project walkthrough  |
| Benchmark harness               | Stable       | Use for technical validation |
| Join with bot                   | Preview      | Show only with caution       |
| Chrome extension capture        | In progress  | Show only as experimental    |
| Audio transcription experiments | Experimental | Optional only                |

## Remaining Product Gaps

- stronger extension speaker separation for multi-person meetings
- stronger evidence trails for why an item was marked open, resolved, or overdue
- larger benchmark dataset across more meeting types
- better inspection tooling for project memory transitions

## Suggested Next Milestones

1. Improve extension transcript finalization and multi-speaker attribution.
2. Expand the benchmark scenario set beyond the current onboarding storyline.
3. Add evidence-view UI for item lifecycle reasoning.
4. Add stronger evaluation around owner accuracy and false closures.
5. Prepare a polished paper/demo package around the benchmark results.

## Best Message For A Reviewer

This project should be evaluated as a system for `longitudinal meeting
intelligence`, not only as a one-off note summarizer. The key differentiator is
that it remembers prior context, carries unresolved work forward, and helps
teams inspect accountability over time.

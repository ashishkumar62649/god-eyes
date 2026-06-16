# specs/ - Spec Kit Workspace

Classification: SPEC_WORKSPACE
Last updated: 2026-06-16

`specs/` contains active Spec Kit work packages for new layers, large features, and broad
refactors. A spec package is the source of truth for a single feature/refactor lifecycle:
what to build, how to build it, what tasks execute it, and how it is validated.

## Spec Kit Sequence

GOD EYES follows this sequence:

1. Constitution - `.specify/memory/constitution.md`
2. Specify - create `spec.md` with user stories, requirements, success criteria, assumptions
3. Clarify - resolve ambiguous requirements before planning
4. Plan - create `plan.md`, plus archived evidence, `contracts/`, `data-model.md`, and `quickstart.md` when needed
5. Tasks - create `tasks.md` with ordered, independently testable work
6. Analyze/checklist - verify consistency across spec, plan, tasks, contracts, and constitution
7. Implement - execute tasks in order, validate, log, and commit

## When To Create A Spec

Create `specs/<NNN>-<feature-or-refactor>/` for:

- A new layer
- A large multi-agent feature
- A broad refactor that changes structure across lanes
- A documentation architecture change that affects active rules, specs, and agent reading policy

Use `docs/work-orders/` instead for a small single-lane fix or narrow cross-cutting
repair; create that folder only when an active work order exists.

## Folder Pattern

```text
specs/<NNN>-<feature-or-refactor>/
```

Rules:

- `NNN` is a zero-padded sequence number.
- The slug is short, lowercase, and kebab-case.
- New specs start at `009`.
- Keep one feature/refactor per spec folder.

## Active Specs

- `specs/008-structure-remediation-roadmap/` - active remediation roadmap with a compact spec/plan/tasks spine. Supporting evidence is archived under `docs/archive/2026-06-16-docs-pruned/spec-008-evidence/`.

## Archived Specs

Implemented layer specs 001-007 are archived under:

- `docs/archive/2026-06-16-implemented-specs/`

Do not read archived specs by default. They are historical context only.

## File Roles

| File/folder | Role | Required |
|-------------|------|----------|
| `spec.md` | What and why: user stories, requirements, success criteria, assumptions, non-goals | Yes |
| `plan.md` | How: technical context, constitution check, structure decision, risks | Yes for medium/large work |
| `tasks.md` | Ordered execution tasks with dependencies, `[P]` markers, exact paths, validation | Yes before implementation |
| `README.md` | Spec-local overview, status banner, and pointers to the active control docs and to the rest of this spec folder | Optional, recommended for active multi-phase roadmaps |
| `repository-skeleton.md` | Target repository skeleton and per-lane folder/ownership mapping for structure-remediation specs | Optional, used by Spec 008 and similar remediation specs |
| Evidence docs | Options, rejected alternatives, discovery notes, and open technical questions | Archive under `docs/archive/<date-topic>/` after they are no longer part of the active reading spine |
| `contracts/` | API/data contracts, schemas, endpoint definitions, interface agreements | When contracts change |
| `data-model.md` | Entities, fields, relationships, lifecycle rules | When data shape changes |
| `quickstart.md` | How to run and validate the work | When runtime behavior changes |
| `checklists/` | Requirement quality or review checklists | When extra quality gates are useful |
| `review.md` | Spec-local review record, if not using `docs/state/INTEGRATION_REVIEW_*` | Optional |

## Agent Rules

- Read `.specify/memory/constitution.md` before planning or implementing a spec.
- Follow `spec.md`, `plan.md`, and `tasks.md`; do not invent scope.
- If a necessary task is missing, log the gap and ask the Orchestrator Agent to update the spec.
- Keep implementation changes inside the allowed paths listed in the task.
- Update `docs/state/HANDOFF_LOG.md` and `docs/state/RECENT_CONTEXT.md` after completed work.

## Reviewer Rules

Review against:

- Constitution principles
- `spec.md` intent and acceptance criteria
- `plan.md` technical approach
- `tasks.md` completion and dependency order
- Relevant sections of `docs/control/PROJECT_CONTROL.md`
- Actual diff and validation output

Reject scope creep, stale layer IDs, missing contracts, undocumented validation failures,
or changes outside ownership.

## Related Documents

- `AGENTS.md`
- `.specify/memory/constitution.md`
- `docs/README.md`
- `docs/control/PROJECT_CONTROL.md`
- `docs/archive/2026-06-16-implemented-specs/INDEX.md`

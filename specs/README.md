# specs/ — Spec Kit Workspace

> **Classification:** SPEC_WORKSPACE
> **Last updated:** 2026-06-14

`specs/` is the **workspace for planned feature and refactor work**. Each medium or
large feature or refactor gets its own dedicated spec folder under `specs/`.

This document describes the folder pattern, the role of each file inside a spec
folder, and the rules for implementation and reviewer agents.

---

## When to create a spec folder

Create a spec folder under `specs/` for:

- A new layer being added to the system.
- A large multi-agent feature (frontend + API + database + fetcher + normalizer).
- A large refactor (e.g., API route split, frontend layer folder normalization,
  contracts module split).

For small cross-cutting repairs or single-lane fixes, use a work order under
`docs/work-orders/` instead. Do not create a spec folder for a one-line change.

---

## Folder pattern

Each spec folder uses the pattern:

```
specs/<NNN>-<feature-or-layer-name>/
```

Where:

- `<NNN>` is a zero-padded three-digit number that orders specs by their
  introduction time (e.g., `001`, `002`, `003`).
- `<feature-or-layer-name>` is a short kebab-case slug that describes the work
  (e.g., `layer-zero-globe-core`, `layer-07-weather-mvp`).

### Existing spec folders

The following spec folders already exist in the current tree and follow this
pattern. New specs should be appended after the highest existing number:

- `specs/001-layer-zero-globe-core/`
- `specs/002-layer-one-aviation/`
- `specs/003-layer-05-space-satellites-mvp/`
- `specs/004-layer-10-energy-infrastructure-mvp/`
- `specs/005-layer-06-maritime-mvp/`
- `specs/006-layer-07-weather-mvp/`
- `specs/007-layer-08-news-osint-mvp/`

---

## File roles inside a spec folder

Each spec folder should contain, as needed for the work:

| File / Folder | Role | Required for |
|---|---|---|
| `spec.md` | What and why. Problem statement, scope, non-goals, success criteria. | All specs |
| `research.md` | Evidence and options. Audit results, prior-art searches, alternative approaches considered. | Specs that need evidence before planning |
| `plan.md` | Selected technical approach. The chosen design, broken into per-lane sections (database, fetching, normalization, API, frontend). | All medium and large specs |
| `tasks.md` | Ordered implementation tasks. One task per row of work, sequenced for the worker agents. | All specs that will be implemented |
| `contracts/` | API/data contracts relevant to the spec. Zod schemas, OpenAPI fragments, or data contract documents. | Specs that introduce or change an API or data shape |
| `quickstart.md` | Validation and run instructions. How to run migrations, seed data, start the API, exercise the new endpoint, observe the new UI behavior. | Specs that change runtime behavior |

### `spec.md`

The `spec.md` file answers:

- What problem are we solving?
- What is the scope of this work?
- What is explicitly out of scope (non-goals)?
- What does success look like?

### `research.md`

The `research.md` file answers:

- What evidence (audit, prior art, measurements) supports the chosen direction?
- What alternatives were considered and why were they rejected?

### `plan.md`

The `plan.md` file answers:

- What is the selected technical approach?
- What is the per-lane plan (database, fetching, normalization, API, frontend)?
- What is the migration / rollout / rollback strategy?

### `tasks.md`

The `tasks.md` file answers:

- What are the ordered implementation tasks?
- Which lane / agent owns each task?
- What is the dependency order?
- What is the definition of done for each task?

### `contracts/`

The `contracts/` folder contains:

- Zod schemas for new API response shapes
- OpenAPI fragments if the project uses them
- Data contract documents for new database tables
- TypeScript type definitions for shared models

### `quickstart.md`

The `quickstart.md` file answers:

- How do I run the migrations?
- How do I seed the data?
- How do I start the API and frontend?
- How do I exercise the new endpoint or UI behavior?
- How do I verify the change is working?

---

## Rules for implementation agents

- **Follow `tasks.md`.** Do not invent scope. If a needed task is missing from
  `tasks.md`, raise it in `HANDOFF_LOG.md` and request the Orchestrator Agent to
  update `tasks.md` before proceeding.
- **Stay within the spec folder's allowed scope.** Do not modify files outside the
  scope defined by the spec's `plan.md` and `tasks.md`. Cross-lane changes are
  coordinated by the Orchestrator Agent.
- **Append a handoff entry** to `docs/state/HANDOFF_LOG.md` after work, per the
  rules in `AGENTS.md` and the `APPEND_ONLY_LOG` classification.

## Rules for reviewer agents

- **Review against `spec.md`, `plan.md`, and `tasks.md`.** The spec defines the
  intent. The plan defines the approach. The tasks define the work.
- **Verify each task is complete and matches the plan.** Reject scope creep
  (changes outside `tasks.md`).
- **Verify handoff log entries** for the spec work are present and complete.

## Rules for the Orchestrator Agent

- Create spec folders. Number them sequentially. Use kebab-case slugs.
- Update `docs/state/CURRENT_PROJECT_STATE.md` and `docs/state/HANDOFF_LOG.md` as
  the spec moves through its lifecycle.
- Do not let unrelated work piggyback on a spec branch.

---

## Related documents

- `docs/README.md` — documentation map and the `SPEC_WORKSPACE` classification
- `docs/decisions/ADR-001-documentation-system.md` — the ADR that defines this
  workspace
- `AGENTS.md` — agent roles, hard rules, workflow cycle
- `docs/control/ENGINEERING_STRUCTURE_RULES.md` — engineering structure rules

# API Endpoint Path Policy

> **Classification:** ACTIVE_POLICY
> **Agent:** API Policy Documentation Agent
> **Lane:** Documentation / Policy
> **Date:** 2026-06-17
> **Work order:** API-POLICY-001
> **Branch:** `docs/api-policy-001-public-api-naming`
> **Parent commit:** `5bcb089 docs(spec): close frontend reconstruction status`
> **Source context:** API-001 (read-only audit), API-PLAN-001 (read-only plan)
> **Source docs:** `specs/008-structure-remediation-roadmap/spec.md`, `plan.md`, `tasks.md`
> **Status:** Decided. Implementation not yet started.

This document records the public API endpoint naming policy. It is
**decision / policy documentation only**. No endpoint path is changed
by this work order. No source code is changed. The policy establishes
what the next API implementation work orders must do — and what they
must not do.

The policy was set by the user / decision-control layer after the API
audit and the API planning report. It is binding for all subsequent
API endpoint work.

---

## 1. Current Decision

The public API URL surface must use **clean readable domain slugs**.
It must **not expose internal implementation IDs**.

Specifically:

* Public API URLs use clean readable names such as `weather`,
  `aviation`, `energy`, `news`, `maritime`, `space`,
  `borders-boundaries`, `earth-events`.
* Public API URLs **must not** expose internal layer-number IDs such
  as `layer_07_weather`, `layer_08_news_osint`, or
  `layer_10_energy_infrastructure`.
* Internal IDs **may** continue to exist in:
  * Database tables and column names.
  * Contract / schema files in `packages/contracts/`.
  * The canonical layer registry record (in
    `apps/api/src/routes/layers.ts` `LAYER_REGISTRY`).
  * Internal TypeScript constants (e.g. `LAYER_ID`).
  * Tests.
  * Server-side route registration code, registry payload, and log
    messages.
  * Internal fetcher / normalizer / ingestion records.
* The public API URL surface and the internal layer registry are
  **separate concerns**. They serve different audiences. They are
  allowed to use different naming conventions.

Why:

* Public URLs are seen by users, by integrators, by debuggers, by
  accident. A public URL like
  `/api/layers/layer_07_weather/weather/current` exposes an internal
  implementation detail that the project does not own in the public
  sphere.
* Internal layer IDs are stable, machine-friendly, and tied to the
  registry. They are the right thing to use inside the system.
* Mixing the two makes the program harder to understand. The policy
  is the simplest separation that keeps both names correct.

This decision **supersedes** the "Blocked / Needs decision" entry on
the API endpoint path policy in `tasks.md` and `plan.md`. The decision
is now recorded. The implementation is a separate, future work item.

---

## 2. Public Slug Map

This table maps each internal layer ID to its public slug. The public
slug is what should appear in public API URLs after the migration is
complete. The internal layer ID remains in use for everything that
is not a public URL.

| Internal layer ID | Public slug |
|---|---|
| `layer_01_aviation` | `aviation` |
| `layer_02_borders_boundaries` | `borders-boundaries` |
| `layer_03_earth_events` | `earth-events` |
| `layer_05_space_satellites` | `space` |
| `layer_06_maritime` | `maritime` |
| `layer_07_weather` | `weather` |
| `layer_08_news_osint` | `news` |
| `layer_10_energy_infrastructure` | `energy` |

Notes:

* The slugs are **public URL only**. They are not new layer IDs.
  Internal code keeps using the canonical `layer_NN_name` IDs.
* `layer_00_globe_core` (foundation layer, frontend-only) has no
  public slug because it has no public API surface.
* `layer_04_public_military_security` and `layer_09_user_shapes`
  are `coming_soon`. No public slug is reserved yet. A future
  work order can reserve one when the layer ships.
* The slug `borders-boundaries` uses a hyphen to match the existing
  public URL convention. Slugs use lowercase letters, digits, and
  hyphens only.

---

## 3. Preferred Future Public API Shape

After migration, the public API URL surface should look like the
examples below. These are **preferred shapes**, not yet-implemented
endpoints. They are listed here so that any new endpoint or any
migration step has a target shape to converge on.

### 3.1 Layer-scoped endpoints

* `GET /api/layers/aviation/aircraft/latest` — replaces
  `GET /api/aviation/aircraft/latest`.
* `GET /api/layers/aviation/aircraft/:sourceObjectId` — replaces
  `GET /api/aviation/aircraft/:sourceObjectId`.
* `GET /api/layers/borders-boundaries/countries` — replaces
  `GET /api/borders-boundaries/countries`.
* `GET /api/layers/earth-events/latest` — replaces
  `GET /api/earth-events/latest`.
* `GET /api/layers/space/satellites` — replaces
  `GET /api/space/satellites`.
* `GET /api/layers/space/satellites/:satelliteId` — replaces
  `GET /api/space/satellites/:satelliteId`.
* `GET /api/layers/maritime/objects` — replaces the
  `/api/layers/<layerId>/objects` form with the literal slug.
* `GET /api/layers/weather/current` — replaces
  `/api/layers/<layerId>/weather/current`.
* `GET /api/layers/weather/hourly` — replaces
  `/api/layers/<layerId>/weather/hourly`.
* `GET /api/layers/weather/nearby` — replaces
  `/api/layers/<layerId>/weather/nearby`.
* `GET /api/layers/news/items` — replaces
  `/api/layers/<layerId>/news/items`.
* `GET /api/layers/news/markers` — replaces
  `/api/layers/<layerId>/news/markers`.
* `GET /api/layers/energy/infrastructure` — replaces
  `/api/energy/infrastructure`.
* `GET /api/layers/energy/infrastructure/:featureId` — replaces
  `/api/energy/infrastructure/:featureId`.

### 3.2 Endpoint families that should remain clean and separate

These endpoint families are already on clean, readable URLs. They
should not be migrated into the `/api/layers/<slug>/...` shape. They
are separate concerns and have their own well-defined identities:

* `GET /api/airports/:airportId/intelligence` — airport-keyed
  aggregation across layers. Keying is on the airport, not on any
  layer.
* `GET /api/airports/:airportId/layout-features` — airport-keyed
  layout data.
* `GET /api/airports/:airportId/public-profile` — airport-keyed
  public profile (cache + status).
* `WS /ws/aviation/aircraft/live` — WebSocket live broadcast for
  aviation aircraft.
* `WS /ws/space/satellites/live` — WebSocket live broadcast for
  space satellites.
* `GET /api/health` — health check.

### 3.3 Endpoint families that must remain generic

These endpoint families are intentionally generic and must not be
per-layer:

* `GET /api/layers` — list available layers (generic summary).
* `GET /api/layers/registry` — full registry (11 entries).
* `GET /api/layers/:layerId` — registry entry by ID (uses internal
  layer ID; this is acceptable because the registry endpoint is
  documented to use internal IDs).
* `GET /api/layers/:layerId/status` — per-layer status
  (uses internal layer ID; same reason).

The use of internal layer IDs in these generic registry endpoints is
**not** a violation of the policy. These endpoints are about the
registry itself; they are not user-facing data endpoints. They are
treated as the registry's external surface, which is the same
identifier set the registry uses internally. The slug policy applies
to **data endpoints**, not to registry metadata endpoints.

---

## 4. Current Transitional State

The current state of `apps/api/src/` and the frontend consumers is
mixed:

* Some `apps/api` route folders register their endpoints with
  `/api/layers/<layerId>/...` using the internal `LAYER_ID`
  constant (e.g. `maritime/index.ts`, `weather/index.ts`,
  `news/index.ts`). This is a partial canonical form that **still
  exposes internal IDs in public URLs** and therefore does not
  conform to the policy yet.
* Some route files are still single-file with legacy domain paths
  (e.g. `aviation-aircraft.ts` exposes `/api/aviation/aircraft/...`).
* The frontend (`apps/web/src/lib/api.ts` and per-layer `*Api.ts`
  files) consumes both styles.
* The airport-keyed and WebSocket endpoints already use clean names.

The migration to the policy is **not yet started**. The transitional
rules below govern what is allowed until the migration lands.

---

## 5. Compatibility Policy

The migration must not break existing callers. The rules below apply
to any work order that introduces a new clean slug endpoint or that
removes an existing path.

1. **Do not remove an existing endpoint path in the same work order
   that introduces its clean slug replacement.** Compatibility must
   be maintained during migration.
2. **Old paths must continue to work as compatibility aliases** for
   as long as any frontend code, test, or external caller relies on
   them. The frontend migration is a **separate work order** and
   must complete and validate before any old alias is removed.
3. **New clean slug endpoints should be added before old paths are
   removed.** Each new endpoint ships with a test that exercises the
   new path; the existing test for the old path continues to pass
   unchanged.
4. **Frontend migration is a coordinated work order**, not an
   in-flight change. The frontend work order (`WEB-API-001` in the
   recommended sequence) updates one consumer at a time, with both
   paths returning the same shape, and runs the full web test suite
   after each consumer update.
5. **Old paths may only be removed after real runtime validation**
   — not only the test suite. The user / decision-control layer
   decides when an old path can be removed.
6. **Old paths may also be formally kept as compatibility endpoints**
   indefinitely. The compatibility decision is a user-level
   decision per path family.

---

## 5.1 Compatibility Alias Decision (locked by API-COMPAT-001)

> **Status:** Locked by work order **API-COMPAT-001** on branch
> `docs/api-compat-001-keep-old-paths` (parent `94d3895`).
> **Source docs:** this file (Section 5 rules above), `tasks.md`,
> `plan.md`, `docs/state/HANDOFF_LOG.md`, `docs/state/RECENT_CONTEXT.md`.
> **Implementation:** docs / policy only. No source code changed.

The clean public API migration is complete:

* **API-URL-001** and **WEB-API-001** delivered the clean Weather and
  News public slug endpoints and migrated the frontend to them.
* **API-URL-002** and **WEB-API-002** delivered the clean slug
  endpoints for the remaining six endpoint groups
  (aviation, borders-boundaries, earth-events, space, maritime,
  energy) and migrated the frontend to them.

The user / decision-control layer has now made the compatibility
decision explicit. The locked policy is:

1. **Clean slug URLs are the official public API.** New frontend
   code, new API documentation, and any future work order must use
   the clean slug pattern:

   ```
   /api/layers/<slug>/<resource>
   ```

   Approved public slugs (from Section 2):

   * `aviation`
   * `borders-boundaries`
   * `earth-events`
   * `weather`
   * `news`
   * `space`
   * `maritime`
   * `energy`

2. **Old layer-ID / legacy paths remain supported compatibility
   aliases for now.** They are registered by the backend and return
   the same response shape as their clean slug equivalents. They are
   not preferred. They are not advertised. They are kept so that any
   third-party caller, test fixture, or leftover frontend code that
   still references them continues to work without breakage.

   Examples of paths that remain registered as compatibility aliases
   (non-exhaustive; the full set is the union of the old paths that
   existed before API-URL-001 and API-URL-002, plus their clean slug
   aliases added in those work orders):

   * `/api/aviation/aircraft/latest` and
     `/api/aviation/aircraft/:sourceObjectId`
   * `/api/borders-boundaries/countries`
   * `/api/earth-events/latest`
   * `/api/layers/layer_01_aviation/weather/<verb>` (the legacy
     aviation objects endpoints have no clean alias and remain on
     the old internal layer-ID path)
   * `/api/space/satellites`, `/api/space/satellites/categories`,
     `/api/space/satellites/:satelliteId`
   * `/api/layers/layer_06_maritime/<verb>` (4 paths: objects,
     objects/:objectId, stats, vessels/:mmsi/positions)
   * `/api/energy/infrastructure`,
     `/api/energy/infrastructure/categories`,
     `/api/energy/infrastructure/sources`,
     `/api/energy/infrastructure/:featureId`
   * `/api/layers/layer_07_weather/weather/<verb>` (Weather legacy)
   * `/api/layers/layer_08_news_osint/news/<verb>` (News legacy)

3. **Frontend callers must keep using clean slug URLs.** WEB-API-001
   and WEB-API-002 have already migrated the frontend's active
   callers. New frontend code added after this decision must use the
   clean slug pattern. Old compatibility aliases must not be added to
   any new frontend caller. Frontend tests that previously asserted
   old paths have been updated; any new frontend test that targets a
   clean endpoint must assert the clean slug path.

4. **API documentation must present clean slug URLs first.** Any new
   or updated API documentation, README section, or example must
   use the clean slug pattern. The compatibility aliases should be
   mentioned only as a brief note in a "compatibility" section, not
   as a recommended path.

5. **Old path removal is deferred.** No old compatibility alias may
   be removed without a future explicit user / decision-control
   decision. If the user later decides to remove old aliases, that
   work must happen under a separate explicit work order
   (`API-URL-003` in the migration sequence in Section 10). The
   current decision is **keep**. `API-URL-003` is **deferred until
   explicitly chosen**.

6. **API-URL-003 status:** **Deferred (not selected).** It remains on
   the optional cleanup list. It will be re-evaluated only if the
   user / decision-control layer issues a new decision.

7. **Until the user issues a removal decision, tests may continue to
   assert compatibility.** Backend alias tests (added in API-URL-001
   and API-URL-002 under the `alias.N` naming pattern) and any frontend
   test that exercises a compatibility alias are valid until the
   alias is removed. New tests for clean slug endpoints should
   prefer asserting the clean slug path.

8. **A future removal work order must follow Section 5 rules 1–5.**
   Specifically: the removal of any old path must happen in a
   separate work order; it must not be combined with the introduction
   of the clean slug replacement (the introduction is already in
   `API-URL-001` / `API-URL-002`); the frontend migration must have
   completed (it has, in `WEB-API-001` / `WEB-API-002`); the user /
   decision-control layer must have issued an explicit removal
   decision; and the removal work order must update the alias tests
   to assert the absence of the old path (or to assert a 410 Gone
   response, if a `410` policy is later chosen).

This section is the binding compatibility decision. It supersedes
any earlier wording in `tasks.md` and `plan.md` that implied the old
paths would be removed automatically. The old paths are now
**compatibility aliases** until the user explicitly removes them.

---

## 6. API Folder Naming Policy

API route folders should describe **domain purpose**, not internal
layer numbers. This is independent of the URL slug policy above but
supports it.

Good examples:

* `apps/api/src/routes/weather/`
* `apps/api/src/routes/news/`
* `apps/api/src/routes/maritime/`
* `apps/api/src/routes/energy/infrastructure/`
* `apps/api/src/routes/aviation/aircraft/`
* `apps/api/src/routes/borders-boundaries/`
* `apps/api/src/routes/earth-events/`
* `apps/api/src/routes/space/satellites/`
* `apps/api/src/routes/airports/public-profile/`
* `apps/api/src/routes/airports/intelligence/`
* `apps/api/src/routes/airports/layout-features/`

Avoid:

* `apps/api/src/routes/layer_07_weather/`
* `apps/api/src/routes/layer_10_energy_infrastructure/`
* `apps/api/src/routes/layer_06_maritime/`
* Any other API route folder whose name is an internal layer ID.

Internal constants and SQL queries may still reference the internal
layer ID. The folder name is a human-readable descriptor for the
public surface, not a database key.

---

## 7. Shim Policy

Shims are compatibility re-exports. They exist so old import paths
keep working after a route split. They are **not** a permanent
fixture.

Rules:

* Pure internal re-export shims should be removed when their
  importers are moved to canonical folder imports. Each shim
  removal must happen in the same work order as the import
  update — never as a standalone cleanup.
* **Mixed-role files must not be deleted as if they were shims.**
  A file that contains a re-export **and** meaningful code (for
  example, a WebSocket handler) is a mixed-role file, not a shim.
* `apps/api/src/routes/space/satellites.ts` is currently a
  mixed-role file: it re-exports the REST route from
  `./satellites/index.js` and also contains
  `attachSpaceSatellitesWebSocket` and the upgrade handler. It must
  not be deleted as a pure shim. Removing it requires first
  extracting the WebSocket broadcaster to its own file in a
  dedicated work order.
* Shim removals must be **small reviewed work orders**, one shim or
  one file at a time, with the build and the full test suite
  passing.
* A work order that removes shims must not change any endpoint
  behavior, response shape, registration order, or path.

---

## 8. File Size / Responsibility Policy

File size alone is not a reason to split a file. The reason to split
a file is **mixed responsibility**.

Rules:

* **Do not split files just because they are large.** A large file
  with one clear responsibility is acceptable.
* **Split only when a file mixes responsibilities.** Mixing
  responsibilities means a file combines, for example: route
  handler registration + SQL query building + response mapping +
  request validation + business logic + compatibility glue.
* When splitting, use **meaningful names** that describe the new
  file's responsibility (`service.ts`, `repository.ts`, `mapper.ts`,
  `validation.ts`, `types.ts`, `index.ts`, etc.).
* The split must follow the existing per-responsibility folder
  pattern used by `airport-intelligence/`, `weather/`, `news/`,
  `maritime/`, `energy/infrastructure/`, and `space/satellites/`.
* A split is a **pure refactor**. It must not change the response
  shape, the path, or the behavior of any endpoint.

---

## 9. API Boundary Policy

API work is **not** fetcher work, normalizer work, or ingestion work.
The lanes are separate by design and must stay separate.

Rules:

* `apps/api/src/` may not fetch external source data directly. No
  outbound HTTP client calls for source retrieval.
* `apps/api/src/` may not normalize raw payloads into canonical
  tables. Normalization belongs in `services/normalizer/`.
* `apps/api/src/` may not run scheduled ingestion jobs. Ingestion
  belongs in `database/ingestion/`.
* `apps/api/src/` may read database records and return responses.
* `apps/api/src/` may record a fetch-run request / status (e.g. a
  row in `airport_public_profile_fetch_runs`), but it must not
  perform the external fetch itself.
* The boundary is enforced by ownership:
  * `apps/api/` is owned by the **API Agent**.
  * `services/fetch-orchestrator/` is owned by the **Fetcher Agent**.
  * `services/normalizer/` is owned by the **Fetcher / Database
    Agent** per Spec 008.
  * `database/ingestion/` is owned by the **Database Agent**.

An API cleanup work order must not touch any file outside
`apps/api/src/`, `apps/api/tests/`, the relevant `packages/contracts/`
files (read-only), and the relevant `docs/` files.

---

## 10. Migration Sequence

The recommended order for any API cleanup work after this policy is
recorded. Each step is a separate small work order. Each step must
build and test cleanly on its own before merging.

1. **API-POLICY-001** — record this policy (this work order). Marks
   the "API endpoint path policy decision" entry in `tasks.md` and
   `plan.md` as **decided**. Implementation remains **pending**.
2. **API-IMP-001** — normalize `apps/api/src/index.ts` route imports
   to the folder form (e.g. `'./routes/weather/index.js'`). Delete
   the pure internal shim files that no longer have any importers.
   Leave `space/satellites.ts` (mixed-role) and `objects.ts`
   (multi-export shim) in place for now.
3. **API-URL-001** — add clean slug endpoint aliases for the data
   endpoints that currently expose internal IDs in the path. Each
   new alias must serve the same response shape as the existing
   endpoint. Keep the old endpoint working as a compatibility alias.
   Add at least one test per new alias.
4. **WEB-API-001** — migrate the frontend consumers
   (`apps/web/src/lib/api.ts` and the per-layer `*Api.ts` files) to
   the clean slug endpoints. Migrate one consumer at a time. Run the
   full web test suite after each consumer update.
5. **API-URL-002** — only after frontend migration and real runtime
   validation, either remove the old aliases or formally keep them
   as compatibility endpoints. The user / decision-control layer
   decides per path family.
6. **API-SIZE-001** — inspect and split large API files **only
   where responsibility mixing exists**. Do not split a large
   cohesive file just because of line count.

Additional sequencing notes:

* The fetcher / normalizer work (Spec 008 SR-015) and the database
  migration documentation cleanup (Spec 008 SR-016) are independent
  lanes. They must not be mixed into the API cleanup sequence.
* The "TODO / deprecated marker cleanup", "CesiumGlobe split
  planning", and "Missing package ownership row decision" items
  tracked in `tasks.md` are separate decisions. They are listed in
  the remaining-recommended-order block and remain Pending / Planned
  later / Blocked per their existing status.

---

## 11. Scope and Authority

* This policy is binding for the next API implementation work
  orders.
* It does **not** retroactively rename any URL. Existing paths keep
  working until the migration sequence above is approved and run.
* It does **not** change any internal ID. Layer IDs, schema names,
  table names, contract types, and internal constants stay the same.
* It does **not** require changes to `apps/web/`, `services/`,
  `database/`, or `packages/contracts/` until the corresponding
  implementation work order in the migration sequence.

---

## 12. Cross-References

* `apps/api/src/index.ts` — Fastify entrypoint; the place where the
  import normalisation of API-IMP-001 will land.
* `apps/api/src/routes/` — current route tree; contains the per-layer
  folders that should eventually follow Section 6.
* `apps/web/src/lib/api.ts` and `apps/web/src/layers/.../*Api.ts` —
  frontend consumers that will be migrated in WEB-API-001.
* `specs/008-structure-remediation-roadmap/tasks.md` — work-package
  status table; this policy updates the "API endpoint path policy
  decision" entry from Blocked to Decided (implementation Pending).
* `specs/008-structure-remediation-roadmap/plan.md` — phase plan;
  this policy updates the "Needs decision" snapshot.
* `docs/control/PROJECT_CONTROL.md` — single active project control
  file; not modified by this work order. If future active guidance
  here directly contradicts this policy, stop and report.
* `docs/state/RECENT_CONTEXT.md`, `docs/state/HANDOFF_LOG.md` —
  state docs; updated by this work order per AGENTS.md.

---

**Last updated:** 2026-06-17 (compatibility alias decision locked by API-COMPAT-001)
**Originally authored:** 2026-06-17 (initial recording per API-POLICY-001)
**Author:** API Policy Documentation Agent
**Maintained by:** Orchestrator Agent

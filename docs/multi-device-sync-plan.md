# Multi-device real-time sync: design plan (not built yet)

This is a design document, not a feature that exists. Incident Forge today is local-only: one
browser, one device, `localStorage`, no account, no backend. This doc lays out how a future
multi-device version would work, so that if it's ever built, the thinking isn't lost, and so anyone
looking at the project can see what the upgrade path actually involves before deciding whether it's
worth it.

## Why this exists, and why it's not built

The original idea for this app was real-time and cross-device from day one, using
[Supabase](https://supabase.com) (a hosted Postgres database with built-in auth, row-level security,
and realtime subscriptions). After weighing that against "never used Supabase before, don't know yet
if I'll actually want cross-device," the decision was to build v1 fully local-only first: zero
accounts, zero cost, zero backend, and treat this as an optional upgrade to revisit once the tool has
actually been used.

Local-only means Red and Blue team views are a convenience toggle on one shared device or browser,
not a secret enforced between separate people on separate machines, the same trust model as
physically hiding a GM screen, not a security boundary. That's fine for one facilitator running
things from one laptop. It stops being fine the moment Red and Blue are supposed to be on different
machines and genuinely not see each other's view.

Before any of the backend work below happens, the local codebase was refactored (see "Seams this
upgrade will use" below) specifically to make this swap smaller when the time comes. That refactor is
done. The backend itself is not.

## The core problem this design solves

Today, `useExerciseStore` owns one big object in memory and localStorage: `{ scenarios, runs }`.
Every component reads straight from it. Team-visibility rules (who sees which inject) are enforced by
simply not rendering the hidden parts, there's no real barrier stopping Red's browser from having
Blue's data sitting right there in memory if it wanted to. That's fine locally, nothing else has
access to that browser. It stops being fine the instant data crosses a network: if Red's device
fetches the same full `runs` row Blue's does, and the client just hides what it isn't supposed to
show, then the "visibility" rule is cosmetic. Anyone who opens dev tools on the network tab sees
everything.

**The fix is to never send the hidden data to the client that shouldn't see it**, enforced at the
database level (Postgres row-level security), not just in the UI.

## Schema

- **`scenarios`**: same shape as today's authored scenario (title, summary, objectives, tags), owned
  by whoever created it.
- **`injects`**: belongs to a scenario. Full content (title, body, visibility, order, trigger note)
  lives here. **Only the facilitator's client ever gets `SELECT` on this table.**
- **`rooms`**: one row per live run. Has a short join code (what Red/Blue type in to connect), a
  reference to the scenario it's running, and status (`lobby` / `running` / `paused` / `ended`), same
  states as today's local `run.status`.
- **`participants`**: one row per device that's joined a room, with a `role` (`facilitator` / `red` /
  `blue`). Created only through the `join_room` RPC below, never by a raw insert, so a client can't
  just claim to be the facilitator.
- **`room_injects`**: this is the enforcement mechanism. A row in this table *is* "revealed", its
  existence is the reveal event. When the facilitator reveals an inject, a row gets inserted here with
  a snapshot of that inject's content (title, body) at that moment. Red and Blue's clients query this
  table, never `injects` directly, so they can only ever see injects that have actually been revealed,
  enforced by Postgres, not by the client choosing not to render something.
- **`decisions`**: one row per logged decision, with `room_id`, `team` (`red`/`blue`), the linked
  inject (nullable, for a general note), body, and timestamp. Row-level security scopes `SELECT` to
  rows where `team` matches the requesting participant's own role (plus the facilitator, who sees
  both), so Red's client genuinely cannot query Blue's log even if it tried.
- **`room_events`**: the shared timeline (status changes, inject reveals), same role as today's local
  `run.events`, used to build the after-action report.

## The key rule

**Red and Blue clients must never get `SELECT` on the raw `injects` table, only on `room_injects`.**
This is the one thing that actually matters for this to be a real security boundary instead of a
dressed-up version of what the local app already does. The Supabase anon key ships inside the public
JS bundle, anyone can read it out of the network tab, so row-level security policies are the only real
enforcement, not "the client app happens not to ask for that data."

## Identity and roles

- Each device signs in anonymously (`supabase.auth.signInAnonymously()`), no email, no password, no
  account creation screen, just an anonymous session so Postgres has something to scope row-level
  security policies to.
- Roles are assigned only through two `security definer` Postgres functions (RPCs), never through a
  raw `insert` the client could forge:
  - **`create_room(scenario_id)`**: creates the room, makes the calling device its facilitator, returns
    the join code.
  - **`join_room(join_code, requested_role)`**: looks up the room by code, inserts a `participants`
    row for the calling device with the requested role (`red` or `blue`, the facilitator role can only
    come from `create_room`), returns the room id.
- Row-level security policies on every table check "does a `participants` row exist for this room and
  this device's identity, with the right role" rather than trusting anything the client claims.

## Realtime

- Clients subscribe to Postgres changes scoped to their room (`room_injects`, `decisions`,
  `room_events`, filtered by `room_id`).
- **Every incoming realtime event is treated as a pure invalidation signal, never as the actual data.**
  On a change notification, the client refetches through the normal RLS-protected `select`, it never
  trusts the payload that rode in on the realtime channel. This matters because Supabase's realtime
  payloads reflect the raw row change, and depending on configuration can include more than the
  subscriber's RLS policy would actually let them `select`, trusting the push payload directly would
  be the same visibility leak as the thing we're building this whole scheme to avoid.

## Seams this upgrade will use

Two pieces of the local codebase were deliberately refactored ahead of time (not as part of this doc,
as actual shipped work) specifically so this upgrade is a contained change instead of a rewrite:

- **`useExerciseStore`'s run-action API** (`createRun`, `cancelRun`, `startExercise`, `pauseExercise`,
  `resumeExercise`, `endExercise`, `revealInject`, `setObjectiveOutcome`, `setDebriefNotes`,
  `logDecision`, in `src/hooks/useExerciseStore.js`): every run mutation already goes through one of
  these named methods instead of being scattered across components. A Supabase-backed version of this
  hook swaps what's *inside* each method (a local `update(...)` call becomes an `await`ed network
  write, probably with an optimistic local update while waiting) without any component needing to
  change, they already just call `createRun(...)`, `revealInject(...)`, etc.
- **`visibleInjectsForTeam(run, scenario, team)`** (in `src/data/model.js`): the exact client-side
  visibility rule, already pulled out into one tested function instead of being buried in JSX. This is
  the rule the `room_injects` row-level security policy above needs to replicate server-side. Having
  one clear, tested definition of "what should Red see" means there's a concrete spec to implement
  against, rather than reverse-engineering it from component code.

## What's deliberately not done yet

- **No `joinCode`/`roomId`/`participants` fields were added to the local data model.** There's no
  current consumer for them locally, adding unused fields now would just be dead code sitting around
  until the backend exists. They get introduced as part of actually building this, not before.
- **The run-action methods on `useExerciseStore` are still synchronous.** A real Supabase-backed
  version would make them `async` (awaited network writes, probably with optimistic local state while
  the write is in flight). Deciding the exact optimistic-update strategy now, with nothing to await
  yet, would be guessing. That's a decision for when this is actually built.
- **No Supabase account, project, or dependency exists anywhere in this repo.** This document is the
  entire footprint of this plan today.

## Rough build order, if this gets picked up

1. Supabase project + schema (the tables above) + RLS policies, with the `room_injects`-only rule for
   Red/Blue as the first thing to get right and test, before anything else.
2. `create_room`/`join_room` RPCs, anonymous auth wiring.
3. A Supabase-backed implementation of `useExerciseStore`'s existing action API (same method
   signatures, different internals), behind a flag or a separate hook so local-only mode keeps working
   without a Supabase project configured.
4. Realtime subscriptions wired to invalidate and refetch, per the rule above.
5. A join-code UI (facilitator shares a code, Red/Blue type it in instead of using the local view
   switcher).
6. GitHub Actions deploy gains the Supabase URL/anon key as repo secrets, injected as Vite env vars at
   build time.

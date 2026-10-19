# Incident Forge

A web-based facilitator tool for running Red Team / Blue Team incident-response tabletop exercises:
author scenarios made of "injects" (events you reveal as the exercise unfolds), run an exercise by
revealing injects and logging each team's decisions, then export an after-action report. Everything
is saved to your browser's local storage: nothing leaves your machine, no account required.

v1 is single-device. Red and Blue views are a convenience toggle meant for handing off the same
screen (or for a facilitator narrating to a room), not a secret enforced between separate people on
separate machines. See `CONTRIBUTING.md` for how changes get made, and
[`docs/multi-device-sync-plan.md`](docs/multi-device-sync-plan.md) for the design behind the planned
multi-device upgrade (not built yet).

## How to use it

### 1. Write a scenario

In the **Scenarios** tab, click **+ New Scenario** and give it a title and a short summary. Add a
few **objectives** (what a "successful" response looks like for this exercise) and then build out
the **injects**: each inject is one event you'll reveal partway through the exercise ("the help desk
reports encrypted shares," "a reporter calls asking about the breach"). For each inject, set:

- **What happens**: the text you'll read out or show when you reveal it
- **Visible to**: who's allowed to see it once revealed (everyone, Red Team only, Blue Team only,
  or facilitator-only notes that never get shown to either team)
- **Pacing note** (optional): a reminder to yourself like "~T+15m," purely advisory, there's no
  real timer tied to it

Use the ▲/▼ buttons to put injects in the order you plan to reveal them.

### 2. Run the exercise

Switch to the **Run Console** tab, pick a scenario, and click **Start Run**. This creates the run in
a "ready to start" state so you can get everyone in place before the clock starts. Click
**Start Exercise** when you're ready to begin.

From here you can:

- **Reveal** injects one at a time as the exercise plays out, in whatever order makes sense
- **Pause**/**Resume** if you need a break. The elapsed-time clock excludes paused time, so a
  10-minute coffee break doesn't inflate how long the exercise "took"
- Mark each **objective** as Met / Partially met / Missed, any time during or after the run
- Jot down **debrief notes** as things come up, not just at the very end
- **End Exercise** once it's done (this stops further injects from being revealed, but nothing is
  deleted, the full run stays around afterward)

### 3. Hand off to the teams

Use the **Facilitator / Red Team / Blue Team** switcher at the top of the page. This is a
single-device convenience toggle, not a secret: switching to Red Team view and handing someone the
keyboard works the same as handing over a printed packet. Each team's view only ever shows:

- injects that have been revealed **and** are visible to "everyone" or specifically to that team
- that team's own decision log (never the other team's)

Each team can log a decision at any point the exercise is running, optionally tagged to the inject
they're responding to, or as a general note. Switch back to Facilitator to keep revealing injects
and watch both teams' logs update live.

### 4. Wrap up

Once a run has ended, use **Print Report** for a printer-friendly after-action report (objectives
and their outcomes, the full timeline of injects/decisions, and your debrief notes), or
**Download JSON** for a raw backup you can keep or hand off. A downloaded run can be brought back in
later with **Import Run** on the Run Console, including on a different browser or computer, handy
for moving a completed exercise somewhere else, or just keeping an off-browser backup.

Past runs stay listed under **Past runs** on the Run Console (nothing is ever deleted), each with
its own Print/Download buttons.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (v18+ recommended).

```bash
npm install
npm run dev
```

# Incident Forge

A web-based facilitator tool for running Red Team / Blue Team incident-response tabletop exercises:
author scenarios made of "injects" (events you reveal as the exercise unfolds), run an exercise by
revealing injects and logging each team's decisions, then export an after-action report. Everything
is saved to your browser's local storage: nothing leaves your machine, no account required.

v1 is single-device. Red and Blue views are a convenience toggle meant for handing off the same
screen (or for a facilitator narrating to a room), not a secret enforced between separate people on
separate machines. See `CONTRIBUTING.md` for how changes get made, and open issues for the planned
multi-device upgrade path.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (v18+ recommended).

```bash
npm install
npm run dev
```

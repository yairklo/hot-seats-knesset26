# Notes for agents

Read `README.md` first. It defines the project's terms (inside the line, hot range, safe seats, poll average). Do not change those definitions.

- UI text is Hebrew, right-to-left. Keep new text in the same style.
- Never guess a candidate's gender. Leave `gender: null` until it is confirmed from a reliable source, and keep the warning the UI shows for it.
- If a poll names a party that has no `partyMap` entry or no list in `candidates.json`, the UI must warn rather than guess a mapping.
- Data lives in `hot-seats/polls.json` and `hot-seats/candidates.json`. Keep logic in `hot-seats/app.js`. Don't hardcode data there.
- To check a change, run `python -m http.server 8766` inside `hot-seats/`, then open the page and try every source and gender filter, plus both PNG exports.

# Demo video script (3 minutes maximum)

Target length: about 2 minutes 45 seconds. Record the browser at 1440 × 900 or larger, with the full app
running (see `RUN_GUIDE.md`, Option 2). Machine IDs and numbers below match the default seeded demo fleet;
if yours differs, use whichever machine tops the Fleet Overview.

Before recording: seed the data, start both servers, open the app on **Fleet Overview**, hide bookmarks
and notifications.

| Time | On screen | Say |
|---|---|---|
| 0:00 – 0:20 | Title slide, then Fleet Overview | "An alarm that says *Machine 104: critical* doesn't tell an engineer why. TraceBack AI shows the evidence behind it: when it started, which sensors, and whether we've seen it before." |
| 0:20 – 0:45 | Fleet Overview: highest-risk card, count tiles, risk distribution | "This is a synthetic demo fleet of 12 machines, and the banner says so. Three healthy, seven on watch, two critical. The worst machine, M010, is on top." |
| 0:45 – 1:05 | Click **Investigate** on M010 | "One page per machine. Health score 21.6, critical at cycle 74. The key line: sustained drift began at cycle 53, twenty-one cycles earlier." |
| 1:05 – 1:35 | Health trend chart, then ranked sensor evidence | "The health trend shows the healthy baseline window, then the drift. Below, sensors are ranked by how far they sit from this machine's own baseline: s2 at 4.7 standard deviations, s21 at 4.3." Click the top sensor. "Clicking a sensor jumps to when it changed." |
| 1:35 – 1:55 | Historical matches, then **Compare** | "Past failures with a similar pattern: M006 shares sensors s11 and s12. That's pattern overlap, not a probability, and the app labels it that way." |
| 1:55 – 2:30 | Click **Ask Copilot**; ask "Why is M010 critical?"; click a citation | "The Copilot only explains what the pipeline computed. Every number in the answer links back to evidence. Click a citation and we land on the exact sensor and cycle." |
| 2:30 – 2:50 | Failure Patterns page (quick scroll) | "Across the fleet, machines are grouped by shared drift signatures, so one diagnosis helps with the next machine." |
| 2:50 – 3:00 | Limits slide or Settings page | "We're open about limits: the data is synthetic, remaining life is unvalidated, and the Copilot is an offline grounded engine by default. Code, run guide and licence are on GitHub. Thank you." |

## Tips

- Keep to one take per segment; trim in any editor.
- If you use the live backend, do one dry run first so the Copilot answer is already cached in your head
  and nothing surprising shows up on camera.
- Export as MP4 and check the length is **under 3:00** before uploading.
- Say "synthetic demo fleet" out loud at least once.

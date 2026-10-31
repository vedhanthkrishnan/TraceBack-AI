# Problem statement

**Track:** Factories, Fleets & Supply Chains · ExaThon India 2026

## The problem

Operators of machine fleets (engines, pumps, turbines, production lines) get alarms that say *that* a
machine is in trouble, not *why*. A typical alert reads "Machine 104: critical". The maintenance engineer
then has to work out, from raw sensor streams, what changed, when it started, and whether this has
happened before. That investigation is slow, depends on individual experience, and is hard to repeat.

The result is late inspections, unnecessary inspections, and unplanned downtime that could have been
planned.

## Who has it

Maintenance and reliability engineers, and the operations managers who decide which machine to inspect
next across a whole fleet.

## What TraceBack AI does

For every machine in the fleet it answers three questions, each backed by data:

1. **When did it start?** The first sustained anomaly cycle, marked on a health trend.
2. **Which sensors are the evidence?** Sensors ranked by deviation from the machine's own healthy
   baseline, drift rate and persistence.
3. **Has this been seen before?** Historical run-to-failure machines with a similar drift pattern.

An evidence-grounded AI Copilot explains these results in plain language. Every claim it makes links back
to the evidence, and missing data is stated rather than guessed.

## Why it is different

- **Analytics first, AI second.** Baselines, deviations, risk scores and rankings are computed
  deterministically in SQL and analytical services. The Copilot only reads and explains them, so the
  system still works with no LLM at all.
- **Honest about uncertainty.** Statistical deviation is shown as evidence, not proven cause. Remaining
  useful life is labelled unvalidated. The demo fleet is labelled synthetic.

## Scope of this submission

A working full-stack prototype: FastAPI backend (Exasol SQL, with an isolated SQLite engine for offline
demos), React/TypeScript frontend, a synthetic 12-machine demo fleet, and an evidence-linked Copilot.
Real fleet data and a per-cycle sensor history are the next steps.

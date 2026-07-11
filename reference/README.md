# Vendored reference engine

`engine2.js` is the **original, untouched** simulation engine from the design handoff. It is
the ground truth our port in `src/lib/engine/` is measured against.

**Do not edit, format, lint, or "improve" this file.** It is excluded from Prettier and
ESLint on purpose. It exists solely so `src/lib/harness/fidelity.spec.ts` can run both
engines head-to-head and prove the port did not change the science.

If you ever need to touch the port's behavior, the fidelity test must be re-run and must
still pass — or the change must be an explicit, measured, documented deviation.

## A note on the README §8 numbers

The handoff README quotes converged survival as Blind ~24% · Distance ~32% · Direction ~59% ·
Anticipation ~46% · Corner-wise ~43%. **Those numbers are not reproducible from this engine.**
Measured headlessly over 50 runs × 50 generations, *this reference file itself* produces:

| world | README §8 | reference (measured) |
| ------------ | --------- | -------------------- |
| Blind drift | 24 | 32.2% ± 0.8 |
| Distance | 32 | 31.6% ± 0.8 |
| Direction | 59 | 36.3% ± 1.1 |
| Anticipation | 46 | 35.2% ± 1.0 |
| Corner-wise | 43 | 34.6% ± 1.1 |

The real spread is far flatter than documented: Distance provides no measurable benefit over
Blind, Direction is the only sense that pays (and only by ~5pp), and the extras do not stack.
The qualitative lesson the product teaches — *more senses ≠ more intelligence* — holds, and is
in fact harsher than the README claims. The numbers were corrected rather than the engine
tuned to flatter them (CLAUDE.md golden rules #1 and #2).

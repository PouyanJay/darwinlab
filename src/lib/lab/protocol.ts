/**
 * The worker wire protocol — the one place the pool and the worker agree on message shapes.
 *
 * Declared once and imported by both `runner.ts` (the pool) and `eval.worker.ts` (the worker), so
 * the compiler enforces they match. Two independent declarations would compile fine after a rename
 * on one side and fail only at runtime; this closes that gap.
 */

import type { EvalRequest, Evaluation } from './evaluator';

/** Main thread → worker: run this job, or cancel one in flight. */
export type WorkerRequest = { jobId: number; req: EvalRequest } | { type: 'cancel'; jobId: number };

/** Worker → main thread: a job's progress, or its result (null if it was cancelled). */
export type WorkerResponse =
	{ jobId: number; progress: number } | { jobId: number; result: Evaluation | null };

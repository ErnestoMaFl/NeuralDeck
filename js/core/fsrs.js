// ═══════════════════════════════════════════════════════════════
// CORE — FSRS (simplified FSRS-4.5 algorithm)
// ═══════════════════════════════════════════════════════════════

import { today } from './db.js';

const FSRS_W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589,
  1.5330, 0.1544, 1.0070, 1.9395, 0.1100, 0.2900, 2.2700, 0.2500,
  2.9898, 0.5100, 0.3567
];

function fsrsInitialStability(rating) {
  return Math.max(FSRS_W[rating - 1] ?? 1, 0.1);
}

function fsrsInitialDifficulty(rating) {
  return Math.min(Math.max(FSRS_W[4] - Math.exp(FSRS_W[5] * (rating - 1)) + 1, 1), 10);
}

function fsrsRetrievability(stability, days) {
  return Math.pow(1 + days / (9 * stability), -1);
}

function fsrsNextInterval(stability, desiredRetention = 0.9) {
  const interval = Math.round(9 * stability * (Math.pow(desiredRetention, -1) - 1));
  return Math.max(1, interval);
}

function fsrsNextStability(d, s, r, rating) {
  if (rating >= 3) {
    return s * (
      Math.exp(FSRS_W[8]) *
      (11 - d) *
      Math.pow(s, -FSRS_W[9]) *
      (Math.exp((1 - r) * FSRS_W[10]) - 1) *
      (rating === 4 ? FSRS_W[15] : 1) *
      (rating === 2 ? FSRS_W[16] : 1)
      + 1
    );
  }
  return FSRS_W[11] *
    Math.pow(d, -FSRS_W[12]) *
    (Math.pow(s + 1, FSRS_W[13]) - 1) *
    Math.exp((1 - r) * FSRS_W[14]);
}

function fsrsNextDifficulty(d, rating) {
  const delta = FSRS_W[6] * (rating - 3);
  const d_new = d - delta;
  return Math.min(Math.max(d_new + FSRS_W[7] * (FSRS_W[4] - d_new), 1), 10);
}

export function applyFSRSRating(concept, rating) {
  const fsrs       = concept.fsrs;
  const today_str  = today();
  const daysSince  = fsrs.last_review
    ? Math.max(1, Math.round((new Date(today_str) - new Date(fsrs.last_review)) / 86400000))
    : 1;

  if (fsrs.state === 'new') {
    fsrs.stability  = fsrsInitialStability(rating);
    fsrs.difficulty = fsrsInitialDifficulty(rating);
    fsrs.state      = rating >= 3 ? 'review' : 'relearn';
    fsrs.reps       = 1;
  } else {
    const r         = fsrsRetrievability(fsrs.stability, daysSince);
    fsrs.stability  = Math.max(0.1, fsrsNextStability(fsrs.difficulty, fsrs.stability, r, rating));
    fsrs.difficulty = fsrsNextDifficulty(fsrs.difficulty, rating);
    fsrs.reps       = (fsrs.reps || 0) + 1;
    if (rating < 3) fsrs.lapses = (fsrs.lapses || 0) + 1;
    fsrs.state      = rating >= 3 ? 'review' : 'relearn';
  }

  const interval = fsrsNextInterval(fsrs.stability);
  const dueDate  = new Date(today_str);
  dueDate.setDate(dueDate.getDate() + interval);
  fsrs.due         = dueDate.toISOString().slice(0, 10);
  fsrs.last_review = today_str;
}

export function isDue(concept) {
  if (!concept.fsrs.due) return true;
  return concept.fsrs.due <= today();
}

export function getDueIn(concept) {
  if (!concept.fsrs.due) return 0;
  return Math.round((new Date(concept.fsrs.due) - new Date(today())) / 86400000);
}

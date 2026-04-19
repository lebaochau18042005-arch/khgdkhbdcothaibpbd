/**
 * ============================================
 * SHARED: FSRS (Free Spaced Repetition Scheduler) Algorithm
 * Tổng hợp từ: Open Spaced Repetition project
 * ============================================
 *
 * Implementation FSRS-4.5 cho cả Sử và Địa.
 * Dùng chung cho user_knowledge tracking.
 */

// FSRS-4.5 default parameters
const DEFAULT_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8,  // w0-w3: initial stability by rating
  4.93,                   // w4: initial difficulty mean
  0.94,                   // w5: initial difficulty deviation
  0.86,                   // w6: difficulty update
  0.01,                   // w7: stability modifier
  1.49,                   // w8: stability success base
  0.14,                   // w9: stability success power
  0.94,                   // w10: stability success retrievability
  2.18,                   // w11: stability fail base
  0.05,                   // w12: stability fail difficulty power
  0.34,                   // w13: stability fail stability power
  1.26,                   // w14: (reserved)
  0.29,                   // w15: (reserved)
  2.61,                   // w16: (reserved)
];

// Rating enum
const Rating = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
const State = { NEW: 'new', LEARNING: 'learning', REVIEW: 'review', RELEARNING: 'relearning' };

class FSRS {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.w = weights;
  }

  /**
   * Tính toán review tiếp theo
   * @param {Object} card - Current card state
   * @param {number} rating - 1=Again, 2=Hard, 3=Good, 4=Easy
   * @returns {Object} Updated card state
   */
  review(card, rating) {
    const now = new Date();
    const elapsedDays = card.last_review_at
      ? (now - new Date(card.last_review_at)) / (1000 * 60 * 60 * 24)
      : 0;

    let { stability, difficulty, reps, lapses, state } = card;

    if (state === State.NEW) {
      return this._firstReview(rating);
    }

    // Calculate retrievability
    const retrievability = this._retrievability(elapsedDays, stability);

    // Update difficulty
    difficulty = this._updateDifficulty(difficulty, rating);

    if (rating === Rating.AGAIN) {
      // Lapse
      stability = this._stabilityAfterFail(difficulty, stability, retrievability);
      lapses += 1;
      state = State.RELEARNING;
    } else {
      // Success
      stability = this._stabilityAfterSuccess(difficulty, stability, retrievability, rating);
      state = State.REVIEW;
    }

    reps += 1;
    const interval = Math.max(1, Math.round(stability * 9));
    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    return {
      stability: Math.round(stability * 100) / 100,
      difficulty: Math.round(difficulty * 100) / 100,
      reps,
      lapses,
      state,
      elapsed_days: Math.round(elapsedDays * 10) / 10,
      scheduled_days: interval,
      last_review_at: now.toISOString(),
      next_review_at: nextReview.toISOString(),
    };
  }

  /**
   * Tính retrievability (khả năng nhớ lại)
   */
  _retrievability(elapsedDays, stability) {
    return Math.pow(1 + elapsedDays / (9 * stability), -1);
  }

  _firstReview(rating) {
    const now = new Date();
    const stability = this.w[rating - 1];
    const difficulty = Math.max(1, Math.min(10,
      this.w[4] - (rating - 3) * this.w[5]
    ));
    const interval = Math.max(1, Math.round(stability * 9));
    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    return {
      stability: Math.round(stability * 100) / 100,
      difficulty: Math.round(difficulty * 100) / 100,
      reps: 1,
      lapses: 0,
      state: State.LEARNING,
      elapsed_days: 0,
      scheduled_days: interval,
      last_review_at: now.toISOString(),
      next_review_at: nextReview.toISOString(),
    };
  }

  _updateDifficulty(d, rating) {
    const newD = d - this.w[6] * (rating - 3);
    return Math.max(1, Math.min(10, newD));
  }

  _stabilityAfterSuccess(d, s, r, rating) {
    const hardPenalty = rating === Rating.HARD ? this.w[15] : 1;
    const easyBonus = rating === Rating.EASY ? this.w[16] : 1;

    return s * (1 +
      Math.exp(this.w[8]) *
      (11 - d) *
      Math.pow(s, -this.w[9]) *
      (Math.exp((1 - r) * this.w[10]) - 1) *
      hardPenalty *
      easyBonus
    );
  }

  _stabilityAfterFail(d, s, r) {
    return this.w[11] *
      Math.pow(d, -this.w[12]) *
      (Math.pow(s + 1, this.w[13]) - 1) *
      Math.exp((1 - r) * this.w[14]);
  }
}

module.exports = { FSRS, Rating, State, DEFAULT_WEIGHTS };

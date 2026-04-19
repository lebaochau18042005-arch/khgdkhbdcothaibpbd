/**
 * ============================================
 * SKILL ĐỊA: Adaptive Learning Engine
 * Tổng hợp từ: Geography-master (proso adaptive framework)
 * ============================================
 *
 * Engine học tập thích ứng dựa trên:
 * - Item Response Theory (IRT) từ proso framework
 * - FSRS (Free Spaced Repetition Scheduler) algorithm
 * - A/B testing framework từ geography project
 */

class AdaptiveLearningEngine {
  constructor(db) {
    this.db = db;
  }

  // ========== ITEM SELECTION (từ proso framework) ==========

  /**
   * Chọn item tiếp theo cho user dựa trên IRT model
   * Ưu tiên items có information value cao nhất (gần threshold 0.5 probability)
   *
   * @param {string} userId
   * @param {string} contextSlug - Map context (vd: 'viet-nam', 'dong-nam-a')
   * @param {number} count - Số items cần chọn
   * @returns {Array} selected items
   */
  async selectNextItems(userId, contextSlug, count = 1) {
    // 1. Ước tính ability hiện tại của user
    const ability = await this.estimateAbility(userId);

    // 2. Lấy danh sách items có thể practice
    const candidates = await this.db.query(`
      SELECT gf.*, gp.name_vi as place_name, gp.type as place_type,
        uk.mastery_level, uk.next_review_at, uk.reps
      FROM geo_flashcards gf
      JOIN geo_places gp ON gf.place_id = gp.id
      JOIN geo_context_places gcp ON gp.id = gcp.place_id
      JOIN geo_map_contexts gmc ON gcp.context_id = gmc.id
      LEFT JOIN user_knowledge uk ON uk.item_id = gf.id
        AND uk.item_type = 'flashcard' AND uk.user_id = $1
      WHERE gmc.slug = $2
      ORDER BY
        CASE WHEN uk.next_review_at IS NULL THEN 0
             WHEN uk.next_review_at <= NOW() THEN 1
             ELSE 2 END,
        RANDOM()
    `, [userId, contextSlug]);

    // 3. Tính information value cho mỗi item
    const scored = candidates.map(item => {
      const difficulty = item.base_difficulty;
      const prob = this._irtProbability(ability, difficulty);
      const information = this._fisherInformation(prob, item);

      return {
        ...item,
        predicted_probability: prob,
        information_value: information,
        is_due_review: item.next_review_at && new Date(item.next_review_at) <= new Date(),
        is_new: !item.reps || item.reps === 0,
      };
    });

    // 4. Ưu tiên: due reviews > new items > others
    scored.sort((a, b) => {
      if (a.is_due_review && !b.is_due_review) return -1;
      if (!a.is_due_review && b.is_due_review) return 1;
      if (a.is_new && !b.is_new) return -1;
      if (!a.is_new && b.is_new) return 1;
      return b.information_value - a.information_value;
    });

    return scored.slice(0, count);
  }

  /**
   * Ước tính ability (theta) của user bằng MLE
   */
  async estimateAbility(userId) {
    const answers = await this.db.query(`
      SELECT la.is_correct, qq.base_difficulty, qq.discrimination
      FROM learning_answers la
      JOIN quiz_questions qq ON la.question_id = qq.id
      WHERE la.user_id = $1
      ORDER BY la.answered_at DESC
      LIMIT 100
    `, [userId]);

    if (answers.length === 0) return 0.0;

    // Newton-Raphson MLE for theta
    let theta = 0.0;
    for (let iter = 0; iter < 20; iter++) {
      let numerator = 0;
      let denominator = 0;

      for (const ans of answers) {
        const p = this._irtProbability(theta, ans.base_difficulty, ans.discrimination);
        const r = ans.is_correct ? 1 : 0;
        const a = ans.discrimination || 1.0;

        numerator += a * (r - p);
        denominator += a * a * p * (1 - p);
      }

      if (Math.abs(denominator) < 1e-10) break;
      const delta = numerator / denominator;
      theta += delta;
      if (Math.abs(delta) < 0.001) break;
    }

    return Math.max(-4, Math.min(4, theta));
  }

  // ========== OPTION SELECTION (từ geography PartialyFourOptionsNumber) ==========

  /**
   * Chọn các option nhiễu cho câu hỏi multiple choice
   * Dựa trên algorithm từ geography/option_selection.py
   *
   * @param {Object} correctItem - Đáp án đúng
   * @param {Array} allItems - Tất cả items có thể
   * @param {number} numOptions - Số lượng options (mặc định 4)
   * @returns {Array} options bao gồm đáp án đúng
   */
  selectDistractors(correctItem, allItems, numOptions = 4) {
    // Lọc bỏ đáp án đúng
    const candidates = allItems.filter(item => item.id !== correctItem.id);

    // Ưu tiên distractors cùng loại (cùng type, cùng region)
    const sameType = candidates.filter(c => c.type === correctItem.type);
    const sameCategory = candidates.filter(c => c.category_id === correctItem.category_id);
    const otherType = candidates.filter(c => c.type !== correctItem.type);

    let distractors = [];

    // Chọn 1-2 từ cùng loại (khó phân biệt hơn)
    const fromSameType = this._randomSample(sameType, Math.min(2, numOptions - 1));
    distractors.push(...fromSameType);

    // Bổ sung từ cùng category
    const remaining = numOptions - 1 - distractors.length;
    if (remaining > 0) {
      const fromCategory = this._randomSample(
        sameCategory.filter(c => !distractors.find(d => d.id === c.id)),
        remaining
      );
      distractors.push(...fromCategory);
    }

    // Bổ sung random nếu chưa đủ
    const stillNeeded = numOptions - 1 - distractors.length;
    if (stillNeeded > 0) {
      const fromOther = this._randomSample(
        candidates.filter(c => !distractors.find(d => d.id === c.id)),
        stillNeeded
      );
      distractors.push(...fromOther);
    }

    // Shuffle tất cả options
    const options = [
      { ...correctItem, is_correct: true },
      ...distractors.map(d => ({ ...d, is_correct: false })),
    ];

    return this._shuffle(options);
  }

  // ========== FSRS SCHEDULING ==========

  /**
   * Tính thời gian review tiếp theo dựa trên FSRS algorithm
   * Từ open-spaced-repetition project
   */
  scheduleReview(knowledge, rating) {
    // rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
    const w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

    let { stability, difficulty, reps, lapses, state } = knowledge;

    if (state === 'new') {
      // First review
      stability = w[rating - 1];
      difficulty = w[4] - (rating - 3) * w[5];
      difficulty = Math.max(1, Math.min(10, difficulty));
      state = 'learning';
    } else {
      // Update difficulty
      difficulty = difficulty - w[6] * (rating - 3);
      difficulty = Math.max(1, Math.min(10, difficulty));

      if (rating === 1) {
        // Lapse
        stability = w[11] * Math.pow(difficulty, -w[12]) *
                    (Math.pow(stability + 1, w[13]) - 1);
        lapses += 1;
        state = 'relearning';
      } else {
        // Success
        const retrievability = Math.pow(1 + knowledge.elapsed_days / (9 * stability), -1);
        stability = stability * (1 + Math.exp(w[8]) *
                    (11 - difficulty) * Math.pow(stability, -w[9]) *
                    (Math.exp((1 - retrievability) * w[10]) - 1));
        state = 'review';
      }
    }

    reps += 1;
    const interval = Math.max(1, Math.round(stability * 9));
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      stability,
      difficulty,
      reps,
      lapses,
      state,
      scheduled_days: interval,
      next_review_at: nextReview,
    };
  }

  // ========== Private Helpers ==========

  _irtProbability(theta, difficulty, discrimination = 1.0, guessing = 0.0) {
    return guessing + (1 - guessing) / (1 + Math.exp(-discrimination * (theta - difficulty)));
  }

  _fisherInformation(probability, item) {
    const a = item.discrimination || 1.0;
    const c = item.guessing || 0.0;
    const p = probability;
    const q = 1 - p;
    return a * a * q / p * Math.pow((p - c) / (1 - c), 2);
  }

  _randomSample(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  _shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

module.exports = { AdaptiveLearningEngine };

/**
 * ============================================
 * SKILL SỬ: History Quiz Engine
 * Tổng hợp từ: EdCore (gamification), Geography (adaptive learning)
 * ============================================
 *
 * Engine tạo và quản lý quiz lịch sử với:
 * - Adaptive difficulty (từ Geography proso framework)
 * - Gamification (từ EdCore)
 * - Timeline ordering questions (từ vis-timeline)
 * - Map click questions (từ History 3D globe)
 */

class HistoryQuizEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Tạo bài quiz thích ứng cho người dùng
   * @param {string} userId
   * @param {Object} options - {periodSlug, count, difficulty}
   * @returns {Object} quiz session
   */
  async generateQuiz(userId, options = {}) {
    const {
      periodSlug = null,
      count = 10,
      difficulty = 'adaptive',
      questionTypes = ['multiple_choice', 'true_false', 'timeline_order'],
    } = options;

    // 1. Lấy thông tin knowledge của user
    const userKnowledge = await this._getUserKnowledge(userId, 'su');
    const userAbility = this._estimateAbility(userKnowledge);

    // 2. Chọn câu hỏi phù hợp
    let questions;
    if (difficulty === 'adaptive') {
      questions = await this._selectAdaptiveQuestions(
        userId, userAbility, count, periodSlug, questionTypes
      );
    } else {
      questions = await this._selectFixedQuestions(
        count, periodSlug, difficulty, questionTypes
      );
    }

    // 3. Tạo session
    const session = await this._createSession(userId, 'su', questions);
    return session;
  }

  /**
   * Xử lý câu trả lời và cập nhật knowledge
   * @param {string} sessionId
   * @param {string} questionId
   * @param {any} answer
   * @returns {Object} result
   */
  async submitAnswer(sessionId, questionId, answer) {
    const session = await this.db.query(
      'SELECT * FROM learning_sessions WHERE id = $1', [sessionId]
    );
    const question = await this.db.query(
      'SELECT * FROM quiz_questions WHERE id = $1', [questionId]
    );

    const isCorrect = this._evaluateAnswer(question, answer);
    const responseTime = Date.now() - session.current_question_start;

    // Lưu câu trả lời
    await this.db.query(`
      INSERT INTO learning_answers
        (session_id, user_id, question_id, user_answer, is_correct, response_time_ms,
         predicted_probability, item_difficulty_at_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      sessionId, session.user_id, questionId,
      JSON.stringify(answer), isCorrect, responseTime,
      question.predicted_probability, question.base_difficulty,
    ]);

    // Cập nhật knowledge (FSRS algorithm)
    await this._updateKnowledge(session.user_id, question, isCorrect);

    // Cập nhật XP & badges
    const rewards = await this._processRewards(session.user_id, isCorrect, question);

    return {
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
      explanation: question.explanation_vi,
      xp_earned: rewards.xp,
      badges_earned: rewards.badges,
      next_question: await this._getNextQuestion(sessionId),
    };
  }

  // ========== Question Types ==========

  /**
   * Tạo câu hỏi sắp xếp timeline
   * Cho một danh sách sự kiện, yêu cầu sắp xếp theo thứ tự thời gian
   */
  async generateTimelineQuestion(periodSlug, count = 5) {
    const events = await this.db.query(`
      SELECT id, title_vi, start_date, summary_vi
      FROM historical_events
      WHERE period_id = (SELECT id FROM historical_periods WHERE slug = $1)
      ORDER BY RANDOM()
      LIMIT $2
    `, [periodSlug, count]);

    const shuffled = [...events].sort(() => Math.random() - 0.5);
    const correctOrder = events
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .map(e => e.id);

    return {
      question_type: 'timeline_order',
      question_vi: 'Sắp xếp các sự kiện sau theo thứ tự thời gian (sớm nhất → muộn nhất):',
      items: shuffled.map(e => ({ id: e.id, text: e.title_vi })),
      correct_answer: JSON.stringify(correctOrder),
    };
  }

  /**
   * Tạo câu hỏi nhận diện trên bản đồ
   * Click vào vị trí sự kiện lịch sử trên bản đồ 3D
   */
  async generateMapQuestion(eventId) {
    const event = await this.db.query(
      'SELECT * FROM historical_events WHERE id = $1', [eventId]
    );

    return {
      question_type: 'map_click',
      question_vi: `Hãy chỉ trên bản đồ vị trí diễn ra sự kiện "${event.title_vi}"`,
      correct_lat: event.location_lat,
      correct_lng: event.location_lng,
      tolerance_km: 50,  // Sai số cho phép 50km
      map_config: {
        center: [16.0, 106.0],  // Trung tâm Việt Nam
        zoom: 6,
        style: 'mapbox://styles/mapbox/satellite-v9',
      },
    };
  }

  // ========== Private Methods ==========

  async _getUserKnowledge(userId, subject) {
    return await this.db.query(`
      SELECT * FROM user_knowledge
      WHERE user_id = $1 AND item_type IN ('event', 'figure')
    `, [userId]);
  }

  _estimateAbility(knowledge) {
    if (!knowledge || knowledge.length === 0) return 0.0;
    const avgMastery = knowledge.reduce((sum, k) => sum + k.mastery_level, 0) / knowledge.length;
    return (avgMastery - 0.5) * 4;  // Scale to [-2, 2] range
  }

  async _selectAdaptiveQuestions(userId, ability, count, periodSlug, types) {
    // Item Response Theory: chọn câu hỏi có information cao nhất
    // P(correct) = guessing + (1-guessing) / (1 + exp(-discrimination * (ability - difficulty)))
    let query = `
      SELECT q.*,
        q.guessing + (1 - q.guessing) / (1 + EXP(-q.discrimination * ($1 - q.base_difficulty))) as predicted_prob,
        q.discrimination * q.discrimination * predicted_prob * (1 - predicted_prob) as information
      FROM quiz_questions q
      JOIN quiz_sets qs ON q.quiz_set_id = qs.id
      WHERE qs.subject = 'su'
        AND q.question_type = ANY($2)
    `;
    const params = [ability, types];

    if (periodSlug) {
      query += ` AND qs.period_id = (SELECT id FROM historical_periods WHERE slug = $3)`;
      params.push(periodSlug);
    }

    query += ` ORDER BY information DESC LIMIT $${params.length + 1}`;
    params.push(count);

    return await this.db.query(query, params);
  }

  async _selectFixedQuestions(count, periodSlug, difficulty, types) {
    const difficultyRange = {
      easy: [0, 0.35],
      medium: [0.35, 0.65],
      hard: [0.65, 1.0],
    };
    const [min, max] = difficultyRange[difficulty] || [0, 1];

    return await this.db.query(`
      SELECT * FROM quiz_questions q
      JOIN quiz_sets qs ON q.quiz_set_id = qs.id
      WHERE qs.subject = 'su'
        AND q.base_difficulty BETWEEN $1 AND $2
        AND q.question_type = ANY($3)
      ORDER BY RANDOM()
      LIMIT $4
    `, [min, max, types, count]);
  }

  _evaluateAnswer(question, answer) {
    switch (question.question_type) {
      case 'multiple_choice':
      case 'true_false':
        return answer === question.correct_answer;

      case 'timeline_order':
        return JSON.stringify(answer) === question.correct_answer;

      case 'map_click':
        const dist = this._haversineDistance(
          answer.lat, answer.lng,
          question.correct_lat, question.correct_lng
        );
        return dist <= (question.tolerance_km || 50);

      case 'fill_blank':
        return answer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim();

      default:
        return false;
    }
  }

  _haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async _updateKnowledge(userId, question, isCorrect) {
    // FSRS-4.5 Algorithm (simplified)
    const itemType = question.event_id ? 'event' : 'figure';
    const itemId = question.event_id || question.figure_id;
    if (!itemId) return;

    const existing = await this.db.query(`
      SELECT * FROM user_knowledge
      WHERE user_id = $1 AND item_type = $2 AND item_id = $3
    `, [userId, itemType, itemId]);

    if (existing.length === 0) {
      await this.db.query(`
        INSERT INTO user_knowledge (user_id, item_type, item_id, total_attempts, correct_attempts, mastery_level, last_review_at)
        VALUES ($1, $2, $3, 1, $4, $5, NOW())
      `, [userId, itemType, itemId, isCorrect ? 1 : 0, isCorrect ? 0.1 : 0.0]);
    } else {
      const k = existing[0];
      const newTotal = k.total_attempts + 1;
      const newCorrect = k.correct_attempts + (isCorrect ? 1 : 0);
      const newMastery = Math.min(1.0, newCorrect / newTotal * (1 + k.reps * 0.05));

      await this.db.query(`
        UPDATE user_knowledge
        SET total_attempts = $1, correct_attempts = $2, mastery_level = $3,
            reps = reps + 1, last_review_at = NOW(), updated_at = NOW()
        WHERE id = $4
      `, [newTotal, newCorrect, newMastery, k.id]);
    }
  }

  async _processRewards(userId, isCorrect, question) {
    let xp = isCorrect ? 10 : 2;
    const badges = [];

    if (isCorrect) {
      // Cập nhật XP
      await this.db.query(`
        INSERT INTO user_xp (user_id, subject, total_xp, current_level, last_activity_date)
        VALUES ($1, 'su', $2, 1, CURRENT_DATE)
        ON CONFLICT (user_id, subject)
        DO UPDATE SET
          total_xp = user_xp.total_xp + $2,
          current_level = FLOOR(SQRT(user_xp.total_xp + $2) / 10) + 1,
          streak_days = CASE
            WHEN user_xp.last_activity_date = CURRENT_DATE - 1 THEN user_xp.streak_days + 1
            WHEN user_xp.last_activity_date = CURRENT_DATE THEN user_xp.streak_days
            ELSE 1
          END,
          longest_streak = GREATEST(user_xp.longest_streak, user_xp.streak_days),
          last_activity_date = CURRENT_DATE,
          updated_at = NOW()
      `, [userId, xp]);
    }

    return { xp, badges };
  }

  async _createSession(userId, subject, questions) {
    const result = await this.db.query(`
      INSERT INTO learning_sessions (user_id, subject, total_questions)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, subject, questions.length]);
    return { ...result[0], questions };
  }

  async _getNextQuestion(sessionId) {
    // Logic lấy câu hỏi tiếp theo trong session
    return null;
  }
}

module.exports = { HistoryQuizEngine };

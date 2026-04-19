/**
 * ============================================
 * SKILL ĐỊA: Geography Quiz Engine
 * Tổng hợp từ: Geography-master (practice system), GeoLearn-AR
 * ============================================
 *
 * Engine quiz địa lý với:
 * - Map click questions (chỉ trên bản đồ)
 * - Flashcard practice (từ geography-flashcards.json)
 * - AR identify (từ GeoLearn-AR)
 * - Adaptive difficulty
 */

class GeographyQuizEngine {
  constructor(db, adaptiveEngine) {
    this.db = db;
    this.adaptive = adaptiveEngine;
  }

  /**
   * Tạo phiên practice bản đồ (kiểu slepemapy.cz)
   * @param {string} userId
   * @param {string} contextSlug - Map context ('viet-nam', 'dong-nam-a', 'world')
   * @param {Object} options
   */
  async startMapPractice(userId, contextSlug, options = {}) {
    const {
      count = 10,
      placeTypes = null,   // ['city', 'river', 'mountain'] hoặc null = tất cả
      cardTypes = ['identify', 'locate', 'capital'],
    } = options;

    // Dùng adaptive engine chọn items
    const items = await this.adaptive.selectNextItems(userId, contextSlug, count);

    // Tạo câu hỏi từ items
    const questions = await Promise.all(
      items.map(item => this._createQuestion(item, cardTypes))
    );

    // Tạo session
    const session = await this.db.query(`
      INSERT INTO learning_sessions (user_id, subject, total_questions)
      VALUES ($1, 'dia', $2) RETURNING *
    `, [userId, questions.length]);

    return {
      session_id: session[0].id,
      context: contextSlug,
      questions,
      map_config: await this._getMapConfig(contextSlug),
    };
  }

  /**
   * Tạo câu hỏi map click: "Hãy chỉ trên bản đồ vị trí của X"
   */
  async generateMapClickQuestion(placeId) {
    const place = await this.db.query(
      'SELECT * FROM geo_places WHERE id = $1', [placeId]
    );
    if (!place.length) return null;
    const p = place[0];

    return {
      question_type: 'map_click',
      question_vi: `Hãy chỉ trên bản đồ vị trí của "${p.name_vi}"`,
      correct_lat: p.latitude,
      correct_lng: p.longitude,
      tolerance_km: this._getToleranceForType(p.type),
      hints: [
        p.type === 'city' ? `Đây là một thành phố` : `Đây là một ${p.type}`,
        p.description_vi ? p.description_vi.substring(0, 100) + '...' : null,
      ].filter(Boolean),
      place_type: p.type,
    };
  }

  /**
   * Tạo câu hỏi identify từ flashcard
   */
  async generateFlashcardQuestion(flashcardId) {
    const fc = await this.db.query(`
      SELECT gf.*, gp.name_vi as place_name, gp.latitude, gp.longitude
      FROM geo_flashcards gf
      JOIN geo_places gp ON gf.place_id = gp.id
      WHERE gf.id = $1
    `, [flashcardId]);

    if (!fc.length) return null;
    const card = fc[0];

    return {
      question_type: card.card_type,
      question_vi: card.question_vi,
      correct_answer: card.answer_vi,
      options: card.options,
      hint: card.hint_vi,
      image_url: card.question_image_url,
      map_highlight: card.map_highlight_config,
    };
  }

  /**
   * Tạo câu hỏi AR identify (từ GeoLearn-AR)
   * Học sinh nhìn AR object và nhận diện địa điểm
   */
  async generateARQuestion(placeId) {
    const place = await this.db.query(
      'SELECT * FROM geo_places WHERE id = $1 AND ar_model_url IS NOT NULL',
      [placeId]
    );

    if (!place.length) return null;
    const p = place[0];

    return {
      question_type: 'ar_identify',
      question_vi: `Quan sát mô hình AR và cho biết đây là địa điểm nào?`,
      ar_model_url: p.ar_model_url,
      ar_qr_code_url: p.ar_qr_code_url,
      ar_config: p.ar_scene_config,
      correct_answer: p.name_vi,
      options: null,  // Sẽ được fill bởi adaptive engine
    };
  }

  /**
   * Đánh giá câu trả lời map click
   * @param {Object} answer - {lat, lng}
   * @param {Object} correct - {lat, lng, tolerance_km}
   * @returns {Object} - {is_correct, distance_km, score}
   */
  evaluateMapClick(answer, correct) {
    const { GISTools } = require('../gis/gis-tools');
    const distance = GISTools.haversineDistance(
      answer.lat, answer.lng,
      correct.lat, correct.lng
    );

    const isCorrect = distance <= correct.tolerance_km;

    // Score dựa trên khoảng cách (gần hơn = điểm cao hơn)
    let score = 0;
    if (isCorrect) {
      score = Math.max(0, 1 - (distance / correct.tolerance_km));
    }

    return {
      is_correct: isCorrect,
      distance_km: Math.round(distance * 10) / 10,
      score: Math.round(score * 100),
      feedback: this._getDistanceFeedback(distance, correct.tolerance_km),
    };
  }

  // ========== Private Helpers ==========

  async _createQuestion(item, cardTypes) {
    const type = cardTypes[Math.floor(Math.random() * cardTypes.length)];

    switch (type) {
      case 'locate':
        return await this.generateMapClickQuestion(item.place_id || item.id);
      case 'identify':
      case 'capital':
      case 'fact':
        return await this.generateFlashcardQuestion(item.id);
      case 'ar_identify':
        return await this.generateARQuestion(item.place_id || item.id);
      default:
        return await this.generateFlashcardQuestion(item.id);
    }
  }

  async _getMapConfig(contextSlug) {
    const ctx = await this.db.query(
      'SELECT * FROM geo_map_contexts WHERE slug = $1', [contextSlug]
    );
    if (!ctx.length) {
      return { center: [16.0, 105.8], zoom: 6 };
    }
    return {
      center: [ctx[0].center_lat, ctx[0].center_lng],
      zoom: ctx[0].zoom_level,
      style: ctx[0].map_style,
      tile_url: ctx[0].tile_url,
    };
  }

  _getToleranceForType(type) {
    const tolerances = {
      city: 30,
      capital: 20,
      river: 50,
      mountain: 40,
      lake: 30,
      sea: 100,
      island: 60,
      country: 150,
      region: 100,
    };
    return tolerances[type] || 50;
  }

  _getDistanceFeedback(distance, tolerance) {
    if (distance <= tolerance * 0.1) return 'Chính xác tuyệt đối! 🎯';
    if (distance <= tolerance * 0.3) return 'Rất gần! Tuyệt vời!';
    if (distance <= tolerance * 0.6) return 'Khá tốt!';
    if (distance <= tolerance) return 'Đúng rồi, nhưng có thể chính xác hơn.';
    if (distance <= tolerance * 2) return 'Gần đúng, nhưng chưa đủ chính xác.';
    return `Sai rồi! Cách vị trí đúng ${Math.round(distance)} km.`;
  }
}

module.exports = { GeographyQuizEngine };

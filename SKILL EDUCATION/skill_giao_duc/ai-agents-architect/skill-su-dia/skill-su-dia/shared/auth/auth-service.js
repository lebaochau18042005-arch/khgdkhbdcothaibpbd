/**
 * ============================================
 * SHARED: Authentication Service
 * Tổng hợp từ: EdCore (OAuth2/Keycloak), History (Supabase Auth)
 * ============================================
 *
 * Service xác thực người dùng cho skill Sử-Địa.
 * Supports: Supabase Auth, OAuth2, Local dev mode
 */

class AuthService {
  constructor(config = {}) {
    this.mode = config.mode || process.env.AUTH_MODE || 'local';
    this.config = config;
  }

  /**
   * Đăng ký người dùng mới
   */
  async register(userData) {
    const { email, password, firstName, lastName, role = 'ROLE_STUDENT' } = userData;

    // Tạo user trong DB
    const user = await this.db.query(`
      INSERT INTO users (login, email, password_hash, first_name, last_name, activated, created_by)
      VALUES ($1, $2, $3, $4, $5, true, 'system')
      RETURNING id, login, email, first_name, last_name
    `, [email.split('@')[0], email, await this._hashPassword(password), firstName, lastName]);

    // Gán role
    await this.db.query(`
      INSERT INTO user_authorities (user_id, authority_name) VALUES ($1, $2)
    `, [user[0].id, role]);

    // Khởi tạo XP cho cả 2 môn
    await this.db.query(`
      INSERT INTO user_xp (user_id, subject, total_xp, current_level)
      VALUES ($1, 'su', 0, 1), ($1, 'dia', 0, 1)
    `, [user[0].id]);

    return user[0];
  }

  /**
   * Đăng nhập
   */
  async login(email, password) {
    const user = await this.db.query(
      'SELECT * FROM users WHERE email = $1 AND activated = true', [email]
    );

    if (!user.length) throw new Error('User not found');
    if (!await this._verifyPassword(password, user[0].password_hash)) {
      throw new Error('Invalid password');
    }

    await this.db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1', [user[0].id]
    );

    return {
      id: user[0].id,
      email: user[0].email,
      name: `${user[0].first_name} ${user[0].last_name}`,
      role: await this._getUserRole(user[0].id),
      subscription: user[0].subscription_tier,
    };
  }

  /**
   * Lấy profile học tập của user
   */
  async getLearningProfile(userId) {
    const [user, xp, knowledge, badges] = await Promise.all([
      this.db.query('SELECT * FROM users WHERE id = $1', [userId]),
      this.db.query('SELECT * FROM user_xp WHERE user_id = $1', [userId]),
      this.db.query(`
        SELECT item_type, COUNT(*) as count,
               AVG(mastery_level) as avg_mastery,
               SUM(CASE WHEN state = 'review' THEN 1 ELSE 0 END) as mastered
        FROM user_knowledge WHERE user_id = $1
        GROUP BY item_type
      `, [userId]),
      this.db.query(`
        SELECT b.* FROM badges b
        JOIN user_badges ub ON b.id = ub.badge_id
        WHERE ub.user_id = $1
      `, [userId]),
    ]);

    const suXP = xp.find(x => x.subject === 'su') || { total_xp: 0, current_level: 1 };
    const diaXP = xp.find(x => x.subject === 'dia') || { total_xp: 0, current_level: 1 };

    return {
      user: user[0],
      stats: {
        su: { xp: suXP.total_xp, level: suXP.current_level, streak: suXP.streak_days },
        dia: { xp: diaXP.total_xp, level: diaXP.current_level, streak: diaXP.streak_days },
      },
      knowledge: knowledge,
      badges: badges,
    };
  }

  // ========== Private ==========

  async _hashPassword(password) {
    // In production: use bcrypt
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async _verifyPassword(password, hash) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex') === hash;
  }

  async _getUserRole(userId) {
    const roles = await this.db.query(
      'SELECT authority_name FROM user_authorities WHERE user_id = $1', [userId]
    );
    return roles.map(r => r.authority_name);
  }
}

module.exports = { AuthService };

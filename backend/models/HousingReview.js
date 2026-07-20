const { pool } = require("../config/db");

const HousingReview = {
  async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM housing_reviews WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
      );
      return rows.map(r => this._parseReview(r));
    } catch (error) {
      console.error("Error finding housing reviews by user:", error);
      throw error;
    }
  },

  _parseReview(row) {
    if (!row) return null;
    if (typeof row.when_away === "string") {
      try { row.when_away = JSON.parse(row.when_away); } catch { row.when_away = null; }
    }
    return row;
  },

  async findById(id) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM housing_reviews WHERE id = ?",
        [id],
      );
      return this._parseReview(rows[0] || null);
    } catch (error) {
      console.error("Error finding housing review by ID:", error);
      throw error;
    }
  },

  async findActiveByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM housing_reviews WHERE user_id = ? AND is_active = 1 LIMIT 1",
        [userId],
      );
      return this._parseReview(rows[0] || null);
    } catch (error) {
      console.error("Error finding active housing review:", error);
      throw error;
    }
  },

  async create(userId, data) {
    try {
      const { house_type, own_or_rent, has_allergies, has_pets, outdoor_space, has_children, time_at_home, experience, income, when_away } = data;
      const [result] = await pool.execute(
        `INSERT INTO housing_reviews (user_id, house_type, own_or_rent, has_allergies, has_pets, outdoor_space, has_children, time_at_home, experience, income, when_away)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, house_type, own_or_rent, has_allergies ? 1 : 0, has_pets ? 1 : 0, outdoor_space || null, has_children ? 1 : 0, time_at_home || null, experience || null, income || null, when_away ? JSON.stringify(when_away) : null],
      );
      return { id: result.insertId, user_id: userId, ...data, status: "pending", is_active: 1 };
    } catch (error) {
      console.error("Error creating housing review:", error);
      throw error;
    }
  },

  async update(id, userId, data) {
    try {
      const fields = [
        "status = 'pending'",
        "admin_notes = NULL",
        "reviewed_by = NULL",
        "reviewed_at = NULL"
      ];
      const params = [];
      if (data.house_type !== undefined) { fields.push("house_type = ?"); params.push(data.house_type); }
      if (data.own_or_rent !== undefined) { fields.push("own_or_rent = ?"); params.push(data.own_or_rent); }
      if (data.has_allergies !== undefined) { fields.push("has_allergies = ?"); params.push(data.has_allergies ? 1 : 0); }
      if (data.has_pets !== undefined) { fields.push("has_pets = ?"); params.push(data.has_pets ? 1 : 0); }
      if (data.outdoor_space !== undefined) { fields.push("outdoor_space = ?"); params.push(data.outdoor_space || null); }
      if (data.has_children !== undefined) { fields.push("has_children = ?"); params.push(data.has_children ? 1 : 0); }
      if (data.time_at_home !== undefined) { fields.push("time_at_home = ?"); params.push(data.time_at_home || null); }
      if (data.experience !== undefined) { fields.push("experience = ?"); params.push(data.experience || null); }
      if (data.income !== undefined) { fields.push("income = ?"); params.push(data.income || null); }
      if (data.when_away !== undefined) { fields.push("when_away = ?"); params.push(data.when_away ? JSON.stringify(data.when_away) : null); }
      params.push(id, userId);
      const [result] = await pool.execute(
        `UPDATE housing_reviews SET ${fields.join(", ")} WHERE id = ? AND user_id = ? AND (status = 'pending' OR status = 'rejected')`,
        params,
      );
      return result.affectedRows > 0 ? this.findById(id) : null;
    } catch (error) {
      console.error("Error updating housing review:", error);
      throw error;
    }
  },

  async deactivate(userId) {
    try {
      await pool.execute(
        "UPDATE housing_reviews SET is_active = 0 WHERE user_id = ? AND is_active = 1",
        [userId],
      );
    } catch (error) {
      console.error("Error deactivating housing reviews:", error);
      throw error;
    }
  },

  async delete(id, userId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM housing_reviews WHERE id = ? AND user_id = ? AND status = 'pending'",
        [id, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting housing review:", error);
      throw error;
    }
  },

  async review(id, reviewerId, status, adminNotes) {
    try {
      const [result] = await pool.execute(
        "UPDATE housing_reviews SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [status, adminNotes || null, reviewerId, id],
      );
      return result.affectedRows > 0 ? this.findById(id) : null;
    } catch (error) {
      console.error("Error reviewing housing review:", error);
      throw error;
    }
  },

  async findAll({ page = 1, limit = 10, status } = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = ["1=1"];
      const countParams = [];
      if (status) { conditions.push("hr.status = ?"); countParams.push(status); }
      const where = conditions.join(" AND ");
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) as total FROM housing_reviews hr WHERE ${where}`,
        countParams,
      );
      const total = countRows[0].total;
      const dataParams = [...countParams, Number(limit), Number(offset)];
      const [rows] = await pool.query(
        `SELECT hr.*, u.display_name, u.name, u.email FROM housing_reviews hr JOIN users u ON hr.user_id = u.id WHERE ${where} ORDER BY hr.created_at DESC LIMIT ? OFFSET ?`,
        dataParams,
      );
      return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      console.error("Error finding housing reviews:", error);
      throw error;
    }
  },
};

module.exports = HousingReview;

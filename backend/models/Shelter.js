const { pool } = require("../config/db");

const Shelter = {
  async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM shelters WHERE user_id = ?",
        [userId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding shelter by user:", error);
      throw error;
    }
  },

  async findById(id) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM shelters WHERE id = ?",
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding shelter by ID:", error);
      throw error;
    }
  },

  async create(userId, data) {
    try {
      const { name, description, address, phone } = data;
      const [result] = await pool.execute(
        `INSERT INTO shelters (user_id, name, description, address, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, name, description || null, address, phone],
      );
      return { id: result.insertId, user_id: userId, name, description, address, phone, status: "pending" };
    } catch (error) {
      console.error("Error creating shelter:", error);
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
      if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
      if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
      if (data.address !== undefined) { fields.push("address = ?"); params.push(data.address); }
      if (data.phone !== undefined) { fields.push("phone = ?"); params.push(data.phone); }
      if (fields.length === 0) return null;
      params.push(id, userId);
      const [result] = await pool.execute(
        `UPDATE shelters SET ${fields.join(", ")} WHERE id = ? AND user_id = ? AND (status = 'pending' OR status = 'rejected')`,
        params,
      );
      return result.affectedRows > 0 ? this.findById(id) : null;
    } catch (error) {
      console.error("Error updating shelter:", error);
      throw error;
    }
  },

  async review(id, reviewerId, status, adminNotes) {
    try {
      const [result] = await pool.execute(
        "UPDATE shelters SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [status, adminNotes || null, reviewerId, id],
      );
      return result.affectedRows > 0 ? this.findById(id) : null;
    } catch (error) {
      console.error("Error reviewing shelter:", error);
      throw error;
    }
  },

  async findAll({ page = 1, limit = 10, status } = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = ["1=1"];
      const countParams = [];
      if (status) { conditions.push("s.status = ?"); countParams.push(status); }
      const where = conditions.join(" AND ");
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) as total FROM shelters s WHERE ${where}`,
        countParams,
      );
      const total = countRows[0].total;
      const dataParams = [...countParams, Number(limit), Number(offset)];
      const [rows] = await pool.query(
        `SELECT s.*, u.display_name, u.name, u.email FROM shelters s JOIN users u ON s.user_id = u.id WHERE ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
        dataParams,
      );
      return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      console.error("Error finding shelters:", error);
      throw error;
    }
  },
};

module.exports = Shelter;

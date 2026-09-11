const { pool } = require("../config/db");

const ModerationReport = {
  /**
   * Tạo báo cáo vi phạm nội dung
   */
  async create({ reporter_id, target_type, target_id, reason, description = null }) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO moderation_reports (reporter_id, target_type, target_id, reason, description, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [reporter_id, target_type, target_id, reason, description]
      );
      return {
        id: result.insertId,
        reporter_id,
        target_type,
        target_id,
        reason,
        description,
        status: "pending",
      };
    } catch (error) {
      console.error("[ModerationReport] create error:", error);
      throw error;
    }
  },

  /**
   * Lấy danh sách báo cáo cho Admin
   */
  async findAll({ page = 1, limit = 20, status } = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = ["1=1"];
      const params = [];

      if (status) {
        conditions.push("mr.status = ?");
        params.push(status);
      }

      const where = conditions.join(" AND ");

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM moderation_reports mr WHERE ${where}`,
        params
      );
      const total = countRows[0].total;

      const [rows] = await pool.query(
        `SELECT mr.*, u.display_name AS reporter_name, u.email AS reporter_email
         FROM moderation_reports mr
         JOIN users u ON mr.reporter_id = u.id
         WHERE ${where}
         ORDER BY mr.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), Number(offset)]
      );

      return {
        reports: rows,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("[ModerationReport] findAll error:", error);
      throw error;
    }
  },
};

module.exports = ModerationReport;

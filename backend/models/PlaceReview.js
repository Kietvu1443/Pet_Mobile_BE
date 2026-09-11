const { pool } = require("../config/db");

const PlaceReview = {
  /**
   * Lấy danh sách đánh giá của 1 địa điểm
   */
  async findByPlaceId(placeId, { page = 1, limit = 20 } = {}) {
    try {
      const offset = (page - 1) * limit;
      const [countRows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM place_reviews WHERE place_id = ?",
        [placeId]
      );
      const total = countRows[0].total;

      const [rows] = await pool.query(
        `SELECT pr.id, pr.place_id, pr.user_id, pr.rating, pr.comment,
                pr.created_at, pr.updated_at,
                u.display_name, u.name AS username, u.avatar
         FROM place_reviews pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.place_id = ?
         ORDER BY pr.created_at DESC
         LIMIT ? OFFSET ?`,
        [placeId, Number(limit), Number(offset)]
      );

      return {
        reviews: rows.map((r) => ({
          ...r,
          rating: Number(r.rating),
        })),
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("[PlaceReview] findByPlaceId error:", error);
      throw error;
    }
  },

  /**
   * Lấy review của 1 user cụ thể cho 1 địa điểm
   */
  async findByPlaceAndUser(placeId, userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT pr.*, u.display_name, u.name AS username, u.avatar
         FROM place_reviews pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.place_id = ? AND pr.user_id = ? LIMIT 1`,
        [placeId, userId]
      );
      if (rows.length === 0) return null;
      return {
        ...rows[0],
        rating: Number(rows[0].rating),
      };
    } catch (error) {
      console.error("[PlaceReview] findByPlaceAndUser error:", error);
      throw error;
    }
  },

  /**
   * Thêm hoặc cập nhật đánh giá (Upsert)
   */
  async upsert({ place_id, user_id, rating, comment = null }) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO place_reviews (place_id, user_id, rating, comment)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP`,
        [place_id, user_id, rating, comment]
      );
      return this.findByPlaceAndUser(place_id, user_id);
    } catch (error) {
      console.error("[PlaceReview] upsert error:", error);
      throw error;
    }
  },

  /**
   * Xóa đánh giá của chính mình
   */
  async delete(placeId, userId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM place_reviews WHERE place_id = ? AND user_id = ?",
        [placeId, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("[PlaceReview] delete error:", error);
      throw error;
    }
  },
};

module.exports = PlaceReview;

const { pool } = require("../config/db");

const VALID_PLACE_TYPES = [
  "shelter",
  "veterinary",
  "grooming",
  "pet_shop",
  "pet_cafe",
  "park",
  "meetup",
  "other",
];

const Place = {
  VALID_PLACE_TYPES,

  /**
   * Tìm kiếm địa điểm gần tọa độ user (Chỉ lấy status = 'approved')
   * Tối ưu hóa: Bounding Box pre-filter + công thức Haversine
   */
  async findNearby({ lat, lng, radiusKm = 10, type, limit = 50 }) {
    try {
      const userLat = Number(lat);
      const userLng = Number(lng);
      const radius = Math.min(Math.max(Number(radiusKm) || 10, 1), 50);
      const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

      // Bounding box delta
      const dLat = radius / 111.045;
      const dLng = radius / (111.045 * Math.cos((userLat * Math.PI) / 180));

      const minLat = userLat - dLat;
      const maxLat = userLat + dLat;
      const minLng = userLng - dLng;
      const maxLng = userLng + dLng;

      let sql = `
        SELECT p.id, p.name, p.type, p.description, p.address,
               p.latitude, p.longitude, p.phone, p.website, p.image_url,
               p.rating_avg, p.review_count, p.status, p.created_at,
               u.display_name AS creator_name,
               (6371 * acos(
                 cos(radians(?)) * cos(radians(p.latitude)) *
                 cos(radians(p.longitude) - radians(?)) +
                 sin(radians(?)) * sin(radians(p.latitude))
               )) AS distance_km
        FROM places p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.status = 'approved'
          AND p.latitude BETWEEN ? AND ?
          AND p.longitude BETWEEN ? AND ?
      `;

      const params = [
        userLat,
        userLng,
        userLat,
        minLat,
        maxLat,
        minLng,
        maxLng,
      ];

      if (type && VALID_PLACE_TYPES.includes(type)) {
        sql += " AND p.type = ?";
        params.push(type);
      }

      sql += `
        HAVING distance_km <= ?
        ORDER BY distance_km ASC
        LIMIT ?
      `;
      params.push(radius, maxLimit);

      const [rows] = await pool.query(sql, params);
      return rows.map((r) => ({
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        rating_avg: Number(r.rating_avg),
        review_count: Number(r.review_count),
        distance_km: r.distance_km != null ? Number(Number(r.distance_km).toFixed(2)) : null,
      }));
    } catch (error) {
      console.error("[Place] findNearby error:", error);
      throw error;
    }
  },

  /**
   * Lấy chi tiết 1 địa điểm theo ID
   */
  async findById(id) {
    try {
      const [rows] = await pool.execute(
        `SELECT p.id, p.name, p.type, p.description, p.address,
                p.latitude, p.longitude, p.phone, p.website, p.image_url,
                p.rating_avg, p.review_count, p.shelter_id, p.created_by,
                p.status, p.admin_notes, p.created_at, p.updated_at,
                u.display_name AS creator_name
         FROM places p
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = ? LIMIT 1`,
        [id]
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        ...r,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        rating_avg: Number(r.rating_avg),
        review_count: Number(r.review_count),
      };
    } catch (error) {
      console.error("[Place] findById error:", error);
      throw error;
    }
  },

  /**
   * Lấy danh sách địa điểm cho Admin Dashboard
   */
  async findAllAdmin({ page = 1, limit = 10, status, type, search } = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = ["1=1"];
      const params = [];

      if (status) {
        conditions.push("p.status = ?");
        params.push(status);
      }
      if (type) {
        conditions.push("p.type = ?");
        params.push(type);
      }
      if (search) {
        conditions.push("(p.name LIKE ? OR p.address LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const where = conditions.join(" AND ");

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM places p WHERE ${where}`,
        params
      );
      const total = countRows[0].total;

      const dataParams = [...params, Number(limit), Number(offset)];
      const [rows] = await pool.query(
        `SELECT p.*, u.display_name AS creator_name, u.name AS creator_username, u.email AS creator_email
         FROM places p
         LEFT JOIN users u ON p.created_by = u.id
         WHERE ${where}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        dataParams
      );

      return {
        places: rows.map((r) => ({
          ...r,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          rating_avg: Number(r.rating_avg),
          review_count: Number(r.review_count),
        })),
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error("[Place] findAllAdmin error:", error);
      throw error;
    }
  },

  /**
   * Tạo địa điểm mới
   */
  async create({
    name,
    type = "other",
    description = null,
    address,
    latitude,
    longitude,
    phone = null,
    website = null,
    image_url = null,
    shelter_id = null,
    created_by,
    status = "pending",
  }) {
    try {
      const [result] = await pool.execute(
        `INSERT INTO places (name, type, description, address, latitude, longitude, phone, website, image_url, shelter_id, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          type,
          description || null,
          address,
          latitude,
          longitude,
          phone || null,
          website || null,
          image_url || null,
          shelter_id || null,
          created_by,
          status,
        ]
      );
      return this.findById(result.insertId);
    } catch (error) {
      console.error("[Place] create error:", error);
      throw error;
    }
  },

  /**
   * Cập nhật địa điểm
   * Nếu user thường sửa -> tự động chuyển status về 'pending'
   */
  async update(id, userId, userRole, data) {
    try {
      const existing = await this.findById(id);
      if (!existing) return null;

      const isAdminOrStaff = userRole === 0 || userRole === 1;
      if (!isAdminOrStaff && existing.created_by !== userId) {
        const err = new Error("Bạn không có quyền sửa địa điểm này");
        err.statusCode = 403;
        throw err;
      }

      const fields = [];
      const params = [];

      if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
      if (data.type !== undefined) { fields.push("type = ?"); params.push(data.type); }
      if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
      if (data.address !== undefined) { fields.push("address = ?"); params.push(data.address); }
      if (data.latitude !== undefined) { fields.push("latitude = ?"); params.push(data.latitude); }
      if (data.longitude !== undefined) { fields.push("longitude = ?"); params.push(data.longitude); }
      if (data.phone !== undefined) { fields.push("phone = ?"); params.push(data.phone); }
      if (data.website !== undefined) { fields.push("website = ?"); params.push(data.website); }
      if (data.image_url !== undefined) { fields.push("image_url = ?"); params.push(data.image_url); }

      // Nếu user thường sửa địa điểm đã approved -> chuyển về pending để duyệt lại
      if (!isAdminOrStaff && existing.status === "approved") {
        fields.push("status = 'pending'");
      }

      if (fields.length === 0) return existing;

      params.push(id);
      await pool.execute(`UPDATE places SET ${fields.join(", ")} WHERE id = ?`, params);
      return this.findById(id);
    } catch (error) {
      console.error("[Place] update error:", error);
      throw error;
    }
  },

  /**
   * Admin duyệt hoặc từ chối địa điểm
   */
  async updateStatus(id, status, adminNotes = null) {
    try {
      const [result] = await pool.execute(
        "UPDATE places SET status = ?, admin_notes = ? WHERE id = ?",
        [status, adminNotes, id]
      );
      return result.affectedRows > 0 ? this.findById(id) : null;
    } catch (error) {
      console.error("[Place] updateStatus error:", error);
      throw error;
    }
  },

  /**
   * Xóa địa điểm
   */
  async delete(id, userId, userRole) {
    try {
      const existing = await this.findById(id);
      if (!existing) return false;

      const isAdminOrStaff = userRole === 0 || userRole === 1;
      if (!isAdminOrStaff && existing.created_by !== userId) {
        const err = new Error("Bạn không có quyền xóa địa điểm này");
        err.statusCode = 403;
        throw err;
      }

      const [result] = await pool.execute("DELETE FROM places WHERE id = ?", [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error("[Place] delete error:", error);
      throw error;
    }
  },

  /**
   * Cập nhật atomic rating_avg và review_count từ bảng place_reviews
   */
  async updateRatingAggregate(placeId) {
    try {
      await pool.execute(
        `UPDATE places p
         SET rating_avg = COALESCE((SELECT ROUND(AVG(rating), 2) FROM place_reviews WHERE place_id = p.id), 0.00),
             review_count = (SELECT COUNT(*) FROM place_reviews WHERE place_id = p.id)
         WHERE p.id = ?`,
        [placeId]
      );
    } catch (error) {
      console.error("[Place] updateRatingAggregate error:", error);
      throw error;
    }
  },
};

module.exports = Place;

const { pool } = require("../config/db");

const DEFAULT_PLACEHOLDER_IMAGE = "/images/the_logo.webp";

const Report = {
  /**
   * Create a new report inside a transaction.
   * Returns the created report object.
   */
  async create(data, connection = null) {
    const conn = connection || pool;
    const {
      user_id,
      type,
      reporter_name,
      phone,
      email,
      address,
      found_location,
      pet_code,
      pet_type,
      species,
      color,
      gender,
      description,
    } = data;

    const [result] = await conn.execute(
      `INSERT INTO reports
        (user_id, type, reporter_name, phone, email, address, found_location, pet_code, pet_type, species, color, gender, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user_id || null,
        type,
        reporter_name || null,
        phone,
        email || null,
        address || null,
        found_location || null,
        pet_code || null,
        pet_type,
        species || null,
        color || null,
        gender || "unknown",
        description || null,
      ],
    );

    return { id: result.insertId, ...data, status: "pending" };
  },

  /**
   * Find a report by ID
   */
  async findById(id) {
    const [rows] = await pool.execute(
      "SELECT * FROM reports WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] || null;
  },

  /**
   * Update report status (approve / reject)
   */
  async updateStatus(id, status) {
    const [result] = await pool.execute(
      "UPDATE reports SET status = ? WHERE id = ?",
      [status, id],
    );
    return result.affectedRows > 0;
  },

  /**
   * Find all reports (admin) with pagination and optional status filter.
   * Returns { data, total }
   */
  async findAll({ page = 1, limit = 20, status = null } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = "";

    if (
      status &&
      ["pending", "approved", "rejected", "resolved"].includes(status)
    ) {
      whereClause = "WHERE r.status = ?";
      params.push(status);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM reports r ${whereClause}`,
      params,
    );
    const total = countRows[0].total;

    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(
      `SELECT r.*,
              (SELECT pi.image_path FROM pet_images pi WHERE pi.report_id = r.id ORDER BY pi.display_order ASC LIMIT 1) AS image
       FROM reports r
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      queryParams,
    );

    // Fallback placeholder
    for (const row of rows) {
      if (!row.image) row.image = DEFAULT_PLACEHOLDER_IMAGE;
    }

    return { data: rows, total };
  },

  /**
   * Find approved reports filtered by type, with pagination.
   * Returns { data, total }
   */
  async findApproved({ type, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = "WHERE r.status = 'approved'";

    if (type && (type === "lost" || type === "found")) {
      whereClause += " AND r.type = ?";
      params.push(type);
    }

    // Count
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM reports r ${whereClause}`,
      params,
    );
    const total = countRows[0].total;

    // Data
    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(
      `SELECT r.id, r.type, r.description,
              COALESCE(r.address, r.found_location) AS location,
              r.reporter_name, r.phone, r.created_at,
              (SELECT pi.image_path FROM pet_images pi WHERE pi.report_id = r.id ORDER BY pi.display_order ASC LIMIT 1) AS image
       FROM reports r
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      queryParams,
    );

    // Fallback placeholder
    for (const row of rows) {
      if (!row.image) row.image = DEFAULT_PLACEHOLDER_IMAGE;
    }

    return { data: rows, total };
  },

  /**
   * Find reports by owner user with pagination.
   * Returns { data, total }
   */
  async findByUser({ userId, status, type, page = 1, limit = 12 } = {}) {
    const offset = (page - 1) * limit;
    const params = [String(userId)];
    let whereClause = "WHERE r.user_id = ?";

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      whereClause += " AND r.status = ?";
      params.push(status);
    }

    if (type && ["lost", "found"].includes(type)) {
      whereClause += " AND r.type = ?";
      params.push(type);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM reports r ${whereClause}`,
      params,
    );
    const total = countRows[0].total;

    const queryParams = [...params, String(limit), String(offset)];
    const [rows] = await pool.execute(
      `SELECT r.id, r.type, r.status, r.description,
              COALESCE(r.address, r.found_location) AS location,
              r.reporter_name, r.phone, r.created_at,
              (SELECT pi.image_path FROM pet_images pi WHERE pi.report_id = r.id ORDER BY pi.display_order ASC LIMIT 1) AS image
       FROM reports r
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      queryParams,
    );

    for (const row of rows) {
      if (!row.image) row.image = DEFAULT_PLACEHOLDER_IMAGE;
    }

    return { data: rows, total };
  },

  /**
   * Find recent reports by owner user (quick overlay).
   */
  async findRecentByUser({ userId, limit = 8 } = {}) {
    const [rows] = await pool.execute(
      `SELECT r.id, r.type, r.status, r.description,
              COALESCE(r.address, r.found_location) AS location,
              r.reporter_name, r.phone, r.created_at,
              (SELECT pi.image_path FROM pet_images pi WHERE pi.report_id = r.id ORDER BY pi.display_order ASC LIMIT 1) AS image
       FROM reports r
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [String(userId), String(limit)],
    );

    for (const row of rows) {
      if (!row.image) row.image = DEFAULT_PLACEHOLDER_IMAGE;
    }

    return rows;
  },

  /**
   * Aggregate report counts by status for current user.
   */
  async getStatusSummaryByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT status, COUNT(*) AS total
       FROM reports
       WHERE user_id = ?
       GROUP BY status`,
      [String(userId)],
    );

    const summary = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const row of rows) {
      const status = row.status;
      const total = Number(row.total || 0);
      if (Object.prototype.hasOwnProperty.call(summary, status)) {
        summary[status] = total;
      }
      summary.total += total;
    }

    return summary;
  },

  /**
   * Delete a report by ID
   */
  async delete(id) {
    const [result] = await pool.execute("DELETE FROM reports WHERE id = ?", [
      id,
    ]);
    return result.affectedRows > 0;
  },
};

module.exports = Report;

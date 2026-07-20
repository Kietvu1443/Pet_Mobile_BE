/**
 * petReturnRepository.js
 * Tầng truy vấn SQL trực tiếp cho pet_returns và pet_return_images.
 * Mọi hàm nhận `conn` (connection) để hỗ trợ Transaction bên ngoài.
 */
const { pool } = require("../config/db");

const petReturnRepository = {
  // ─── Queries chạy trên pool (không transaction) ──────────────────────────

  async findByUserAndPetPending(userId, petId) {
    const [rows] = await pool.execute(
      `SELECT id FROM pet_returns
       WHERE user_id = ? AND pet_id = ?
         AND status IN ('pending', 'approved_online')
       LIMIT 1`,
      [userId, petId],
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT pr.*,
              u.display_name, u.name AS user_name, u.email, u.address, u.phone,
              p.name AS pet_name_current, p.status AS pet_status
       FROM pet_returns pr
       INNER JOIN users u ON u.id = pr.user_id
       INNER JOIN pets  p ON p.id = pr.pet_id
       WHERE pr.id = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  },

  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT pr.*,
              GROUP_CONCAT(pri.image_path ORDER BY pri.id SEPARATOR '|') AS images
       FROM pet_returns pr
       LEFT JOIN pet_return_images pri ON pri.pet_return_id = pr.id
       WHERE pr.user_id = ?
       GROUP BY pr.id
       ORDER BY pr.created_at DESC`,
      [userId],
    );
    return rows.map(petReturnRepository._parseImages);
  },

  async findAllAdmin({ status, page, limit }) {
    const offset = (page - 1) * limit;
    const whereClause = status ? "WHERE pr.status = ?" : "";
    const params = status
      ? [status, String(limit), String(offset)]
      : [String(limit), String(offset)];

    const countParams = status ? [status] : [];
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM pet_returns pr ${whereClause}`,
      countParams,
    );

    const [rows] = await pool.execute(
      `SELECT pr.*,
              u.display_name, u.name AS user_name, u.email, u.address,
              p.name AS pet_name_current, p.pet_type, p.status AS pet_status,
              pi.image_path AS pet_primary_image,
              GROUP_CONCAT(pri.image_path ORDER BY pri.id SEPARATOR '|') AS images
       FROM pet_returns pr
       INNER JOIN users u ON u.id = pr.user_id
       INNER JOIN pets  p ON p.id = pr.pet_id
       LEFT JOIN pet_images pi ON pi.pet_id = p.id AND pi.display_order = 0
       LEFT JOIN pet_return_images pri ON pri.pet_return_id = pr.id
       ${whereClause}
       GROUP BY pr.id
       ORDER BY pr.created_at DESC
       LIMIT ? OFFSET ?`,
      params,
    );
    return { data: rows.map(petReturnRepository._parseImages), total };
  },

  async insertImages(petReturnId, imageList) {
    if (!imageList.length) return;
    for (const img of imageList) {
      await pool.execute(
        `INSERT INTO pet_return_images (pet_return_id, image_path, cloudinary_id)
         VALUES (?, ?, ?)`,
        [petReturnId, img.path, img.cloudinaryId || null],
      );
    }
  },

  // ─── Queries chạy trong Transaction (nhận conn) ───────────────────────────

  async lockForUpdate(conn, id) {
    const [rows] = await conn.execute(
      `SELECT id, user_id, pet_id, status FROM pet_returns WHERE id = ? FOR UPDATE`,
      [id],
    );
    return rows[0] || null;
  },

  async updateStatus(conn, id, { status, reviewedBy, adminNotes }) {
    await conn.execute(
      `UPDATE pet_returns
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, reviewedBy || null, adminNotes || null, id],
    );
  },

  async create(conn, data) {
    const [result] = await conn.execute(
      `INSERT INTO pet_returns
         (user_id, pet_id, adoption_request_id, reason_category, reason_detail,
          pet_name_snapshot, pet_image_snapshot, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        data.userId,
        data.petId,
        data.adoptionRequestId,
        data.reasonCategory,
        data.reasonDetail,
        data.petNameSnapshot,
        data.petImageSnapshot || null,
      ],
    );
    return result.insertId;
  },

  async insertImagesConn(conn, petReturnId, imageList) {
    for (const img of imageList) {
      await conn.execute(
        `INSERT INTO pet_return_images (pet_return_id, image_path, cloudinary_id)
         VALUES (?, ?, ?)`,
        [petReturnId, img.path, img.cloudinaryId || null],
      );
    }
  },

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _parseImages(row) {
    return {
      ...row,
      images: row.images ? row.images.split("|") : [],
    };
  },
};

module.exports = petReturnRepository;

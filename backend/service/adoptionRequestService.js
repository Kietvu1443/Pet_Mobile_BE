const { pool } = require("../config/db");
const notificationService = require("./notificationService");
const NOTIF_TYPES = require("../shared/constants/notificationTypes");

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const adoptionRequestService = {
  async createAdoptionRequest({ userId, petId, message, verify }) {
    if (Number(verify) !== 1) {
      throw createError(
        403,
        "Please verify your account before creating adoption request",
      );
    }

    const [petRows] = await pool.execute(
      "SELECT id, status FROM pets WHERE id = ? LIMIT 1",
      [petId],
    );

    if (!petRows.length) {
      throw createError(404, "Thú cưng không tồn tại");
    }

    if (petRows[0].status === "adopted") {
      throw createError(409, "Thú cưng này đã được nhận nuôi");
    }

    const [duplicateRows] = await pool.execute(
      "SELECT id FROM adoption_requests WHERE user_id = ? AND pet_id = ? LIMIT 1",
      [userId, petId],
    );

    if (duplicateRows.length) {
      throw createError(409, "Bạn đã gửi yêu cầu nhận nuôi cho thú cưng này");
    }

    const [result] = await pool.execute(
      `INSERT INTO adoption_requests (user_id, pet_id, message, status, created_at)
       VALUES (?, ?, ?, 'pending', NOW())`,
      [userId, petId, message],
    );

    return { id: result.insertId, status: "pending" };
  },

  async getAdminAdoptionRequests({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM adoption_requests`,
      [],
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT
        ar.id,
        ar.user_id,
        ar.pet_id,
        ar.message,
        ar.status,
        ar.created_at,
        ar.reviewed_at,
        ar.reviewed_by,
        u.display_name,
        u.name AS user_name,
        u.email,
        u.address,
        p.name AS pet_name,
        p.pet_type,
        p.status AS pet_status,
        pi.image_path AS pet_image
      FROM adoption_requests ar
      INNER JOIN users u ON u.id = ar.user_id
      INNER JOIN pets p ON p.id = ar.pet_id
      LEFT JOIN pet_images pi ON pi.pet_id = p.id AND pi.display_order = 0
      ORDER BY ar.created_at DESC
      LIMIT ? OFFSET ?`,
      [String(limit), String(offset)],
    );

    return { data: rows, total };
  },

  async getUserAdoptionRequests({ userId }) {
    const [rows] = await pool.execute(
      `SELECT
        ar.id,
        ar.pet_id,
        ar.message,
        ar.status,
        ar.created_at,
        ar.reviewed_at,
        p.name AS pet_name,
        p.pet_type,
        p.status AS pet_status,
        pi.image_path AS pet_image
      FROM adoption_requests ar
      INNER JOIN pets p ON p.id = ar.pet_id
      LEFT JOIN pet_images pi ON pi.pet_id = p.id AND pi.display_order = 0
      WHERE ar.user_id = ?
      ORDER BY ar.created_at DESC`,
      [userId],
    );

    return rows;
  },

  async updateAdoptionRequestStatus({ requestId, status, reviewerId }) {
    if (status === "approved") {
      return this.approveAdoptionRequest({ requestId, reviewerId });
    }

    const [reqRows] = await pool.execute(
      "SELECT ar.id, ar.user_id, ar.status, p.name AS pet_name FROM adoption_requests ar LEFT JOIN pets p ON ar.pet_id = p.id WHERE ar.id = ?",
      [requestId],
    );
    if (!reqRows.length) {
      throw createError(404, "Không tìm thấy hồ sơ nhận nuôi");
    }

    const [result] = await pool.execute(
      `UPDATE adoption_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reviewerId, requestId],
    );

    if (!result.affectedRows) {
      throw createError(409, "Hồ sơ đã được xử lý trước đó, vui lòng tải lại dữ liệu");
    }

    notificationService.send({
      userId: reqRows[0].user_id,
      title: "❌ Yêu cầu nhận nuôi bị từ chối",
      message: `Yêu cầu nhận nuôi "${reqRows[0].pet_name || 'thú cưng'}" của bạn đã bị từ chối.`,
      type: NOTIF_TYPES.ADOPTION_REJECTED,
      data: { requestId, status: "rejected" },
    });

    return { id: requestId, status: "rejected" };
  },

  async approveAdoptionRequest({ requestId, reviewerId }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.execute(
        `SELECT ar.id, ar.user_id, ar.pet_id, ar.status, p.name AS pet_name
         FROM adoption_requests ar
         JOIN pets p ON ar.pet_id = p.id
         WHERE ar.id = ?
         FOR UPDATE`,
        [requestId],
      );

      if (!requestRows.length) {
        throw createError(404, "Không tìm thấy hồ sơ nhận nuôi");
      }

      const request = requestRows[0];
      if (request.status !== "pending") {
        throw createError(
          409,
          "Hồ sơ đã được xử lý trước đó, vui lòng tải lại dữ liệu",
        );
      }

      const [petRows] = await connection.execute(
        "SELECT id, status FROM pets WHERE id = ? FOR UPDATE",
        [request.pet_id],
      );

      if (!petRows.length) {
        throw createError(404, "Thú cưng không tồn tại");
      }

      if (petRows[0].status === "adopted") {
        throw createError(409, "Thú cưng đã được nhận nuôi trước đó");
      }

      const [approveResult] = await connection.execute(
        `UPDATE adoption_requests
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ? AND status = 'pending'`,
        [reviewerId, requestId],
      );

      if (!approveResult.affectedRows) {
        throw createError(
          409,
          "Hồ sơ đã được xử lý trước đó, vui lòng tải lại dữ liệu",
        );
      }

      await connection.execute("UPDATE pets SET status = 'adopted' WHERE id = ?", [
        request.pet_id,
      ]);

      await connection.execute(
        `UPDATE adoption_requests
         SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
         WHERE pet_id = ? AND id <> ? AND status = 'pending'`,
        [reviewerId, request.pet_id, requestId],
      );

      await connection.commit();

      notificationService.send({
        userId: request.user_id,
        title: "✅ Yêu cầu nhận nuôi đã được duyệt",
        message: `Yêu cầu nhận nuôi "${request.pet_name || 'thú cưng'}" của bạn đã được duyệt! Vui lòng liên hệ trại cứu hộ để sắp xếp đón bé.`,
        type: NOTIF_TYPES.ADOPTION_APPROVED,
        data: { requestId, petId: request.pet_id, status: "approved" },
      });

      return { id: requestId, status: "approved" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async revertApprovedRequest({ requestId }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.execute(
        `SELECT id, pet_id, status
         FROM adoption_requests
         WHERE id = ?
         FOR UPDATE`,
        [requestId],
      );

      if (!requestRows.length) {
        throw createError(404, "Không tìm thấy hồ sơ nhận nuôi");
      }

      const request = requestRows[0];
      if (request.status !== "approved") {
        throw createError(409, "Chỉ có thể huỷ duyệt hồ sơ đã được duyệt");
      }

      const [petRows] = await connection.execute(
        "SELECT id FROM pets WHERE id = ? FOR UPDATE",
        [request.pet_id],
      );

      if (!petRows.length) {
        throw createError(404, "Thú cưng không tồn tại");
      }

      await connection.execute(
        `UPDATE adoption_requests
         SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
         WHERE id = ?`,
        [requestId],
      );

      await connection.execute("UPDATE pets SET status = 'available' WHERE id = ?", [
        request.pet_id,
      ]);

      await connection.commit();
      return { id: requestId, status: "pending" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async countPendingRequests(petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM adoption_requests WHERE pet_id = ? AND status = 'pending'",
        [petId],
      );
      return rows[0].total;
    } catch (error) {
      console.error("Error counting pending requests:", error);
      throw error;
    }
  },
};

module.exports = adoptionRequestService;

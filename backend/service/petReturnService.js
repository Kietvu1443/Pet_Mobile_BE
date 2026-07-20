/**
 * petReturnService.js
 * Xử lý toàn bộ nghiệp vụ Pet Return Workflow.
 * Mọi thao tác thay đổi dữ liệu đều sử dụng DB Transaction.
 */
const { pool } = require("../config/db");
const petReturnRepository = require("../repository/petReturnRepository");
const petReturnValidation = require("../validation/petReturnValidation");
const notificationService = require("./notificationService");

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Lấy danh sách user_id của tất cả staff và admin để gửi thông báo */
async function getStaffUserIds() {
  const [rows] = await pool.execute(
    `SELECT id FROM users WHERE role IN (0, 1) AND status != 'banned' LIMIT 20`,
  );
  return rows.map((r) => r.id);
}

const petReturnService = {
  // ─── CREATE ──────────────────────────────────────────────────────────────

  async createReturnRequest({ userId, petId, reasonCategory, reasonDetail, imageFiles }) {
    // 1. Validate inputs
    const validated = petReturnValidation.validateCreate({
      petId,
      reasonCategory,
      reasonDetail,
    });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 2. Verify tài khoản đã verify
      // (đã xử lý bởi requireApiVerified middleware, nhưng double-check ở service)
      const [[user]] = await connection.execute(
        "SELECT id, verify FROM users WHERE id = ? LIMIT 1",
        [userId],
      );
      if (!user || Number(user.verify) !== 1) {
        throw createError(403, "Tài khoản chưa xác thực email, không thể gửi yêu cầu");
      }

      // 3. Kiểm tra pet tồn tại và đang ở trạng thái adopted
      const [[pet]] = await connection.execute(
        "SELECT id, name, status FROM pets WHERE id = ? LIMIT 1 FOR UPDATE",
        [validated.petId],
      );
      if (!pet) throw createError(404, "Thú cưng không tồn tại");
      if (pet.status !== "adopted") {
        throw createError(409, "Thú cưng này hiện không ở trạng thái đang được nuôi");
      }

      // 4. Kiểm tra quyền sở hữu: user phải có adoption_request approved cho pet này
      const [[adoptionRequest]] = await connection.execute(
        `SELECT id FROM adoption_requests
         WHERE user_id = ? AND pet_id = ? AND status = 'approved'
         LIMIT 1`,
        [userId, validated.petId],
      );
      if (!adoptionRequest) {
        throw createError(403, "Bạn không có quyền gửi yêu cầu trả thú cưng này");
      }

      // 5. Chống duplicate: không cho tạo nếu đang có pending/approved_online
      const [[existing]] = await connection.execute(
        `SELECT id FROM pet_returns
         WHERE user_id = ? AND pet_id = ? AND status IN ('pending', 'approved_online')
         LIMIT 1`,
        [userId, validated.petId],
      );
      if (existing) {
        throw createError(409, "Bạn đã có yêu cầu trả thú cưng này đang được xử lý");
      }

      // 6. Lấy ảnh đại diện pet để snapshot
      const [[petImage]] = await connection.execute(
        "SELECT image_path FROM pet_images WHERE pet_id = ? AND display_order = 0 LIMIT 1",
        [validated.petId],
      );

      // 7. Tạo hồ sơ trả
      const returnId = await petReturnRepository.create(connection, {
        userId,
        petId: validated.petId,
        adoptionRequestId: adoptionRequest.id,
        reasonCategory: validated.reasonCategory,
        reasonDetail: validated.reasonDetail,
        petNameSnapshot: pet.name,
        petImageSnapshot: petImage ? petImage.image_path : null,
      });

      // 8. Lưu ảnh minh chứng
      if (imageFiles && imageFiles.length > 0) {
        await petReturnRepository.insertImagesConn(connection, returnId, imageFiles);
      }

      await connection.commit();

      // 9. Gửi thông báo cho staff (ngoài transaction)
      const staffIds = await getStaffUserIds();
      await notificationService.notifyStaffNewReturn(staffIds, pet.name, returnId);

      return { id: returnId, status: "pending" };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // ─── GET ─────────────────────────────────────────────────────────────────

  async getMyReturns(userId) {
    return petReturnRepository.findByUser(userId);
  },

  async getAdminReturns({ status, page = 1, limit = 15 }) {
    return petReturnRepository.findAllAdmin({ status, page, limit });
  },

  async getReturnById(id) {
    const record = await petReturnRepository.findById(id);
    if (!record) throw createError(404, "Không tìm thấy hồ sơ trả thú cưng");
    return record;
  },

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────

  /**
   * Cập nhật trạng thái hồ sơ trả với Transaction.
   * Chỉ khi status = 'completed' mới chuyển pets.status → available.
   */
  async updateStatus({ returnId, nextStatus, reviewerId, adminNotes, userRole }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Khóa dòng để tránh race condition
      const record = await petReturnRepository.lockForUpdate(connection, returnId);
      if (!record) throw createError(404, "Không tìm thấy hồ sơ trả thú cưng");

      // 2. Validate quyền sở hữu (cancel case)
      if (nextStatus === "cancelled") {
        petReturnValidation.validateOwnership(record, reviewerId, userRole);
      }

      // 3. Validate chuyển đổi trạng thái
      petReturnValidation.validateTransition(record.status, nextStatus, userRole);

      // 4. Nếu rejected: phải có admin_notes
      if (nextStatus === "rejected" && !String(adminNotes || "").trim()) {
        throw createError(400, "Vui lòng nhập lý do từ chối");
      }

      // 5. Cập nhật trạng thái hồ sơ trả
      await petReturnRepository.updateStatus(connection, returnId, {
        status: nextStatus,
        reviewedBy: nextStatus === "cancelled" ? null : reviewerId,
        adminNotes: adminNotes || null,
      });

      // 6. Nếu completed: chuyển pet về available
      if (nextStatus === "completed") {
        const [[petRow]] = await connection.execute(
          "SELECT id FROM pets WHERE id = ? FOR UPDATE",
          [record.pet_id],
        );
        if (!petRow) throw createError(404, "Thú cưng không còn tồn tại trong hệ thống");

        await connection.execute(
          "UPDATE pets SET status = 'available', updated_at = NOW() WHERE id = ?",
          [record.pet_id],
        );
      }

      await connection.commit();

      // 7. Thông báo cho user (ngoài transaction)
      const [[returnFull]] = await pool.execute(
        "SELECT user_id, pet_name_snapshot FROM pet_returns WHERE id = ? LIMIT 1",
        [returnId],
      );
      if (returnFull) {
        await notificationService.notifyUserStatusChange(
          returnFull.user_id,
          returnFull.pet_name_snapshot,
          nextStatus,
          adminNotes,
        );
      }

      return { id: returnId, status: nextStatus };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },
};

module.exports = petReturnService;

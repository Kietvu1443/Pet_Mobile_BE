/**
 * petReturnValidation.js
 * Kiểm tra dữ liệu đầu vào và logic chuyển đổi trạng thái (State Machine).
 */

const VALID_REASON_CATEGORIES = [
  "financial",   // Tài chính
  "allergy",     // Dị ứng
  "housing",     // Nhà ở / chỗ ở thay đổi
  "behavior",    // Hành vi của thú cưng
  "medical",     // Sức khỏe cá nhân
  "other",       // Khác
];

// Các chuyển đổi hợp lệ theo State Machine
const VALID_TRANSITIONS = {
  pending:          ["approved_online", "rejected", "cancelled"],
  approved_online:  ["completed", "rejected", "cancelled"],
  // completed, rejected, cancelled là terminal states
};

// Ai được phép thực hiện transition nào
// role 0=admin, 1=staff, 2=user
const TRANSITION_PERMISSIONS = {
  approved_online: [0, 1],   // Chỉ staff/admin
  completed:       [0, 1],   // Chỉ staff/admin
  rejected:        [0, 1],   // Chỉ staff/admin
  cancelled:       [0, 1, 2], // Cả user (tự cancel của mình)
};

function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const petReturnValidation = {
  /**
   * Validate body khi user gửi yêu cầu tạo mới.
   */
  validateCreate(body) {
    const petId = Number(body.petId);
    if (!petId || Number.isNaN(petId)) {
      throw createError(400, "petId không hợp lệ");
    }

    const reasonCategory = String(body.reasonCategory || "").trim();
    if (!VALID_REASON_CATEGORIES.includes(reasonCategory)) {
      throw createError(
        400,
        `Lý do không hợp lệ. Vui lòng chọn một trong: ${VALID_REASON_CATEGORIES.join(", ")}`,
      );
    }

    const reasonDetail = String(body.reasonDetail || "").trim();
    if (reasonDetail.length < 10) {
      throw createError(400, "Mô tả lý do phải có ít nhất 10 ký tự");
    }
    if (reasonDetail.length > 1000) {
      throw createError(400, "Mô tả lý do không được vượt quá 1000 ký tự");
    }

    return { petId, reasonCategory, reasonDetail };
  },

  /**
   * Kiểm tra tính hợp lệ của chuyển đổi trạng thái.
   * @param {string} currentStatus  - Trạng thái hiện tại trong DB
   * @param {string} nextStatus     - Trạng thái muốn chuyển sang
   * @param {number} userRole       - Role của người thực hiện
   */
  validateTransition(currentStatus, nextStatus, userRole) {
    const allowedNext = VALID_TRANSITIONS[currentStatus];
    if (!allowedNext) {
      throw createError(
        409,
        `Hồ sơ đang ở trạng thái "${currentStatus}" không thể thay đổi thêm`,
      );
    }

    if (!allowedNext.includes(nextStatus)) {
      throw createError(
        400,
        `Không thể chuyển từ trạng thái "${currentStatus}" sang "${nextStatus}"`,
      );
    }

    const permittedRoles = TRANSITION_PERMISSIONS[nextStatus];
    if (!permittedRoles.includes(userRole)) {
      throw createError(403, "Bạn không có quyền thực hiện thao tác này");
    }
  },

  /**
   * Kiểm tra quyền sở hữu: User chỉ được cancel hồ sơ của chính mình.
   */
  validateOwnership(returnRecord, userId, userRole) {
    if (userRole === 0 || userRole === 1) return; // Staff/Admin bypass
    if (Number(returnRecord.user_id) !== Number(userId)) {
      throw createError(403, "Bạn không có quyền thao tác hồ sơ này");
    }
  },
};

module.exports = petReturnValidation;

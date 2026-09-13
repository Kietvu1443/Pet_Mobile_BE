const { pool } = require("../config/db");
const PetInteraction = require("../models/PetInteraction");
const PetLike = require("../models/PetLike");

const PetInteractionService = {
  /**
   * Lấy trạng thái tương tác hiện tại trong bảng core `pet_likes`.
   */
  async getCurrentStatus(userId, petId) {
    const [rows] = await pool.query(
      "SELECT id, status FROM pet_likes WHERE user_id = ? AND pet_id = ? LIMIT 1",
      [userId, petId],
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Ghi nhận lượt thích (Like).
   * - CORE WRITE: Bắt buộc ghi THẬT vào bảng `pet_likes`. Nếu thất bại, throw lỗi thật.
   * - TELEMETRY: Ghi log vào `pet_interactions` (fail-soft nếu chưa migrate bảng).
   */
  async recordLike({
    userId,
    petId,
    source = "petsnap",
    sessionId = null,
    metadata = null,
  }) {
    const normalizedUserId = Number(userId);
    const normalizedPetId = Number(petId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Invalid userId");
    }
    if (!Number.isInteger(normalizedPetId) || normalizedPetId <= 0) {
      throw new Error("Invalid petId");
    }

    const current = await this.getCurrentStatus(normalizedUserId, normalizedPetId);
    let duplicate = false;

    if (current && current.status === "liked") {
      duplicate = true;
    } else {
      // 1. Core Write: Bắt buộc ghi thật vào bảng `pet_likes`
      const success = await PetLike.create(normalizedUserId, normalizedPetId, "liked");
      if (!success && !current) {
        throw new Error("Không thể ghi nhận lượt thích vào cơ sở dữ liệu");
      }
    }

    // 2. Telemetry: Ghi nhận sự kiện nếu bảng đã migrate (fail-soft)
    try {
      const hasTable = await PetInteraction.tableExists();
      if (hasTable) {
        await PetInteraction.create({
          userId: normalizedUserId,
          petId: normalizedPetId,
          interactionType: "like",
          source,
          sessionId,
          metadata,
        });
      }
    } catch (telemetryErr) {
      console.warn("[PetInteractionService] Telemetry like log skipped:", telemetryErr.message);
    }

    return { status: "liked", success: true, duplicate };
  },

  /**
   * Ghi nhận lượt bỏ qua (Pass/Dislike).
   * - CORE WRITE: Bắt buộc ghi THẬT vào bảng `pet_likes`. Nếu thất bại, throw lỗi thật.
   * - TELEMETRY: Ghi log vào `pet_interactions` (fail-soft nếu chưa migrate bảng).
   */
  async recordPass({
    userId,
    petId,
    source = "petsnap",
    sessionId = null,
    metadata = null,
  }) {
    const normalizedUserId = Number(userId);
    const normalizedPetId = Number(petId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Invalid userId");
    }
    if (!Number.isInteger(normalizedPetId) || normalizedPetId <= 0) {
      throw new Error("Invalid petId");
    }

    const current = await this.getCurrentStatus(normalizedUserId, normalizedPetId);
    let duplicate = false;

    if (current && current.status === "passed") {
      duplicate = true;
    } else {
      // 1. Core Write: Bắt buộc ghi thật vào bảng `pet_likes`
      const success = await PetLike.create(normalizedUserId, normalizedPetId, "passed");
      if (!success && !current) {
        throw new Error("Không thể ghi nhận lượt bỏ qua vào cơ sở dữ liệu");
      }
    }

    // 2. Telemetry: Ghi nhận sự kiện nếu bảng đã migrate (fail-soft)
    try {
      const hasTable = await PetInteraction.tableExists();
      if (hasTable) {
        await PetInteraction.create({
          userId: normalizedUserId,
          petId: normalizedPetId,
          interactionType: "pass",
          source,
          sessionId,
          metadata,
        });
      }
    } catch (telemetryErr) {
      console.warn("[PetInteractionService] Telemetry pass log skipped:", telemetryErr.message);
    }

    return { status: "passed", success: true, duplicate };
  },

  /**
   * Ghi nhận lượt Siêu Thích (Super Like).
   * - CORE WRITE: Bắt buộc ghi THẬT vào bảng `pet_likes` với status = 'superliked'.
   * - Nếu đã superliked trước đó: xử lý idempotent / duplicate thành công.
   * - Nếu DB write thất bại: throw lỗi thật.
   * - TELEMETRY: Ghi log vào `pet_interactions` (fail-soft nếu chưa migrate bảng).
   */
  async recordSuperLike({
    userId,
    petId,
    source = "petsnap",
    sessionId = null,
    metadata = null,
  }) {
    const normalizedUserId = Number(userId);
    const normalizedPetId = Number(petId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Invalid userId");
    }
    if (!Number.isInteger(normalizedPetId) || normalizedPetId <= 0) {
      throw new Error("Invalid petId");
    }

    const current = await this.getCurrentStatus(normalizedUserId, normalizedPetId);
    let duplicate = false;

    if (current && current.status === "superliked") {
      duplicate = true;
    } else {
      // Core Write: Bắt buộc ghi thật vào bảng `pet_likes`
      await PetLike.superLike(normalizedUserId, normalizedPetId);
    }

    // Telemetry: Ghi nhận sự kiện nếu bảng đã migrate (fail-soft)
    try {
      const hasTable = await PetInteraction.tableExists();
      if (hasTable) {
        await PetInteraction.create({
          userId: normalizedUserId,
          petId: normalizedPetId,
          interactionType: "super_like",
          source,
          sessionId,
          metadata,
        });
      }
    } catch (telemetryErr) {
      console.warn("[PetInteractionService] Telemetry super_like log skipped:", telemetryErr.message);
    }

    return { status: "superliked", success: true, duplicate };
  },

  /**
   * Ghi nhận lượt xem chi tiết thú cưng (Detail View).
   * Telemetry thuần túy: Không thay đổi bảng `pet_likes`.
   * Fail-soft nếu bảng `pet_interactions` chưa tồn tại.
   */
  async recordDetailView({
    userId,
    petId,
    source = "petsnap",
    sessionId = null,
    metadata = null,
  }) {
    const normalizedUserId = Number(userId);
    const normalizedPetId = Number(petId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Invalid userId");
    }
    if (!Number.isInteger(normalizedPetId) || normalizedPetId <= 0) {
      throw new Error("Invalid petId");
    }

    try {
      const hasTable = await PetInteraction.tableExists();
      if (hasTable) {
        await PetInteraction.create({
          userId: normalizedUserId,
          petId: normalizedPetId,
          interactionType: "detail_view",
          source,
          sessionId,
          metadata,
        });
      }
    } catch (telemetryErr) {
      console.warn("[PetInteractionService] Telemetry detail_view log skipped:", telemetryErr.message);
    }

    return { success: true };
  },

  /**
   * Ghi nhận lượt bỏ thích (Unlike).
   * - CORE WRITE: Xóa bản ghi trong bảng `pet_likes`.
   * - Kiểm tra trạng thái hiện tại: nếu thú cưng chưa được thích/siêu thích, ném lỗi thật.
   * - TELEMETRY: Ghi log vào `pet_interactions` (fail-soft nếu chưa migrate bảng).
   */
  async recordUnlike({
    userId,
    petId,
    source = "petsnap",
    sessionId = null,
    metadata = null,
  }) {
    const normalizedUserId = Number(userId);
    const normalizedPetId = Number(petId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      throw new Error("Invalid userId");
    }
    if (!Number.isInteger(normalizedPetId) || normalizedPetId <= 0) {
      throw new Error("Invalid petId");
    }

    const current = await this.getCurrentStatus(normalizedUserId, normalizedPetId);
    if (!current || !["liked", "superliked"].includes(current.status)) {
      const err = new Error("Thú cưng chưa được thích hoặc trạng thái không hợp lệ");
      err.statusCode = 400;
      throw err;
    }

    // Core Write: Xóa bản ghi thật khỏi bảng `pet_likes`
    await PetLike.delete(normalizedUserId, normalizedPetId);

    // Telemetry: Ghi nhận sự kiện nếu bảng đã migrate (fail-soft)
    try {
      const hasTable = await PetInteraction.tableExists();
      if (hasTable) {
        await PetInteraction.create({
          userId: normalizedUserId,
          petId: normalizedPetId,
          interactionType: "unlike",
          source,
          sessionId,
          metadata,
        });
      }
    } catch (telemetryErr) {
      console.warn("[PetInteractionService] Telemetry unlike log skipped:", telemetryErr.message);
    }

    return { status: "unliked", success: true };
  },

  /**
   * Ghi nhận hiển thị (Impression).
   * Telemetry thuần túy: Không fake database row nếu bảng chưa tồn tại.
   */
  async recordImpression({
    userId,
    petId,
    source = "petsnap",
    sessionId = null,
    metadata = null,
  }) {
    try {
      const hasTable = await PetInteraction.tableExists();
      if (!hasTable) {
        return; // No-op, không fake ID khi chưa có bảng
      }

      await PetInteraction.create({
        userId: Number(userId),
        petId: Number(petId),
        interactionType: "impression",
        source,
        sessionId,
        metadata,
      });
    } catch (err) {
      console.warn("[PetInteractionService] recordImpression failed:", err.message);
    }
  },
};

module.exports = PetInteractionService;

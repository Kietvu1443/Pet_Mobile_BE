const { pool } = require("../config/db");

let _tableExistsCache = null;
let _lastCacheCheck = 0;
const CACHE_TTL_MS = 60000; // 1 phút kiểm tra lại một lần nếu chưa tồn tại

const PetInteraction = {
  /**
   * Kiểm tra bảng `pet_interactions` có tồn tại trong CSDL hiện tại hay không.
   * Có cache kết quả để không query information_schema trên mỗi request.
   */
  async tableExists() {
    const now = Date.now();
    if (_tableExistsCache === true) {
      return true; // Một khi bảng đã tồn tại, không cần check lại
    }
    if (_tableExistsCache === false && now - _lastCacheCheck < CACHE_TTL_MS) {
      return false; // Đang trong thời gian cache miss
    }

    try {
      _lastCacheCheck = now;
      const [rows] = await pool.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pet_interactions' LIMIT 1"
      );
      _tableExistsCache = rows.length > 0;
      return _tableExistsCache;
    } catch (err) {
      console.warn("[PetInteraction] tableExists check failed:", err.message);
      return false;
    }
  },

  /** Reset cache (hữu ích cho testing) */
  clearTableExistsCache() {
    _tableExistsCache = null;
    _lastCacheCheck = 0;
  },

  async create(
    {
      userId,
      petId,
      interactionType,
      source = "petsnap",
      sessionId = null,
      metadata = null,
    },
    connection = null,
  ) {
    const executor = connection || pool;

    let metadataValue = null;
    if (metadata !== null && metadata !== undefined) {
      metadataValue =
        typeof metadata === "string" ? metadata : JSON.stringify(metadata);
    }

    const [result] = await executor.execute(
      `
        INSERT INTO pet_interactions (
          user_id,
          pet_id,
          interaction_type,
          source,
          session_id,
          metadata
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, petId, interactionType, source, sessionId, metadataValue],
    );

    return {
      id: result.insertId,
      userId,
      petId,
      interactionType,
      source,
      sessionId,
      metadata,
      createdAt: new Date(),
    };
  },

  async getUserPetInteractions(userId, petId) {
    const [rows] = await pool.execute(
      `
        SELECT
          id,
          user_id,
          pet_id,
          interaction_type,
          source,
          session_id,
          metadata,
          created_at
        FROM pet_interactions
        WHERE user_id = ? AND pet_id = ?
        ORDER BY id DESC
      `,
      [userId, petId],
    );
    return rows;
  },

  async getRecentUserInteractions(userId, limit = 300) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 300, 500));
    const [rows] = await pool.query(
      `
        SELECT
          pi.id,
          pi.pet_id,
          pi.interaction_type,
          pi.created_at,
          p.pet_type,
          p.breed,
          p.gender,
          p.color,
          p.age,
          p.weight
        FROM pet_interactions pi
        JOIN pets p ON p.id = pi.pet_id
        WHERE pi.user_id = ?
        ORDER BY pi.created_at DESC, pi.id DESC
        LIMIT ${safeLimit}
      `,
      [userId],
    );
    return rows;
  },
};

module.exports = PetInteraction;

const { pool } = require("../config/db");

/**
 * BestMatchStory.js
 * Voluntary journey entries for a Best Match. Never a reporting
 * requirement — absence of stories is never treated as negative evidence
 * (enforced at the service/assessment layer, not here).
 */
const BestMatchStory = {
  async create({ bestMatchId, authorUserId, title, content, storyDate, visibility }, conn = pool) {
    const [result] = await conn.execute(
      `INSERT INTO best_match_stories
        (best_match_id, author_user_id, title, content, story_date, visibility)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bestMatchId, authorUserId, title || null, content, storyDate || null, visibility || "private"],
    );
    return result.insertId;
  },

  async addMedia(storyId, mediaList, conn = pool) {
    if (!mediaList || !mediaList.length) return;
    let order = 0;
    for (const media of mediaList) {
      await conn.execute(
        `INSERT INTO best_match_story_media
          (story_id, media_type, media_path, cloudinary_id, caption, display_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          storyId,
          media.mediaType || "image",
          media.path,
          media.cloudinaryId || null,
          media.caption || null,
          order,
        ],
      );
      order += 1;
    }
  },

  async getById(storyId) {
    const [rows] = await pool.execute(
      "SELECT * FROM best_match_stories WHERE id = ? LIMIT 1",
      [storyId],
    );
    return rows[0] || null;
  },

  // Joins the parent Best Match so the caller can verify ownership in one query.
  async getByIdWithOwner(storyId) {
    const [rows] = await pool.execute(
      `SELECT s.*, bm.user_id AS best_match_owner_id, bm.id AS best_match_id
       FROM best_match_stories s
       INNER JOIN best_matches bm ON bm.id = s.best_match_id
       WHERE s.id = ?
       LIMIT 1`,
      [storyId],
    );
    return rows[0] || null;
  },

  async listMedia(storyId) {
    const [rows] = await pool.execute(
      "SELECT * FROM best_match_story_media WHERE story_id = ? ORDER BY display_order ASC",
      [storyId],
    );
    return rows;
  },

  async listByBestMatch(bestMatchId, { includePrivate = true, publicOnly = false } = {}) {
    let visibilityClause = "";
    if (publicOnly) {
      visibilityClause = "AND s.visibility = 'public'";
    } else if (!includePrivate) {
      visibilityClause = "AND s.visibility IN ('public', 'connections')";
    }

    const [rows] = await pool.execute(
      `SELECT * FROM best_match_stories s
       WHERE s.best_match_id = ? AND s.status = 'active' ${visibilityClause}
       ORDER BY COALESCE(s.story_date, DATE(s.created_at)) DESC, s.created_at DESC`,
      [bestMatchId],
    );

    if (!rows.length) return rows;

    const ids = rows.map((r) => r.id);
    const [mediaRows] = await pool.query(
      `SELECT * FROM best_match_story_media WHERE story_id IN (?) ORDER BY display_order ASC`,
      [ids],
    );

    const mediaByStory = new Map();
    for (const m of mediaRows) {
      if (!mediaByStory.has(m.story_id)) mediaByStory.set(m.story_id, []);
      mediaByStory.get(m.story_id).push(m);
    }

    return rows.map((r) => ({ ...r, media: mediaByStory.get(r.id) || [] }));
  },

  async update(storyId, fields) {
    const allowed = ["title", "content", "story_date", "visibility"];
    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }

    if (!sets.length) return this.getById(storyId);

    params.push(storyId);
    await pool.execute(
      `UPDATE best_match_stories SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    return this.getById(storyId);
  },

  async softDelete(storyId, conn = pool) {
    await conn.execute(
      "UPDATE best_match_stories SET status = 'deleted' WHERE id = ?",
      [storyId],
    );
  },
};

module.exports = BestMatchStory;

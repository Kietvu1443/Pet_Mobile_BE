const { pool } = require("../config/db");

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const VALID_CATEGORIES = [
  "community",
  "health",
  "adoption",
  "knowledge",
  "rescue",
];
const VALID_STATUSES = ["pending", "approved", "rejected"];

const newsService = {
  // ===== PUBLIC =====

  async getPublicNews({ category, page = 1, limit = 12 }) {
    const limitNum = Number(limit);
    const offset = Number((page - 1) * limitNum);
    const conditions = ["n.status = 'approved'"];
    const params = [];

    if (category && VALID_CATEGORIES.includes(category)) {
      conditions.push("n.category = ?");
      params.push(category);
    }

    const where = conditions.join(" AND ");

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM news n WHERE ${where}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT
        n.id, n.title, n.image, n.category, n.view_count,
        n.created_at, n.updated_at,
        u.display_name AS author_name, u.name AS author_full_name,
        u.email AS author_email, u.role AS author_role,
        u.avatar AS author_avatar,
        (SELECT COUNT(*) FROM news_likes nl WHERE nl.news_id = n.id) AS like_count,
        (SELECT COUNT(*) FROM news_comments nc WHERE nc.news_id = n.id) AS comment_count,
        (SELECT COUNT(*) FROM news_follows nf WHERE nf.news_id = n.id) AS follow_count
       FROM news n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    return {
      news: rows,
      total,
      page,
      totalPages: Math.ceil(total / limitNum),
    };
  },

  async getNewsById(newsId, userId = null) {
    const [[news]] = await pool.execute(
      `SELECT
        n.*,
        u.display_name AS author_name, u.name AS author_full_name,
        u.email AS author_email, u.role AS author_role,u.avatar AS author_avatar,
        (SELECT COUNT(*) FROM news_likes nl WHERE nl.news_id = n.id) AS like_count,
        (SELECT COUNT(*) FROM news_comments nc WHERE nc.news_id = n.id) AS comment_count,
        (SELECT COUNT(*) FROM news_follows nf WHERE nf.news_id = n.id) AS follow_count
       FROM news n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.id = ? AND n.status = 'approved'`,
      [newsId],
    );

    if (!news) throw createError(404, "Không tìm thấy bài tin");

    // Tăng view count
    await pool.execute(
      "UPDATE news SET view_count = view_count + 1 WHERE id = ?",
      [newsId],
    );

    // Check user đã like/follow chưa
    if (userId) {
      const [[likeRow]] = await pool.execute(
        "SELECT id FROM news_likes WHERE news_id = ? AND user_id = ?",
        [newsId, userId],
      );
      const [[followRow]] = await pool.execute(
        "SELECT id FROM news_follows WHERE news_id = ? AND user_id = ?",
        [newsId, userId],
      );
      news.is_liked = !!likeRow;
      news.is_followed = !!followRow;
    } else {
      news.is_liked = false;
      news.is_followed = false;
    }

    return news;
  },

  async getRandomFeaturedNews(limit = 3) {
    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.image, n.category, n.created_at,
              u.display_name AS author_name, u.name AS author_full_name,
              u.email AS author_email, u.role AS author_role,
              u.avatar AS author_avatar,
              (SELECT COUNT(*) FROM news_likes nl WHERE nl.news_id = n.id) AS like_count
       FROM news n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.status = 'approved'
       ORDER BY RAND()
       LIMIT ?`,
      [Number(limit)],
    );
    return rows;
  },

  // ===== COMMENTS =====

  async getComments(newsId, userId = null) {
    const [rows] = await pool.execute(
      `SELECT
        nc.id, nc.news_id, nc.user_id, nc.parent_id, nc.content,
        nc.created_at, nc.updated_at,
        u.display_name AS author_name,
        u.avatar AS author_avatar,
        (SELECT COUNT(*) FROM news_comment_likes ncl WHERE ncl.comment_id = nc.id) AS like_count
       FROM news_comments nc
       INNER JOIN users u ON u.id = nc.user_id
       WHERE nc.news_id = ?
       ORDER BY nc.created_at ASC`,
      [newsId],
    );

    // Nếu đã đăng nhập, check từng comment đã like chưa
    if (userId && rows.length > 0) {
      const commentIds = rows.map((r) => r.id);
      const [likedRows] = await pool.query(
        `SELECT comment_id FROM news_comment_likes WHERE comment_id IN (?) AND user_id = ?`,
        [commentIds, userId],
      );
      const likedSet = new Set(likedRows.map((r) => r.comment_id));
      rows.forEach((r) => {
        r.is_liked = likedSet.has(r.id);
      });
    } else {
      rows.forEach((r) => {
        r.is_liked = false;
      });
    }

    // Build cây đúng:
    // Cấp 1: comment gốc (parent_id = null)
    // Cấp 2: reply trực tiếp vào comment gốc → gắn vào replies của cấp 1
    // Cấp 3: reply vào cấp 2 → gắn vào replies của cấp 2 đó
    // Cấp 4+: reply vào cấp 3+ → gắn vào replies của cha trực tiếp (frontend sẽ giới hạn hiển thị)

    const rowMap = {};
    rows.forEach((r) => {
      r.replies = [];
      rowMap[r.id] = r;
    });

    const rootComments = [];
    rows.forEach((r) => {
      if (!r.parent_id) {
        // Cấp 1 — comment gốc
        rootComments.push(r);
      } else {
        const parent = rowMap[r.parent_id];
        if (parent) {
          // Gắn vào replies của cha trực tiếp — giữ đúng cây
          parent.replies.push(r);
        }
        // Nếu không tìm thấy cha (bị xóa chẳng hạn) → bỏ qua
      }
    });
    return rootComments;
  },

  async addComment({ newsId, userId, parentId, content }) {
    const [[news]] = await pool.execute(
      "SELECT id FROM news WHERE id = ? AND status = 'approved'",
      [newsId],
    );
    if (!news) throw createError(404, "Không tìm thấy bài tin");

    if (parentId) {
      const [[parent]] = await pool.execute(
        "SELECT id FROM news_comments WHERE id = ? AND news_id = ?",
        [parentId, newsId],
      );
      if (!parent) throw createError(404, "Bình luận gốc không tồn tại");
    }

    const [result] = await pool.execute(
      "INSERT INTO news_comments (news_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)",
      [newsId, userId, parentId || null, content],
    );
    return { id: result.insertId };
  },

  // ===== LIKES =====

  async toggleNewsLike({ newsId, userId }) {
    const [[existing]] = await pool.execute(
      "SELECT id FROM news_likes WHERE news_id = ? AND user_id = ?",
      [newsId, userId],
    );

    if (existing) {
      await pool.execute("DELETE FROM news_likes WHERE id = ?", [existing.id]);
      return { liked: false };
    } else {
      await pool.execute(
        "INSERT INTO news_likes (news_id, user_id) VALUES (?, ?)",
        [newsId, userId],
      );
      return { liked: true };
    }
  },

  async toggleCommentLike({ commentId, userId }) {
    const [[existing]] = await pool.execute(
      "SELECT id FROM news_comment_likes WHERE comment_id = ? AND user_id = ?",
      [commentId, userId],
    );

    if (existing) {
      await pool.execute("DELETE FROM news_comment_likes WHERE id = ?", [
        existing.id,
      ]);
      return { liked: false };
    } else {
      await pool.execute(
        "INSERT INTO news_comment_likes (comment_id, user_id) VALUES (?, ?)",
        [commentId, userId],
      );
      return { liked: true };
    }
  },

  // ===== FOLLOWS =====

  async toggleFollow({ newsId, userId }) {
    const [[existing]] = await pool.execute(
      "SELECT id FROM news_follows WHERE news_id = ? AND user_id = ?",
      [newsId, userId],
    );

    if (existing) {
      await pool.execute("DELETE FROM news_follows WHERE id = ?", [
        existing.id,
      ]);
      return { followed: false };
    } else {
      await pool.execute(
        "INSERT INTO news_follows (news_id, user_id) VALUES (?, ?)",
        [newsId, userId],
      );
      return { followed: true };
    }
  },

  async getMyFollowedNews({ userId, page = 1, limit = 12 }) {
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM news_follows WHERE user_id = ?",
      [userId],
    );

    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.image, n.category, n.created_at,
              u.display_name AS author_name, u.name AS author_full_name,
              u.email AS author_email, u.role AS author_role,
              u.avatar AS author_avatar,
              (SELECT COUNT(*) FROM news_likes nl WHERE nl.news_id = n.id) AS like_count
       FROM news_follows nf
       INNER JOIN news n ON n.id = nf.news_id AND n.status = 'approved'
       INNER JOIN users u ON u.id = n.author_id
       WHERE nf.user_id = ?
       ORDER BY nf.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    return { news: rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  // ===== SUBMIT (USER/ADMIN) =====

  async submitNews({ authorId, title, content, image, category }) {
    if (!VALID_CATEGORIES.includes(category)) {
      throw createError(400, "Danh mục không hợp lệ");
    }

    const [result] = await pool.execute(
      `INSERT INTO news (author_id, title, content, image, category, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [authorId, title, content, image || null, category],
    );

    return { id: result.insertId, status: "pending" };
  },

  async getMyNews({ userId, page = 1, limit = 12 }) {
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM news WHERE author_id = ?",
      [userId],
    );

    const [rows] = await pool.query(
      `SELECT id, title, image, category, status, rejected_reason,
              view_count, created_at, updated_at
       FROM news WHERE author_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    return { news: rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  // ===== ADMIN =====

  async getAdminNews({ status, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
      conditions.push("n.status = ?");
      params.push(status);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM news n ${where}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.image, n.category, n.status,
              n.rejected_reason, n.view_count, n.created_at, n.updated_at,
              u.display_name AS author_name, u.name AS author_full_name,
              u.email AS author_email, u.role AS author_role,
              u.avatar AS author_avatar
       FROM news n
       LEFT JOIN users u ON u.id = n.author_id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset],
    );

    return { news: rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  async updateNewsStatus({ newsId, status, rejectedReason }) {
    if (!VALID_STATUSES.includes(status)) {
      throw createError(400, "Trạng thái không hợp lệ");
    }

    const [[news]] = await pool.execute("SELECT id FROM news WHERE id = ?", [
      newsId,
    ]);
    if (!news) throw createError(404, "Không tìm thấy bài tin");

    await pool.execute(
      "UPDATE news SET status = ?, rejected_reason = ?, updated_at = NOW() WHERE id = ?",
      [status, status === "rejected" ? rejectedReason || null : null, newsId],
    );

    return { id: newsId, status };
  },

  async deleteNews(newsId) {
    const [[news]] = await pool.execute("SELECT id FROM news WHERE id = ?", [
      newsId,
    ]);
    if (!news) throw createError(404, "Không tìm thấy bài tin");
    await pool.execute("DELETE FROM news WHERE id = ?", [newsId]);
    return { id: newsId };
  },
};

module.exports = newsService;

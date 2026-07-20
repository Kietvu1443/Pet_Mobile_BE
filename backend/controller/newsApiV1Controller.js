const newsService = require("../service/newsService");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { isProduction, getImageUrl, getCloudinaryId } = require("../config/upload");

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const newsApiV1Controller = {

  // ===== PUBLIC =====

  async getPublicNews(req, res) {
    try {
      const category = req.query.category || null;
      const page  = Math.max(1, toNumber(req.query.page, 1));
      const limit = Math.min(50, Math.max(1, toNumber(req.query.limit, 12)));
      const result = await newsService.getPublicNews({ category, page, limit });
      return sendSuccess(res, 200, "Lấy danh sách tin tức thành công", result);
    } catch (error) {
      console.error("[News] getPublicNews:", error);
      return sendError(res, 500, "Không thể tải danh sách tin tức");
    }
  },

  async getNewsById(req, res) {
    try {
      const newsId = Number(req.params.id);
      if (!newsId) return sendError(res, 400, "ID không hợp lệ");
      const userId = req.user ? req.user.id : null;
      const news = await newsService.getNewsById(newsId, userId);
      return sendSuccess(res, 200, "Lấy bài tin thành công", { news });
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể tải bài tin");
    }
  },

  async getFeaturedNews(req, res) {
    try {
      const limit = Math.min(10, toNumber(req.query.limit, 3));
      const news = await newsService.getRandomFeaturedNews(limit);
      return sendSuccess(res, 200, "Lấy tin nổi bật thành công", { news });
    } catch (error) {
      return sendError(res, 500, "Không thể tải tin nổi bật");
    }
  },

  async getComments(req, res) {
    try {
      const newsId = Number(req.params.id);
      if (!newsId) return sendError(res, 400, "ID không hợp lệ");
      const userId = req.user ? req.user.id : null;
      const comments = await newsService.getComments(newsId, userId);
      return sendSuccess(res, 200, "Lấy bình luận thành công", { comments });
    } catch (error) {
      return sendError(res, 500, "Không thể tải bình luận");
    }
  },

  // ===== AUTH REQUIRED =====

  async addComment(req, res) {
    try {
      const newsId   = Number(req.params.id);
      const userId   = req.user.id;
      const { content, parent_id } = req.body;

      if (!content || !content.trim()) {
        return sendError(res, 400, "Nội dung bình luận không được để trống");
      }

      const result = await newsService.addComment({
        newsId,
        userId,
        parentId: parent_id ? Number(parent_id) : null,
        content: content.trim(),
      });

      return sendSuccess(res, 201, "Bình luận thành công", result);
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể thêm bình luận");
    }
  },

  async toggleNewsLike(req, res) {
    try {
      const newsId = Number(req.params.id);
      const userId = req.user.id;
      const result = await newsService.toggleNewsLike({ newsId, userId });
      return sendSuccess(res, 200, result.liked ? "Đã thích" : "Đã bỏ thích", result);
    } catch (error) {
      return sendError(res, 500, "Không thể thực hiện");
    }
  },

  async toggleCommentLike(req, res) {
    try {
      const commentId = Number(req.params.commentId);
      const userId    = req.user.id;
      const result    = await newsService.toggleCommentLike({ commentId, userId });
      return sendSuccess(res, 200, result.liked ? "Đã thích" : "Đã bỏ thích", result);
    } catch (error) {
      return sendError(res, 500, "Không thể thực hiện");
    }
  },

  async toggleFollow(req, res) {
    try {
      const newsId = Number(req.params.id);
      const userId = req.user.id;
      const result = await newsService.toggleFollow({ newsId, userId });
      return sendSuccess(res, 200, result.followed ? "Đã quan tâm" : "Đã bỏ quan tâm", result);
    } catch (error) {
      return sendError(res, 500, "Không thể thực hiện");
    }
  },

  async getMyFollowedNews(req, res) {
    try {
      const userId = req.user.id;
      const page   = Math.max(1, toNumber(req.query.page, 1));
      const limit  = Math.min(24, toNumber(req.query.limit, 12));
      const result = await newsService.getMyFollowedNews({ userId, page, limit });
      return sendSuccess(res, 200, "Lấy tin tức quan tâm thành công", result);
    } catch (error) {
      return sendError(res, 500, "Không thể tải tin tức quan tâm");
    }
  },

  async submitNews(req, res) {
    try {
      const userId   = req.user.id;
      const { title, content, category } = req.body;

      if (!title || !title.trim()) return sendError(res, 400, "Tiêu đề không được để trống");
      if (!content || !content.trim()) return sendError(res, 400, "Nội dung không được để trống");
      if (!category) return sendError(res, 400, "Vui lòng chọn danh mục");

      // Xử lý ảnh upload
      let imageUrl = null;
      if (req.file) {
        imageUrl = isProduction ? req.file.path : getImageUrl(req.file);
      }

      const result = await newsService.submitNews({
        authorId: userId,
        title:    title.trim(),
        content:  content.trim(),
        image:    imageUrl,
        category,
      });

      return sendSuccess(res, 201, "Gửi bài tin thành công, đang chờ duyệt", result);
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể gửi bài tin");
    }
  },

  async getMyNews(req, res) {
    try {
      const userId = req.user.id;
      const page   = Math.max(1, toNumber(req.query.page, 1));
      const limit  = Math.min(24, toNumber(req.query.limit, 12));
      const result = await newsService.getMyNews({ userId, page, limit });
      return sendSuccess(res, 200, "Lấy bài tin của bạn thành công", result);
    } catch (error) {
      return sendError(res, 500, "Không thể tải bài tin");
    }
  },

  // ===== ADMIN =====

  async getAdminNews(req, res) {
    try {
      const status = req.query.status || null;
      const page   = Math.max(1, toNumber(req.query.page, 1));
      const limit  = Math.min(100, toNumber(req.query.limit, 50));
      const result = await newsService.getAdminNews({ status, page, limit });
      return sendSuccess(res, 200, "Lấy danh sách tin tức thành công", result);
    } catch (error) {
      return sendError(res, 500, "Không thể tải danh sách tin tức");
    }
  },

  async updateNewsStatus(req, res) {
    try {
      const newsId         = Number(req.params.id);
      const { status, rejected_reason } = req.body;
      if (!newsId) return sendError(res, 400, "ID không hợp lệ");
      const result = await newsService.updateNewsStatus({ newsId, status, rejectedReason: rejected_reason });
      return sendSuccess(res, 200, "Cập nhật trạng thái thành công", result);
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể cập nhật");
    }
  },

  async deleteNews(req, res) {
    try {
      const newsId = Number(req.params.id);
      if (!newsId) return sendError(res, 400, "ID không hợp lệ");
      const result = await newsService.deleteNews(newsId);
      return sendSuccess(res, 200, "Xóa bài tin thành công", result);
    } catch (error) {
      return sendError(res, error.status || 500, error.message || "Không thể xóa");
    }
  },
};

module.exports = newsApiV1Controller;

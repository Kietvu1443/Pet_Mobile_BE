const Place = require("../models/Place");
const PlaceReview = require("../models/PlaceReview");
const ModerationReport = require("../models/ModerationReport");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { getImageUrl, deleteImage } = require("../config/upload");

const placeApiV1Controller = {
  /**
   * GET /api/v1/places/nearby
   * Lấy danh sách địa điểm gần tọa độ (Chỉ approved)
   */
  async getNearby(req, res) {
    try {
      const { lat, lng, radius, type, limit } = req.query;

      if (!lat || !lng) {
        return sendError(res, 400, "Vui lòng cung cấp tọa độ lat và lng");
      }

      const numLat = Number(lat);
      const numLng = Number(lng);

      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        return sendError(res, 400, "Tọa độ vĩ độ (latitude) không hợp lệ (-90 đến 90)");
      }
      if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        return sendError(res, 400, "Tọa độ kinh độ (longitude) không hợp lệ (-180 đến 180)");
      }

      const places = await Place.findNearby({
        lat: numLat,
        lng: numLng,
        radiusKm: radius ? Number(radius) : 10,
        type: type || null,
        limit: limit ? Number(limit) : 50,
      });

      return sendSuccess(res, 200, "Lấy danh sách địa điểm thành công", { places });
    } catch (error) {
      console.error("[Place] getNearby error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi tìm kiếm địa điểm");
    }
  },

  /**
   * GET /api/v1/places/:id
   * Xem chi tiết địa điểm
   */
  async getDetail(req, res) {
    try {
      const { id } = req.params;
      const place = await Place.findById(id);

      if (!place) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }

      // Nếu địa điểm chưa duyệt và người xem không phải chủ sở hữu hoặc admin -> 404
      const user = req.user || null;
      const isAdminOrStaff = user && (user.role === 0 || user.role === 1);
      const isOwner = user && user.id === place.created_by;

      if (place.status !== "approved" && !isAdminOrStaff && !isOwner) {
        return sendError(res, 404, "Không tìm thấy địa điểm hoặc địa điểm đang chờ duyệt");
      }

      // Lấy review của user hiện tại nếu có đăng nhập
      let myReview = null;
      if (user) {
        myReview = await PlaceReview.findByPlaceAndUser(place.id, user.id);
      }

      return sendSuccess(res, 200, "Lấy thông tin địa điểm thành công", {
        place,
        my_review: myReview,
      });
    } catch (error) {
      console.error("[Place] getDetail error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi lấy thông tin địa điểm");
    }
  },

  /**
   * POST /api/v1/places
   * Tạo địa điểm cộng đồng mới (User -> pending, Admin/Staff -> approved)
   */
  async create(req, res) {
    try {
      const { name, type, description, address, latitude, longitude, phone, website, shelter_id } = req.body;

      if (!name || !name.trim()) {
        return sendError(res, 400, "Vui lòng nhập tên địa điểm");
      }
      if (!address || !address.trim()) {
        return sendError(res, 400, "Vui lòng nhập địa chỉ địa điểm");
      }
      if (latitude === undefined || longitude === undefined) {
        return sendError(res, 400, "Vui lòng cung cấp tọa độ địa điểm (latitude, longitude)");
      }

      const numLat = Number(latitude);
      const numLng = Number(longitude);

      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        return sendError(res, 400, "Tọa độ vĩ độ (latitude) không hợp lệ (-90 đến 90)");
      }
      if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        return sendError(res, 400, "Tọa độ kinh độ (longitude) không hợp lệ (-180 đến 180)");
      }

      const placeType = Place.VALID_PLACE_TYPES.includes(type) ? type : "other";

      // Server-side status enforcement
      const userRole = req.user.role;
      const isAdminOrStaff = userRole === 0 || userRole === 1;
      const status = isAdminOrStaff ? "approved" : "pending";

      let imageUrl = null;
      if (req.file) {
        imageUrl = getImageUrl(req.file);
      }

      let newPlace = null;
      try {
        newPlace = await Place.create({
          name: name.trim(),
          type: placeType,
          description: description ? description.trim() : null,
          address: address.trim(),
          latitude: numLat,
          longitude: numLng,
          phone: phone ? phone.trim() : null,
          website: website ? website.trim() : null,
          image_url: imageUrl,
          shelter_id: shelter_id ? Number(shelter_id) : null,
          created_by: req.user.id,
          status,
        });
      } catch (dbErr) {
        // Rollback ảnh Cloudinary nếu DB lỗi
        if (req.file) {
          try { await deleteImage(req.file); } catch (_) {}
        }
        throw dbErr;
      }

      const message = status === "approved"
        ? "Tạo địa điểm thành công"
        : "Địa điểm đã được gửi và đang chờ kiểm duyệt";

      return sendSuccess(res, 201, message, { place: newPlace });
    } catch (error) {
      console.error("[Place] create error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi tạo địa điểm");
    }
  },

  /**
   * PATCH /api/v1/places/:id
   * Sửa địa điểm (Nếu user thường sửa place đã approved -> chuyển về pending)
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, type, description, address, latitude, longitude, phone, website } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (type !== undefined && Place.VALID_PLACE_TYPES.includes(type)) updateData.type = type;
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (address !== undefined) updateData.address = address.trim();
      if (latitude !== undefined) {
        const numLat = Number(latitude);
        if (isNaN(numLat) || numLat < -90 || numLat > 90) return sendError(res, 400, "Vĩ độ không hợp lệ");
        updateData.latitude = numLat;
      }
      if (longitude !== undefined) {
        const numLng = Number(longitude);
        if (isNaN(numLng) || numLng < -180 || numLng > 180) return sendError(res, 400, "Kinh độ không hợp lệ");
        updateData.longitude = numLng;
      }
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (website !== undefined) updateData.website = website ? website.trim() : null;

      if (req.file) {
        updateData.image_url = getImageUrl(req.file);
      }

      const updated = await Place.update(id, req.user.id, req.user.role, updateData);
      if (!updated) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }

      const message = updated.status === "pending"
        ? "Cập nhật thành công. Địa điểm đang chờ kiểm duyệt lại."
        : "Cập nhật địa điểm thành công";

      return sendSuccess(res, 200, message, { place: updated });
    } catch (error) {
      if (error.statusCode === 403) {
        return sendError(res, 403, error.message);
      }
      console.error("[Place] update error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi cập nhật địa điểm");
    }
  },

  /**
   * DELETE /api/v1/places/:id
   * Xóa địa điểm
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Place.delete(id, req.user.id, req.user.role);
      if (!deleted) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }
      return sendSuccess(res, 200, "Xóa địa điểm thành công");
    } catch (error) {
      if (error.statusCode === 403) {
        return sendError(res, 403, error.message);
      }
      console.error("[Place] delete error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi xóa địa điểm");
    }
  },

  /**
   * GET /api/v1/places/:id/reviews
   * Lấy danh sách đánh giá của địa điểm
   */
  async getReviews(req, res) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      const place = await Place.findById(id);
      if (!place) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }

      const result = await PlaceReview.findByPlaceId(id, { page, limit });
      return sendSuccess(res, 200, "Lấy danh sách đánh giá thành công", result);
    } catch (error) {
      console.error("[Place] getReviews error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi lấy danh sách đánh giá");
    }
  },

  /**
   * POST /api/v1/places/:id/reviews
   * Đăng hoặc cập nhật đánh giá (1-5 sao + comment)
   */
  async postReview(req, res) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;

      const place = await Place.findById(id);
      if (!place) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }
      if (place.status !== "approved") {
        return sendError(res, 400, "Không thể đánh giá địa điểm chưa được duyệt");
      }

      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
        return sendError(res, 400, "Đánh giá sao phải là số nguyên từ 1 đến 5");
      }

      const cleanComment = comment ? String(comment).trim().slice(0, 2000) : null;

      const review = await PlaceReview.upsert({
        place_id: place.id,
        user_id: req.user.id,
        rating: numRating,
        comment: cleanComment,
      });

      // Tự động cập nhật điểm trung bình của địa điểm
      await Place.updateRatingAggregate(place.id);

      const updatedPlace = await Place.findById(place.id);

      return sendSuccess(res, 200, "Đánh giá địa điểm thành công", {
        review,
        rating_avg: updatedPlace.rating_avg,
        review_count: updatedPlace.review_count,
      });
    } catch (error) {
      console.error("[Place] postReview error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi gửi đánh giá");
    }
  },

  /**
   * DELETE /api/v1/places/:id/reviews/my
   * Xóa đánh giá của chính mình
   */
  async deleteMyReview(req, res) {
    try {
      const { id } = req.params;
      const deleted = await PlaceReview.delete(id, req.user.id);
      if (!deleted) {
        return sendError(res, 404, "Bạn chưa có đánh giá nào cho địa điểm này");
      }

      // Cập nhật lại điểm trung bình
      await Place.updateRatingAggregate(id);

      return sendSuccess(res, 200, "Xóa đánh giá thành công");
    } catch (error) {
      console.error("[Place] deleteMyReview error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi xóa đánh giá");
    }
  },

  /**
   * POST /api/v1/places/:id/report
   * Báo cáo vi phạm địa điểm hoặc đánh giá
   */
  async report(req, res) {
    try {
      const { id } = req.params;
      const { target_type = "place", reason, description } = req.body;

      if (!reason) {
        return sendError(res, 400, "Vui lòng chọn lý do báo cáo");
      }

      const validReasons = [
        "spam",
        "incorrect_info",
        "place_not_exist",
        "wrong_location",
        "inappropriate",
        "other",
      ];
      if (!validReasons.includes(reason)) {
        return sendError(res, 400, "Lý do báo cáo không hợp lệ");
      }

      const report = await ModerationReport.create({
        reporter_id: req.user.id,
        target_type: target_type === "review" ? "review" : "place",
        target_id: Number(id),
        reason,
        description: description ? String(description).trim() : null,
      });

      return sendSuccess(res, 201, "Báo cáo của bạn đã được gửi tới quản trị viên", { report });
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        return sendError(res, 409, "Bạn đã gửi báo cáo cho nội dung này rồi");
      }
      console.error("[Place] report error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi gửi báo cáo");
    }
  },

  /**
   * ============ ADMIN / STAFF ENDPOINTS ============
   */

  /**
   * GET /api/v1/admin/places
   * Lấy danh sách địa điểm kiểm duyệt
   */
  async adminGetPlaces(req, res) {
    try {
      const { page, limit, status, type, search } = req.query;
      const result = await Place.findAllAdmin({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        status,
        type,
        search,
      });
      return sendSuccess(res, 200, "Lấy danh sách địa điểm kiểm duyệt thành công", result);
    } catch (error) {
      console.error("[Place] adminGetPlaces error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi lấy danh sách địa điểm");
    }
  },

  /**
   * PATCH /api/v1/admin/places/:id/status
   * Duyệt hoặc từ chối địa điểm
   */
  async adminUpdateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      if (!status || !["approved", "rejected", "pending"].includes(status)) {
        return sendError(res, 400, "Trạng thái không hợp lệ (approved, rejected, pending)");
      }

      const updated = await Place.updateStatus(id, status, admin_notes || null);
      if (!updated) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }

      return sendSuccess(res, 200, `Đã cập nhật trạng thái địa điểm thành ${status}`, { place: updated });
    } catch (error) {
      console.error("[Place] adminUpdateStatus error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi cập nhật trạng thái địa điểm");
    }
  },

  /**
   * DELETE /api/v1/admin/places/:id
   * Admin xóa địa điểm vi phạm
   */
  async adminDeletePlace(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Place.delete(id, req.user.id, req.user.role);
      if (!deleted) {
        return sendError(res, 404, "Không tìm thấy địa điểm");
      }
      return sendSuccess(res, 200, "Xóa địa điểm thành công");
    } catch (error) {
      console.error("[Place] adminDeletePlace error:", error);
      return sendError(res, 500, "Đã xảy ra lỗi khi xóa địa điểm");
    }
  },
};

module.exports = placeApiV1Controller;

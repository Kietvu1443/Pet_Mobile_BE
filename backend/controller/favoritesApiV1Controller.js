const Pet = require("../models/Pet");
const PetLike = require("../models/PetLike");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const toValidId = (value) => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const extractLocation = (contactInfo) => {
  if (!contactInfo || typeof contactInfo !== "string") return null;
  const trimmed = contactInfo.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeFavorite = (row) => ({
  id: row.id,
  name: row.name,
  pet_type: row.pet_type,
  breed: row.breed,
  age: row.age,
  gender: row.gender,
  color: row.color,
  status: row.status,
  pet_code: row.pet_code,
  vaccination: row.vaccination,
  description: row.description,
  liked_at: row.liked_at ? new Date(row.liked_at).toISOString() : null,
  image: row.avatar_image || row.image_url || "/images/the_logo.webp",
  location: extractLocation(row.contact_info),
});

const favoritesApiV1Controller = {
  async addFavorite(req, res) {
    try {
      const petId = toValidId(req.params.petId);
      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const userId = Number(req.user.id);
      const alreadyLiked = await PetLike.checkUserLike(userId, petId);

      if (!alreadyLiked) {
        await PetLike.create(userId, petId, "liked");
      }

      const totalLikes = await PetLike.countLikes(petId);

      return sendSuccess(
        res,
        200,
        alreadyLiked
          ? "Thú cưng đã có trong danh sách yêu thích"
          : "Đã thêm thú cưng vào danh sách yêu thích",
        {
          petId,
          isLiked: true,
          totalLikes,
        },
      );
    } catch (error) {
      console.error("[Favorites API v1] addFavorite error:", error);
      return sendError(res, 500, "Không thể thêm thú cưng vào yêu thích");
    }
  },

  async removeFavorite(req, res) {
    try {
      const petId = toValidId(req.params.petId);
      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const userId = Number(req.user.id);
      await PetLike.softRemove(userId, petId);
      const totalLikes = await PetLike.countLikes(petId);

      return sendSuccess(res, 200, "Đã chuyển thú cưng sang danh sách bỏ qua", {
        petId,
        isLiked: false,
        totalLikes,
      });
    } catch (error) {
      console.error("[Favorites API v1] removeFavorite error:", error);
      return sendError(res, 500, "Không thể bỏ yêu thích thú cưng");
    }
  },

  async restoreFavorite(req, res) {
    try {
      const petId = toValidId(req.params.petId);
      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const userId = Number(req.user.id);
      await PetLike.restorePet(userId, petId);
      const totalLikes = await PetLike.countLikes(petId);

      return sendSuccess(res, 200, "Đã khôi phục thú cưng vào danh sách yêu thích", {
        petId,
        isLiked: true,
        totalLikes,
      });
    } catch (error) {
      console.error("[Favorites API v1] restoreFavorite error:", error);
      return sendError(res, 500, "Không thể khôi phục thú cưng");
    }
  },

  async getMyFavorites(req, res) {
    try {
      const userId = Number(req.user.id);
      const rows = await PetLike.findLikedPets(userId);
      const favorites = rows.map(normalizeFavorite);

      return sendSuccess(res, 200, "Lấy danh sách yêu thích thành công", {
        favorites,
        total: favorites.length,
      });
    } catch (error) {
      console.error("[Favorites API v1] getMyFavorites error:", error);
      return sendError(res, 500, "Không thể tải danh sách yêu thích");
    }
  },

  async getMyPassed(req, res) {
    try {
      const userId = Number(req.user.id);
      const rows = await PetLike.findPassedPets(userId);
      const favorites = rows.map(normalizeFavorite);

      return sendSuccess(res, 200, "Lấy danh sách bỏ qua thành công", {
        favorites,
        total: favorites.length,
      });
    } catch (error) {
      console.error("[Favorites API v1] getMyPassed error:", error);
      return sendError(res, 500, "Không thể tải danh sách bỏ qua");
    }
  },

  async superlikeFavorite(req, res) {
    try {
      const petId = toValidId(req.params.petId);
      if (!petId) {
        return sendError(res, 400, "petId không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const userId = Number(req.user.id);
      await PetLike.superLike(userId, petId);
      const totalLikes = await PetLike.countLikes(petId);

      return sendSuccess(res, 200, "Đã thêm thú cưng vào Quan tâm đặc biệt", {
        petId,
        isLiked: true,
        isSuperliked: true,
        totalLikes,
      });
    } catch (error) {
      console.error("[Favorites API v1] superlikeFavorite error:", error);
      return sendError(res, 500, "Không thể thêm thú cưng vào Quan tâm đặc biệt");
    }
  },

  async getMySuperliked(req, res) {
    try {
      const userId = Number(req.user.id);
      const rows = await PetLike.findSuperlikedPets(userId);
      const favorites = rows.map(normalizeFavorite);

      return sendSuccess(res, 200, "Lấy danh sách Quan tâm đặc biệt thành công", {
        favorites,
        total: favorites.length,
      });
    } catch (error) {
      console.error("[Favorites API v1] getMySuperliked error:", error);
      return sendError(res, 500, "Không thể tải danh sách Quan tâm đặc biệt");
    }
  },
};

module.exports = favoritesApiV1Controller;

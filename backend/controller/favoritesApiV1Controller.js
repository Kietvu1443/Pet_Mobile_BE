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
  description: row.description,
  liked_at: row.liked_at,
  image: row.avatar_image || row.image_url || "/images/the_logo.webp",
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
      await PetLike.delete(userId, petId);
      const totalLikes = await PetLike.countLikes(petId);

      return sendSuccess(res, 200, "Đã xóa thú cưng khỏi danh sách yêu thích", {
        petId,
        isLiked: false,
        totalLikes,
      });
    } catch (error) {
      console.error("[Favorites API v1] removeFavorite error:", error);
      return sendError(res, 500, "Không thể xóa thú cưng khỏi yêu thích");
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
};

module.exports = favoritesApiV1Controller;

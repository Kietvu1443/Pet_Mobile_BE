const PetCollection = require("../models/PetCollection");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const extractLocation = (contactInfo) => {
  if (!contactInfo || typeof contactInfo !== "string") return null;
  const trimmed = contactInfo.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizePet = (row) => ({
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

const collectionsApiV1Controller = {
  async getMyCollections(req, res) {
    try {
      const userId = Number(req.user.id);
      const collections = await PetCollection.findUserCollections(userId);
      return sendSuccess(res, 200, "Lấy danh sách bộ sưu tập thành công", {
        collections,
        total: collections.length,
      });
    } catch (error) {
      console.error("[Collections API] getMyCollections error:", error);
      return sendError(res, 500, "Không thể tải bộ sưu tập");
    }
  },

  async createCollection(req, res) {
    try {
      const userId = Number(req.user.id);
      const { name, emoji } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return sendError(res, 400, "Tên bộ sưu tập không được để trống");
      }

      const collection = await PetCollection.createCollection(
        userId,
        name.trim(),
        emoji || "📁",
      );

      return sendSuccess(res, 201, "Tạo bộ sưu tập thành công", { collection });
    } catch (error) {
      console.error("[Collections API] createCollection error:", error);
      return sendError(res, 500, "Không thể tạo bộ sưu tập");
    }
  },

  async deleteCollection(req, res) {
    try {
      const userId = Number(req.user.id);
      const collectionId = Number(req.params.id);
      if (!collectionId) {
        return sendError(res, 400, "collectionId không hợp lệ");
      }

      const deleted = await PetCollection.deleteCollection(userId, collectionId);
      if (!deleted) {
        return sendError(res, 404, "Không tìm thấy bộ sưu tập");
      }

      return sendSuccess(res, 200, "Xóa bộ sưu tập thành công", { collectionId });
    } catch (error) {
      console.error("[Collections API] deleteCollection error:", error);
      return sendError(res, 500, "Không thể xóa bộ sưu tập");
    }
  },

  async addPetToCollection(req, res) {
    try {
      const userId = Number(req.user.id);
      const collectionId = Number(req.params.id);
      const { petId } = req.body;
      if (!collectionId || !petId) {
        return sendError(res, 400, "Thông tin collectionId hoặc petId không hợp lệ");
      }

      const collection = await PetCollection.findOwnedCollection(collectionId, userId);
      if (!collection) {
        return sendError(res, 404, "Không tìm thấy bộ sưu tập");
      }

      await PetCollection.addPet(collectionId, Number(petId));
      return sendSuccess(res, 200, "Đã thêm thú cưng vào bộ sưu tập", {
        collectionId,
        petId: Number(petId),
      });
    } catch (error) {
      console.error("[Collections API] addPetToCollection error:", error);
      return sendError(res, 500, "Không thể thêm thú cưng vào bộ sưu tập");
    }
  },

  async removePetFromCollection(req, res) {
    try {
      const userId = Number(req.user.id);
      const collectionId = Number(req.params.id);
      const petId = Number(req.params.petId);
      if (!collectionId || !petId) {
        return sendError(res, 400, "Thông tin không hợp lệ");
      }

      const collection = await PetCollection.findOwnedCollection(collectionId, userId);
      if (!collection) {
        return sendError(res, 404, "Không tìm thấy bộ sưu tập");
      }

      await PetCollection.removePet(collectionId, petId);
      return sendSuccess(res, 200, "Đã xóa thú cưng khỏi bộ sưu tập", {
        collectionId,
        petId,
      });
    } catch (error) {
      console.error("[Collections API] removePetFromCollection error:", error);
      return sendError(res, 500, "Không thể xóa thú cưng khỏi bộ sưu tập");
    }
  },

  async getCollectionPets(req, res) {
    try {
      const userId = Number(req.user.id);
      const collectionId = Number(req.params.id);
      if (!collectionId) {
        return sendError(res, 400, "collectionId không hợp lệ");
      }

      const collection = await PetCollection.findOwnedCollection(collectionId, userId);
      if (!collection) {
        return sendError(res, 404, "Không tìm thấy bộ sưu tập");
      }

      const rows = await PetCollection.findCollectionPets(userId, collectionId);
      const favorites = rows.map(normalizePet);
      return sendSuccess(res, 200, "Lấy thú cưng trong bộ sưu tập thành công", {
        favorites,
        total: favorites.length,
      });
    } catch (error) {
      console.error("[Collections API] getCollectionPets error:", error);
      return sendError(res, 500, "Không thể tải thú cưng trong bộ sưu tập");
    }
  },

  async getPetCollections(req, res) {
    try {
      const userId = Number(req.user.id);
      const petId = Number(req.params.petId);
      const collectionIds = await PetCollection.findPetCollectionIds(userId, petId);
      return sendSuccess(res, 200, "Lấy thông tin bộ sưu tập của pet thành công", {
        collectionIds,
      });
    } catch (error) {
      console.error("[Collections API] getPetCollections error:", error);
      return sendError(res, 500, "Không thể tải bộ sưu tập của pet");
    }
  },
};

module.exports = collectionsApiV1Controller;

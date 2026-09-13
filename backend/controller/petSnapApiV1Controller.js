const PetLike = require("../models/PetLike");
const PetImage = require("../models/PetImage");
const Pet = require("../models/Pet");
const PetRecommendationService = require("../service/PetRecommendationService");
const PetInteractionService = require("../service/PetInteractionService");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const toValidId = (value) => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const normalizePet = (pet) => {
  if (!pet) {
    return null;
  }

  const avatar =
    pet.avatar_image ||
    pet.image_url ||
    (Array.isArray(pet.images) && pet.images[0] && pet.images[0].image_path) ||
    "/images/the_logo.webp";

  return {
    id: pet.id,
    name: pet.name,
    pet_type: pet.pet_type,
    breed: pet.breed,
    age: pet.age,
    gender: pet.gender,
    color: pet.color,
    weight: pet.weight,
    status: pet.status,
    pet_code: pet.pet_code,
    description: pet.description,
    image: avatar,
    images: Array.isArray(pet.images) ? pet.images : [],
  };
};

const getNextPetBundle = async (userId, sessionId = null) => {
  const nextPet = await PetRecommendationService.getNextPet(userId, sessionId);

  if (!nextPet) {
    return {
      pet: null,
      hasMore: false,
    };
  }

  await PetImage.attachImagesToPets([nextPet]);

  // Telemetry impression (fail-soft, non-blocking)
  void PetInteractionService.recordImpression({
    userId,
    petId: nextPet.id,
    source: "petsnap",
    sessionId,
    metadata: {
      recommendation_score: nextPet.recommendation_score ?? null,
      recommendation_reasons: nextPet.recommendation_reasons ?? [],
    },
  });

  return {
    pet: normalizePet(nextPet),
    hasMore: true,
  };
};

const petSnapApiV1Controller = {
  async getNext(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const next = await getNextPetBundle(userId);

      return sendSuccess(
        res,
        200,
        next.pet ? "Lấy thú cưng thành công" : "Đã hết thú cưng phù hợp",
        {
          pet: next.pet,
          hasMore: next.hasMore,
        },
      );
    } catch (error) {
      console.error("[PetSnap API v1] getNext error:", error);
      return sendError(res, 500, "Không thể tải thú cưng tiếp theo", {
        pet: null,
        hasMore: false,
      });
    }
  },

  async like(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ", {
          pet: null,
          hasMore: false,
        });
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng", {
          pet: null,
          hasMore: false,
        });
      }

      // Core Write: PetInteractionService.recordLike writes to pet_likes table.
      // If DB write fails, throws error -> catch block sends real 500 error (Write Realism).
      await PetInteractionService.recordLike({
        userId,
        petId,
        source: "petsnap",
      });

      const next = await getNextPetBundle(userId);

      return sendSuccess(res, 200, "Đã thích thú cưng", {
        pet: next.pet,
        hasMore: next.hasMore,
      });
    } catch (error) {
      console.error("[PetSnap API v1] like error:", error);
      return sendError(res, 500, "Không thể xử lý lượt thích", {
        pet: null,
        hasMore: false,
      });
    }
  },

  async dislike(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ", {
          pet: null,
          hasMore: false,
        });
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng", {
          pet: null,
          hasMore: false,
        });
      }

      // Core Write: PetInteractionService.recordPass writes to pet_likes table.
      // If DB write fails, throws error -> catch block sends real 500 error (Write Realism).
      await PetInteractionService.recordPass({
        userId,
        petId,
        source: "petsnap",
      });

      const next = await getNextPetBundle(userId);

      return sendSuccess(res, 200, "Đã bỏ qua thú cưng", {
        pet: next.pet,
        hasMore: next.hasMore,
      });
    } catch (error) {
      console.error("[PetSnap API v1] dislike error:", error);
      return sendError(res, 500, "Không thể bỏ qua thú cưng", {
        pet: null,
        hasMore: false,
      });
    }
  },

  async detailView(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const sessionId =
        typeof req.headers["x-petsnap-session-id"] === "string"
          ? req.headers["x-petsnap-session-id"]
          : null;

      await PetInteractionService.recordDetailView({
        userId,
        petId,
        source: "petsnap",
        sessionId,
        metadata: {
          action: "open_pet_detail",
        },
      });

      return sendSuccess(res, 200, "Đã ghi nhận lượt xem chi tiết", {
        petId,
        success: true,
      });
    } catch (error) {
      console.error("[PetSnap API v1] detailView error:", error);
      return sendError(res, 500, "Không thể ghi nhận lượt xem chi tiết");
    }
  },

  async superLike(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ", {
          pet: null,
          hasMore: false,
        });
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng", {
          pet: null,
          hasMore: false,
        });
      }

      const sessionId =
        typeof req.headers["x-petsnap-session-id"] === "string"
          ? req.headers["x-petsnap-session-id"]
          : null;

      // Core Write: PetInteractionService.recordSuperLike writes to pet_likes table.
      // If DB write fails, throws error -> catch block sends real 500 error (Write Realism).
      await PetInteractionService.recordSuperLike({
        userId,
        petId,
        source: "petsnap",
        sessionId,
        metadata: {
          action: "super_like",
        },
      });

      const next = await getNextPetBundle(userId, sessionId);

      return sendSuccess(res, 200, "Đã siêu thích thú cưng", {
        petId,
        status: "superliked",
        nextPet: next.pet,
        pet: next.pet,
        hasMore: next.hasMore,
      });
    } catch (error) {
      console.error("[PetSnap API v1] superLike error:", error);
      return sendError(res, 500, "Không thể xử lý lượt siêu thích", {
        pet: null,
        hasMore: false,
      });
    }
  },

  async getLikedPets(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      // Tái sử dụng trực tiếp PetLike.findLikedPets theo đúng yêu cầu an toàn
      const pets = await PetLike.findLikedPets(userId);
      await PetImage.attachImagesToPets(pets);

      return sendSuccess(
        res,
        200,
        "Lấy danh sách thú cưng đã thích thành công",
        {
          pets: pets.map(normalizePet),
          total: pets.length,
        },
      );
    } catch (error) {
      console.error("[PetSnap API v1] getLikedPets error:", error);
      return sendError(
        res,
        500,
        "Không thể tải danh sách thú cưng đã thích",
      );
    }
  },

  async unlike(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const sessionId =
        typeof req.headers["x-petsnap-session-id"] === "string"
          ? req.headers["x-petsnap-session-id"]
          : null;

      await PetInteractionService.recordUnlike({
        userId,
        petId,
        source: "petsnap",
        sessionId,
        metadata: {
          action: "unlike",
        },
      });

      return sendSuccess(res, 200, "Đã bỏ thích thú cưng", {
        petId,
        status: "unliked",
        success: true,
      });
    } catch (error) {
      if (error.statusCode === 400) {
        return sendError(res, 400, error.message);
      }
      console.error("[PetSnap API v1] unlike error:", error);
      return sendError(res, 500, "Không thể bỏ thích thú cưng");
    }
  },
};

module.exports = petSnapApiV1Controller;


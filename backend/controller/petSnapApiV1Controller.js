const PetLike = require("../models/PetLike");
const PetImage = require("../models/PetImage");
const Pet = require("../models/Pet");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const NEXT_BATCH_SIZE = 2;

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

const getNextPetBundle = async (userId) => {
  const randomPets = await PetLike.findRandomPets(userId, NEXT_BATCH_SIZE);
  await PetImage.attachImagesToPets(randomPets);

  const nextPet = randomPets[0] || null;
  const hasMore = randomPets.length > 1;

  return {
    pet: normalizePet(nextPet),
    hasMore,
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

      await PetLike.create(userId, petId, "liked");
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

      await PetLike.create(userId, petId, "passed");
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
};

module.exports = petSnapApiV1Controller;

const path = require("path");
const fs = require("fs");
const Pet = require("../models/Pet");
const PetImage = require("../models/PetImage");
const PetLike = require("../models/PetLike");
const {
  isProduction,
  getImageUrl,
  getCloudinaryId,
  ensurePetFolder,
  deleteImage,
} = require("../config/upload");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const toValidId = (value) => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const buildPetPayload = (payload, imageUrl) => {
  return {
    name: String(payload.name || "").trim(),
    pet_type: payload.pet_type || "Chó",
    status: payload.status || null,
    breed: payload.breed || null,
    age: payload.age || null,
    gender: payload.gender || null,
    color: payload.color || null,
    weight: payload.weight || null,
    pet_code: payload.pet_code || null,
    vaccination: payload.vaccination || null,
    image_url: imageUrl || null,
    contact_info: payload.contact_info || null,
    source_url: payload.source_url || null,
    description: payload.description || null,
  };
};

const petApiV1Controller = {
  async listPets(req, res) {
    try {
      const allowedStatuses = ["available", "adopted"];
      const status = allowedStatuses.includes(req.query.status)
        ? req.query.status
        : null;
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(
        50,
        Math.max(1, Number(req.query.pageSize || req.query.limit || 10)),
      );
      const search = req.query.search || null;
      const species = req.query.species || null;

      const result = await Pet.findAll({
        status,
        page,
        limit: pageSize,
        search,
        species,
      });
      return sendSuccess(res, 200, "Lấy danh sách thú cưng thành công", {
        pets: result.data,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      });
    } catch (error) {
      console.error("[Pet API v1] listPets error:", error);
      return sendError(res, 500, "Không thể tải danh sách thú cưng");
    }
  },

  async getPetDetail(req, res) {
    try {
      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Thú cưng không tồn tại");
      }

      const images = await PetImage.findByPetId(petId);
      const likesCount = await PetLike.countLikes(petId);
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      const isLiked = userId ? await PetLike.checkUserLike(userId, petId) : false;

      return sendSuccess(res, 200, "Lấy chi tiết thú cưng thành công", {
        pet: {
          ...pet,
          images,
          likesCount,
          isLiked,
        },
      });
    } catch (error) {
      console.error("[Pet API v1] getPetDetail error:", error);
      return sendError(res, 500, "Không thể tải thông tin thú cưng");
    }
  },

  async createPet(req, res) {
    try {
      const imageUrl = req.file ? getImageUrl(req.file) : null;
      const petPayload = buildPetPayload(req.body, imageUrl);
      petPayload.status = ["available", "adopted"].includes(petPayload.status)
        ? petPayload.status
        : "available";

      if (!petPayload.name) {
        return sendError(res, 400, "Tên thú cưng là bắt buộc");
      }

      const created = await Pet.create(petPayload);
      const petId = created.id;

      if (req.file) {
        const cloudinaryId = getCloudinaryId(req.file);

        if (isProduction) {
          await PetImage.create(petId, req.file.path, 0, cloudinaryId);
        } else {
          const petDir = ensurePetFolder(petId);
          const filename = req.file.filename;
          const sourcePath = req.file.path;
          const destPath = path.join(petDir, filename);
          fs.copyFileSync(sourcePath, destPath);
          await PetImage.create(petId, `/images/pets/${petId}/${filename}`, 0, null);
        }
      }

      const pet = await Pet.findById(petId);
      const images = await PetImage.findByPetId(petId);

      return sendSuccess(res, 201, "Tạo thú cưng thành công", {
        pet: {
          ...pet,
          images,
        },
      });
    } catch (error) {
      console.error("[Pet API v1] createPet error:", error);
      return sendError(res, 500, "Không thể tạo thú cưng");
    }
  },

  async updatePet(req, res) {
    try {
      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const oldPet = await Pet.findById(petId);
      if (!oldPet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      let imageUrl = oldPet.image_url;
      if (req.file) {
        await deleteImage(oldPet.image_url, null);

        imageUrl = getImageUrl(req.file);
        const cloudinaryId = getCloudinaryId(req.file);

        if (isProduction) {
          const nextOrder = await PetImage.getNextDisplayOrder(petId);
          await PetImage.create(petId, req.file.path, nextOrder, cloudinaryId);
        } else {
          const petDir = ensurePetFolder(petId);
          const filename = req.file.filename;
          const sourcePath = req.file.path;
          const destPath = path.join(petDir, filename);
          fs.copyFileSync(sourcePath, destPath);

          const nextOrder = await PetImage.getNextDisplayOrder(petId);
          await PetImage.create(
            petId,
            `/images/pets/${petId}/${filename}`,
            nextOrder,
            null,
          );
        }
      }

      const petPayload = buildPetPayload(req.body, imageUrl);
      petPayload.status = ["available", "adopted"].includes(petPayload.status)
        ? petPayload.status
        : oldPet.status;
      if (!petPayload.name) {
        return sendError(res, 400, "Tên thú cưng là bắt buộc");
      }

      await Pet.update(petId, petPayload);

      const pet = await Pet.findById(petId);
      const images = await PetImage.findByPetId(petId);

      return sendSuccess(res, 200, "Cập nhật thú cưng thành công", {
        pet: {
          ...pet,
          images,
        },
      });
    } catch (error) {
      console.error("[Pet API v1] updatePet error:", error);
      return sendError(res, 500, "Không thể cập nhật thú cưng");
    }
  },

  async deletePet(req, res) {
    try {
      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const images = await PetImage.findByPetId(petId);
      for (const image of images) {
        await deleteImage(image.image_path, image.cloudinary_id);
      }

      await PetImage.deleteByPetId(petId);
      await deleteImage(pet.image_url, null);

      if (!isProduction) {
        const petDir = path.join(__dirname, "../../frontend/images/pets", String(petId));
        if (fs.existsSync(petDir)) {
          fs.rmSync(petDir, { recursive: true, force: true });
        }
      }

      await Pet.delete(petId);

      return sendSuccess(res, 200, "Xóa thú cưng thành công", {
        id: petId,
      });
    } catch (error) {
      console.error("[Pet API v1] deletePet error:", error);
      return sendError(res, 500, "Không thể xóa thú cưng");
    }
  },

  async likePet(req, res) {
    try {
      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      const pet = await Pet.findById(petId);
      if (!pet) {
        return sendError(res, 404, "Thú cưng không tồn tại");
      }

      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId || Number.isNaN(userId)) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const alreadyLiked = await PetLike.checkUserLike(userId, petId);
      if (alreadyLiked) {
        await PetLike.delete(userId, petId);
      } else {
        await PetLike.create(userId, petId, "liked");
      }

      const totalLikes = await PetLike.countLikes(petId);
      const isLiked = !alreadyLiked;

      return sendSuccess(res, 200, isLiked ? "Đã thêm vào yêu thích" : "Đã bỏ yêu thích", {
        petId,
        isLiked,
        totalLikes,
      });
    } catch (error) {
      console.error("[Pet API v1] likePet error:", error);
      return sendError(res, 500, "Không thể thích thú cưng");
    }
  },
};

module.exports = petApiV1Controller;
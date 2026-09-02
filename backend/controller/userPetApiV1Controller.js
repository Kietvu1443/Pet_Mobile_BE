const UserPet = require("../models/UserPet");
const UserPetImage = require("../models/UserPetImage");
const {
  isProduction,
  getImageUrl,
  getCloudinaryId,
  deleteImage,
} = require("../config/upload");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const MAX_IMAGES_PER_PET = 5;

const toValidId = (value) => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

// Helper dọn dẹp các file vừa upload nếu xảy ra lỗi DB / validation
const cleanupUploadedFiles = async (files) => {
  if (!files || !Array.isArray(files) || files.length === 0) return;
  for (const file of files) {
    try {
      const cloudinaryId = getCloudinaryId(file);
      const imageUrl = getImageUrl(file);
      await deleteImage(imageUrl, cloudinaryId);
    } catch (err) {
      console.error("[UserPet API] Error cleaning up uploaded file:", err);
    }
  }
};

const userPetApiV1Controller = {
  // GET /api/v1/user-pets/my
  async getMyPets(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const pets = await UserPet.findByUserId(userId);
      await UserPetImage.attachImagesToPets(pets);

      return sendSuccess(res, 200, "Lấy danh sách thú cưng thành công", {
        pets,
        total: pets.length,
      });
    } catch (error) {
      console.error("[UserPet API v1] getMyPets error:", error);
      return sendError(res, 500, "Không thể tải danh sách thú cưng");
    }
  },

  // GET /api/v1/user-pets/:id
  async getDetail(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      // Enforce ownership: Chỉ tìm thấy nếu thuộc về user này
      const pet = await UserPet.findByIdAndUserId(petId, userId);
      if (!pet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const images = await UserPetImage.findByUserPetId(petId);
      if (typeof pet.traits === "string") {
        try {
          pet.traits = JSON.parse(pet.traits);
        } catch {
          pet.traits = [];
        }
      }

      return sendSuccess(res, 200, "Lấy chi tiết thú cưng thành công", {
        pet: {
          ...pet,
          images,
        },
      });
    } catch (error) {
      console.error("[UserPet API v1] getDetail error:", error);
      return sendError(res, 500, "Không thể tải thông tin thú cưng");
    }
  },

  // POST /api/v1/user-pets
  async createPet(req, res) {
    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId) {
        await cleanupUploadedFiles(uploadedFiles);
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const name = String(req.body.name || "").trim();
      if (!name) {
        await cleanupUploadedFiles(uploadedFiles);
        return sendError(res, 400, "Tên thú cưng là bắt buộc");
      }

      if (uploadedFiles.length > MAX_IMAGES_PER_PET) {
        await cleanupUploadedFiles(uploadedFiles);
        return sendError(
          res,
          400,
          `Tối đa ${MAX_IMAGES_PER_PET} ảnh cho mỗi thú cưng`,
        );
      }

      // Xác định avatar URL từ ảnh đầu tiên (nếu có)
      let firstImageUrl = null;
      if (uploadedFiles.length > 0) {
        firstImageUrl = getImageUrl(uploadedFiles[0]);
      }

      // Parse traits
      let traits = req.body.traits;
      if (typeof traits === "string") {
        try {
          traits = JSON.parse(traits);
        } catch {
          traits = traits ? [traits] : [];
        }
      }

      const petData = {
        user_id: userId,
        name,
        species: req.body.species || "cat",
        breed: req.body.breed || null,
        gender: req.body.gender || null,
        birth_date: req.body.birth_date || null,
        color: req.body.color || null,
        weight: req.body.weight || null,
        vaccinated: req.body.vaccinated === "1" || req.body.vaccinated === true || req.body.vaccinated === 1 ? 1 : 0,
        description: req.body.description || null,
        traits,
        image_url: firstImageUrl,
      };

      const createdPet = await UserPet.create(petData);
      const userPetId = createdPet.id;

      // Lưu các ảnh vào user_pet_images
      const savedImages = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const imagePath = getImageUrl(file);
        const cloudinaryId = getCloudinaryId(file);
        const imgRecord = await UserPetImage.create(
          userPetId,
          imagePath,
          i,
          cloudinaryId,
        );
        savedImages.push(imgRecord);
      }

      return sendSuccess(res, 201, "Thêm thú cưng thành công", {
        pet: {
          ...createdPet,
          images: savedImages,
        },
      });
    } catch (error) {
      console.error("[UserPet API v1] createPet error:", error);
      // Rollback Cloudinary nếu DB lỗi
      await cleanupUploadedFiles(uploadedFiles);
      return sendError(res, 500, "Không thể thêm thú cưng");
    }
  },

  // PATCH /api/v1/user-pets/:id
  async updatePet(req, res) {
    const uploadedFiles = req.files || (req.file ? [req.file] : []);
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId) {
        await cleanupUploadedFiles(uploadedFiles);
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        await cleanupUploadedFiles(uploadedFiles);
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      // Enforce ownership
      const existingPet = await UserPet.findByIdAndUserId(petId, userId);
      if (!existingPet) {
        await cleanupUploadedFiles(uploadedFiles);
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      const isReplaceImages = req.body.replace_images === "true" || req.body.replace_images === true;
      const currentImageCount = await UserPetImage.countByUserPetId(petId);

      // Kiểm tra giới hạn tối đa 5 ảnh
      if (isReplaceImages) {
        if (uploadedFiles.length > MAX_IMAGES_PER_PET) {
          await cleanupUploadedFiles(uploadedFiles);
          return sendError(res, 400, `Tối đa ${MAX_IMAGES_PER_PET} ảnh cho mỗi thú cưng`);
        }
      } else if (uploadedFiles.length > 0) {
        if (currentImageCount + uploadedFiles.length > MAX_IMAGES_PER_PET) {
          await cleanupUploadedFiles(uploadedFiles);
          return sendError(
            res,
            400,
            `Tổng số ảnh không được vượt quá ${MAX_IMAGES_PER_PET}. Hiện tại đã có ${currentImageCount} ảnh.`,
          );
        }
      }

      // Xử lý cập nhật thông tin fields
      const updateData = {};
      if (req.body.name !== undefined) updateData.name = String(req.body.name).trim();
      if (req.body.species !== undefined) updateData.species = req.body.species;
      if (req.body.breed !== undefined) updateData.breed = req.body.breed;
      if (req.body.gender !== undefined) updateData.gender = req.body.gender;
      if (req.body.birth_date !== undefined) updateData.birth_date = req.body.birth_date || null;
      if (req.body.color !== undefined) updateData.color = req.body.color;
      if (req.body.weight !== undefined) updateData.weight = req.body.weight;
      if (req.body.vaccinated !== undefined) {
        updateData.vaccinated = req.body.vaccinated === "1" || req.body.vaccinated === true || req.body.vaccinated === 1 ? 1 : 0;
      }
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.traits !== undefined) {
        let traits = req.body.traits;
        if (typeof traits === "string") {
          try {
            traits = JSON.parse(traits);
          } catch {
            traits = traits ? [traits] : [];
          }
        }
        updateData.traits = traits;
      }

      // Xử lý ảnh nếu có replace hoặc upload thêm
      if (isReplaceImages) {
        // Xóa ảnh cũ trên Cloudinary / DB
        const oldImages = await UserPetImage.findByUserPetId(petId);
        for (const oldImg of oldImages) {
          await deleteImage(oldImg.image_path, oldImg.cloudinary_id);
        }
        await UserPetImage.deleteByUserPetId(petId);

        // Lưu ảnh mới
        let firstImageUrl = null;
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const imagePath = getImageUrl(file);
          const cloudinaryId = getCloudinaryId(file);
          if (i === 0) firstImageUrl = imagePath;
          await UserPetImage.create(petId, imagePath, i, cloudinaryId);
        }
        updateData.image_url = firstImageUrl;
      } else if (uploadedFiles.length > 0) {
        // Append ảnh mới
        let nextOrder = await UserPetImage.getNextDisplayOrder(petId);
        for (const file of uploadedFiles) {
          const imagePath = getImageUrl(file);
          const cloudinaryId = getCloudinaryId(file);
          await UserPetImage.create(petId, imagePath, nextOrder++, cloudinaryId);
        }
        // Đảm bảo image_url có avatar nếu trước đó chưa có
        if (!existingPet.image_url && uploadedFiles.length > 0) {
          updateData.image_url = getImageUrl(uploadedFiles[0]);
        }
      }

      await UserPet.update(petId, userId, updateData);

      const updatedPet = await UserPet.findByIdAndUserId(petId, userId);
      const images = await UserPetImage.findByUserPetId(petId);
      if (typeof updatedPet.traits === "string") {
        try {
          updatedPet.traits = JSON.parse(updatedPet.traits);
        } catch {
          updatedPet.traits = [];
        }
      }

      return sendSuccess(res, 200, "Cập nhật thú cưng thành công", {
        pet: {
          ...updatedPet,
          images,
        },
      });
    } catch (error) {
      console.error("[UserPet API v1] updatePet error:", error);
      await cleanupUploadedFiles(uploadedFiles);
      return sendError(res, 500, "Không thể cập nhật thú cưng");
    }
  },

  // DELETE /api/v1/user-pets/:id
  async deletePet(req, res) {
    try {
      const userId = req.user && req.user.id ? Number(req.user.id) : null;
      if (!userId) {
        return sendError(res, 401, "Vui lòng đăng nhập tài khoản");
      }

      const petId = toValidId(req.params.id);
      if (!petId) {
        return sendError(res, 400, "ID thú cưng không hợp lệ");
      }

      // Enforce ownership
      const existingPet = await UserPet.findByIdAndUserId(petId, userId);
      if (!existingPet) {
        return sendError(res, 404, "Không tìm thấy thú cưng");
      }

      // Xóa tất cả ảnh trên Cloudinary
      const images = await UserPetImage.findByUserPetId(petId);
      for (const img of images) {
        try {
          await deleteImage(img.image_path, img.cloudinary_id);
        } catch (err) {
          console.error("[UserPet API] Error deleting image from storage:", err);
        }
      }

      await UserPet.delete(petId, userId);

      return sendSuccess(res, 200, "Xóa thú cưng thành công", {
        id: petId,
      });
    } catch (error) {
      console.error("[UserPet API v1] deletePet error:", error);
      return sendError(res, 500, "Không thể xóa thú cưng");
    }
  },
};

module.exports = userPetApiV1Controller;

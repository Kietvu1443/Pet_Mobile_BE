const { pool } = require("../config/db");

const UserPetImage = {
  // Lấy tất cả ảnh của 1 thú cưng cá nhân
  async findByUserPetId(userPetId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM user_pet_images WHERE user_pet_id = ? ORDER BY display_order ASC",
        [userPetId],
      );
      return rows;
    } catch (error) {
      console.error("[UserPetImage] findByUserPetId error:", error);
      throw error;
    }
  },

  // Đếm số lượng ảnh hiện tại của thú cưng
  async countByUserPetId(userPetId) {
    try {
      const [rows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM user_pet_images WHERE user_pet_id = ?",
        [userPetId],
      );
      return rows[0].total || 0;
    } catch (error) {
      console.error("[UserPetImage] countByUserPetId error:", error);
      throw error;
    }
  },

  // Tạo bản ghi ảnh mới
  async create(userPetId, imagePath, displayOrder = 0, cloudinaryId = null) {
    try {
      const [result] = await pool.execute(
        "INSERT INTO user_pet_images (user_pet_id, image_path, display_order, cloudinary_id) VALUES (?, ?, ?, ?)",
        [userPetId, imagePath, displayOrder, cloudinaryId],
      );
      return {
        id: result.insertId,
        user_pet_id: userPetId,
        image_path: imagePath,
        display_order: displayOrder,
        cloudinary_id: cloudinaryId,
      };
    } catch (error) {
      console.error("[UserPetImage] create error:", error);
      throw error;
    }
  },

  // Lấy next display_order
  async getNextDisplayOrder(userPetId) {
    try {
      const [rows] = await pool.execute(
        "SELECT MAX(display_order) as max_order FROM user_pet_images WHERE user_pet_id = ?",
        [userPetId],
      );
      const maxOrder = rows[0]?.max_order;
      return maxOrder !== null && maxOrder !== undefined ? maxOrder + 1 : 0;
    } catch (error) {
      console.error("[UserPetImage] getNextDisplayOrder error:", error);
      throw error;
    }
  },

  // Tìm ảnh đại diện (display_order = 0)
  async findAvatar(userPetId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM user_pet_images WHERE user_pet_id = ? ORDER BY display_order ASC LIMIT 1",
        [userPetId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("[UserPetImage] findAvatar error:", error);
      throw error;
    }
  },

  // Xóa 1 ảnh cụ thể
  async deleteById(imageId, userPetId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM user_pet_images WHERE id = ? AND user_pet_id = ?",
        [imageId, userPetId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("[UserPetImage] deleteById error:", error);
      throw error;
    }
  },

  // Xóa tất cả ảnh của 1 thú cưng
  async deleteByUserPetId(userPetId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM user_pet_images WHERE user_pet_id = ?",
        [userPetId],
      );
      return result.affectedRows;
    } catch (error) {
      console.error("[UserPetImage] deleteByUserPetId error:", error);
      throw error;
    }
  },

  // Helper gộp mảng images vào danh sách user_pets
  async attachImagesToPets(userPets) {
    if (!userPets || userPets.length === 0) return userPets;
    const petIds = userPets.map((p) => p.id);
    try {
      const placeholders = petIds.map(() => "?").join(",");
      const [allImages] = await pool.execute(
        `SELECT * FROM user_pet_images WHERE user_pet_id IN (${placeholders}) ORDER BY user_pet_id, display_order ASC`,
        petIds,
      );

      const imageMap = {};
      for (const img of allImages) {
        if (!imageMap[img.user_pet_id]) imageMap[img.user_pet_id] = [];
        imageMap[img.user_pet_id].push(img);
      }

      for (const pet of userPets) {
        pet.images = imageMap[pet.id] || [];
        if (typeof pet.traits === "string") {
          try {
            pet.traits = JSON.parse(pet.traits);
          } catch {
            pet.traits = [];
          }
        }
      }
      return userPets;
    } catch (error) {
      console.error("[UserPetImage] attachImagesToPets error:", error);
      throw error;
    }
  },
};

module.exports = UserPetImage;

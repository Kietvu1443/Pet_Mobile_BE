const { pool } = require("../config/db");

const PetImage = {
  // Get all images for a pet, sorted by display_order
  async findByPetId(petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM pet_images WHERE pet_id = ? ORDER BY display_order ASC",
        [petId],
      );
      return rows;
    } catch (error) {
      console.error("Error finding images for pet:", error);
      throw error;
    }
  },

  // Get avatar image (display_order = 0) for a pet
  async findAvatarByPetId(petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM pet_images WHERE pet_id = ? AND display_order = 0 LIMIT 1",
        [petId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding avatar for pet:", error);
      throw error;
    }
  },

  // Create a new image record
  async create(petId, imagePath, displayOrder = 0, cloudinaryId = null) {
    try {
      const [result] = await pool.execute(
        "INSERT INTO pet_images (pet_id, image_path, display_order, cloudinary_id) VALUES (?, ?, ?, ?)",
        [petId, imagePath, displayOrder, cloudinaryId],
      );
      return {
        id: result.insertId,
        pet_id: petId,
        image_path: imagePath,
        display_order: displayOrder,
        cloudinary_id: cloudinaryId,
      };
    } catch (error) {
      console.error("Error creating pet image:", error);
      throw error;
    }
  },

  // Create an image record for a report (using a shared connection for transactions)
  async createForReport(reportId, imagePath, displayOrder = 0, cloudinaryId = null, connection = null) {
    try {
      const conn = connection || pool;
      const [result] = await conn.execute(
        "INSERT INTO pet_images (report_id, image_path, display_order, cloudinary_id) VALUES (?, ?, ?, ?)",
        [reportId, imagePath, displayOrder, cloudinaryId],
      );
      return {
        id: result.insertId,
        report_id: reportId,
        image_path: imagePath,
        display_order: displayOrder,
        cloudinary_id: cloudinaryId,
      };
    } catch (error) {
      console.error("Error creating report image:", error);
      throw error;
    }
  },

  // Get all images for a report
  async findByReportId(reportId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM pet_images WHERE report_id = ? ORDER BY display_order ASC",
        [reportId],
      );
      return rows;
    } catch (error) {
      console.error("Error finding images for report:", error);
      throw error;
    }
  },

  // Batch get all images for multiple reports
  async findByReportIds(reportIds) {
    if (!reportIds || reportIds.length === 0) return [];
    try {
      const placeholders = reportIds.map(() => "?").join(",");
      const [rows] = await pool.execute(
        `SELECT * FROM pet_images WHERE report_id IN (${placeholders}) ORDER BY report_id, display_order ASC`,
        reportIds,
      );
      return rows;
    } catch (error) {
      console.error("Error batch finding report images:", error);
      throw error;
    }
  },

  // Delete all images for a report
  async deleteByReportId(reportId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM pet_images WHERE report_id = ?",
        [reportId],
      );
      return result.affectedRows;
    } catch (error) {
      console.error("Error deleting images for report:", error);
      throw error;
    }
  },

  // Delete an image record
  async delete(imageId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM pet_images WHERE id = ?",
        [imageId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting pet image:", error);
      throw error;
    }
  },

  // Delete all images for a pet
  async deleteByPetId(petId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM pet_images WHERE pet_id = ?",
        [petId],
      );
      return result.affectedRows;
    } catch (error) {
      console.error("Error deleting images for pet:", error);
      throw error;
    }
  },

  // Get next display_order for a pet
  async getNextDisplayOrder(petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT MAX(display_order) as max_order FROM pet_images WHERE pet_id = ?",
        [petId],
      );
      const maxOrder = rows[0]?.max_order;
      return maxOrder !== null ? maxOrder + 1 : 0;
    } catch (error) {
      console.error("Error getting next display order:", error);
      throw error;
    }
  },

  // Batch get all images for multiple pets
  async findByPetIds(petIds) {
    if (!petIds || petIds.length === 0) return [];
    try {
      const placeholders = petIds.map(() => "?").join(",");
      const [rows] = await pool.execute(
        `SELECT * FROM pet_images WHERE pet_id IN (${placeholders}) ORDER BY pet_id, display_order ASC`,
        petIds,
      );
      return rows;
    } catch (error) {
      console.error("Error batch finding images:", error);
      throw error;
    }
  },

  // Helper: attach images array to each pet in a list
  async attachImagesToPets(pets) {
    if (!pets || pets.length === 0) return pets;
    const petIds = pets.map((p) => p.id);
    const allImages = await this.findByPetIds(petIds);

    // Group images by pet_id
    const imageMap = {};
    for (const img of allImages) {
      if (!imageMap[img.pet_id]) imageMap[img.pet_id] = [];
      imageMap[img.pet_id].push(img);
    }

    // Attach to each pet
    for (const pet of pets) {
      pet.images = imageMap[pet.id] || [];
    }
    return pets;
  },
};

module.exports = PetImage;

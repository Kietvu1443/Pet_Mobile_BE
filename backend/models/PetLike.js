const { pool } = require("../config/db");

const PetLike = {
  // Create a new like/pass interaction
  async create(userId, petId, status) {
    try {
      const [result] = await pool.execute(
        "INSERT INTO pet_likes (user_id, pet_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?",
        [userId, petId, status, status],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error creating pet like:", error);
      throw error;
    }
  },

  // Get random pets that the user hasn't interacted with yet
  async findRandomPets(userId, limit = 10) {
    try {
      const safeLimit = parseInt(limit, 10) || 10;
      const query = `
        SELECT p.*, pi.image_path as avatar_image
        FROM pets p
        LEFT JOIN pet_likes pl ON p.id = pl.pet_id AND pl.user_id = ?
        LEFT JOIN pet_images pi ON p.id = pi.pet_id AND pi.display_order = 0
        WHERE pl.id IS NULL AND p.status = 'available'
        ORDER BY RAND() 
        LIMIT ${safeLimit}
      `;
      const [rows] = await pool.execute(query, [userId]);
      return rows;
    } catch (error) {
      console.error("Error finding random pets:", error);
      throw error;
    }
  },

  // Get pets liked by the user
  async findLikedPets(userId) {
    try {
      const query = `
        SELECT p.*, pl.created_at as liked_at, pi.image_path as avatar_image
        FROM pets p
        JOIN pet_likes pl ON p.id = pl.pet_id
        LEFT JOIN pet_images pi ON p.id = pi.pet_id AND pi.display_order = 0
        WHERE pl.user_id = ? AND pl.status = 'liked'
        ORDER BY pl.created_at DESC
      `;
      const [rows] = await pool.execute(query, [userId]);
      return rows;
    } catch (error) {
      console.error("Error finding liked pets:", error);
      throw error;
    }
  },

  // Check if a user has liked a specific pet
  async checkUserLike(userId, petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT id FROM pet_likes WHERE user_id = ? AND pet_id = ? AND status = 'liked' LIMIT 1",
        [userId, petId],
      );
      return rows.length > 0;
    } catch (error) {
      console.error("Error checking user like:", error);
      throw error;
    }
  },

  // Count total likes for a pet
  async countLikes(petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM pet_likes WHERE pet_id = ? AND status = 'liked'",
        [petId],
      );
      return rows[0].total;
    } catch (error) {
      console.error("Error counting likes:", error);
      throw error;
    }
  },

  // Delete a like (idempotent — always returns success)
  async delete(userId, petId) {
    try {
      await pool.execute(
        "DELETE FROM pet_likes WHERE user_id = ? AND pet_id = ?",
        [userId, petId],
      );
      return true;
    } catch (error) {
      console.error("Error deleting pet like:", error);
      throw error;
    }
  },
};

module.exports = PetLike;

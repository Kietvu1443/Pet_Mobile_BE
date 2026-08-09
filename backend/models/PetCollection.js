const { pool } = require("../config/db");

const PetCollection = {
  // Create a new collection
  async createCollection(userId, name, emoji = "📁") {
    try {
      const [result] = await pool.execute(
        "INSERT INTO pet_collections (user_id, name, emoji) VALUES (?, ?, ?)",
        [userId, name, emoji || "📁"],
      );
      return { id: result.insertId, name, emoji: emoji || "📁" };
    } catch (error) {
      console.error("Error creating collection:", error);
      throw error;
    }
  },

  // Get user collections with pet count & preview image
  async findUserCollections(userId) {
    try {
      const query = `
        SELECT 
          c.id, 
          c.name, 
          c.emoji, 
          c.created_at,
          COUNT(ci.pet_id) AS pet_count,
          (
            SELECT pi.image_path 
            FROM pet_collection_items ci2
            JOIN pets p2 ON ci2.pet_id = p2.id
            LEFT JOIN pet_images pi ON p2.id = pi.pet_id AND pi.display_order = 0
            WHERE ci2.collection_id = c.id
            ORDER BY ci2.added_at DESC
            LIMIT 1
          ) AS preview_image
        FROM pet_collections c
        LEFT JOIN pet_collection_items ci ON c.id = ci.collection_id
        WHERE c.user_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `;
      const [rows] = await pool.execute(query, [userId]);
      return rows;
    } catch (error) {
      console.error("Error finding user collections:", error);
      throw error;
    }
  },

  // Delete a collection
  async deleteCollection(userId, collectionId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM pet_collections WHERE id = ? AND user_id = ?",
        [collectionId, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting collection:", error);
      throw error;
    }
  },

  // Add pet to a collection
  async addPet(collectionId, petId) {
    try {
      await pool.execute(
        "INSERT INTO pet_collection_items (collection_id, pet_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP",
        [collectionId, petId],
      );
      return true;
    } catch (error) {
      console.error("Error adding pet to collection:", error);
      throw error;
    }
  },

  // Remove pet from a collection
  async removePet(collectionId, petId) {
    try {
      await pool.execute(
        "DELETE FROM pet_collection_items WHERE collection_id = ? AND pet_id = ?",
        [collectionId, petId],
      );
      return true;
    } catch (error) {
      console.error("Error removing pet from collection:", error);
      throw error;
    }
  },

  // Get pets in a specific collection
  async findCollectionPets(userId, collectionId) {
    try {
      const query = `
        SELECT p.*, ci.added_at as liked_at, pi.image_path as avatar_image
        FROM pets p
        JOIN pet_collection_items ci ON p.id = ci.pet_id
        JOIN pet_collections c ON ci.collection_id = c.id
        LEFT JOIN pet_images pi ON p.id = pi.pet_id AND pi.display_order = 0
        WHERE c.id = ? AND c.user_id = ?
        ORDER BY ci.added_at DESC
      `;
      const [rows] = await pool.execute(query, [collectionId, userId]);
      return rows;
    } catch (error) {
      console.error("Error finding collection pets:", error);
      throw error;
    }
  },

  // Get list of collection IDs that contain a specific pet
  async findPetCollectionIds(userId, petId) {
    try {
      const query = `
        SELECT ci.collection_id
        FROM pet_collection_items ci
        JOIN pet_collections c ON ci.collection_id = c.id
        WHERE c.user_id = ? AND ci.pet_id = ?
      `;
      const [rows] = await pool.execute(query, [userId, petId]);
      return rows.map((r) => r.collection_id);
    } catch (error) {
      console.error("Error finding pet collection IDs:", error);
      throw error;
    }
  },

  // Find a collection owned by a specific user
  async findOwnedCollection(collectionId, userId) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM pet_collections WHERE id = ? AND user_id = ? LIMIT 1",
        [collectionId, userId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding owned collection:", error);
      throw error;
    }
  },
};

module.exports = PetCollection;

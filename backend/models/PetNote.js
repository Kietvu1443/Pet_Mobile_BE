const { pool } = require("../config/db");

const PetNote = {
  // Get note for a specific user and pet
  async getNote(userId, petId) {
    try {
      const [rows] = await pool.execute(
        "SELECT id, user_id, pet_id, content, created_at, updated_at FROM pet_notes WHERE user_id = ? AND pet_id = ?",
        [userId, petId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error getting pet note:", error);
      throw error;
    }
  },

  // Create or update (upsert) note for a user and pet
  async upsertNote(userId, petId, content) {
    try {
      const trimmedContent = content ? content.trim() : "";
      if (!trimmedContent) {
        // If content is empty, delete note
        await this.deleteNote(userId, petId);
        return null;
      }

      await pool.execute(
        `INSERT INTO pet_notes (user_id, pet_id, content) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE content = ?, updated_at = CURRENT_TIMESTAMP`,
        [userId, petId, trimmedContent, trimmedContent],
      );

      return await this.getNote(userId, petId);
    } catch (error) {
      console.error("Error upserting pet note:", error);
      throw error;
    }
  },

  // Delete note for a user and pet
  async deleteNote(userId, petId) {
    try {
      const [result] = await pool.execute(
        "DELETE FROM pet_notes WHERE user_id = ? AND pet_id = ?",
        [userId, petId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting pet note:", error);
      throw error;
    }
  },
};

module.exports = PetNote;

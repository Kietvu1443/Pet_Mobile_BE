const { pool } = require("../config/db");

let supportsImageUrlColumn = null;

const hasImageUrlColumn = async () => {
  if (supportsImageUrlColumn !== null) {
    return supportsImageUrlColumn;
  }

  const [rows] = await pool.execute("SHOW COLUMNS FROM pets LIKE 'image_url'");
  supportsImageUrlColumn = rows.length > 0;
  return supportsImageUrlColumn;
};

const Pet = {
  // Get all available pets
  async findAll(options = null) {
    try {
      let status = null;
      let page = 1;
      let limit = null;
      let search = null;
      let pet_type = null;

      if (typeof options === "string" || options === null) {
        status = options;
      } else if (typeof options === "object") {
        status = options.status || null;
        page = Math.max(1, Number(options.page || 1));
        limit = Math.min(50, Math.max(1, Number(options.limit || 20)));
        search = options.search || null;
        pet_type = options.pet_type || options.species || null;
      }

      let whereClauses = [];
      let params = [];

      if (status) {
        whereClauses.push("p.status = ?");
        params.push(status);
      }

      if (pet_type) {
        whereClauses.push("p.pet_type = ?");
        params.push(pet_type);
      }

      if (search) {
        whereClauses.push(
          "(LOWER(p.name) LIKE LOWER(?) OR LOWER(p.description) LIKE LOWER(?) OR LOWER(p.pet_code) LIKE LOWER(?))",
        );
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const whereSql =
        whereClauses.length > 0 ? " WHERE " + whereClauses.join(" AND ") : "";

      let query = `
        SELECT p.*, pi.image_path as avatar_image
        FROM pets p
        LEFT JOIN pet_images pi ON p.id = pi.pet_id AND pi.display_order = 0
        ${whereSql}
        ORDER BY p.created_at DESC
      `;

      if (limit !== null) {
        const offset = (page - 1) * limit;
        const countQuery = `SELECT COUNT(*) AS total FROM pets p ${whereSql}`;
        const [countRows] = await pool.execute(countQuery, params);
        const total = countRows[0].total;

        query += " LIMIT ? OFFSET ?";
        const queryParams = [...params, String(limit), String(offset)];

        const [rows] = await pool.execute(query, queryParams);
        return { data: rows, total };
      }

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error("Error finding all pets:", error);
      throw error;
    }
  },

  // Get pet by ID
  async findById(id) {
    try {
      const [rows] = await pool.execute(
        `SELECT p.*, pi.image_path as avatar_image
         FROM pets p
         LEFT JOIN pet_images pi ON p.id = pi.pet_id AND pi.display_order = 0
         WHERE p.id = ?`,
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding pet by ID:", error);
      throw error;
    }
  },

  // Create new pet
  async create(petData) {
    try {
      const {
        name,
        pet_type,
        status,
        breed,
        age,
        gender,
        color,
        weight,
        pet_code,
        vaccination,
        description,
        image_url,
        contact_info,
        source_url,
      } = petData;

      const canUseImageUrl = await hasImageUrlColumn();

      const [result] = canUseImageUrl
        ? await pool.execute(
          `INSERT INTO pets (name, pet_type, status, breed, age, gender, color, weight, pet_code, vaccination, description, image_url, contact_info, source_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            pet_type || "Chó",
            status || "available",
            breed || null,
            age || null,
            gender || null,
            color || null,
            weight || null,
            pet_code || null,
            vaccination || null,
            description || null,
            image_url || null,
            contact_info || null,
            source_url || null,
          ],
        )
        : await pool.execute(
          `INSERT INTO pets (name, pet_type, status, breed, age, gender, color, weight, pet_code, vaccination, description, contact_info, source_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            pet_type || "Chó",
            status || "available",
            breed || null,
            age || null,
            gender || null,
            color || null,
            weight || null,
            pet_code || null,
            vaccination || null,
            description || null,
            contact_info || null,
            source_url || null,
          ],
        );

      return { id: result.insertId, ...petData };
    } catch (error) {
      console.error("Error creating pet:", error);
      throw error;
    }
  },

  // Update pet
  async update(id, petData) {
    try {
      const {
        name,
        pet_type,
        status,
        breed,
        age,
        gender,
        color,
        weight,
        pet_code,
        vaccination,
        description,
        image_url,
        contact_info,
        source_url,
      } = petData;

      const canUseImageUrl = await hasImageUrlColumn();

      const [result] = canUseImageUrl
        ? await pool.execute(
          `UPDATE pets SET 
            name = ?, pet_type = ?, status = ?, breed = ?, age = ?, gender = ?,
            color = ?, weight = ?, pet_code = ?, vaccination = ?,
            description = ?, image_url = ?, contact_info = ?, source_url = ?
           WHERE id = ?`,
          [
            name,
            pet_type || "Chó",
            status || "available",
            breed || null,
            age || null,
            gender || null,
            color || null,
            weight || null,
            pet_code || null,
            vaccination || null,
            description || null,
            image_url || null,
            contact_info || null,
            source_url || null,
            id,
          ],
        )
        : await pool.execute(
          `UPDATE pets SET 
            name = ?, pet_type = ?, status = ?, breed = ?, age = ?, gender = ?,
            color = ?, weight = ?, pet_code = ?, vaccination = ?,
            description = ?, contact_info = ?, source_url = ?
           WHERE id = ?`,
          [
            name,
            pet_type || "Chó",
            status || "available",
            breed || null,
            age || null,
            gender || null,
            color || null,
            weight || null,
            pet_code || null,
            vaccination || null,
            description || null,
            contact_info || null,
            source_url || null,
            id,
          ],
        );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating pet:", error);
      throw error;
    }
  },

  // Update pet status
  async updateStatus(id, status) {
    try {
      const [result] = await pool.execute(
        "UPDATE pets SET status = ? WHERE id = ?",
        [status, id],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating pet status:", error);
      throw error;
    }
  },

  // Delete pet
  async delete(id) {
    try {
      const [result] = await pool.execute("DELETE FROM pets WHERE id = ?", [
        id,
      ]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error deleting pet:", error);
      throw error;
    }
  },
};

module.exports = Pet;

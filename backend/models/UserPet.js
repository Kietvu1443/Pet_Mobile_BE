const { pool } = require("../config/db");

const UserPet = {
  // Lấy danh sách thú cưng của 1 user
  async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, user_id, name, species, breed, gender, birth_date, color, weight, vaccinated, description, traits, image_url, created_at, updated_at
         FROM user_pets
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId],
      );
      return rows;
    } catch (error) {
      console.error("[UserPet] findByUserId error:", error);
      throw error;
    }
  },

  // Lấy chi tiết thú cưng theo id và user_id (đảm bảo ownership)
  async findByIdAndUserId(id, userId) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, user_id, name, species, breed, gender, birth_date, color, weight, vaccinated, description, traits, image_url, created_at, updated_at
         FROM user_pets
         WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("[UserPet] findByIdAndUserId error:", error);
      throw error;
    }
  },

  // Tạo thú cưng cá nhân mới
  async create(data) {
    try {
      const {
        user_id,
        name,
        species = "cat",
        breed = null,
        gender = null,
        birth_date = null,
        color = null,
        weight = null,
        vaccinated = 0,
        description = null,
        traits = null,
        image_url = null,
      } = data;

      const traitsJson = traits ? (typeof traits === "string" ? traits : JSON.stringify(traits)) : null;

      const [result] = await pool.execute(
        `INSERT INTO user_pets (user_id, name, species, breed, gender, birth_date, color, weight, vaccinated, description, traits, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          name,
          species || "cat",
          breed || null,
          gender || null,
          birth_date || null,
          color || null,
          weight !== null && weight !== undefined && weight !== "" ? Number(weight) : null,
          vaccinated ? 1 : 0,
          description || null,
          traitsJson,
          image_url || null,
        ],
      );

      return {
        id: result.insertId,
        user_id,
        name,
        species,
        breed,
        gender,
        birth_date,
        color,
        weight: weight !== null && weight !== undefined && weight !== "" ? Number(weight) : null,
        vaccinated: vaccinated ? 1 : 0,
        description,
        traits: traits ? (typeof traits === "string" ? JSON.parse(traits) : traits) : null,
        image_url,
      };
    } catch (error) {
      console.error("[UserPet] create error:", error);
      throw error;
    }
  },

  // Cập nhật thông tin thú cưng (enforce ownership)
  async update(id, userId, data) {
    try {
      const fields = [];
      const values = [];

      if (data.name !== undefined) {
        fields.push("name = ?");
        values.push(data.name);
      }
      if (data.species !== undefined) {
        fields.push("species = ?");
        values.push(data.species);
      }
      if (data.breed !== undefined) {
        fields.push("breed = ?");
        values.push(data.breed);
      }
      if (data.gender !== undefined) {
        fields.push("gender = ?");
        values.push(data.gender);
      }
      if (data.birth_date !== undefined) {
        fields.push("birth_date = ?");
        values.push(data.birth_date);
      }
      if (data.color !== undefined) {
        fields.push("color = ?");
        values.push(data.color);
      }
      if (data.weight !== undefined) {
        fields.push("weight = ?");
        values.push(data.weight !== null && data.weight !== "" ? Number(data.weight) : null);
      }
      if (data.vaccinated !== undefined) {
        fields.push("vaccinated = ?");
        values.push(data.vaccinated ? 1 : 0);
      }
      if (data.description !== undefined) {
        fields.push("description = ?");
        values.push(data.description);
      }
      if (data.traits !== undefined) {
        fields.push("traits = ?");
        const traitsJson = data.traits ? (typeof data.traits === "string" ? data.traits : JSON.stringify(data.traits)) : null;
        values.push(traitsJson);
      }
      if (data.image_url !== undefined) {
        fields.push("image_url = ?");
        values.push(data.image_url);
      }

      if (fields.length === 0) {
        return true;
      }

      values.push(id, userId);

      const [result] = await pool.execute(
        `UPDATE user_pets SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
        values,
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error("[UserPet] update error:", error);
      throw error;
    }
  },

  // Cập nhật avatar URL cache
  async updateImageUrl(id, userId, imageUrl) {
    try {
      const [result] = await pool.execute(
        `UPDATE user_pets SET image_url = ? WHERE id = ? AND user_id = ?`,
        [imageUrl, id, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("[UserPet] updateImageUrl error:", error);
      throw error;
    }
  },

  // Xóa thú cưng (enforce ownership)
  async delete(id, userId) {
    try {
      const [result] = await pool.execute(
        `DELETE FROM user_pets WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("[UserPet] delete error:", error);
      throw error;
    }
  },
};

module.exports = UserPet;

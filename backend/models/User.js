const { pool } = require("../config/db");

const User = {
  // Find user by email
  async findByEmail(email) {
    try {
      const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [
        email,
      ]);
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding user by email:", error);
      throw error;
    }
  },

  // Find user by display name (for login)
  async findByDisplayName(displayName) {
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM users WHERE display_name = ?",
        [displayName],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding user by display name:", error);
      throw error;
    }
  },

  // Find user by ID
  async findById(id) {
    try {
      const [rows] = await pool.execute(
        "SELECT id, display_name, name, email, role, verify, birthday, address, avatar, bg_preference, gender, phone, preferences, created_at FROM users WHERE id = ?",
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      console.error("Error finding user by ID:", error);
      throw error;
    }
  },

  // Create new user
  async create(userData) {
    try {
      const { display_name, name, email, password, birthday, address } =
        userData;

      const [result] = await pool.execute(
        `INSERT INTO users (display_name, name, email, password, role, birthday, address) 
         VALUES (?, ?, ?, ?, 2, ?, ?)`,
        [
          display_name,
          name,
          email,
          password,
          birthday || null,
          address || null,
        ],
      );

      return { id: result.insertId, display_name, name, email, role: 2 };
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  // Compare password
  async comparePassword(inputPassword, hashedPassword) {
    return inputPassword === hashedPassword;
  },

  // Update user password
  async updatePassword(userId, newPassword) {
    try {
      const [result] = await pool.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        [newPassword, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating user password:", error);
      throw error;
    }
  },

  // Update user role (admin only)
  async updateRole(userId, newRole) {
    try {
      const [result] = await pool.execute(
        "UPDATE users SET role = ? WHERE id = ?",
        [newRole, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating user role:", error);
      throw error;
    }
  },

  // Update user email verification status
  async updateVerifyStatus(userId, verifyStatus) {
    try {
      const [result] = await pool.execute(
        "UPDATE users SET verify = ? WHERE id = ?",
        [verifyStatus, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating user verify status:", error);
      throw error;
    }
  },

  // Update profile fields for current user
  async updateProfile(userId, profileData) {
    try {
      const { display_name, name, email, verify, birthday, gender, phone, address } = profileData;

      const [result] = await pool.execute(
        "UPDATE users SET display_name = ?, name = ?, email = ?, verify = ?, birthday = ?, gender = ?, phone = ?, address = ? WHERE id = ?",
        [display_name, name, email, verify, birthday || null, gender || null, phone || null, address || null, userId],
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return this.findById(userId);
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  },

  // Update user status (admin only: ban/unban)
  async updateStatus(userId, status, reason = null) {
    try {
      const bannedAt = status === "banned" ? new Date() : null;
      const bannedReason = status === "banned" ? reason : null;

      const [result] = await pool.execute(
        "UPDATE users SET status = ?, banned_reason = ?, banned_at = ? WHERE id = ?",
        [status, bannedReason, bannedAt, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating user status:", error);
      throw error;
    }
  },

  // Get all users (admin only) with pagination and filtering
  async findAll({ page = 1, limit = 20, status, role } = {}) {
    try {
      const offset = (page - 1) * limit;
      const params = [];
      const conditions = [];

      if (status && ["active", "banned"].includes(status)) {
        conditions.push("status = ?");
        params.push(status);
      }

      if (role !== undefined && [0, 1, 2].includes(Number(role))) {
        conditions.push("role = ?");
        params.push(Number(role));
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        params,
      );
      const total = countRows[0].total;

      const queryParams = [...params, String(limit), String(offset)];
      const [rows] = await pool.execute(
        `SELECT id, display_name, name, email, role, status, avatar, banned_reason, banned_at, created_at
         FROM users ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        queryParams,
      );

      return { data: rows, total };
    } catch (error) {
      console.error("Error finding all users:", error);
      throw error;
    }
  },

  // Update user preferences (JSON column)
  async updatePreferences(userId, preferences) {
    try {
      const [result] = await pool.execute(
        "UPDATE users SET preferences = ? WHERE id = ?",
        [preferences ? JSON.stringify(preferences) : null, userId],
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Error updating user preferences:", error);
      throw error;
    }
  },
};

module.exports = User;

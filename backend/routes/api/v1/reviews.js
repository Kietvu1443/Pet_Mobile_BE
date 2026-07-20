const express = require("express");
const router = express.Router();
const { pool: db } = require("../../../config/db");
const { isAdmin, isStaff } = require("../../../middleware/authMiddleware");

// ADD REVIEW
router.post("/", async (req, res) => {
  try {
    const { product_id, user_id, rating, comment } = req.body;

    await db.query(
      "INSERT INTO product_reviews(product_id, user_id, rating, comment) VALUES (?,?,?,?)",
      [product_id, user_id, rating, comment],
    );

    res.json({ message: "Review added" });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// GET REVIEWS + LIKE COUNT
router.get("/:product_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
            SELECT r.*, u.name as user_name, u.avatar as avatar_url,
            (SELECT COUNT(*) FROM product_review_likes WHERE review_id = r.id) as likes
            FROM product_reviews r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE product_id = ?
            ORDER BY r.id DESC
        `,
      [req.params.product_id],
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// LIKE REVIEW
router.post("/like/:review_id", async (req, res) => {
  try {
    const { user_id } = req.body;

    await db.query(
      "INSERT INTO product_review_likes(review_id, user_id) VALUES (?,?)",
      [req.params.review_id, user_id],
    );

    res.json({ message: "Liked review" });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ===================== ADMIN ENDPOINTS =====================

// GET /admin/all — Lấy tất cả reviews (tất cả sản phẩm), kèm tên user và tên sản phẩm
router.get("/admin/all", isStaff, async (req, res) => {
  try {
    const { product_id, rating } = req.query;

    let sql = `
            SELECT r.*, u.name as user_name, u.avatar as avatar_url, p.name as product_name,
            (SELECT COUNT(*) FROM product_review_likes WHERE review_id = r.id) as likes
            FROM product_reviews r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN products p ON r.product_id = p.id
            WHERE 1=1
        `;
    let params = [];

    if (product_id) {
      sql += " AND r.product_id = ?";
      params.push(product_id);
    }

    if (rating && rating !== "all") {
      sql += " AND r.rating = ?";
      params.push(parseInt(rating));
    }

    sql += " ORDER BY r.id DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// DELETE /admin/:id — Xóa review không hợp lệ
router.delete("/admin/:id", isStaff, async (req, res) => {
  try {
    const [[review]] = await db.query(
      "SELECT * FROM product_reviews WHERE id = ?",
      [req.params.id],
    );

    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy review" });
    }

    // Xóa likes của review trước
    await db.query("DELETE FROM product_review_likes WHERE review_id = ?", [
      req.params.id,
    ]);

    // Xóa review
    await db.query("DELETE FROM product_reviews WHERE id = ?", [req.params.id]);

    res.json({ message: "Đã xóa review" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

module.exports = router;

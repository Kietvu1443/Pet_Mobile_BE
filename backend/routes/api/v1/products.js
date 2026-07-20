const express = require("express");
const router = express.Router();
const { pool: db } = require("../../../config/db");
const { isAdmin, isStaff } = require("../../../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer upload ảnh sản phẩm
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../../../frontend/uploads/products");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `product_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, gif, webp)"));
  },
});

// GET all products + filter + search + like count
router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query;

    let sql = `
            SELECT p.*, 
            (SELECT COUNT(*) FROM product_likes WHERE product_id = p.id) as likes
            FROM products p
            WHERE 1=1
        `;
    let params = [];

    if (category && category !== "all") {
      sql += " AND p.category = ?";
      params.push(category);
    }

    if (search) {
      sql += " AND p.name LIKE ?";
      params.push(`%${search}%`);
    }

    sql += " ORDER BY p.id DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET product detail + like count
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
            SELECT p.*, 
            (SELECT COUNT(*) FROM product_likes WHERE product_id = p.id) as likes
            FROM products p
            WHERE p.id = ?
        `,
      [req.params.id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// CHECK LIKE STATUS
router.get("/:id/like-status", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.json({ isLiked: false, like_count: 0 });

    const [[countRow]] = await db.query(
      "SELECT COUNT(*) as cnt FROM product_likes WHERE product_id = ?",
      [req.params.id],
    );
    const [[likeRow]] = await db.query(
      "SELECT id FROM product_likes WHERE product_id = ? AND user_id = ?",
      [req.params.id, user_id],
    );

    res.json({ isLiked: !!likeRow, like_count: countRow.cnt });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// TOGGLE LIKE PRODUCT (1 lần/người)
router.post("/:id/like", async (req, res) => {
  try {
    const user_id = req.body.user_id || (req.user && req.user.id);
    if (!user_id) return res.status(401).json({ message: "Cần đăng nhập" });

    const [[existing]] = await db.query(
      "SELECT id FROM product_likes WHERE product_id = ? AND user_id = ?",
      [req.params.id, user_id],
    );

    if (existing) {
      // Đã like → unlike
      await db.query("DELETE FROM product_likes WHERE id = ?", [existing.id]);
    } else {
      // Chưa like → like
      await db.query(
        "INSERT INTO product_likes(product_id, user_id) VALUES (?,?)",
        [req.params.id, user_id],
      );
    }

    const [[countRow]] = await db.query(
      "SELECT COUNT(*) as cnt FROM product_likes WHERE product_id = ?",
      [req.params.id],
    );

    res.json({ isLiked: !existing, like_count: countRow.cnt });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ADD product (admin)
router.post("/", async (req, res) => {
  try {
    const { name, price, image, description, category, stock } = req.body;

    await db.query(
      "INSERT INTO products(name, price, image, description, category, stock) VALUES (?,?,?,?,?,?)",
      [name, price, image, description, category, stock],
    );

    res.json({ message: "Product added" });
  } catch (err) {
    res.status(500).json({ message: "Error adding product" });
  }
});

// ===================== ADMIN ENDPOINTS =====================

// GET /admin/all — Lấy danh sách tất cả sản phẩm (kèm like count)
router.get("/admin/all", isStaff, async (req, res) => {
  try {
    const { category, search } = req.query;

    let sql = `
            SELECT p.*,
            COALESCE(p.product_code, '') as product_code,
            (SELECT COUNT(*) FROM product_likes WHERE product_id = p.id) as likes
            FROM products p
            WHERE 1=1
        `;
    let params = [];

    if (category && category !== "all") {
      sql += " AND p.category = ?";
      params.push(category);
    }

    if (search) {
      sql += " AND p.name LIKE ?";
      params.push(`%${search}%`);
    }

    sql += " ORDER BY p.id DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /admin/create — Thêm sản phẩm mới + upload ảnh
router.post(
  "/admin/create",
  isStaff,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, price, description, category, stock, product_code } =
        req.body;

      if (!name || !price || !category) {
        return res
          .status(400)
          .json({ message: "Thiếu thông tin bắt buộc (tên, giá, danh mục)" });
      }

      // Kiểm tra SKU trùng
      if (product_code) {
        const [[existing]] = await db.query(
          "SELECT id FROM products WHERE product_code = ?",
          [product_code.trim()],
        );
        if (existing) {
          return res
            .status(400)
            .json({ message: "Mã sản phẩm (SKU) đã tồn tại" });
        }
      }

      let imagePath = null;
      if (req.file) {
        imagePath = `/uploads/products/${req.file.filename}`;
      }

      await db.query(
        "INSERT INTO products(product_code, name, price, image, description, category, stock) VALUES (?,?,?,?,?,?,?)",
        [
          product_code ? product_code.trim() : null,
          name,
          price,
          imagePath,
          description || "",
          category,
          stock || 0,
        ],
      );

      res.json({ message: "Thêm sản phẩm thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Lỗi khi thêm sản phẩm" });
    }
  },
);

// PATCH /admin/:id — Sửa sản phẩm + upload ảnh mới (nếu có)
router.patch(
  "/admin/:id",
  isStaff,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, price, description, category, stock, product_code } =
        req.body;

      const [[existing]] = await db.query(
        "SELECT * FROM products WHERE id = ?",
        [req.params.id],
      );

      if (!existing) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }

      // Kiểm tra SKU trùng (trừ chính sản phẩm đang sửa)
      if (
        product_code &&
        product_code.trim() !== (existing.product_code || "")
      ) {
        const [[dup]] = await db.query(
          "SELECT id FROM products WHERE product_code = ? AND id != ?",
          [product_code.trim(), req.params.id],
        );
        if (dup) {
          return res
            .status(400)
            .json({ message: "Mã sản phẩm (SKU) đã tồn tại" });
        }
      }

      let imagePath = existing.image;
      if (req.file) {
        imagePath = `/uploads/products/${req.file.filename}`;
        if (existing.image) {
          const oldPath = path.join(
            __dirname,
            "../../../../frontend",
            existing.image,
          );
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      }

      await db.query(
        "UPDATE products SET product_code=?, name=?, price=?, image=?, description=?, category=?, stock=? WHERE id=?",
        [
          product_code !== undefined
            ? product_code.trim() || null
            : existing.product_code,
          name || existing.name,
          price || existing.price,
          imagePath,
          description !== undefined ? description : existing.description,
          category || existing.category,
          stock !== undefined ? stock : existing.stock,
          req.params.id,
        ],
      );

      res.json({ message: "Cập nhật sản phẩm thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Lỗi khi cập nhật sản phẩm" });
    }
  },
);

// DELETE /admin/:id — Xóa sản phẩm
router.delete("/admin/:id", isAdmin, async (req, res) => {
  try {
    const [[existing]] = await db.query("SELECT * FROM products WHERE id = ?", [
      req.params.id,
    ]);

    if (!existing) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    // Xóa ảnh nếu có
    if (existing.image) {
      const imgPath = path.join(__dirname, "../../../../frontend", existing.image);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    await db.query("DELETE FROM products WHERE id = ?", [req.params.id]);

    res.json({ message: "Xóa sản phẩm thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi khi xóa sản phẩm" });
  }
});

// PATCH /admin/:id/stock — Cộng/trừ kho hàng
router.patch("/admin/:id/stock", isStaff, async (req, res) => {
  try {
    const { delta } = req.body; // delta: số dương = nhập thêm, âm = trừ

    if (delta === undefined || isNaN(delta)) {
      return res.status(400).json({ message: "Thiếu giá trị delta" });
    }

    const [[product]] = await db.query(
      "SELECT stock FROM products WHERE id = ?",
      [req.params.id],
    );

    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const newStock = product.stock + parseInt(delta);
    if (newStock < 0) {
      return res.status(400).json({ message: "Kho không đủ để trừ" });
    }

    await db.query("UPDATE products SET stock = ? WHERE id = ?", [
      newStock,
      req.params.id,
    ]);

    res.json({ message: "Cập nhật kho thành công", stock: newStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi khi cập nhật kho" });
  }
});

module.exports = router;

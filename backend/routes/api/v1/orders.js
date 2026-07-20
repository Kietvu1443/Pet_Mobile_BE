const express = require("express");
const router = express.Router();
const { pool: db } = require("../../../config/db");
const {
  isAdmin,
  isStaff,
  isAuthenticated,
} = require("../../../middleware/authMiddleware");

// CREATE ORDER
router.post("/", async (req, res) => {
  try {
    const { customer, items } = req.body;

    // Ưu tiên user_id từ body, nếu null/undefined thì lấy từ token
    let user_id = req.body.user_id || null;
    if (!user_id) {
      const jwt = require("jsonwebtoken");
      const { JWT_SECRET } = require("../../../middleware/authMiddleware");
      let token = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer "))
        token = authHeader.split(" ")[1];
      if (!token && req.cookies && req.cookies.token) token = req.cookies.token;
      if (token) {
        try {
          user_id = jwt.verify(token, JWT_SECRET).id;
        } catch (e) {}
      }
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Cart rỗng" });
    }

    let total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const [result] = await db.query(
      "INSERT INTO orders(user_id, name, phone, address, total) VALUES (?,?,?,?,?)",
      [user_id, customer.name, customer.phone, customer.address, total],
    );

    const orderId = result.insertId;

    for (let item of items) {
      // CHECK STOCK
      const [[product]] = await db.query(
        "SELECT stock FROM products WHERE id = ?",
        [item.id],
      );

      if (!product || product.stock < item.qty) {
        return res.status(400).json({
          message: `Sản phẩm ID ${item.id} không đủ hàng`,
        });
      }

      // INSERT ITEM
      await db.query(
        "INSERT INTO order_items(order_id, product_id, quantity, price) VALUES (?,?,?,?)",
        [orderId, item.id, item.qty, item.price],
      );

      // TRỪ KHO
      await db.query("UPDATE products SET stock = stock - ? WHERE id = ?", [
        item.qty,
        item.id,
      ]);
    }

    res.json({ message: "Order created", orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Order failed" });
  }
});

// ===================== USER ENDPOINTS =====================

// GET /my — Lấy đơn hàng của chính user đang đăng nhập (đọc từ token)
router.get("/my", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC",
      [userId],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// GET /my/:id/detail — Xem chi tiết đơn hàng (chỉ xem được đơn của mình)
router.get("/my/:id/detail", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const [[order]] = await db.query(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?",
      [req.params.id, userId],
    );

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const [items] = await db.query(
      `
            SELECT oi.*, p.name as product_name, p.image as product_image
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `,
      [req.params.id],
    );

    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// GET ALL ORDERS (admin)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// GET MY ORDERS
router.get("/user/:user_id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC",
      [req.params.user_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// UPDATE STATUS
router.put("/:id", async (req, res) => {
  try {
    const { status } = req.body;

    await db.query("UPDATE orders SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);

    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ===================== ADMIN SESSION + STATS =====================

// POST /admin/session/start — Bắt đầu ca mới khi admin login
router.post("/admin/session/start", isStaff, async (req, res) => {
  try {
    const adminId = req.user.id;
    const adminName = req.user.name || req.user.display_name;

    // Đóng ca cũ nếu còn active
    await db.query(
      "UPDATE admin_sessions SET is_active = 0, ended_at = NOW() WHERE admin_id = ? AND is_active = 1",
      [adminId],
    );

    // Tạo ca mới
    const [result] = await db.query(
      "INSERT INTO admin_sessions(admin_id, admin_name, started_at, is_active) VALUES (?,?,NOW(),1)",
      [adminId, adminName],
    );

    res.json({
      message: "Bắt đầu ca mới",
      session_id: result.insertId,
      started_at: new Date(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// POST /admin/session/end — Kết thúc ca khi admin logout
router.post("/admin/session/end", isStaff, async (req, res) => {
  try {
    await db.query(
      "UPDATE admin_sessions SET is_active = 0, ended_at = NOW() WHERE admin_id = ? AND is_active = 1",
      [req.user.id],
    );
    res.json({ message: "Kết thúc ca" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// GET /admin/session/current — Lấy ca hiện tại + thống kê
router.get("/admin/session/current", isStaff, async (req, res) => {
  try {
    const adminId = req.user.id;

    // Đóng tất cả session active thừa (giữ lại session mới nhất)
    const [activeSessions] = await db.query(
      "SELECT id FROM admin_sessions WHERE admin_id = ? AND is_active = 1 ORDER BY id DESC",
      [adminId],
    );

    if (activeSessions.length > 1) {
      // Giữ lại session mới nhất, đóng tất cả session cũ
      const keepId = activeSessions[0].id;
      await db.query(
        "UPDATE admin_sessions SET is_active = 0, ended_at = NOW() WHERE admin_id = ? AND is_active = 1 AND id != ?",
        [adminId, keepId],
      );
    }

    // Lấy session active duy nhất
    const [[session]] = await db.query(
      "SELECT * FROM admin_sessions WHERE admin_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1",
      [adminId],
    );

    if (!session) {
      // Không có ca active → tạo mới
      const adminName = req.user.display_name || req.user.name || "Admin";
      const [result] = await db.query(
        "INSERT INTO admin_sessions(admin_id, admin_name, started_at, is_active) VALUES (?,?,NOW(),1)",
        [adminId, adminName],
      );
      const [[newSession]] = await db.query(
        "SELECT * FROM admin_sessions WHERE id = ?",
        [result.insertId],
      );
      return res.json(await buildSessionStats(newSession));
    }

    res.json(await buildSessionStats(session));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// Helper: build thống kê theo ca
async function buildSessionStats(session) {
  const sessionStart = session.started_at;

  // Đơn trong ca = đơn mới tạo từ đầu ca + đơn pending tồn từ trước
  // (đơn pending cũ chưa xử lý sẽ cộng vào ca tiếp theo)
  const [[{ total_in_session }]] = await db.query(
    `
        SELECT COUNT(*) as total_in_session FROM orders
        WHERE created_at >= ?
        OR (status = 'pending' AND created_at < ?)
    `,
    [sessionStart, sessionStart],
  );

  // Chờ xử lý = tất cả đơn pending hiện tại
  const [[{ pending_count }]] = await db.query(
    "SELECT COUNT(*) as pending_count FROM orders WHERE status = 'pending'",
  );

  // Đã xử lý trong ca = đơn completed trong ca này (theo completed_at)
  const [[{ done_count }]] = await db.query(
    `
        SELECT COUNT(*) as done_count FROM orders
        WHERE status = 'completed' AND completed_at >= ?
    `,
    [sessionStart],
  );

  // Doanh thu ca = tổng tiền đơn completed trong ca này
  const [[{ revenue }]] = await db.query(
    `
        SELECT COALESCE(SUM(total), 0) as revenue FROM orders
        WHERE status = 'completed' AND completed_at >= ?
    `,
    [sessionStart],
  );

  return {
    session_id: session.id,
    started_at: session.started_at,
    total_in_session: total_in_session || 0,
    pending_count: pending_count || 0,
    done_count: done_count || 0,
    revenue: revenue || 0,
  };
}

// ===================== ADMIN ENDPOINTS =====================

// GET /admin/all — Lấy tất cả đơn hàng (kèm filter trạng thái)
router.get("/admin/all", isStaff, async (req, res) => {
  try {
    const { status } = req.query;

    let sql = "SELECT * FROM orders";
    let params = [];

    if (status && status !== "all") {
      sql += " WHERE status = ?";
      params.push(status);
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// GET /admin/:id/detail — Xem chi tiết đơn hàng (kèm danh sách sản phẩm)
router.get("/admin/:id/detail", isStaff, async (req, res) => {
  try {
    const [[order]] = await db.query("SELECT * FROM orders WHERE id = ?", [
      req.params.id,
    ]);

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const [items] = await db.query(
      `
            SELECT oi.*, p.name as product_name, p.image as product_image
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `,
      [req.params.id],
    );

    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// PATCH /admin/:id/status — Cập nhật trạng thái đơn hàng
router.patch("/admin/:id/status", isStaff, async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "processing",
      "shipping",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    if (status === "completed") {
      await db.query(
        "UPDATE orders SET status = ?, completed_at = NOW() WHERE id = ?",
        [status, req.params.id],
      );
    } else {
      await db.query(
        "UPDATE orders SET status = ?, completed_at = NULL WHERE id = ?",
        [status, req.params.id],
      );
    }

    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

// PATCH /admin/:id/cancel — Hủy đơn + khôi phục kho
router.patch("/admin/:id/cancel", isStaff, async (req, res) => {
  try {
    const [[order]] = await db.query("SELECT * FROM orders WHERE id = ?", [
      req.params.id,
    ]);

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Đơn hàng đã được hủy trước đó" });
    }

    if (order.status === "completed") {
      return res
        .status(400)
        .json({ message: "Không thể hủy đơn hàng đã hoàn thành" });
    }

    // Lấy danh sách sản phẩm trong đơn để khôi phục kho
    const [items] = await db.query(
      "SELECT * FROM order_items WHERE order_id = ?",
      [req.params.id],
    );

    // Khôi phục kho từng sản phẩm
    for (let item of items) {
      await db.query("UPDATE products SET stock = stock + ? WHERE id = ?", [
        item.quantity,
        item.product_id,
      ]);
    }

    // Cập nhật trạng thái đơn hàng
    await db.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [
      req.params.id,
    ]);

    res.json({ message: "Đã hủy đơn hàng và khôi phục kho" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error" });
  }
});

module.exports = router;

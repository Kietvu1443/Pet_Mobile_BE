const path = require("path");
const dotenv = require("../node_modules/dotenv");

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

const { pool } = require("../config/db");

async function seedDemoPlaces() {
  const isProduction = process.env.NODE_ENV === "production";
  const forceFlag = process.argv.includes("--force-demo");

  if (isProduction && !forceFlag) {
    console.error("⛔ CẢNH BÁO: Không thể chạy seed_demo_places.js trên môi trường PRODUCTION!");
    console.error("Nếu bạn thực sự muốn chạy, vui lòng thêm cờ --force-demo.");
    process.exit(1);
  }

  console.log("🌱 Đang nạp dữ liệu địa điểm demo cho môi trường Development/Testing...");

  // Tìm một user hợp lệ làm creator
  const [userRows] = await pool.query("SELECT id FROM users LIMIT 1");
  const creatorId = userRows.length > 0 ? userRows[0].id : 1;

  const demoPlaces = [
    {
      name: "[DEMO] Trạm Cứu Hộ Chó Mèo Sài Gòn (SAR)",
      type: "shelter",
      description: "Trạm cứu hộ và chăm sóc các bé chó mèo bị bỏ rơi hoặc gặp tai nạn.",
      address: "123 Đường Bình Thới, Phường 11, Quận 11, TP. Hồ Chí Minh",
      latitude: 10.762622,
      longitude: 106.660172,
      phone: "0901234567",
      website: "https://facebook.com/saigonanimalrescue",
      image_url: "https://images.unsplash.com/photo-1629740067905-bd3f515aa739?w=800",
      rating_avg: 4.90,
      review_count: 24,
      status: "approved",
    },
    {
      name: "[DEMO] Bệnh Viện Thú Y PetCare 24/7",
      type: "veterinary",
      description: "Khám chữa bệnh, cấp cứu 24/7, phẫu thuật và tiêm phòng vắc-xin cho thú cưng.",
      address: "146 Nguyễn Văn Thủ, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
      latitude: 10.788451,
      longitude: 106.698315,
      phone: "02838234567",
      website: "https://petcare.vn",
      image_url: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800",
      rating_avg: 4.80,
      review_count: 18,
      status: "approved",
    },
    {
      name: "[DEMO] Poodle & Cat Spa Grooming",
      type: "grooming",
      description: "Dịch vụ tắm spa, cắt tỉa lông tạo kiểu nghệ thuật cho chó mèo chuyên nghiệp.",
      address: "215 Điện Biên Phủ, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh",
      latitude: 10.781234,
      longitude: 106.689123,
      phone: "0909888999",
      website: "https://poodlespa.example.com",
      image_url: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800",
      rating_avg: 4.70,
      review_count: 15,
      status: "approved",
    },
    {
      name: "[DEMO] Cà Phê Mèo Meow House",
      type: "pet_cafe",
      description: "Không gian cà phê vui chơi với hơn 30 bé mèo thân thiện và quấn người.",
      address: "102 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
      latitude: 10.782901,
      longitude: 106.695234,
      phone: "0933221144",
      website: "https://meowhouse.example.com",
      image_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800",
      rating_avg: 4.65,
      review_count: 32,
      status: "approved",
    },
    {
      name: "[DEMO] Khu Vui Chơi Thú Cưng Tao Đàn",
      type: "park",
      description: "Khu vực sân cỏ thoáng mát cho cún chạy nhảy, giao lưu cuối tuần.",
      address: "Công viên Tao Đàn, Trương Định, Quận 1, TP. Hồ Chí Minh",
      latitude: 10.774500,
      longitude: 106.692500,
      phone: null,
      website: null,
      image_url: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800",
      rating_avg: 4.85,
      review_count: 40,
      status: "approved",
    },
    {
      name: "[DEMO] Điểm Giao Lưu Corgi & Poodle Weekend",
      type: "meetup",
      description: "Buổi offline gặp gỡ hàng tuần của hội yêu cún cưng Sài Gòn.",
      address: "Khuôn viên Landmark 81 Park, Bình Thạnh, TP. Hồ Chí Minh",
      latitude: 10.795100,
      longitude: 106.721200,
      phone: "0912345678",
      website: null,
      image_url: "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=800",
      rating_avg: 5.00,
      review_count: 12,
      status: "approved",
    },
  ];

  let inserted = 0;
  for (const p of demoPlaces) {
    // Kiểm tra xem đã có chưa để tránh trùng lặp
    const [existing] = await pool.query("SELECT id FROM places WHERE name = ?", [p.name]);
    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO places (name, type, description, address, latitude, longitude, phone, website, image_url, rating_avg, review_count, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.name,
          p.type,
          p.description,
          p.address,
          p.latitude,
          p.longitude,
          p.phone,
          p.website,
          p.image_url,
          p.rating_avg,
          p.review_count,
          creatorId,
          p.status,
        ]
      );
      inserted++;
    }
  }

  console.log(`✅ Đã nạp thành công ${inserted} địa điểm demo [DEMO]!`);
  process.exit(0);
}

seedDemoPlaces().catch((err) => {
  console.error("❌ Seed demo places thất bại:", err);
  process.exit(1);
});

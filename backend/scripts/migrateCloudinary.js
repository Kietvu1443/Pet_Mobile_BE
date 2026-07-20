/**
 * Script: Migrate ảnh Local lên Cloudinary
 *
 * Chạy: node scripts/migrateCloudinary.js
 *
 * Script này sẽ:
 * 1. Quét bảng pet_images tìm những ảnh có cloudinary_id = NULL (ảnh local cũ)
 * 2. Upload từng ảnh lên Cloudinary
 * 3. Cập nhật lại image_path và cloudinary_id trong DB
 * 4. Cập nhật cả bảng pets.image_url nếu cần
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { pool } = require("../config/db");

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Đường dẫn gốc đến thư mục public
const PUBLIC_DIR = path.join(__dirname, "../public");

// Đếm số lượng thành công và thất bại
let successCount = 0;
let failCount = 0;
let skipCount = 0;

async function migrateImages() {
  console.log("🚀 Bắt đầu migrate ảnh Local lên Cloudinary...\n");

  // Kiểm tra kết nối Cloudinary
  try {
    const result = await cloudinary.api.ping();
    console.log("✅ Cloudinary kết nối OK:", result.status);
  } catch (error) {
    console.error("❌ Không thể kết nối Cloudinary. Kiểm tra lại .env!");
    console.error(error.message);
    process.exit(1);
  }

  // 1. Lấy tất cả ảnh chưa có cloudinary_id từ bảng pet_images
  const [images] = await pool.execute(
    "SELECT * FROM pet_images WHERE cloudinary_id IS NULL ORDER BY pet_id, display_order",
  );

  console.log(`📸 Tìm thấy ${images.length} ảnh local cần migrate.\n`);

  if (images.length === 0) {
    console.log("✅ Không có ảnh nào cần migrate. Xong!");
    process.exit(0);
  }

  // 2. Upload từng ảnh
  for (const img of images) {
    const localPath = path.join(PUBLIC_DIR, img.image_path);

    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(localPath)) {
      console.log(
        `⚠️  [ID:${img.id}] File không tồn tại: ${img.image_path} → BỎ QUA`,
      );
      skipCount++;
      continue;
    }

    try {
      // Xác định folder trên Cloudinary theo pet_id
      const folder = `pets/${img.pet_id}`;

      console.log(
        `📤 [ID:${img.id}] Đang upload: ${img.image_path} → ${folder}`,
      );

      // Upload lên Cloudinary
      const uploadResult = await cloudinary.uploader.upload(localPath, {
        folder: folder,
        quality: "auto",
        resource_type: "image",
      });

      const newUrl = uploadResult.secure_url;
      const publicId = uploadResult.public_id;

      // 3. Cập nhật bảng pet_images
      await pool.execute(
        "UPDATE pet_images SET image_path = ?, cloudinary_id = ? WHERE id = ?",
        [newUrl, publicId, img.id],
      );

      console.log(`   ✅ Thành công! URL: ${newUrl}`);
      console.log(`   🔑 Public ID: ${publicId}\n`);

      successCount++;
    } catch (error) {
      console.error(
        `   ❌ [ID:${img.id}] Upload lỗi: ${error.message}\n`,
      );
      failCount++;
    }
  }

  // 4. Cập nhật bảng pets.image_url cho các pet có ảnh local
  console.log("\n📝 Đang cập nhật bảng pets.image_url...");
  const [pets] = await pool.execute(
    "SELECT id, image_url FROM pets WHERE image_url IS NOT NULL AND image_url LIKE '/images/%'",
  );

  let petUpdateCount = 0;
  for (const pet of pets) {
    // Tìm ảnh đầu tiên (display_order = 0) đã migrate của pet này
    const [migrated] = await pool.execute(
      "SELECT image_path FROM pet_images WHERE pet_id = ? AND cloudinary_id IS NOT NULL ORDER BY display_order ASC LIMIT 1",
      [pet.id],
    );

    if (migrated.length > 0) {
      await pool.execute("UPDATE pets SET image_url = ? WHERE id = ?", [
        migrated[0].image_path,
        pet.id,
      ]);
      petUpdateCount++;
    }
  }

  console.log(`   ✅ Đã cập nhật ${petUpdateCount} pet.\n`);

  // 5. Tổng kết
  console.log("═══════════════════════════════════════");
  console.log("📊 KẾT QUẢ MIGRATE:");
  console.log(`   ✅ Thành công: ${successCount}`);
  console.log(`   ❌ Thất bại:   ${failCount}`);
  console.log(`   ⚠️  Bỏ qua:    ${skipCount}`);
  console.log("═══════════════════════════════════════");

  if (failCount === 0 && skipCount === 0) {
    console.log(
      "\n🎉 Tất cả ảnh đã được chuyển lên Cloudinary thành công!",
    );
    console.log(
      "💡 Bạn có thể xóa thư mục public/images/pets/ để dọn dẹp dung lượng.",
    );
  } else {
    console.log(
      "\n⚠️  Có một số ảnh chưa được migrate. Xem log ở trên để biết chi tiết.",
    );
  }

  process.exit(0);
}

// Chạy
migrateImages().catch((error) => {
  console.error("💥 Script bị lỗi nghiêm trọng:", error);
  process.exit(1);
});

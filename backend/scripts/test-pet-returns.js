/**
 * test-pet-returns.js
 * Standalone test script cho Pet Return Workflow.
 * Chạy: node backend/scripts/test-pet-returns.js
 *
 * Yêu cầu: DB đã có dữ liệu mẫu (user, pet ở trạng thái adopted, adoption_request approved).
 * Cập nhật USER_ID, PET_ID, ADOPTION_REQUEST_ID phù hợp với DB của bạn.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../config/db");
const petReturnService = require("../service/petReturnService");

// ─── Cấu hình test ────────────────────────────────────────────────────────────
const TEST_USER_ID = 2;       // ID user đã verify có adoption_request approved
const TEST_PET_ID = 1;        // Pet đang ở trạng thái 'adopted'
const STAFF_USER_ID = 1;      // Admin/Staff ID

let returnId = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pass(msg) { console.log(`\x1b[32m✅ PASS\x1b[0m: ${msg}`); }
function fail(msg) { console.log(`\x1b[31m❌ FAIL\x1b[0m: ${msg}`); }
async function dbQuery(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows; }

// ─── Test Cases ───────────────────────────────────────────────────────────────

async function tc1_CreateReturnRequest() {
  console.log("\n[TC1] Tạo yêu cầu trả hợp lệ");
  try {
    const result = await petReturnService.createReturnRequest({
      userId: TEST_USER_ID,
      petId: TEST_PET_ID,
      reasonCategory: "financial",
      reasonDetail: "Hoàn cảnh gia đình thay đổi đột ngột, không thể tiếp tục nuôi dưỡng.",
      imageFiles: [],
    });
    returnId = result.id;
    pass(`Tạo hồ sơ trả #${returnId} thành công (status: ${result.status})`);
  } catch (err) {
    fail(`Tạo hồ sơ trả thất bại: ${err.message}`);
  }
}

async function tc2_DuplicateBlock() {
  console.log("\n[TC2] Chống duplicate: gửi trả 2 lần");
  try {
    await petReturnService.createReturnRequest({
      userId: TEST_USER_ID,
      petId: TEST_PET_ID,
      reasonCategory: "allergy",
      reasonDetail: "Dị ứng nghiêm trọng với lông thú cưng được xác nhận bởi bác sĩ.",
      imageFiles: [],
    });
    fail("Kẽ hở: cho phép tạo hồ sơ trả thứ 2 khi pending đang tồn tại");
  } catch (err) {
    if (err.status === 409) {
      pass(`Chặn duplicate đúng (409): ${err.message}`);
    } else {
      fail(`Lỗi không đúng loại: ${err.status} - ${err.message}`);
    }
  }
}

async function tc3_InvalidTransition_PendingToCompleted() {
  console.log("\n[TC3] Chuyển trạng thái không hợp lệ: pending → completed");
  if (!returnId) { fail("Bỏ qua – không có returnId"); return; }
  try {
    await petReturnService.updateStatus({
      returnId,
      nextStatus: "completed",
      reviewerId: STAFF_USER_ID,
      adminNotes: null,
      userRole: 0,
    });
    fail("Kẽ hở: cho phép pending → completed trực tiếp");
  } catch (err) {
    if (err.status === 400) {
      pass(`Chặn chuyển trạng thái không hợp lệ (400): ${err.message}`);
    } else {
      fail(`Lỗi không đúng loại: ${err.status} - ${err.message}`);
    }
  }
}

async function tc4_UnauthorizedUserCannotApprove() {
  console.log("\n[TC4] User thường (role=2) không được approve hồ sơ");
  if (!returnId) { fail("Bỏ qua – không có returnId"); return; }
  try {
    await petReturnService.updateStatus({
      returnId,
      nextStatus: "approved_online",
      reviewerId: TEST_USER_ID,
      adminNotes: null,
      userRole: 2,  // user thường
    });
    fail("Kẽ hở: user thường có thể approve");
  } catch (err) {
    if (err.status === 403) {
      pass(`Chặn truy cập trái phép (403): ${err.message}`);
    } else {
      fail(`Lỗi không đúng loại: ${err.status} - ${err.message}`);
    }
  }
}

async function tc5_ApproveOnline() {
  console.log("\n[TC5] Staff duyệt online (pending → approved_online)");
  if (!returnId) { fail("Bỏ qua – không có returnId"); return; }
  try {
    const result = await petReturnService.updateStatus({
      returnId,
      nextStatus: "approved_online",
      reviewerId: STAFF_USER_ID,
      adminNotes: "Trạm xác nhận. Hẹn bàn giao Thứ 7 tuần tới lúc 9h sáng.",
      userRole: 0,
    });
    pass(`Duyệt online thành công (status: ${result.status})`);
  } catch (err) {
    fail(`Duyệt online thất bại: ${err.message}`);
  }
}

async function tc6_TransactionRollbackOnComplete() {
  console.log("\n[TC6] Transaction integrity: complete → pets.status phải là available");
  if (!returnId) { fail("Bỏ qua – không có returnId"); return; }
  try {
    await petReturnService.updateStatus({
      returnId,
      nextStatus: "completed",
      reviewerId: STAFF_USER_ID,
      adminNotes: "Đã nhận lại bé tại trạm. Sức khỏe tốt.",
      userRole: 0,
    });
    // Kiểm tra pet.status
    const pets = await dbQuery("SELECT status FROM pets WHERE id = ? LIMIT 1", [TEST_PET_ID]);
    if (pets[0] && pets[0].status === "available") {
      pass(`Transaction hoàn tất: pets.status chuyển sang 'available' đúng`);
    } else {
      fail(`Transaction lỗi: pets.status = '${pets[0]?.status}', kỳ vọng 'available'`);
    }
  } catch (err) {
    fail(`TC6 thất bại: ${err.message}`);
  }
}

async function tc7_TerminalStateCannotChange() {
  console.log("\n[TC7] Không được thay đổi trạng thái sau completed");
  if (!returnId) { fail("Bỏ qua – không có returnId"); return; }
  try {
    await petReturnService.updateStatus({
      returnId,
      nextStatus: "pending",
      reviewerId: STAFF_USER_ID,
      adminNotes: null,
      userRole: 0,
    });
    fail("Kẽ hở: cho phép thay đổi từ terminal state");
  } catch (err) {
    if (err.status === 409 || err.status === 400) {
      pass(`Chặn thay đổi terminal state (${err.status}): ${err.message}`);
    } else {
      fail(`Lỗi không đúng loại: ${err.status} - ${err.message}`);
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\n[CLEANUP] Khôi phục trạng thái DB về ban đầu...");
  if (returnId) {
    await dbQuery("DELETE FROM pet_return_images WHERE pet_return_id = ?", [returnId]);
    await dbQuery("DELETE FROM pet_returns WHERE id = ?", [returnId]);
  }
  // Khôi phục pet về adopted để test khác không bị ảnh hưởng
  await dbQuery("UPDATE pets SET status = 'adopted' WHERE id = ?", [TEST_PET_ID]);
  console.log("Cleanup hoàn tất.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log("═══════════════════════════════════════════════════");
  console.log("   Pet Return Workflow – Test Suite");
  console.log("═══════════════════════════════════════════════════");

  try {
    await tc1_CreateReturnRequest();
    await tc2_DuplicateBlock();
    await tc3_InvalidTransition_PendingToCompleted();
    await tc4_UnauthorizedUserCannotApprove();
    await tc5_ApproveOnline();
    await tc6_TransactionRollbackOnComplete();
    await tc7_TerminalStateCannotChange();
  } finally {
    await cleanup();
    await pool.end();
    console.log("\n═══════════════════════════════════════════════════");
    console.log("   Test Suite hoàn tất.");
    console.log("═══════════════════════════════════════════════════");
  }
})();

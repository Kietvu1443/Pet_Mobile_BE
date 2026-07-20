# Đặc tả Use Case chi tiết cho Actor: Staff

Tài liệu này mô tả chi tiết các trường hợp sử dụng (Use Case) dành cho Nhân viên (Staff) trong việc vận hành hệ thống Pet Helper.

## 1. Phân hệ Quản lý Thú cưng

### UC_Staff_Pet_01: Thêm thú cưng mới
*   **Mô tả:** Staff đăng tải thông tin thú cưng mới cứu hộ được lên hệ thống.
*   **Dòng sự kiện chính:**
    1.  Staff chọn "Thêm thú cưng".
    2.  Staff nhập các thông tin: Tên, loài, giống, tuổi, giới tính, màu sắc, cân nặng, tình trạng tiêm chủng.
    3.  Staff tải lên ít nhất một ảnh đại diện.
    4.  Hệ thống lưu thông tin và tạo thư mục lưu trữ ảnh riêng cho bé.
*   **Kết quả:** Thú cưng hiển thị công khai trên trang "Adopt".

### UC_Staff_Pet_02: Cập nhật/Xóa thú cưng
*   **Mô tả:** Chỉnh sửa thông tin hoặc gỡ bỏ thú cưng khi đã được nhận nuôi hoặc có thay đổi.
*   **Lưu ý:** Khi xóa thú cưng, hệ thống sẽ đồng thời xóa toàn bộ ảnh liên quan trong thư mục lưu trữ.

---

## 2. Phân hệ Quy trình Nhận nuôi

### UC_Staff_Adopt_01: Xét duyệt hồ sơ nhận nuôi
*   **Mô tả:** Đánh giá và phản hồi các yêu cầu nhận nuôi từ người dùng.
*   **Dòng sự kiện chính:**
    1.  Staff truy cập danh sách "Adoption Requests".
    2.  Staff kiểm tra tính xác thực của người dùng và lý do nhận nuôi.
    3.  Staff chọn "Approve" (Duyệt) hoặc "Reject" (Từ chối).
    4.  Hệ thống cập nhật trạng thái hồ sơ và gửi thông báo cho người dùng.

---

## 3. Phân hệ Xử lý Báo cáo

### UC_Staff_Report_01: Quản lý báo cáo thất lạc
*   **Mô tả:** Kiểm duyệt các tin đăng báo mất/tìm thấy thú cưng từ cộng đồng.
*   **Dòng sự kiện chính:**
    1.  Staff xem các báo cáo mới gửi.
    2.  Nếu thông tin hợp lệ, Staff giữ trạng thái "Approved".
    3.  Nếu là tin spam hoặc sai sự thật, Staff có quyền xóa bài đăng.
    4.  Staff có thể hoàn tác (Revert) trạng thái xử lý nếu có sai sót.

---

## 4. Các quyền hạn khác
*   **Xem danh sách người dùng:** Staff có quyền xem thông tin cơ bản của người dùng để phục vụ việc xác minh hồ sơ nhận nuôi, nhưng **không có quyền** thay đổi Role hoặc Khóa tài khoản (đây là quyền của Admin).

---

## Danh sách các tệp sơ đồ liên quan:
*   [UC_Staff_PetManagement.puml](./UC_Staff_PetManagement.puml)
*   [UC_Staff_AdoptionProcess.puml](./UC_Staff_AdoptionProcess.puml)
*   [UC_Staff_ReportHandling.puml](./UC_Staff_ReportHandling.puml)

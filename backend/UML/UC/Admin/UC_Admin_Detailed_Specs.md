# Đặc tả Use Case chi tiết cho Actor: Admin

Tài liệu này mô tả chi tiết các trường hợp sử dụng (Use Case) dành riêng hoặc quan trọng đối với Quản trị viên (Admin).

## 1. Phân hệ Quản lý Người dùng (Đặc quyền Admin)

### UC_Admin_User_01: Thay đổi quyền hạn (Update Role)
*   **Mô tả:** Admin nâng cấp người dùng lên Staff hoặc hạ cấp Staff xuống User.
*   **Dòng sự kiện chính:**
    1.  Admin vào danh sách Người dùng.
    2.  Admin chọn một tài khoản cụ thể.
    3.  Admin chọn Role mới (Staff/User).
    4.  Hệ thống cập nhật quyền và thông báo thành công.
*   **Lưu ý:** Admin không thể tự đổi quyền của mình hoặc của Admin khác.

### UC_Admin_User_02: Khóa/Mở khóa tài khoản
*   **Mô tả:** Admin ngăn chặn người dùng vi phạm truy cập hệ thống.
*   **Dòng sự kiện chính:**
    1.  Admin chọn tài khoản cần xử lý.
    2.  Admin nhấn "Khóa tài khoản" và nhập lý do.
    3.  Hệ thống chuyển trạng thái sang "Banned" và ghi nhận thời gian.
    4.  Người dùng bị khóa sẽ không thể đăng nhập.

---

## 2. Phân hệ Quản lý Báo cáo nâng cao

### UC_Admin_Report_01: Xử lý vi phạm từ báo cáo
*   **Mô tả:** Admin xử lý báo cáo và đồng thời khóa tài khoản người bị báo cáo.
*   **Dòng sự kiện chính:**
    1.  Admin xem chi tiết báo cáo "Pending".
    2.  Admin chọn hành động "Ban User".
    3.  Hệ thống thực hiện giao dịch (Transaction): Duyệt báo cáo + Khóa tài khoản người đăng.
    4.  Thông báo kết quả xử lý kép thành công.

---

## 3. Phân hệ Vận hành (Chia sẻ với Staff)

### UC_Admin_Pet_01: Quản lý thú cưng
*   **Mô tả:** Thêm, sửa hoặc xóa thông tin thú cưng trên hệ thống.
*   **Dòng sự kiện chính:**
    1.  Admin nhập thông tin bé mới (Tên, tuổi, loài, ảnh).
    2.  Hệ thống lưu dữ liệu và hiển thị lên trang chủ/trang nhận nuôi.

### UC_Admin_Adopt_01: Xét duyệt nhận nuôi
*   **Mô tả:** Duyệt hoặc từ chối các yêu cầu nhận nuôi từ người dùng.
*   **Dòng sự kiện chính:**
    1.  Admin xem danh sách yêu cầu "Waiting".
    2.  Admin kiểm tra thông tin người đăng ký.
    3.  Admin nhấn "Approve" hoặc "Reject".

---

## Danh sách các tệp sơ đồ liên quan:
*   [UC_Admin_UserManagement.puml](./UC_Admin_UserManagement.puml)
*   [UC_Admin_ReportManagement.puml](./UC_Admin_ReportManagement.puml)
*   [UC_Admin_Operation.puml](./UC_Admin_Operation.puml)

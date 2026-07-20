# Đặc tả Use Case chi tiết cho Actor: User

Tài liệu này mô tả chi tiết các trường hợp sử dụng (Use Case) cho người dùng trong hệ thống Pet Helper.

## 1. Phân hệ Quản lý Tài khoản

### UC_User_Account_01: Đăng ký tài khoản
*   **Mô tả:** Người dùng tạo tài khoản mới để sử dụng các tính năng nâng cao.
*   **Dòng sự kiện chính:**
    1.  Người dùng chọn "Đăng ký".
    2.  Hệ thống hiển thị form (Tên đăng nhập, Email, Mật khẩu, Thông tin cá nhân).
    3.  Người dùng nhập thông tin và xác nhận.
    4.  Hệ thống kiểm tra tính hợp lệ và lưu vào database.
*   **Kết quả:** Tài khoản được tạo thành công, người dùng được tự động đăng nhập.

---

## 2. Phân hệ Tương tác Thú cưng

### UC_User_Pet_01: Quẹt PetSnap
*   **Mô tả:** Người dùng tìm kiếm thú cưng một cách ngẫu hứng thông qua giao diện quẹt (Swipe).
*   **Dòng sự kiện chính:**
    1.  Người dùng truy cập mục "PetSnap".
    2.  Hệ thống hiển thị ngẫu nhiên một bé thú cưng chưa được tương tác.
    3.  Người dùng chọn "Thích" (quẹt phải) hoặc "Bỏ qua" (quẹt trái).
    4.  Nếu "Thích", hệ thống lưu bé vào danh sách yêu thích.
    5.  Hệ thống tải bé tiếp theo.

---

## 3. Phân hệ Nhận nuôi

### UC_User_Adopt_01: Gửi yêu cầu nhận nuôi
*   **Mô tả:** Người dùng đăng ký nhận nuôi một bé thú cưng cụ thể.
*   **Điều kiện tiên quyết:** Người dùng đã đăng nhập.
*   **Dòng sự kiện chính:**
    1.  Người dùng xem chi tiết một bé thú cưng có trạng thái "Available".
    2.  Người dùng nhấn "Nhận nuôi".
    3.  Hệ thống yêu cầu nhập lý do/thông tin liên hệ.
    4.  Người dùng gửi yêu cầu.
*   **Kết quả:** Yêu cầu được gửi tới Staff chờ xét duyệt.

---

## 4. Phân hệ Báo cáo Thất lạc

### UC_User_Report_01: Báo cáo thú cưng thất lạc (Lost)
*   **Mô tả:** Người dùng đăng tin tìm kiếm thú cưng bị mất.
*   **Dòng sự kiện chính:**
    1.  Người dùng chọn "Báo mất thú cưng".
    2.  Người dùng điền thông tin: Tên bé, loài, màu sắc, vị trí lạc, ảnh.
    3.  Người dùng xác nhận đăng bài.
    4.  Hệ thống hiển thị bài viết lên bảng tin công khai.

---

## 5. Phân hệ Dịch vụ & Tiện ích

### UC_User_Service_01: Đặt lịch tiêm phòng
*   **Mô tả:** Người dùng đăng ký lịch hẹn y tế cho vật nuôi.
*   **Dòng sự kiện chính:**
    1.  Người dùng chọn "Đặt lịch tiêm phòng".
    2.  Người dùng chọn loại dịch vụ (Tiêm phòng dại, Khám tổng quát...).
    3.  Người dùng chọn ngày hẹn và để lại số điện thoại.
    4.  Hệ thống thông báo đăng ký thành công.

---

## Danh sách các tệp sơ đồ liên quan:
*   [UC_User_Account.puml](./UC_User_Account.puml)
*   [UC_User_PetInteraction.puml](./UC_User_PetInteraction.puml)
*   [UC_User_Adoption.puml](./UC_User_Adoption.puml)
*   [UC_User_Reporting.puml](./UC_User_Reporting.puml)
*   [UC_User_Services.puml](./UC_User_Services.puml)

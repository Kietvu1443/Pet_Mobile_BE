# 🐾 Pet Helper - Hỗ Trợ & Bảo Vệ Vật Nuôi

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**Pet Helper** là một nền tảng Web được xây dựng nhằm hỗ trợ việc nhận nuôi thú cưng và báo cáo thú cưng thất lạc. Hệ thống kết nối những người yêu động vật với các trạm cứu hộ, giúp các bé thú cưng tìm thấy mái ấm mới và hỗ trợ chủ nuôi tìm lại thú cưng bị lạc.

---

## ✨ Tính năng chính

### 👤 Dành cho Người dùng
- **Xác thực & Bảo mật**: Đăng ký, đăng nhập và xác thực tài khoản qua Email OTP (sử dụng Resend API).
- **Nhận nuôi thú cưng**: Xem danh sách thú cưng, gửi yêu cầu nhận nuôi và theo dõi trạng thái hồ sơ.
- **PetSnap**: Trải nghiệm duyệt thú cưng kiểu "Tinder", giúp bạn nhanh chóng tìm thấy thú cưng ưng ý.
- **Báo cáo Thú cưng**: Gửi báo cáo Thất lạc (Lost) hoặc Tìm thấy (Found) thú cưng kèm hình ảnh và vị trí.
- **Yêu thích**: Lưu lại danh sách các bé thú cưng bạn đang quan tâm.

### 🛠️ Dành cho Staff (Nhân viên)
- **Quản lý Thú cưng**: Thêm, chỉnh sửa thông tin và quản lý hình ảnh thú cưng.
- **Duyệt hồ sơ**: Xem xét và phê duyệt các yêu cầu nhận nuôi từ người dùng.

### 👑 Dành cho Admin (Quản trị viên)
- **Quản lý Người dùng**: Theo dõi danh sách thành viên, phân quyền (Staff/User) và khóa tài khoản vi phạm.
- **Quản lý Báo cáo**: Xử lý các báo cáo thất lạc/tìm thấy từ cộng đồng.
- **Thống kê**: Xem tổng quan số liệu về thú cưng, người dùng và các hoạt động trên hệ thống.

---

## 🛠️ Công nghệ sử dụng

- **Backend**: Node.js, Express.js.
- **Database**: MySQL (sử dụng `mysql2/promise` và Connection Pool).
- **Template Engine**: EJS (Embedded JavaScript templates).
- **Cloud Storage**: Cloudinary (lưu trữ hình ảnh).
- **Email Service**: Resend API (gửi mã OTP).
- **Docker**: Docker Compose cho việc đóng gói và triển khai nhanh chóng.

---

## 🚀 Hướng dẫn cài đặt

### 1. Sử dụng Docker (Khuyên dùng)
Yêu cầu: Đã cài đặt Docker Desktop.

```bash
# Khởi chạy hệ thống lần đầu (bao gồm build)
docker-compose up --build

# Chạy ở chế độ nền
docker-compose up -d

# Dừng hệ thống
docker-compose down
```
- **Website**: [http://localhost:3000](http://localhost:3000)
- **Quản lý DB (phpMyAdmin)**: [http://localhost:8080](http://localhost:8080) (User: `root` / Pass: `root123`)

### 2. Cài đặt thủ công (Local)
Yêu cầu: Node.js >= 16, MySQL.

1. **Cấu hình môi trường**: Tạo file `.env` tại thư mục gốc:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pet_helper

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Email Config
RESEND_API_KEY=your_resend_key
```

2. **Cài đặt thư viện & Chạy**:
```bash
npm install
npm start
```

---

## 📊 Sơ đồ hệ thống (UML)

Dự án đã được thiết kế với các sơ đồ UML chi tiết nằm trong thư mục `/UML`:
- **State Diagrams**: [Chi tiết trạng thái thực thể](UML/StateDiagrams.puml)
- **Activity Diagrams**: [Luồng hoạt động của Actor](UML/Activity/)
- **Sequence Diagrams**: [Quy trình xử lý logic](UML/Sequence/)

---

## 🔐 Tài khoản thử nghiệm

| Vai trò | Email | Mật khẩu |
| :--- | :--- | :--- |
| **Admin** | `admin@pethelper.vn` | `admin123` |
| **Staff** | `truestaff@example.com` (Cần tạo) | `1234567` |
| **User** | `trueuser@example.com` (Cần tạo) | `1234567` |

---

## 📁 Cấu trúc thư mục

```text
├── config/         # Cấu hình Database, Cloudinary, v.v.
├── controller/     # Xử lý logic nghiệp vụ (MVC - Controller)
├── database/       # Chứa schema SQL và các file migration
├── middleware/     # Kiểm tra quyền, xác thực JWT
├── models/         # Tương tác trực tiếp với Database (MVC - Model)
├── public/         # Tài nguyên tĩnh (JS, CSS, Images, HTML)
├── routes/         # Định tuyến API và Web
├── utils/          # Các hàm tiện ích (Response, Email, v.v.)
└── views/          # Giao diện phía Server (MVC - View)
```

---
© 2026 Pet Helper Team.

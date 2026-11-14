# Cấu hình cuộc gọi LiveKit Cloud

1. Tạo project trong LiveKit Cloud và lấy Project URL dạng `wss://...livekit.cloud`, API key và API secret từ Project Settings.
2. Điền các biến dưới đây vào file `.env` của backend (không đưa API secret vào frontend hoặc mã nguồn):

```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

3. Khởi động lại backend và frontend. Mở ứng dụng qua HTTPS hoặc localhost để trình duyệt cho phép micro/camera.
4. Đăng nhập bằng hai tài khoản có quyền trong cùng lớp, chọn gọi thoại/video. Người nhận phải chấp nhận trước khi token được cấp và thiết bị truyền âm thanh/hình ảnh.

Các cuộc gọi được giới hạn 2 người. Các phiên hết hạn được giải phóng tự động; nếu tab bị đóng đột ngột, quyền gọi được dọn khi kiểm tra cuộc gọi tiếp theo hoặc heartbeat phát hiện phiên cũ. Backend dùng MongoDB unique index để tránh hai cuộc gọi đồng thời cho cùng một tài khoản; tài khoản database phải có quyền tạo index khi ứng dụng khởi động.

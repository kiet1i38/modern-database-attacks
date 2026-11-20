export type DemoScenario = {
  id: string;
  title: string;
  request: string;
  defense: string;
};

export const scenarios: readonly DemoScenario[] = [
  {
    id: "disclosure",
    title: "Lộ bản ghi ngoài phạm vi",
    request: "Xem yêu cầu của nhóm A.",
    defense: "Ràng buộc phạm vi theo phiên đăng nhập và chỉ trả các trường cần hiển thị."
  },
  {
    id: "targeted-update",
    title: "Sửa bản ghi ngoài phạm vi",
    request: "Đóng yêu cầu M-01 của nhóm A.",
    defense: "Kiểm tra quyền trên từng bản ghi và cố định phạm vi cập nhật."
  },
  {
    id: "bulk-update",
    title: "Sửa hàng loạt ngoài dự kiến",
    request: "Đóng duy nhất yêu cầu M-01.",
    defense: "Dùng điều kiện cố định theo mã và quyền sở hữu; kiểm tra số hàng bị ảnh hưởng."
  },
  {
    id: "bulk-delete",
    title: "Xóa nhiều bản ghi",
    request: "Xóa duy nhất yêu cầu M-01.",
    defense: "Giới hạn thao tác theo quyền và mã bản ghi; dữ liệu chạy trong sandbox tạm."
  },
  {
    id: "table-loss",
    title: "Mất cả bảng hoặc bộ sưu tập",
    request: "Đọc danh sách yêu cầu mẫu.",
    defense: "Thao tác phá hủy chỉ nhắm vào bảng tạm hoặc bộ sưu tập tạm của lượt chạy."
  },
  {
    id: "privilege",
    title: "Thay đổi quyền qua cập nhật dữ liệu",
    request: "Đổi tên hiển thị của tài khoản mẫu.",
    defense: "Chỉ nhận các trường hồ sơ được phép; vai trò chỉ đổi qua luồng quản trị."
  },
  {
    id: "error-details",
    title: "Lộ chi tiết qua thông báo lỗi",
    request: "Gửi một truy vấn có trường không tồn tại.",
    defense: "Trả lỗi ngắn gọn cho người dùng và không gửi chi tiết driver ra ngoài."
  },
  {
    id: "response-difference",
    title: "Rò rỉ qua phản hồi khác nhau",
    request: "So sánh hai truy vấn trên dữ liệu mẫu.",
    defense: "Giữ thông báo công khai nhất quán khi khác biệt có thể tiết lộ dữ liệu."
  },
  {
    id: "authentication",
    title: "Xác thực và mật khẩu sai",
    request: "Yêu cầu đăng nhập với mật khẩu không đúng.",
    defense: "Tìm tài khoản bằng truy vấn có ràng buộc và kiểm tra mật khẩu độc lập."
  },
  {
    id: "mongo-types",
    title: "Kiểu dữ liệu trong xác thực MongoDB",
    request: "So sánh object truy vấn với mật khẩu dạng chuỗi.",
    defense: "Chỉ nhận mật khẩu dạng chuỗi và từ chối kiểu sai trước bước xác thực."
  },
  {
    id: "ticket-ownership",
    title: "Quyền xem yêu cầu của sinh viên",
    request: "Sinh viên nhóm A mở yêu cầu thuộc nhóm B.",
    defense: "Kiểm tra quyền sở hữu trên máy chủ cho từng yêu cầu."
  },
  {
    id: "role-boundaries",
    title: "Hành động bị cấm và trường vai trò",
    request: "Thử thực hiện một hành động dành riêng cho quản trị viên.",
    defense: "Kiểm tra vai trò trên máy chủ trước mọi thao tác quản trị."
  },
  {
    id: "session-boundaries",
    title: "Tách phiên, đăng xuất và khóa tài khoản",
    request: "So sánh phiên hiện tại với phiên khác, đã đăng xuất và bị khóa.",
    defense: "Kiểm tra biến thể, trạng thái phiên và trạng thái tài khoản trên máy chủ."
  },
  {
    id: "legitimate-apostrophe",
    title: "Dữ liệu hợp lệ có dấu nháy",
    request: "Lưu và đọc lại tiêu đề Yêu cầu của O'Connor.",
    defense: "Truyền dữ liệu bằng tham số hoặc trường BSON để giữ nguyên dấu nháy."
  }
];

type Row = readonly [id: string, value: string];
type Outcome = { status: number; summary: string; rows?: readonly Row[] };
export type DemoScenario = {
  id: string;
  title: string;
  request: string;
  defense: string;
  before?: readonly Row[];
  insufficient: Outcome;
  protected: Outcome;
};

const tickets = [
  ["M-01", "Nhóm A · Đang mở"],
  ["M-02", "Nhóm B · Đang mở"],
  ["M-03", "Nhóm B · Đang xử lý"]
] as const;
const updated = ["M-01", "Nhóm A · Đã xử lý"] as const;

export const scenarios: readonly DemoScenario[] = [
  {
    id: "disclosure",
    title: "Lộ bản ghi ngoài phạm vi",
    request: "Xem yêu cầu của nhóm A.",
    defense: "Ràng buộc phạm vi theo phiên đăng nhập và chỉ trả các trường cần hiển thị.",
    insufficient: { status: 200, summary: "Phản hồi chứa 3 bản ghi, trong đó có 2 bản ghi của nhóm B.", rows: tickets },
    protected: { status: 200, summary: "Phản hồi chỉ chứa 1 bản ghi của nhóm A.", rows: [tickets[0]] }
  },
  {
    id: "targeted-update",
    title: "Sửa bản ghi ngoài phạm vi",
    request: "Đóng yêu cầu M-01 của nhóm A.",
    defense: "Kiểm tra quyền trên từng bản ghi và cố định phạm vi cập nhật.",
    before: tickets,
    insufficient: { status: 200, summary: "1 bản ghi bị sửa, nhưng đó là M-02 của nhóm B.", rows: [tickets[0], ["M-02", "Nhóm B · Đã xử lý"], tickets[2]] },
    protected: { status: 200, summary: "Chỉ M-01 được cập nhật.", rows: [updated, tickets[1], tickets[2]] }
  },
  {
    id: "bulk-update",
    title: "Sửa hàng loạt ngoài dự kiến",
    request: "Đóng duy nhất yêu cầu M-01.",
    defense: "Dùng điều kiện cố định theo mã và quyền sở hữu. Kiểm tra số hàng bị ảnh hưởng trước khi xác nhận giao dịch.",
    before: tickets,
    insufficient: { status: 200, summary: "3 bản ghi bị sửa.", rows: [updated, ["M-02", "Nhóm B · Đã xử lý"], ["M-03", "Nhóm B · Đã xử lý"]] },
    protected: { status: 200, summary: "Chỉ 1 bản ghi bị sửa.", rows: [updated, tickets[1], tickets[2]] }
  },
  {
    id: "bulk-delete",
    title: "Xóa nhiều bản ghi",
    request: "Xóa duy nhất yêu cầu M-01.",
    defense: "Giới hạn thao tác theo quyền và mã bản ghi. Dùng giao dịch để có thể hủy khi số hàng bị ảnh hưởng vượt dự kiến.",
    before: tickets,
    insufficient: { status: 200, summary: "3 bản ghi bị xóa.", rows: [] },
    protected: { status: 200, summary: "1 bản ghi bị xóa, 2 bản ghi còn lại.", rows: [tickets[1], tickets[2]] }
  },
  {
    id: "table-loss",
    title: "Mất cả bảng hoặc bộ sưu tập",
    request: "Đọc danh sách yêu cầu mẫu.",
    defense: "Dành quyền quản lý lược đồ cho tài khoản riêng. Tài khoản chạy ứng dụng chỉ có quyền dữ liệu cần thiết.",
    before: tickets,
    insufficient: { status: 503, summary: "Lần đọc tiếp theo thất bại vì bảng hoặc bộ sưu tập minh họa đã mất." },
    protected: { status: 200, summary: "Bảng hoặc bộ sưu tập vẫn sẵn sàng và trả 3 bản ghi.", rows: tickets }
  },
  {
    id: "privilege",
    title: "Thay đổi quyền qua cập nhật dữ liệu",
    request: "Đổi tên hiển thị của tài khoản mẫu.",
    defense: "Chỉ nhận các trường hồ sơ được phép. Luồng đổi vai trò cần kiểm tra quyền riêng ở máy chủ.",
    before: [["U-01", "Tên cũ · Sinh viên"]],
    insufficient: { status: 200, summary: "Tên và vai trò đều thay đổi. Tài khoản mẫu có quyền quản trị.", rows: [["U-01", "Tên mới · Quản trị"]] },
    protected: { status: 200, summary: "Chỉ tên hiển thị thay đổi.", rows: [["U-01", "Tên mới · Sinh viên"]] }
  },
  {
    id: "error-details",
    title: "Lộ chi tiết qua thông báo lỗi",
    request: "Gửi một giá trị có định dạng không hợp lệ.",
    defense: "Trả lỗi ngắn gọn cho người dùng. Lưu chi tiết cần thiết trong nhật ký giới hạn quyền truy cập.",
    insufficient: { status: 400, summary: "Thông báo để lộ tên bảng và trường nội bộ trong ví dụ giả định." },
    protected: { status: 400, summary: "Thông báo chỉ cho biết dữ liệu gửi lên không hợp lệ." }
  },
  {
    id: "response-difference",
    title: "Rò rỉ qua phản hồi khác nhau",
    request: "So sánh phản hồi cho hai trường hợp giả định.",
    defense: "Giữ các phản hồi công khai nhất quán khi khác biệt có thể tiết lộ thông tin cần bảo vệ.",
    insufficient: { status: 200, summary: "Hai phản hồi khác nhau có thể tiết lộ một thuộc tính dù không trả giá trị đó.", rows: [["Trường hợp A", "Có kết quả"], ["Trường hợp B", "Không có kết quả"]] },
    protected: { status: 200, summary: "Hai phản hồi có cùng thông báo công khai.", rows: [["Trường hợp A", "Đã xử lý yêu cầu"], ["Trường hợp B", "Đã xử lý yêu cầu"]] }
  },
  {
    id: "authentication",
    title: "Xác thực và mật khẩu sai",
    request: "Yêu cầu đăng nhập với mật khẩu không đúng.",
    defense: "Tìm tài khoản bằng truy vấn có ràng buộc và kiểm tra mật khẩu độc lập. Mật khẩu hợp lệ vẫn đăng nhập được.",
    insufficient: { status: 200, summary: "Ứng dụng giả định cấp phiên dù thông tin đăng nhập không hợp lệ." },
    protected: { status: 401, summary: "Máy chủ từ chối đăng nhập và không cấp phiên." }
  },
  {
    id: "mongo-types",
    title: "Kiểu dữ liệu trong xác thực MongoDB",
    request: "So sánh object, chuỗi JSON, mảng, null, số và mật khẩu đúng.",
    defense: "Chỉ nhận mật khẩu dạng chuỗi. Từ chối kiểu sai trước bước tìm thông tin xác thực.",
    insufficient: { status: 200, summary: "Trong ví dụ giả định, object được hiểu là điều kiện truy vấn và ứng dụng cấp phiên." },
    protected: { status: 400, summary: "Object, mảng, null và số bị chặn trước truy vấn. Chuỗi JSON sai trả 401, còn mật khẩu đúng trả 200." }
  },
  {
    id: "ticket-ownership",
    title: "Quyền xem yêu cầu của sinh viên",
    request: "Sinh viên nhóm A mở yêu cầu của mình, rồi so sánh với yêu cầu thuộc nhóm B.",
    defense: "Kiểm tra quyền sở hữu trên máy chủ cho từng yêu cầu.",
    insufficient: { status: 200, summary: "Ví dụ thiếu kiểm tra quyền trả cả yêu cầu của nhóm B.", rows: [tickets[1]] },
    protected: { status: 403, summary: "Yêu cầu của nhóm B bị từ chối. Yêu cầu do chính sinh viên sở hữu vẫn trả HTTP 200." }
  },
  {
    id: "role-boundaries",
    title: "Hành động bị cấm và trường vai trò",
    request: "So sánh quyền đổi trạng thái, tạo tài khoản và cập nhật hồ sơ của sinh viên.",
    defense: "Kiểm tra vai trò trên máy chủ và chỉ nhận các trường hồ sơ được phép.",
    insufficient: { status: 200, summary: "Ví dụ thiếu kiểm tra cho phép một thao tác dành cho quản trị viên hoặc chấp nhận thay đổi vai trò trong hồ sơ." },
    protected: {
      status: 403, summary: "Vai trò sinh viên được giữ nguyên.",
      rows: [["Đổi trạng thái xử lý", "HTTP 403"], ["Tạo tài khoản quản trị", "HTTP 403"], ["Đổi vai trò qua hồ sơ", "HTTP 400"]]
    }
  },
  {
    id: "session-boundaries",
    title: "Tách phiên, đăng xuất và khóa tài khoản",
    request: "So sánh việc đọc hồ sơ ở phiên bản khác, sau khi đăng xuất và trong lúc tài khoản bị khóa.",
    defense: "Tách cookie theo phiên bản, hủy phiên khi đăng xuất và kiểm tra trạng thái tài khoản khi đọc dữ liệu.",
    insufficient: { status: 200, summary: "Ví dụ thiếu kiểm tra vẫn chấp nhận một phiên cũ hoặc không thuộc phiên bản hiện tại." },
    protected: {
      status: 401, summary: "Máy chủ yêu cầu phiên còn hiệu lực của phiên bản hiện tại và một tài khoản đang hoạt động.",
      rows: [["Mở phiên bản khác", "HTTP 401"], ["Sau khi đăng xuất", "HTTP 401"], ["Trong lúc tài khoản bị khóa", "HTTP 401"]]
    }
  },
  {
    id: "legitimate-apostrophe",
    title: "Dữ liệu hợp lệ có dấu nháy",
    request: "Lưu và mở lại yêu cầu có tiêu đề Yêu cầu của O'Connor.",
    defense: "Truyền dữ liệu qua tham số hoặc trường dữ liệu cố định để giữ nguyên dấu nháy.",
    insufficient: { status: 400, summary: "Ví dụ lọc ký tự quá mức từ chối một tiêu đề hợp lệ." },
    protected: { status: 201, summary: "Lưu thành công và đọc lại được nguyên văn.", rows: [["Tiêu đề", "Yêu cầu của O'Connor"]] }
  }
];

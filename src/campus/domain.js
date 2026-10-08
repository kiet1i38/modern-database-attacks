import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../modules/auth/password.js";

export const VARIANTS = {
  "sql-unsafe": { database: "MySQL", safe: false, port: 3001 },
  "sql-safe": { database: "MySQL", safe: true, port: 3002 },
  "mongo-unsafe": { database: "MongoDB", safe: false, port: 3003 },
  "mongo-safe": { database: "MongoDB", safe: true, port: 3004 }
};
export const STATUSES = ["open", "in_progress", "resolved"];
export const PRIORITIES = ["low", "medium", "high"];
export const SQL_PAYLOADS = [
  { id: "tautology", label: "OR luôn đúng", username: "admin", password: "' OR '1'='1' -- " },
  { id: "comment", label: "Comment điều kiện mật khẩu", username: "admin' -- ", password: "not-the-password" },
  { id: "hash-comment", label: "OR và comment #", username: "admin", password: "' OR 1=1 #" },
  { id: "target-admin", label: "Điều kiện nhắm role admin", username: "' OR role = 'admin' -- ", password: "not-the-password" }
];
export const MONGO_PAYLOADS = [
  { id: "gt", label: "$gt — lớn hơn chuỗi rỗng", password: { $gt: "" } },
  { id: "gte", label: "$gte — lớn hơn hoặc bằng", password: { $gte: "" } },
  { id: "ne", label: "$ne — khác mật khẩu sai", password: { $ne: "not-the-password" } },
  { id: "regex", label: "$regex — khớp chuỗi", password: { $regex: ".*" } },
  { id: "nin", label: "$nin — không nằm trong danh sách", password: { $nin: ["not-the-password"] } },
  { id: "exists", label: "$exists — trường có tồn tại", password: { $exists: true } }
];
export function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
export function textField(value, label, max = 120, min = 1) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw fail(400, "INVALID_INPUT", label + " phải là chuỗi từ " + min + " đến " + max + " ký tự.");
  }
  return value.trim();
}
export function loginInput(body, variant) {
  if (!body || Array.isArray(body) || typeof body !== "object" ||
      Object.keys(body).some(key => !["username", "password"].includes(key))) {
    throw fail(400, "INVALID_INPUT", "Chỉ nhận username và password.");
  }
  // Do not trim login strings: trailing spaces are material to MySQL -- comments.
  textField(body.username, "Username", 120);
  const password = body.password;
  if (typeof password === "string") {
    textField(password, "Mật khẩu", 256);
  } else if (variant !== "mongo-unsafe" || !password || Array.isArray(password)) {
    throw fail(400, "INVALID_INPUT", "Mật khẩu phải là chuỗi; object không được dùng làm điều kiện xác thực.");
  } else {
    // Bound the teaching surface without removing the intentional operator-injection defect.
    const entries = Object.entries(password);
    const [key, value] = entries[0] || [];
    const valid = entries.length === 1 && (
      (["$gt", "$gte", "$ne"].includes(key) && typeof value === "string" && value.length <= 120) ||
      (key === "$regex" && value === ".*") ||
      (key === "$nin" && Array.isArray(value) && value.length <= 5 && value.every(v => typeof v === "string" && v.length <= 120)) ||
      (key === "$exists" && typeof value === "boolean")
    );
    if (!valid) throw fail(400, "INVALID_INPUT", "Lab chỉ nhận sáu toán tử trong bộ demo.");
  }
  return { username: body.username, password };
}
export function publicUser(user) {
  if (!user) return null;
  const { id, username, name, role, email, department, active } = user;
  return { id, username, name, role, email, department, active: Boolean(active) };
}
export function diagnostic(variant, input, success) {
  const sql = variant.startsWith("sql");
  const safe = VARIANTS[variant].safe;
  const recognized = sql
    ? SQL_PAYLOADS.find(p => p.username === input.username && p.password === input.password)
    : MONGO_PAYLOADS.find(p => JSON.stringify(p.password) === JSON.stringify(input.password));
  return {
    variant, success, payload: recognized?.id || (typeof input.password === "object" ? "operator" : "normal"),
    inputType: typeof input.password,
    request: { username: recognized ? input.username : "[redacted]", password: recognized ? input.password : "[redacted]" },
    queryTemplate: sql
      ? (safe ? "SELECT * FROM users WHERE username = ?; verifyPassword(password, passwordHash)" : "SELECT * FROM users WHERE username = '<input>' AND password = '<input>'\nORDER BY role ASC, username ASC LIMIT 1")
      : (safe ? "findOne({ username: <validated string> }); verifyPassword(password, passwordHash)" : "findOne({ username: <input>, password: <input> })"),
    explanation: safe
      ? "Input không được diễn giải thành điều kiện truy vấn; mật khẩu được xác minh bằng scrypt."
      : "Input thay đổi điều kiện truy vấn. Đây là lỗi xác thực cố ý của bản lab."
  };
}
export function ticketInput(body) {
  const title = textField(body?.title, "Tiêu đề", 160, 3);
  const description = textField(body?.description, "Nội dung", 3000, 10);
  const category = body?.category || "academic";
  const priority = body?.priority || "medium";
  if (!["academic", "it", "facilities", "other"].includes(category) || !PRIORITIES.includes(priority)) {
    throw fail(400, "INVALID_INPUT", "Danh mục hoặc mức ưu tiên không hợp lệ.");
  }
  return { title, description, category, priority };
}
export function makeTicket(ownerId, input) {
  const id = randomUUID();
  return { id, code: "CD-" + id.slice(0, 6).toUpperCase(), ownerId, ...input, status: "open", createdAt: Date.now(), updatedAt: Date.now() };
}
export function seedData(safe) {
  const credentials = [
    ["admin-001", "admin", "Campus Admin", "admin", "Admin@123"],
    ["user-001", "student", "Nguyễn Minh Anh", "user", "Student@123"],
    ["user-002", "student2", "Trần Gia Bảo", "user", "Student2@123"]
  ];
  const users = credentials.map(([id, username, name, role, password]) => ({
    id, username, name, role, email: username + "@campus.example", department: role === "admin" ? "Phòng hỗ trợ" : "Công nghệ thông tin",
    active: true, password: safe ? null : password, passwordHash: safe ? hashPassword(password) : null
  }));
  const titles = ["Không truy cập được cổng học tập", "Cập nhật lịch thi học kỳ", "Wifi phòng tự học không ổn định", "Xác nhận học phí", "Đăng ký phòng thực hành", "Cấp lại thẻ sinh viên", "Lỗi tải tài liệu môn học", "Mượn thiết bị trình chiếu", "Kiểm tra điểm chuyên cần", "Đổi lịch tư vấn học tập", "Máy tính phòng B203", "Yêu cầu giấy xác nhận"];
  const tickets = titles.map((title, i) => ({
    ...makeTicket(i % 3 === 0 ? "user-002" : "user-001", { title, description: "Yêu cầu hỗ trợ mẫu: " + title + ". Nhờ phòng hỗ trợ kiểm tra và phản hồi giúp em.", category: ["academic", "it", "facilities"][i % 3], priority: PRIORITIES[i % 3] }),
    id: "ticket-" + String(i + 1).padStart(3, "0"), code: "CD-" + (1001 + i), status: STATUSES[i % 3],
    createdAt: Date.now() - (i + 1) * 86400000, updatedAt: Date.now() - i * 43200000
  }));
  return { users, tickets };
}
export { hashPassword, verifyPassword };

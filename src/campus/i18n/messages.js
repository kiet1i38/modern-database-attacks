const catalogs = {
  vi: {
    "errors.generic": "Không thể thực hiện thao tác.",
    "errors.invalidCredentials": "Tên đăng nhập hoặc mật khẩu không đúng.",
    "errors.csrfOrigin": "Origin không hợp lệ.",
    "errors.csrfToken": "Phiên đã thay đổi. Vui lòng tải lại trang.",
    "errors.rateLimit": "Quá nhiều lần đăng nhập. Thử lại sau một phút.",
    "errors.sqlSyntax": "Payload làm câu SQL sai cú pháp.",
    "errors.unauthenticated": "Vui lòng đăng nhập.",
    "errors.adminOnly": "Chỉ admin được thực hiện thao tác này.",
    "errors.ticketNotFound": "Không tìm thấy yêu cầu.",
    "errors.accountNotFound": "Không tìm thấy tài khoản.",
    "errors.forbiddenOwnership": "Bạn không có quyền xem yêu cầu này.",
    "errors.invalidStatusPriority": "Trạng thái hoặc ưu tiên không hợp lệ.",
    "errors.invalidUsername": "Username chỉ nhận chữ, số, dấu chấm, gạch ngang.",
    "errors.invalidRole": "Role không hợp lệ.",
    "errors.duplicateUser": "Username đã tồn tại.",
    "errors.selfLock": "Không được khóa tài khoản đang sử dụng.",
    "errors.activeBoolean": "Chỉ nhận active kiểu boolean.",
    "errors.profileImmutable": "Không được thay đổi role/id qua hồ sơ.",
    "errors.invalidEmail": "Email không hợp lệ.",
    "errors.invalidInput": "Dữ liệu gửi lên không hợp lệ.",
    "errors.invalidJson": "JSON gửi lên không hợp lệ.",
    "errors.databaseUnavailable": "Database tạm thời không khả dụng. Vui lòng thử lại.",
    "errors.apiNotFound": "API không tồn tại.",
    "errors.fieldLength": "Giá trị phải là chuỗi từ {{min}} đến {{max}} ký tự.",
    "errors.usernameAndPasswordOnly": "Chỉ nhận username và password.",
    "errors.passwordMustBeString": "Mật khẩu phải là chuỗi; object không được dùng làm điều kiện xác thực.",
    "errors.demoOperatorsOnly": "Lab chỉ nhận sáu toán tử trong bộ demo.",
    "errors.invalidCategoryPriority": "Danh mục hoặc mức ưu tiên không hợp lệ.",
    "lab.safeExplanation": "Truy vấn chỉ tìm username; mật khẩu được xác minh riêng bằng scrypt.",
    "lab.unsafeSqlExplanation": "Bản unsafe ghép input vào câu SQL. Chuỗi payload có thể thay đổi cú pháp và điều kiện truy vấn để bỏ qua kiểm tra mật khẩu.",
    "lab.unsafeMongoExplanation": "Bản unsafe đưa trực tiếp input vào truy vấn. Object toán tử có thể thay điều kiện so sánh mật khẩu; chuỗi thông thường vẫn được so sánh như giá trị.",
    "lab.rejectedExplanation": "Validation chặn request trước truy vấn xác thực. Session và audit vẫn có thể dùng database."
  },
  en: {
    "errors.generic": "The operation could not be completed.",
    "errors.invalidCredentials": "Invalid username or password.",
    "errors.csrfOrigin": "The request origin is invalid.",
    "errors.csrfToken": "Your session changed. Reload the page and try again.",
    "errors.rateLimit": "Too many sign-in attempts. Try again in one minute.",
    "errors.sqlSyntax": "The payload made the SQL statement invalid.",
    "errors.unauthenticated": "Please sign in.",
    "errors.adminOnly": "Only an administrator can perform this action.",
    "errors.ticketNotFound": "Request not found.",
    "errors.accountNotFound": "Account not found.",
    "errors.forbiddenOwnership": "You do not have permission to view this request.",
    "errors.invalidStatusPriority": "The status or priority is invalid.",
    "errors.invalidUsername": "Usernames may contain letters, numbers, periods, underscores, and hyphens only.",
    "errors.invalidRole": "The role is invalid.",
    "errors.duplicateUser": "That username already exists.",
    "errors.selfLock": "You cannot lock the account you are currently using.",
    "errors.activeBoolean": "The active field must be a boolean.",
    "errors.profileImmutable": "Role and ID cannot be changed through the profile.",
    "errors.invalidEmail": "The email address is invalid.",
    "errors.invalidInput": "The submitted data is invalid.",
    "errors.invalidJson": "The submitted JSON is invalid.",
    "errors.databaseUnavailable": "The database is temporarily unavailable. Please try again.",
    "errors.apiNotFound": "API route not found.",
    "errors.fieldLength": "The value must be a string between {{min}} and {{max}} characters long.",
    "errors.usernameAndPasswordOnly": "Only username and password are accepted.",
    "errors.passwordMustBeString": "Password must be a string; an object cannot be used as an authentication condition.",
    "errors.demoOperatorsOnly": "The lab accepts only the six operators in its demo set.",
    "errors.invalidCategoryPriority": "The category or priority is invalid.",
    "lab.safeExplanation": "The query only finds the username; the password is independently verified with scrypt.",
    "lab.unsafeSqlExplanation": "The unsafe variant concatenates input into SQL. A payload string can alter the syntax and query condition to bypass password verification.",
    "lab.unsafeMongoExplanation": "The unsafe variant passes input directly into the query. An operator object can replace the password comparison; ordinary strings are still compared as values.",
    "lab.rejectedExplanation": "Validation blocked the request before the authentication query. The session and audit log may still use the database."
  }
};

export const apiMessageKeys = Object.freeze(Object.keys(catalogs.en));

export function translateApiMessage(key, locale = "vi", params = {}) {
  const catalog = catalogs[locale] || catalogs.vi;
  const fallback = locale === "en" ? catalogs.en["errors.generic"] : catalogs.vi["errors.generic"];
  const template = catalog[key] || fallback;
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (token, name) => {
    const value = params[name];
    return typeof value === "string" || typeof value === "number" ? String(value) : token;
  });
}

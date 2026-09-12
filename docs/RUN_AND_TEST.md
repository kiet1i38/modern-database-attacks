# Hướng dẫn chạy, truy cập và kiểm thử

Tài liệu này hướng dẫn chạy project bằng Docker, truy cập giao diện, kiểm thử API/UI và xử lý các lỗi thường gặp.

> Chỉ dùng dữ liệu synthetic trong máy local. Không dùng project này với tài khoản, database hoặc hệ thống của người khác.

## 1. Yêu cầu

- Docker Desktop đang chạy.
- Docker Compose v2.
- Node.js 20+ và npm nếu muốn chạy lệnh kiểm tra ngoài container.
- Windows PowerShell hoặc terminal tương đương.

Kiểm tra nhanh:

```powershell
docker --version
docker compose version
node --version
npm --version
```

## 2. Chạy chế độ secure mặc định

Từ thư mục gốc project:

```powershell
docker compose up --build -d
docker compose run --rm app node scripts/seed.js
docker compose ps
```

`seed.js` tạo user synthetic cho secure route. Lệnh seed có thể chạy lại nhiều lần.

Kết quả mong đợi trong `docker compose ps`:

- `modern-database-attacks-mongodb`: `healthy`.
- `modern-database-attacks-app`: `Up`.
- App được publish tại `127.0.0.1:3000`.

## 3. Truy cập project

Mở trình duyệt tại:

```text
http://127.0.0.1:3000
```

Các URL API chính:

| Mục đích | URL |
| --- | --- |
| Health HTTP + MongoDB | `http://127.0.0.1:3000/api/health` |
| Trạng thái lab | `http://127.0.0.1:3000/api/lab/status` |
| Secure login | `POST http://127.0.0.1:3000/api/auth/login` |
| Logout placeholder | `POST http://127.0.0.1:3000/api/auth/logout` |
| Lab observation | `POST http://127.0.0.1:3000/api/lab/login-observation` |

Credentials synthetic:

| Route | Username | Password |
| --- | --- | --- |
| Secure | `alice` | `synthetic-demo-password` |
| Lab string | `alice` | `lab-only-demo-password` |

## 4. Bật chế độ lab

Lab route chỉ được bật khi `LAB_MODE=true`, `NODE_ENV` không phải production và request đến từ loopback.

```powershell
docker compose down
docker compose -f docker-compose.yml -f docker-compose.lab.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.lab.yml run --rm app node scripts/seed.js --lab
```

Sau đó mở lại `http://127.0.0.1:3000`, chọn `Local lab observation`.

Hai payload trên giao diện:

- Assignment-shaped: `{"gt":""}` — thường trả `401`.
- MongoDB operator: `{"$gt":""}` — trong MongoDB lab hiện tại trả `200` và `authenticated: true`.

Đây chỉ là kết quả của database local hiện tại, không phải kết luận cho mọi hệ thống MongoDB.

## 5. Kiểm thử tự động trong Docker

Dockerfile là runtime image nên không copy thư mục `tests`. Mount thư mục test ở chế độ read-only khi chạy test:

```powershell
$repo = (Get-Location).Path
docker compose run --rm -v "${repo}\tests:/app/tests:ro" app npm run test:all
```

Nếu đang chạy lab override, dùng đầy đủ các file Compose:

```powershell
$repo = (Get-Location).Path
docker compose -f docker-compose.yml -f docker-compose.lab.yml run --rm -v "${repo}\tests:/app/tests:ro" app npm run test:all
```

Kết quả baseline đã xác nhận:

- Unit + security-boundary: `11/11 pass`.
- MongoDB integration: `1/1 pass`.
- Tổng cộng: `12/12 pass`.

Kiểm tra dependency:

```powershell
docker compose run --rm app npm audit --omit=dev --audit-level=moderate
```

## 6. Kiểm thử API thủ công

Trong PowerShell, dùng `curl.exe` để tránh alias `curl` của PowerShell:

```powershell
# Health
curl.exe -i http://127.0.0.1:3000/api/health

# Secure login đúng: 200
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"synthetic-demo-password"}'

# Sai password: 401
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"wrong-password"}'

# Secure route phải chặn object: 400
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":{"$gt":""}}'

# Lab operator object: chạy khi đã bật lab, thường 200 trong môi trường này
curl.exe -i -X POST http://127.0.0.1:3000/api/lab/login-observation `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":{"$gt":""}}'

# JSON hỏng: 400 INVALID_JSON
curl.exe -i -X POST http://127.0.0.1:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice"'
```

Ma trận kết quả quan trọng:

| Case | Kỳ vọng |
| --- | --- |
| Secure đúng username/password | `200` |
| Secure sai hoặc user không tồn tại | `401` |
| Secure password là object/array/number/null | `400` |
| Secure có field thừa | `400` |
| Lab đang tắt | `404 LAB_DISABLED` |
| Lab request từ container/địa chỉ không loopback | `403 LAB_LOCAL_ONLY` |
| MongoDB không chạy | Health `503`, `database: down` |
| Body vượt `16kb` | `413` |

## 7. Kiểm thử giao diện như người dùng

1. Mở `http://127.0.0.1:3000`.
2. Xác nhận badge hiển thị `HTTP and MongoDB are ready.`.
3. Chọn `Secure comparison`, dùng `alice` và password secure, bấm Submit; kết quả phải là HTTP `200`.
4. Nhập sai password; kết quả phải là HTTP `401`.
5. Chuyển sang `Local lab observation`; password input được thay bằng dropdown payload.
6. Gửi variant `{"gt":""}` rồi `{"$gt":""}`; kiểm tra request hiển thị là object, không phải escaped string.
7. Sau mỗi lần submit, password field phải được xóa.
8. Thu nhỏ cửa sổ khoảng `375x812` để kiểm tra layout mobile.

Có thể dùng Playwright CLI:

```powershell
npx --yes --package @playwright/cli playwright-cli open http://127.0.0.1:3000 --headed
npx --yes --package @playwright/cli playwright-cli snapshot
```

Luôn snapshot lại sau navigation, đổi mode hoặc thao tác làm DOM thay đổi.

## 8. Cố ý tạo lỗi để kiểm tra recovery

### MongoDB dừng

```powershell
docker stop modern-database-attacks-mongodb
curl.exe -i http://127.0.0.1:3000/api/health
docker start modern-database-attacks-mongodb
```

Kỳ vọng:

- Khi Mongo dừng: HTTP `503`, `database: down`.
- Giao diện báo MongoDB unavailable.
- Sau khi start lại, health và secure login trở lại bình thường.

### App restart

```powershell
docker restart modern-database-attacks-app
docker compose ps
```

Sau restart, kiểm tra lại `/api/health` và login. Dữ liệu trong volume phải còn nguyên.

### Kiểm tra lab production guard

Không chạy seed bằng production:

```powershell
docker compose run --rm -e NODE_ENV=production app node scripts/seed.js
```

Lệnh này phải thất bại với thông báo từ chối seed production. Không bỏ qua lỗi này.

## 9. Lỗi port MongoDB 27017

Nếu gặp:

```text
ports are not available ... 127.0.0.1:27017
```

Kiểm tra process đang giữ port, không tự ý kill process không xác định:

```powershell
Get-NetTCPConnection -LocalPort 27017 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Nếu port thuộc MongoDB native mà bạn không muốn dừng, tạo file local-only `docker-compose.local.yml` ở thư mục gốc:

```yaml
services:
  mongodb:
    ports: !override
      - "127.0.0.1:27018:27017"
```

Chạy Compose với file này:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.local.yml run --rm app node scripts/seed.js
```

Muốn bật lab thì thêm `-f docker-compose.lab.yml` vào cuối mỗi lệnh. App vẫn kết nối Mongo qua network Docker tại `mongodb:27017`; chỉ cổng host đổi thành `27018`.

File local override không nên commit. Nếu Compose cũ không hỗ trợ tag `!override`, hãy giải phóng port bằng process thuộc quyền quản lý của bạn hoặc đổi port tạm thời trong override theo tài liệu Compose đang dùng.

## 10. Xem log và chẩn đoán

```powershell
docker compose ps
docker compose logs --tail=100 app
docker compose logs --tail=100 mongodb
docker inspect modern-database-attacks-mongodb
```

Không expose MongoDB ra Internet. Compose hiện publish MongoDB và app trên loopback (`127.0.0.1`).

## 11. Cleanup và reset database

Dừng app/Mongo nhưng giữ volume:

```powershell
docker compose down
```

Xóa cả volume database disposable chỉ khi chắc chắn đây là volume của project:

```powershell
docker compose down -v
```

Reset bằng script cũng cần cờ bảo vệ:

```powershell
docker compose run --rm -e ALLOW_LOCAL_RESET=true app node scripts/reset-db.js
```

Không chạy reset trên production hoặc database thật.

## 12. Baseline và giới hạn hiện tại

Baseline Docker/browser đã kiểm tra:

- Docker build pass với Node 20 và MongoDB 7.0.16.
- `12/12` automated tests pass.
- Secure/lab API và UI flow chính pass.
- MongoDB stop/start và app restart recovery pass.

Các điểm còn cần biết:

- `/favicon.ico` hiện trả `404`, tạo một console error nhỏ khi load mới.
- `npm audit` hiện báo `2 moderate vulnerabilities` qua Express/`qs`.
- Runtime image mặc định chạy bằng root; cần harden trước production.
- Project không tạo persistent session; `authenticated: true` chỉ là marker của lab demo.

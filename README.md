# TFT Updater

TFT Updater theo dõi bản cập nhật **Đấu Trường Chân Lý (Teamfight Tactics)**. Ứng dụng giúp bạn tra cứu lịch sử bản vá, xem tướng và trang bị, so sánh thay đổi giữa các phiên bản và khám phá đội hình theo nguồn dữ liệu.

## Tính năng

| Trang | Công dụng |
| --- | --- |
| `/history` và `/timeline` | Xem các mốc bản vá Live và PBE, ghi chú và nguồn tham chiếu. |
| `/champions` và `/items` | Tra cứu tướng và trang bị. |
| `/compare` | Đối chiếu chỉ số và kỹ năng khi có dữ liệu của cả hai phiên bản. Với bản chỉ có ghi chú, xem các thay đổi được nguồn ghi nhận. |
| `/meta/websites` và `/meta/elite` | Xem đội hình và bảng xếp hạng khi nguồn có dữ liệu đủ điều kiện. |
| `/data-status` | Kiểm tra trạng thái thu thập và các phần còn thiếu dữ liệu. |

## Cài đặt và chạy

Cần Node.js 24 và pnpm `12.3.4`. Cấu hình mặc định dùng **PGlite**, một cơ sở dữ liệu PostgreSQL nhúng chạy trên máy của bạn.

```sh
git clone https://github.com/vinhvt619/TFT-updater.git
cd TFT-updater
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000). Cơ sở dữ liệu mới có thể chưa có bản vá, đội hình hoặc snapshot để so sánh. Hãy chạy lệnh thu thập bên dưới để nạp dữ liệu theo nguồn.

## Thu thập dữ liệu

```sh
# Nạp các bài ghi chú Riot đã lưu cùng mã nguồn
pnpm patches:sync

# Kiểm tra nguồn trước khi lấy dữ liệu gameplay Live
pnpm source:audit --source cdragon-live
pnpm ingest:once --source cdragon-live
```

Ghi chú bản vá mô tả thay đổi do Riot công bố. So sánh gameplay cần snapshot chỉ số và kỹ năng cho từng phiên bản. Số bản vá, độ mới và phạm vi xếp hạng phụ thuộc dữ liệu nguồn mà dự án thu thập được. Khi thiếu bằng chứng, giao diện hiển thị trạng thái chờ hoặc dữ liệu chưa có.

Các nguồn gameplay được cấu hình trong [`config/sources.json`](config/sources.json). Có thể sao chép `.env.example` thành `.env` để cấu hình riêng. Lưu khóa Riot và bí mật HMAC trong môi trường cục bộ. Xem [cách chạy worker](docs/operations/persistent-worker.md) và [cấu hình Riot API cho Elite](docs/RIOT_ELITE_OPERATIONS.md).

## Phát triển

```sh
pnpm lint
pnpm typecheck
pnpm test:all
pnpm build
```

Dự án dùng Next.js, TypeScript và Drizzle ORM. Phần nghiệp vụ nằm trong `src/domain`, thu thập và chuẩn hóa trong `src/ingestion`, API và lưu trữ trong `src/server` và `src/app/api`. Xem [kiến trúc ứng dụng](docs/ARCHITECTURE.md) và [cách tính điểm đội hình](docs/META_RANKING_METHOD.md).

## Tài nguyên trò chơi

Đây là dự án cộng đồng dành cho người chơi Đấu Trường Chân Lý. Tên trò chơi, hình ảnh và tài nguyên liên quan thuộc về chủ sở hữu tương ứng.

# Kiến trúc Hệ thống (Architecture Overview)

Hệ thống: **TFT 18 Change Tracker**  
Phiên bản tài liệu: 1.0.0

---

## 1. Mô hình Phân lớp (Layered Architecture)

```text
Nguồn bên ngoài (CDragon / Patch Notes)
                  │
      [Worker + Source Adapters]
                  │
      [Kho File Gốc Bất Biến (Raw Storage)]
                  │
      [Chuẩn hóa & Kiểm định (Zod Contracts)]
                  │
      [PostgreSQL 17 / PGlite Fallback]
                  │
      [Dịch vụ Đọc & Bộ So sánh Thuần (Diff Engine)]
                  │
      [Next.js App Router (Server & Client Components)]
                  │
             Trình duyệt
```

---

## 2. Các Thành phần Cốt lõi

### 2.1. Domain Layer (`src/domain/`)
- **Độc lập hoàn toàn:** Không phụ thuộc framework web, React hay database.
- **Hợp đồng dữ liệu:** `types.ts` và `schemas.ts` đảm bảo tính toàn vẹn của dữ liệu tướng, chỉ số theo cấp sao và dẫn nguồn (evidence).
- **Bộ so sánh (`compare.ts`):** Tính toán chênh lệch tuyệt đối, phần trăm tương đối, điểm phần trăm và đánh giá tác động buff/nerf dựa trên `field-registry.ts`.

### 2.2. Database & Storage Layer (`src/server/`)
- **Dual Database Engine:** Hỗ trợ kết nối PostgreSQL tiêu chuẩn qua `DATABASE_URL` khi chạy production/Docker, đồng thời tự động kích hoạt PGlite (WASM Postgres engine) khi chạy độc lập cục bộ mà không cần Docker.
- **Raw Storage:** Lưu trữ byte gốc của mọi payload tải về định danh theo mã SHA-256 bất biến (`storage/raw/sha256/..`).
- **Diff Cache:** Lưu bộ đệm kết quả so sánh theo cặp `(fromSnapshotId, toSnapshotId, diffEngineVersion)`.

### 2.3. Web & Presentation Layer (`src/app/`)
- Next.js 15 App Router với Tailwind CSS và dark modern UI.
- URL query parameters đóng vai trò là "Single Source of Truth" cho toàn bộ bộ lọc và phiên bản so sánh, cho phép chia sẻ liên kết trực tiếp.
- Phân biệt rõ dữ liệu demo với banner cảnh báo cố định.

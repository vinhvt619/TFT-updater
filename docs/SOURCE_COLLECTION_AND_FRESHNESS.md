# Source collection và freshness

Website board nhận dữ liệu từ năm source độc lập: MetaTFT, TFT Academy, TFTFlex,
DataTFT và Tactics.Tools. Collector lưu source URL, raw response content-addressed,
SHA-256, receipt, thời điểm fetch và `sourceDataAsOf`. Cache chỉ được dùng khi
chạy cờ offline rõ ràng; cache không được đổi thành online success.

Mỗi observation đi qua canonical registry mapping. `valid`, `quarantined` và
`superseded` được giữ riêng. `qualifiedObservations` và `contributingObservations`
được tính sau mapping/coverage; DataTFT có thể collected/valid nhưng
`qualified=0` mà không bị ép vào consensus. Không có đủ lineage thì row ở trạng
thái `collecting` và không có số liệu bịa.

```powershell
npx tsx scripts/meta/ingest-real-meta-sources.ts --online-required
npx tsx scripts/meta/ingest-real-meta-sources.ts --offline-cache
```

Ranking candidate chỉ được publish khi freshness, coverage, source receipts và
single-build provenance đạt gate. Nếu candidate stale hoặc source lỗi, pointer
last-good vẫn giữ nguyên và API/UI hiển thị tuổi dữ liệu cùng lý do. `mode=real`
không đọc demo cache, fixture hoặc demo pointer.

Trạng thái source được xem tại
`GET /api/v1/meta/sources/status?mode=real` (hoặc `mode=demo`).

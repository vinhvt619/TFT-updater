# Patch epochs và bản cập nhật nhỏ

Patch labels được resolve từ bảng release evidence thay vì hardcode theo một
patch hiện tại. Mỗi main patch, hotfix/mid-patch và PBE revision là một mốc
riêng. Ví dụ timeline có thể chứa `18.1 → 18.1a → 18.1b → 18.2`; parser giữ
`versionKey`, `versionSortKey`, `releaseKind`, `hotfixSuffix` và `pbeRevision`
để sort ổn định. Không gộp hai hotfix vào main patch.

`src/domain/versioning.ts` là nguồn duy nhất cho parse/sort. Alias hiển thị
như `18.1a` chỉ được đánh dấu inferred khi Riot chỉ công bố heading/ngày (ví dụ
`AUGUST 27TH`); alias không biến claim notes thành snapshot số liệu.

Khi không có build hoặc timestamp chứng minh một epoch, ingestion giữ record ở
`collecting`, `notes_only` hoặc `gap`, không gán nó vào epoch kế bên. `notes_only`
không được đưa vào phép tính compare; compare chỉ mở khi cả hai snapshot đã
published và cùng dataset.

## Revision và PBE

Collector `scripts/meta/collect-patch-revisions.ts` deduplicate raw content theo
SHA-256. Hash mới tạo revision mới; một hash đơn lẻ giữ trạng thái
`single_snapshot_no_chain`, không tự dựng revision chain. PBE được gắn build/hash
hoặc revision đã quan sát, không suy ra tên patch tương lai.

```powershell
npm run patches:revisions
npx tsx scripts/meta/collect-patch-revisions.ts --online-required
```

Báo cáo bản vá ghi riêng
`snapshot_available`, `notes_only`, `gap`, raw hash và limitation cho từng mốc.

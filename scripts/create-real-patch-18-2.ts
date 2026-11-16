/**
 * [LỆNH BỊ VÔ HIỆU HÓA] scripts/create-real-patch-18-2.ts
 *
 * Lý do: Dữ liệu công bố phải có nguồn và qua kiểm tra toàn vẹn.
 * Tuyệt đối không nhân bản snapshot hiện tại và áp override để giả lập lịch sử bản cập nhật.
 * Lịch sử bản cập nhật phải được theo dõi qua RiotPatchNotesAdapter và raw payload captures.
 */

export {};

async function main() {
  console.error("================================================================================");
  console.error(" [LỆNH BỊ VÔ HIỆU HÓA] scripts/create-real-patch-18-2.ts đã bị vô hiệu hóa!");
  console.error(" Lý do: Dữ liệu công bố phải có nguồn và qua kiểm tra toàn vẹn.");
  console.error(" Tuyệt đối không nhân bản snapshot hiện tại và áp override để giả lập lịch sử.");
  console.error(" Lịch sử bản cập nhật phải được theo dõi qua RiotPatchNotesAdapter và raw payload captures.");
  console.error("================================================================================");
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

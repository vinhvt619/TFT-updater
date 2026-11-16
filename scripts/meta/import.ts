import fs from "fs";
import { metaRepository } from "../../src/server/meta/repositories/meta-repository";
import { SourceCompObservationSchema } from "../../src/domain/meta/schemas";
import { publicationService } from "../../src/server/services/publication-service";

async function main() {
  const args = process.argv.slice(2);
  let filePath = "";
  let isDryRun = false;
  let datasetKind: "real" | "demo" = "real";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) filePath = args[++i];
    if (args[i] === "--dry-run") isDryRun = true;
    if (args[i] === "--dataset" && args[i + 1]) {
      const val = args[++i];
      if (val === "real" || val === "demo") datasetKind = val;
    }
  }

  if (!filePath) {
    console.error("Vui lòng cung cấp đường dẫn file bằng --file <đường_dẫn>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File không tồn tại: ${filePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(rawData);

  console.log(`[Import] Đọc file ${filePath} (${Array.isArray(parsed) ? parsed.length : 1} bản ghi)...`);

  if (Array.isArray(parsed)) {
    let validCount = 0;
    for (const item of parsed) {
      const check = SourceCompObservationSchema.safeParse(item);
      if (check.success) validCount++;
      else {
        console.warn(`[Import] Record ${item?.id || "unknown"} không hợp lệ:`, check.error.errors[0]?.message);
      }
    }

    console.log(`[Import] Kết quả xác thực schema: ${validCount}/${parsed.length} hợp lệ.`);
    if (validCount === 0) {
      console.error("[Import] Không có bản ghi nào vượt qua schema validation. Dừng lại.");
      process.exit(1);
    }

    if (isDryRun) {
      console.log("[Import] Chế độ --dry-run: Không ghi vào database.");
      process.exit(0);
    }

    // Nếu datasetKind là real, kiểm tra rawArtifactId phải tồn tại
    if (datasetKind === "real") {
      for (const item of parsed) {
        if (!item.rawArtifactId) {
          console.error(`[Import] Lỗi dữ liệu thật: Bản ghi ${item.id} thiếu rawArtifactId bắt buộc!`);
          process.exit(1);
        }
      }
    }

    // Ghi vào database nếu không phải dry-run
    const snapId = `manual_import_${datasetKind}_${Date.now()}`;
    await metaRepository.saveSourceObservations(
      snapId,
      "manual_import",
      { note: `Manual file import (${filePath})` },
      parsed as any,
      datasetKind
    );
    console.log(`[Import] Đã lưu ${validCount} bản ghi thành công với Snapshot ID: ${snapId} (Dataset: ${datasetKind})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Import] Thất bại:", err);
    process.exit(1);
  });

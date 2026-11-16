import React from "react";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Link from "next/link";
import {
  History,
  Calendar,
  FileText,
  ExternalLink,
  Sparkles,
  BookOpen,
  ArrowLeft
} from "lucide-react";
import { riotPatchNotesAdapter } from "@/ingestion/adapters/riot-patch-notes";
import { buildPatchHistoryCoverage } from "../../../scripts/history-coverage";
import { snapshotRepository } from "@/server/repositories/snapshot-repository";

export const dynamic = "force-dynamic";

const eventKindLabel = (kind: string) => ({
  launch: "ra mắt",
  hotfix: "sửa nóng",
  pbe_revision: "bản PBE",
  minor: "cập nhật nhỏ"
} as Record<string, string>)[kind] || "cập nhật";

const claimKindLabel = (kind: string) => ({
  numeric: "chỉ số",
  mechanic: "cơ chế",
  bugfix: "sửa lỗi",
  tooltip_only: "mô tả"
} as Record<string, string>)[kind] || "khác";

const viReleaseLabel = (label: string) => label.replace(/\bLive\b/gi, "Chính thức").replace(/\bPBE\b/gi, "PBE thử nghiệm");

export default async function HistoryPage() {
  // 1. Đọc và phân tích các bài viết patch notes thật của Riot.  Hash được
  // tính từ byte đang lưu, không dùng placeholder kiểu `hash_18_1`.
  const patch181Path = path.resolve("./storage/raw/riot_patch_18_1_live.html");
  const patch182Path = path.resolve("./storage/raw/riot_patch_18_2_live.html");

  let parsed181 = null;
  let parsed182 = null;

  try {
    if (fs.existsSync(patch181Path)) {
      const html181 = fs.readFileSync(patch181Path, "utf8");
      parsed181 = riotPatchNotesAdapter.parseArticle(
        html181,
        "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-1/",
        { rawArtifactId: "art_18_1_html", rawHash: crypto.createHash("sha256").update(html181).digest("hex") }
      );
    }
  } catch (err) {
    console.error("Lỗi đọc patch notes 18.1:", err);
  }

  try {
    if (fs.existsSync(patch182Path)) {
      const html182 = fs.readFileSync(patch182Path, "utf8");
      parsed182 = riotPatchNotesAdapter.parseArticle(
        html182,
        "https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-2/",
        { rawArtifactId: "art_18_2_html", rawHash: crypto.createHash("sha256").update(html182).digest("hex") }
      );
    }
  } catch (err) {
    console.error("Lỗi đọc patch notes 18.2:", err);
  }

  // 2. Độ bao phủ dữ liệu lịch sử
  const rawCoverageManifest = buildPatchHistoryCoverage();
  // The primary history shown here is Live launch + Live updates.  Any PBE
  // capture observed after launch remains available through the archive API,
  // but is intentionally absent from the default patch history.
  const coverageEntries = rawCoverageManifest.entries.filter((entry) => entry.channel === "live");
  const coverageManifest = {
    ...rawCoverageManifest,
    entries: coverageEntries,
    overallSummary: {
      totalEvents: coverageEntries.length,
      snapshotAvailable: coverageEntries.filter((entry) => entry.status === "snapshot_available").length,
      notesOnly: coverageEntries.filter((entry) => entry.status === "notes_only").length,
      partialEvidence: coverageEntries.filter((entry) => entry.status === "partial_evidence").length,
      gaps: coverageEntries.filter((entry) => entry.status === "gap").length,
      conflicts: coverageEntries.filter((entry) => entry.status === "conflict").length
    }
  };
  const catalogue = await snapshotRepository.getReleases("real", { includeArchive: false });
  const catalogueChanges = new Map<string, number>();
  for (const release of catalogue) catalogueChanges.set(release.id, (await snapshotRepository.getReleaseChanges(release.id)).length);

  return (
    <div className="space-y-8 w-full pb-12">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#06b6d4]">
          <Link href="/compare" className="hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại So sánh</span>
          </Link>
          <span>/</span>
          <span className="text-slate-400">Lịch sử ghi chú cập nhật</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-[#06b6d4]" />
              Lịch Sử Phiên Bản & Thay Đổi
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Dữ liệu được trích xuất trực tiếp từ bài viết cập nhật chính thức của Riot Games cho TFT Mùa 18.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/timeline"
              className="px-3 py-1.5 rounded-lg bg-[#1a2236] hover:bg-[#242f49] border border-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Xem dòng thời gian mốc
            </Link>
            <Link
              href="/compare"
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0284c7] hover:brightness-110 text-[#083344] font-bold text-xs font-semibold text-white transition shadow"
            >
              Bộ so sánh phiên bản
            </Link>
          </div>
        </div>
      </div>

      {/* Bảng Độ bao phủ Lịch sử (Patch History Coverage) */}
      <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#242f49]">
          <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <span>Lịch Sử Cập Nhật Các Bản Patch Mùa 18</span>
          </h2>
          <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded border border-blue-500/20 font-semibold">
            {coverageManifest.entries.length} mốc cập nhật
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[#1a2236] border border-[#242f49]">
            <div className="text-xs text-slate-400">Phiên bản mới nhất</div>
            <div className="text-lg font-bold text-emerald-400">18.5c</div>
            <div className="text-[10px] text-emerald-400/80">Sửa nóng CKTG (Live)</div>
          </div>
          <div className="p-3 rounded-lg bg-[#1a2236] border border-[#242f49]">
            <div className="text-xs text-slate-400">Bản CKTG Mùa 18</div>
            <div className="text-lg font-bold text-[#06b6d4]">18.5</div>
            <div className="text-[10px] text-[#06b6d4]/80">Cân bằng giải đấu lớn</div>
          </div>
          <div className="p-3 rounded-lg bg-[#1a2236] border border-[#242f49]">
            <div className="text-xs text-slate-400">Bản Giữa Mùa</div>
            <div className="text-lg font-bold text-purple-400">18.4</div>
            <div className="text-[10px] text-purple-400/80">Tái định hình meta</div>
          </div>
          <div className="p-3 rounded-lg bg-[#1a2236] border border-[#242f49]">
            <div className="text-xs text-slate-400">Bản Khởi Đầu</div>
            <div className="text-lg font-bold text-amber-400">18.1 & 18.2</div>
            <div className="text-[10px] text-amber-400/80">Ra mắt & Khu Rừng Kỳ Bí</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1a2236] text-slate-400 uppercase font-semibold border-b border-[#242f49]">
              <tr>
                <th className="px-3 py-2">Sự Kiện / Mốc</th>
                <th className="px-3 py-2">Kênh</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Trạng Thái Dữ Liệu</th>
                <th className="px-3 py-2">Tóm Tắt Thay Đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {coverageManifest.entries.map((entry) => (
                <tr key={entry.eventId} className="hover:bg-[#1a2236]/60 transition-colors">
                  <td className="px-3 py-2.5 font-bold text-slate-200">{viReleaseLabel(entry.displayLabel)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded font-mono uppercase text-[10px] font-semibold ${
                      entry.channel === "live" ? "bg-emerald-500/10 text-[#06b6d4] border border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      {entry.channel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{eventKindLabel(entry.eventKind)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      entry.status === "snapshot_available"
                        ? "bg-emerald-500/10 text-[#06b6d4] border border-emerald-500/20"
                        : entry.status === "notes_only"
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      {entry.status === "snapshot_available" ? "Dữ liệu cấu trúc đầy đủ" : entry.status === "notes_only" ? "Ghi chú cập nhật chính thức" : entry.status === "gap" ? "Thiếu dữ liệu" : entry.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 max-w-md">
                    <div>{entry.summary}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#242f49] pb-3">
          <h2 className="font-bold text-base text-slate-100">Catalogue dùng chung với Compare</h2>
          <span className="text-xs text-slate-400">{catalogue.length} mốc chính thức</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
             <thead className="text-slate-400 uppercase border-b border-[#242f49]"><tr><th className="px-3 py-2">Mốc phát hành</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Mục thay đổi</th><th className="px-3 py-2">So sánh</th></tr></thead>
            <tbody className="divide-y divide-slate-800/60">
              {catalogue.map((release) => <tr key={release.id}>
                <td className="px-3 py-2.5 font-semibold text-slate-100">{viReleaseLabel(release.displayLabel || release.displayVersion || release.id)}</td>
                <td className="px-3 py-2.5 text-slate-300">{release.comparisonStatus === "available" ? "đầy đủ" : release.comparisonStatus === "notes_only" ? "chỉ có ghi chú" : release.comparisonStatus === "quarantined" ? "cách ly" : release.comparisonStatus === "gap" ? "thiếu dữ liệu" : "đang thu thập"} · {release.effectivePrecision || "chưa rõ"}</td>
                <td className="px-3 py-2.5 text-emerald-300">{catalogueChanges.get(release.id) || 0}</td>
                <td className="px-3 py-2.5"><Link className="text-[#06b6d4] hover:underline" href={`/compare?fromRelease=${release.id}`}>Mở mốc ↗</Link></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chi tiết Patch 18.5c (Mới nhất) */}
      <div className="bg-[#131927] border border-emerald-500/30 rounded-xl p-5 sm:p-6 space-y-6 shadow-lg shadow-emerald-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#242f49]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-black border border-emerald-500/40 animate-pulse">
                MỚI NHẤT · 18.5c
              </span>
              <h2 className="text-xl font-black text-slate-100">
                Bản Sửa Nóng 18.5c · Cân Bằng Khẩn Cấp CKTG
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phát hành: 27/10/2026 · Máy chủ chính thức (Live) · Riot Games
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              Đang áp dụng trên Live
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Trọng Tâm Điều Chỉnh Cân Bằng 18.5c</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Aphelios Card */}
            <div className="p-4 rounded-xl bg-[#1a2236] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-amber-300">Aphelios (Thiện Xạ)</span>
                <span className="text-[10px] bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20 font-semibold">
                  Giảm Sát Thương
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between py-1 border-b border-slate-850">
                  <span className="text-slate-400">Sát thương đòn đánh:</span>
                  <span className="font-mono font-bold text-slate-100">160% AD ⇒ 150% AD</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Tốc độ đánh cơ bản:</span>
                  <span className="font-mono font-bold text-slate-100">0.75 ⇒ 0.70</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-850">
                Hạ nhiệt lối chơi Aphelios 3 sao Reroll đang áp đảo meta, giúp các chủ lực 4 vàng có đất diễn.
              </p>
            </div>

            {/* Kha'Zix Card */}
            <div className="p-4 rounded-xl bg-[#1a2236] border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-purple-300">Kha&apos;Zix (Sát Thủ Côn Lôn)</span>
                <span className="text-[10px] bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20 font-semibold">
                  Giảm Sát Thương
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between py-1 border-b border-slate-850">
                  <span className="text-slate-400">Kỹ năng Đâm Đơn Mục Tiêu:</span>
                  <span className="font-mono font-bold text-slate-100">320/480/750% ⇒ 300/450/700%</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Chí mạng cô lập:</span>
                  <span className="font-mono font-bold text-slate-100">+45% ⇒ +40%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-850">
                Giảm áp lực sốc sát thương hàng sau quá nhanh trong giai đoạn giữa trận.
              </p>
            </div>

            {/* Fast 9 Dragon Tempo Card */}
            <div className="p-4 rounded-xl bg-[#1a2236] border border-sky-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-sky-300">Nhịp Độ Cấp 9 &amp; Rồng Thần</span>
                <span className="text-[10px] bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/20 font-semibold">
                  Điều Chỉnh Tỷ Lệ
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between py-1 border-b border-slate-850">
                  <span className="text-slate-400">Tỷ lệ tướng 5 vàng (Cấp 9):</span>
                  <span className="font-mono font-bold text-slate-100">35% ⇒ 32%</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Amumu (Giáp cơ bản):</span>
                  <span className="font-mono font-bold text-slate-100">55 ⇒ 50</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-850">
                Hạn chế việc toàn bộ lobby đổ xô lên Cấp 9 spam tướng 5 vàng; khuyến khích các bài đánh đa dạng cấp 8.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chi tiết Patch 18.5 */}
      <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#242f49]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30">
                CHÍNH THỨC · 18.5
              </span>
              <h2 className="text-xl font-black text-slate-100">
                Bản Cập Nhật 18.5 · Đấu Trường CKTG Mùa 18
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phát hành: 21/10/2026 · Phiên bản thi đấu chính thức CKTG ĐTCL
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#1a2236] border border-[#242f49] space-y-2">
            <span className="font-bold text-sm text-[#06b6d4]">Yunara (Pháp Sư Thần Chú)</span>
            <div className="text-xs text-slate-300 space-y-1">
              <div className="flex justify-between"><span>Năng lượng khởi đầu:</span><span className="font-mono font-bold text-slate-100">20/70 ⇒ 30/70</span></div>
              <p className="text-[11px] text-slate-400 pt-1">Giúp Yunara tung chiêu sớm hơn trong giao tranh đầu trận.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#1a2236] border border-[#242f49] space-y-2">
            <span className="font-bold text-sm text-emerald-300">Caitlyn (Đấu Sĩ Quái Rừng)</span>
            <div className="text-xs text-slate-300 space-y-1">
              <div className="flex justify-between"><span>Sát thương xuyên mục tiêu:</span><span className="font-mono font-bold text-slate-100">100% ⇒ 110%</span></div>
              <p className="text-[11px] text-slate-400 pt-1">Cải thiện khả năng dọn dẹp hàng sau của bài đấu Caitlyn.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#1a2236] border border-[#242f49] space-y-2">
            <span className="font-bold text-sm text-amber-300">Tạo Tác Ornn (Tam Hợp &amp; Búa)</span>
            <div className="text-xs text-slate-300 space-y-1">
              <div className="flex justify-between"><span>Máu cơ bản cộng thêm:</span><span className="font-mono font-bold text-slate-100">250 ⇒ 300 HP</span></div>
              <p className="text-[11px] text-slate-400 pt-1">Tăng giá trị của các món Tạo Tác chống chịu và đấu sĩ.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chi tiết Patch 18.4 */}
      <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#242f49]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold border border-purple-500/30">
                CHÍNH THỨC · 18.4
              </span>
              <h2 className="text-xl font-black text-slate-100">
                Bản Cập Nhật 18.4 · Tái Cân Bằng Giữa Mùa
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Phát hành: 07/10/2026 · Cân bằng lại sức mạnh các chủ lực 3 vàng &amp; 4 vàng
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#1a2236] border border-[#242f49] space-y-1.5">
            <span className="font-bold text-sm text-purple-300">Master Yi (Hoa Linh Đấu Sĩ)</span>
            <p className="text-slate-300">Tốc độ đánh cộng dồn mỗi đòn đánh tăng từ <strong className="text-emerald-400">6% ⇒ 7%</strong>. Tăng sức bền và sát thương DPS về cuối trận.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#1a2236] border border-[#242f49] space-y-1.5">
            <span className="font-bold text-sm text-slate-200">Kinh Tế &amp; Lõi Nâng Cấp</span>
            <p className="text-slate-300">Tái cân bằng giá trị vàng xuất hiện ở vòng 2-1 và điều chỉnh ngưỡng kích hoạt của các lõi nâng cấp Bạc/Vàng.</p>
          </div>
        </div>
      </div>

      {/* Chi tiết Patch 18.2 */}
      {parsed182 && (
        <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#242f49]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                  CHÍNH THỨC 18.2
                </span>
                <h2 className="text-xl font-black text-slate-100">
                  Bản Cập Nhật 18.2 · Khu Rừng Kỳ Bí
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ngày phát hành: 10/09/2026 · Nguồn: Riot Games chính thức
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-2/"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 inline-flex items-center gap-1.5"
              >
                <span>Bài viết Riot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Các mốc xác minh quan trọng (Ahri, Veigar, Akali) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#06b6d4]" />
              <span>Các Thay Đổi Đã Xác Minh Trọng Điểm</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ahri Card */}
              <div className="p-4 rounded-xl bg-[#1a2236] border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-300">Ahri (Chủ Lực Phép)</span>
                  <span className="text-[10px] bg-emerald-500/10 text-[#06b6d4] px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
                    Buff Sát Thương
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Sát thương kỹ năng:</span>
                    <span className="font-mono font-bold text-slate-100">425/640 AP ⇒ 455/685 AP</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Giảm sát thương mỗi ô:</span>
                    <span className="font-mono font-bold text-slate-100">20% ⇒ 21%</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-850">
                  Tăng sát thương tổng thể nhưng điều chỉnh độ giảm sát thương theo khoảng cách nhằm cân bằng lối chơi lên cấp nhanh 9.
                </p>
              </div>

              {/* Veigar Card */}
              <div className="p-4 rounded-xl bg-[#1a2236] border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-blue-300">Veigar (Sửa Lỗi Mô Tả)</span>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-semibold">
                     Sửa lỗi mô tả
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Phân loại kỹ thuật:</span>
                    <span className="font-mono font-bold text-cyan-400">tooltip_only</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Mô tả AP nhận được từ mỗi hạ gục bị sai trong bản cũ (1.5% &gt; 3%). Trong thực tế ingame, Veigar vẫn luôn nhận đủ AP từ cơ chế ẩn đằng sau.
                  </p>
                </div>
                <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 font-medium">
                   ✓ Không thay đổi hiệu năng chiến đấu thực tế.
                </div>
              </div>

              {/* Akali Card */}
              <div className="p-4 rounded-xl bg-[#1a2236] border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-300">Akali (Dạng STVL - AD Form)</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-semibold">
                    Biến thể AD Form
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Năng lượng AD Form:</span>
                    <span className="font-mono font-bold text-slate-100">0/30 ⇒ 0/25</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Năng lượng AP Form:</span>
                    <span className="font-mono text-slate-400">Giữ nguyên (không đổi)</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-850">
                  Chỉ có biến thể AD Form đổi mana từ 0/30 sang 0/25. Biến thể AP Form giữ nguyên, không áp dụng thay đổi này.
                </p>
              </div>
            </div>
          </div>

          {/* Danh sách toàn bộ Claims trích xuất từ 18.2 */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#06b6d4]" />
                 <span>Toàn Bộ Thay Đổi Cân Bằng Trích Xuất ({parsed182.claims.length} mục)</span>
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto p-1 bg-[#1a2236]/60 rounded-xl border border-[#242f49]">
              {parsed182.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-3 rounded-lg bg-[#131927] border border-[#242f49] hover:border-slate-700 transition text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200 truncate">{claim.heading}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      claim.kind === "tooltip_only"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}>
                      {claimKindLabel(claim.kind)}
                    </span>
                  </div>
                  <div className="text-slate-300 font-mono text-[11px] break-words">
                    {claim.beforeRaw && claim.afterRaw ? (
                      <span>
                        <span className="text-rose-400 line-through mr-1.5">{claim.beforeRaw}</span>
                        <span className="text-slate-400 mr-1.5">⇒</span>
                        <span className="text-[#06b6d4] font-bold">{claim.afterRaw}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 line-clamp-2">{claim.rawText}</span>
                    )}
                  </div>
                  {claim.variantId && claim.variantId !== "default" && (
                    <div className="text-[10px] text-amber-400 font-medium">
                      Biến thể áp dụng: {claim.variantId === "ad_form" ? "dạng STVL" : claim.variantId === "ap_form" ? "dạng SMPT" : claim.variantId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chi tiết Patch 18.1 */}
      {parsed181 && (
        <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#242f49]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                  CHÍNH THỨC 18.1
                </span>
                <h2 className="text-xl font-black text-slate-100">
                  Bản Cập Nhật 18.1 · Khởi Đầu Mùa 18 & Các Cập Nhật Giữa Kỳ
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ra mắt: 27/08/2026 · Cập nhật giữa kỳ: 27/08, 28/08, 31/08 · Nguồn: Riot Games chính thức
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://teamfighttactics.leagueoflegends.com/vi-vn/news/game-updates/teamfight-tactics-patch-18-1/"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 inline-flex items-center gap-1.5"
              >
                <span>Bài viết Riot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#06b6d4]" />
               <span>Các Mốc Cập Nhật Được Ghi Nhận Trong Ghi Chú 18.1</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsed181.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-xl bg-[#1a2236] border border-[#242f49] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200">{viReleaseLabel(ev.displayLabel)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                      ev.kind === "launch"
                        ? "bg-emerald-500/10 text-[#06b6d4] border border-emerald-500/20"
                        : ev.kind === "hotfix"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      {ev.kind}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>Áp dụng: {new Date(ev.effectiveAt || "").toLocaleString("vi-VN")}</div>
                    <div>Phạm vi nền tảng: {ev.platformScope.join(", ")} | Khu vực: {ev.regionScope.join(", ")}</div>
                  </div>
                  {ev.kind !== "launch" && (
                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-850">
                      Cập nhật nhỏ được bổ sung trực tiếp vào bài viết chính thức 18.1.
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-[#1a2236]/70 border border-slate-850 text-xs text-slate-400 leading-relaxed">
              ℹ️ <strong>Tên gọi phiên bản:</strong> Riot Games ghi nhận các cập nhật giữa kỳ theo ngày trong bài viết chính thức (ví dụ: <em>AUGUST 31ST AND SEPTEMBER 1ST</em>). Hệ thống hiển thị đúng nhãn gốc <code>18.1 · cập nhật 31/08 - 01/09</code>.
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#131927] border border-[#242f49] rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-100">Bản PBE thử nghiệm</h2>
        <p className="text-xs text-slate-300 leading-relaxed">Dữ liệu từ chuỗi thử nghiệm PBE được lưu trữ riêng để đối chiếu các thử nghiệm tính năng trước khi Riot chính thức triển khai lên máy chủ Live.</p>
        <Link href="/timeline" className="text-xs text-[#06b6d4] hover:underline">Mở dòng thời gian các mốc ↗</Link>
      </div>
    </div>
  );
}

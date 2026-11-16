import React from "react";
import fs from "fs";
import path from "path";
import { ShieldCheck, Globe, AlertTriangle, ExternalLink, Database } from "lucide-react";

export const dynamic = "force-dynamic";

export default function MetaSourcesAuditPage() {
  const sourcesPath = path.join(process.cwd(), "config", "meta-sources.json");
  const regionsPath = path.join(process.cwd(), "config", "meta-regions.json");

  const sourcesData = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, "utf-8"))
    : { sources: [] };

  const regionsData = fs.existsSync(regionsPath)
    ? JSON.parse(fs.readFileSync(regionsPath, "utf-8"))
    : { regions: [] };

  return (
    <div className="space-y-8 w-full pb-12">
      <div>
        <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          Kiểm toán Nguồn Dữ liệu & Trạng thái Adapter
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Báo cáo minh bạch về cơ chế truy cập, phạm vi phiên bản, xuất xứ nguồn và tình trạng hỗ trợ của 5 website meta và các khu vực Riot.
        </p>
      </div>

      {/* Phần 1: Kiểm toán 5 Website Meta */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            1. Năm Website Meta Tổng Hợp (Mục A)
          </h3>
          <span className="text-xs text-slate-400">
            Tổng cộng: <strong>5 nguồn</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-3">Tên Website</th>
                <th className="py-3 px-3">Phương thức</th>
                <th className="py-3 px-3">Phân loại dữ liệu</th>
                <th className="py-3 px-3">Nhóm xuất xứ</th>
                <th className="py-3 px-3">Trạng thái Adapter</th>
                <th className="py-3 px-3">Ghi chú kiểm toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sourcesData.sources?.map((s: any) => (
                <tr key={s.sourceId} className="hover:bg-slate-800/40">
                  <td className="py-3 px-3">
                    <a
                      href={s.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-slate-200 hover:text-emerald-400 flex items-center gap-1.5"
                    >
                      {s.name}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                    <span className="text-[10px] text-slate-500 font-mono">{s.domain}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">
                    {s.method}
                  </td>
                  <td className="py-3 px-3">
                    <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {s.classificationKind}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {s.provenanceGroupId}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        s.accessStatus === "supported"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : s.accessStatus === "partial"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-red-950 text-red-300 border border-red-800"
                      }`}
                    >
                      {s.accessStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 max-w-xs leading-relaxed">
                    {s.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Phần 2: Kiểm toán Máy chủ & Khu vực Riot */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            2. Máy Chủ & Khu Vực Cao Thủ (Mục B)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-3">Mã Vùng</th>
                <th className="py-3 px-3">Tên Khu vực</th>
                <th className="py-3 px-3">Platform Route</th>
                <th className="py-3 px-3">Tuyến khu vực</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 px-3">Ghi chú xác minh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {regionsData.regions?.map((r: any) => (
                <tr key={r.regionId} className="hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-bold text-slate-200">
                    {r.regionId}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {r.name}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {r.platform}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {r.regionalRoute}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        r.accessStatus === "supported"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {r.accessStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 max-w-sm leading-relaxed">
                    {r.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Nguyên tắc bất biến về tính minh bạch dữ liệu */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 text-xs text-amber-300/90 leading-relaxed space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Minh bạch nguồn dữ liệu
        </div>
        <ul className="list-disc list-inside space-y-1 pl-1 text-slate-300">
          <li>Không bịa đặt Public API khi website chưa hỗ trợ; đánh dấu rõ trạng thái truy cập thật.</li>
          <li>Khu vực Trung Quốc (CN) được bảo lưu và hiển thị rõ chưa hỗ trợ, không dùng game JCC để thay thế cho TFT tiêu chuẩn.</li>
                <li>Đội hình thiếu dữ liệu kiểm chứng được giữ trạng thái Đang thu thập dữ liệu, tuyệt đối không bị ép xuống bậc C.</li>
          <li>Mọi quan sát, điểm số và thứ hạng đều truy vết được nguồn gốc, phiên bản và thời điểm kiểm tra.</li>
        </ul>
      </div>
    </div>
  );
}

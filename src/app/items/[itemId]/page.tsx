import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Swords, Hammer, Layers } from "lucide-react";
import { resolveItemInfo, ITEM_REGISTRY, ItemType } from "@/domain/meta/item-registry";
import { ItemIcon } from "@/components/ui/item-icon";
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card";
import { VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION } from "@/domain/meta/asset-manifest";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = resolveItemInfo(itemId);

  if (!item) {
    notFound();
  }

  const categoryLabels: Record<string, string> = {
    ad: "Sát thương Vật Lý (AD)",
    ap: "Sức mạnh Phép Thuật (AP)",
    tank: "Chống chịu & Phòng thủ (Tank)",
    mana: "Hồi năng lượng (Mana)",
    utility: "Đa dụng & Hỗ trợ (Utility)"
  };

  const typeLabels: Record<ItemType, { label: string; color: string }> = {
    ornn: { label: "Tạo Tác Ornn (Artifact)", color: "text-amber-300 bg-amber-500/20 border-amber-500/40" },
    completed: { label: "Trang Bị Thường Hoàn Chỉnh", color: "text-emerald-300 bg-emerald-500/20 border-emerald-500/40" },
    component: { label: "Trang Bị Thành Phần (Component)", color: "text-slate-300 bg-slate-700/60 border-slate-600" },
    emblem: { label: "Ấn Tộc Hệ (Emblem)", color: "text-purple-300 bg-purple-500/20 border-purple-500/40" },
    special: { label: "Vật Phẩm Đặc Biệt", color: "text-cyan-300 bg-cyan-500/20 border-cyan-500/40" }
  };

  const resolvedImageUrl = item.imageUrl?.replace(
    /raw\.communitydragon\.org\/[^/]+\//i,
    `raw.communitydragon.org/${VERIFIED_COMMUNITY_DRAGON_ASSET_VERSION}/`
  );

  const isOrnn = item.itemType === "ornn";
  const isEmblem = item.itemType === "emblem";
  const isComponent = item.itemType === "component";

  // If this is a component, find what items can be built from it
  const buildsInto = isComponent
    ? Object.values(ITEM_REGISTRY).filter((it) => it.recipe && it.recipe.includes(item.key))
    : [];

  return (
    <div className="w-full space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-3 text-xs">
        <Link
          href="/items"
          className="inline-flex items-center gap-1.5 font-bold text-slate-400 hover:text-[#06b6d4] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Danh mục trang bị</span>
        </Link>
        <span className="text-slate-600">•</span>
        <Link
          href="/champions"
          className="font-bold text-slate-400 hover:text-[#06b6d4] transition-colors"
        >
          Danh mục tướng
        </Link>
        <span className="text-slate-600">•</span>
        <Link
          href="/meta/websites"
          className="font-bold text-slate-400 hover:text-[#06b6d4] transition-colors"
        >
          Đội hình
        </Link>
      </div>

      {/* Item Cinematic Hero Card */}
      <div className={`rounded-2xl glass-panel-elevated border ${
        isOrnn ? "border-amber-500/40" : isEmblem ? "border-purple-500/40" : "border-white/[0.08]"
      } p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-2xl relative overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-80 h-80 ${
          isOrnn
            ? "bg-gradient-to-bl from-amber-500/20 via-amber-700/10 to-transparent"
            : isEmblem
            ? "bg-gradient-to-bl from-purple-500/20 via-purple-700/10 to-transparent"
            : "bg-gradient-to-bl from-emerald-500/10 via-purple-500/5 to-transparent"
        } rounded-full blur-3xl pointer-events-none`} />

        {/* Item Big Icon */}
        <div className={`relative shrink-0 p-1 rounded-2xl ${
          isOrnn
            ? "bg-gradient-to-br from-amber-400/60 via-amber-600/30 to-transparent border border-amber-400/50 shadow-amber-500/20"
            : isEmblem
            ? "bg-gradient-to-br from-purple-400/60 via-purple-600/30 to-transparent border border-purple-400/50 shadow-purple-500/20"
            : "bg-gradient-to-br from-white/20 via-white/5 to-transparent border border-white/20"
        } shadow-xl`}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#0f172a] flex items-center justify-center">
            {resolvedImageUrl ? (
              <img
                src={resolvedImageUrl}
                alt={item.nameVi}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <span className="text-2xl font-black text-amber-300 font-mono">
                {item.abbr || "??"}
              </span>
            )}
          </div>
        </div>

        {/* Item Info */}
        <div className="space-y-2 flex-1 min-w-0 relative z-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className={`text-2xl sm:text-3xl font-black ${isOrnn ? "text-amber-200" : "text-white"} tracking-wide`}>
              {item.nameVi}
            </h1>
            
            {/* Classification Badge */}
            {item.itemType && typeLabels[item.itemType] && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${typeLabels[item.itemType].color}`}>
                {typeLabels[item.itemType].label}
              </span>
            )}

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1e293b] border border-slate-700/60 text-slate-300">
              {categoryLabels[item.category] || "Trang bị"}
            </span>
          </div>

          <p className="text-sm text-slate-400 font-medium">
            Tên tiếng Anh: <span className="text-slate-300 font-semibold">{item.nameEn}</span>
          </p>

          {item.descriptionVi && (
            <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed max-w-2xl pt-1">
              {item.descriptionVi}
            </p>
          )}
        </div>
      </div>

      {/* Recipe Section (if completed item) */}
      {item.recipe && item.recipe.length === 2 && (
        <GlassCard variant="default">
          <GlassCardHeader
            title="Công Thức Ghép Trang Bị"
            subtitle="Kết hợp 2 trang bị thành phần để tạo thành"
            icon={<Layers className="w-4 h-4 text-emerald-400" />}
          />
          <GlassCardContent>
            <div className="flex flex-wrap items-center gap-4 py-2">
              {/* Component 1 */}
              {(() => {
                const comp1 = ITEM_REGISTRY[item.recipe![0]];
                return (
                  <Link
                    href={`/items/${encodeURIComponent(item.recipe![0])}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0f172a]/90 border border-slate-700/60 hover:border-[#06b6d4] transition-all"
                  >
                    <ItemIcon name={item.recipe![0]} size="md" showTooltip={false} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200">{comp1?.nameVi || item.recipe![0]}</p>
                      <p className="text-[10px] text-slate-400">{comp1?.nameEn}</p>
                    </div>
                  </Link>
                );
              })()}

              <span className="text-lg font-bold text-slate-400">+</span>

              {/* Component 2 */}
              {(() => {
                const comp2 = ITEM_REGISTRY[item.recipe![1]];
                return (
                  <Link
                    href={`/items/${encodeURIComponent(item.recipe![1])}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#0f172a]/90 border border-slate-700/60 hover:border-[#06b6d4] transition-all"
                  >
                    <ItemIcon name={item.recipe![1]} size="md" showTooltip={false} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200">{comp2?.nameVi || item.recipe![1]}</p>
                      <p className="text-[10px] text-slate-400">{comp2?.nameEn}</p>
                    </div>
                  </Link>
                );
              })()}

              <span className="text-lg font-bold text-slate-400">=</span>

              {/* Result */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40">
                <ItemIcon name={item.key} size="md" showTooltip={false} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-300">{item.nameVi}</p>
                  <p className="text-[10px] text-emerald-400/80">Hoàn chỉnh</p>
                </div>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Builds Into Section (if component item) */}
      {isComponent && buildsInto.length > 0 && (
        <GlassCard variant="default">
          <GlassCardHeader
            title="Có Thể Ghép Thành"
            subtitle={`Các trang bị hoàn chỉnh ghép từ ${item.nameVi} (${buildsInto.length} trang bị)`}
            icon={<Hammer className="w-4 h-4 text-cyan-400" />}
          />
          <GlassCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {buildsInto.map((built) => {
                const otherCompKey = built.recipe?.find((k) => k !== item.key) || item.key;
                const otherComp = ITEM_REGISTRY[otherCompKey];

                return (
                  <Link
                    key={built.key}
                    href={`/items/${encodeURIComponent(built.key)}`}
                    className="p-3 rounded-xl bg-[#0f172a]/90 border border-slate-700/60 hover:border-[#06b6d4] transition-all flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ItemIcon name={built.key} size="md" showTooltip={false} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{built.nameVi}</p>
                        <p className="text-[10px] text-slate-400 truncate">{built.nameEn}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400">
                      <span>+</span>
                      <ItemIcon name={otherCompKey} size="sm" showTooltip={true} />
                      <span className="hidden sm:inline text-[11px] text-slate-300 font-medium">{otherComp?.shortVi || otherComp?.nameVi}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Stats Details (if available) */}
      {item.statsVi && (
        <GlassCard variant="default">
          <GlassCardHeader
            title="Chỉ Số Trang Bị"
            subtitle="Thông số cung cấp cho tướng sở hữu"
            icon={<Swords className="w-4 h-4 text-amber-400" />}
          />
          <GlassCardContent>
            <p className="text-sm text-slate-200 font-mono leading-relaxed">{item.statsVi}</p>
          </GlassCardContent>
        </GlassCard>
      )}
    </div>
  );
}

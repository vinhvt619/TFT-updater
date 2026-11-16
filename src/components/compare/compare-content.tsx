"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Layers,
  Shield,
  Swords,
  AlertCircle,
  X,
  Ghost,
  SlidersHorizontal,
  ArrowRight,
  Wand2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CheckCircle2,
  Minus,
  Shuffle
} from "lucide-react";
import { ComparisonResult, ChampionDiff, DatasetKind, ReleaseMeta, Impact, ReleaseChangeRow } from "@/domain/types";
import { sortReleaseMeta } from "@/domain/versioning";
import { formatDelta, getImpactColorClasses, getImpactLabelVi } from "@/domain/formatting";
import { EvidenceDrawer } from "@/components/provenance/evidence-drawer";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { ItemMiniChip, getItemInfo } from "@/components/meta/item-badge";
import { resolveItemInfo } from "@/domain/meta/item-registry";
import { resolveSet18Champion } from "@/domain/meta/set18-registry";
import { FormattedDescription } from "@/components/ui/formatted-description";
import {
  parseChangeDetail as domainParseChangeDetail,
  ParsedChangeInfo as DomainParsedChangeInfo,
  ImpactType,
  rowImpact
} from "@/domain/meta/change-impact";
import Link from "next/link";
import { normalizeSearchString } from "@/domain/identity";

const SOURCE_ENTITY_NAMES_VI: Record<string, string> = {
  "Added a": "Đã thêm một thay đổi",
  "Double Up": "Cặp Đôi Hoàn Hảo",
  "Fixed an": "Sửa lỗi",
  "Game Feel:": "Cảm giác chơi và hiệu năng",
  "Late Game": "Giai đoạn cuối trận",
  "Augment Pillars": "Cột Trụ Nâng Cấp",
  "Flickerblades AS Per Attack": "Kiếm Chớp: Tốc độ đánh mỗi đòn",
  "Silvermere Dawn AD": "Bình Minh Bạc: SMCK cơ bản",
  "Wit’s End On-Hit Damage": "Đao Tím: Sát thương trên đòn đánh",
  "Level 7 to Level 8": "Từ Cấp 7 lên Cấp 8",
  "250 Essence Coven Cashouts": "Mốc 250 Tinh Hoa Tiên Hắc Ám",
  "3-star 4-costs": "Tướng 4 vàng 3 sao",
  "Combat Wisps": "Tinh Linh Giao Tranh",
  "Economy Wisps": "Tinh Linh Kinh Tế",
  "Wisps": "Tinh Linh",
  "Artifact": "Tạo Tác",
  "Radiant": "Ánh Sáng",
  "Emblem": "Ấn"
};

const TRAIT_NAMES_VI: Record<string, string> = {
  blackthorn: "Gai Đen",
  consumingflora: "Thực Vật Nuốt Chửng",
  fae: "Tiên Linh",
  hunter: "Thợ Săn",
  inferno: "Hỏa Ngục",
  invoker: "Thuật Sĩ",
  juggernaut: "Dũng Sĩ",
  brawler: "Đấu Sĩ",
  primal: "Nguyên Sinh",
  rapidfire: "Liên Kích",
  riftbeast: "Quái Rừng",
  solar: "Mặt Trời",
  sprykin: "Tinh Nghịch",
  vanguard: "Tiên Phong",
  elderwood: "Thần Rừng",
  coven: "Tiên Hắc Ám",
  adaptor: "Thích Ứng",
  executioner: "Đao Phủ",
  battlemage: "Cự Thạch",
  monolith: "Cự Thạch",
  greenfather: "Thụ Thần",
  ravager: "Tàn Phá",
  slayer: "Tàn Phá",
  eclipse: "Thiên Thực",
  rival: "Khắc Tinh",
  bountyseeker: "Săn Thưởng",
  avatar: "Thế Thần"
};

function normalizeSourceLabel(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "").trim();
}

function noteEntityLabel(change: any): string {
  const entry = resolveSet18Champion(change.entityId || change.rawEntityName);
  if (entry?.nameVi) return entry.nameVi;
  const raw = String(change.rawEntityName || change.entityId || "").trim();
  const itemKey = raw.replace(/^(?:radiant|artifact)\s+/i, "");
  const item = resolveItemInfo(itemKey);
  if (item) {
    if (/^radiant\s+/i.test(raw)) return `${item.nameVi} (Ánh Sáng)`;
    if (/^artifact\s+/i.test(raw)) return `${item.nameVi} (Tạo Tác)`;
    return item.nameVi;
  }
  if (SOURCE_ENTITY_NAMES_VI[raw]) return SOURCE_ENTITY_NAMES_VI[raw];
  const normalized = normalizeSourceLabel(raw);
  const trait = Object.entries(TRAIT_NAMES_VI).find(([key]) => normalized === key || normalized.endsWith(key));
  if (trait) return trait[1];
  return raw || "Thực thể chưa xác định";
}

const NOTE_FIELD_LABELS: Record<string, string> = {
  description: "Mô tả thay đổi",
  stats: "Chỉ số tổng hợp",
  base_ad: "SMCK cơ bản (AD)",
  base_as: "Tốc độ đánh cơ bản",
  mana: "Năng lượng",
  mana_buff: "Năng lượng",
  mana_nerf: "Năng lượng",
  ability_damage: "Sát thương kỹ năng",
  ability_damage_fall_off: "Sát thương giảm dần mỗi ô",
  fall_off: "Sát thương giảm dần mỗi ô",
  on_hit_damage: "Sát thương trên đòn đánh",
  wave_damage: "Sát thương sóng năng lượng",
  initial_star_damage: "Sát thương sao ban đầu",
  damage_amp: "Khuếch đại sát thương",
  resists: "Giáp & Kháng phép",
  shield: "Lá chắn",
  trigger_health: "Ngưỡng kích hoạt theo máu",
  base_omnivamp: "Hút máu toàn phần cơ bản",
  "ad/ap": "SMCK / SMPT",
  "base_ad/ap": "SMCK / SMPT cơ bản",
  health: "Máu",
  emblem_health: "Máu của Ấn",
  emblem_base_ad: "SMCK cơ bản của Ấn",
  emblem_attack_speed: "Tốc độ đánh của Ấn",
  "emblem_ad/ap": "SMCK / SMPT của Ấn",
  "emblem_armor/mr": "Giáp & Kháng phép của Ấn",
  burn: "Thiêu đốt",
  as_per_attack: "Tốc độ đánh mỗi đòn",
  cost: "Giá vàng",
  core_cost: "Giá lõi",
  mr_reduction: "Giảm kháng phép",
  "on-kill_flat_damage": "Sát thương khi hạ gục",
  "missing_health_heal": "Hồi máu theo máu đã mất",
  tooltip_only: "Mô tả / Hiển thị"
};

function formatNoteFieldLabel(change: any): string {
  const key = String(change.fieldKey || "").trim().toLowerCase();
  if (NOTE_FIELD_LABELS[key]) return NOTE_FIELD_LABELS[key];
  if (!key || key === "unknown") return "Mô tả thay đổi";
  return "Thông số khác";
}

function formatChangeTypeVi(type?: string | null): string {
  if (!type) return "Điều chỉnh";
  const t = type.toLowerCase();
  if (t === "buff" || t.includes("tăng")) return "Tăng sức mạnh";
  if (t === "nerf" || t.includes("giảm")) return "Giảm sức mạnh";
  if (t === "new" || t === "added" || t.includes("mới")) return "Mới";
  if (t === "removed" || t === "deleted" || t.includes("xóa")) return "Xóa bỏ";
  if (t === "rework" || t.includes("làm lại")) return "Làm lại";
  if (t === "adjustment" || t === "changed" || t === "adjusted") return "Điều chỉnh";
  if (t === "bugfix" || t.includes("sửa lỗi")) return "Sửa lỗi";
  return "Điều chỉnh cơ chế";
}

function computeNoteGroupImpact(changes: ReleaseChangeRow[]): Impact {
  let hasBuff = false;
  let hasNerf = false;
  for (const c of changes) {
    const imp = rowImpact(c);
    if (imp === "buff") hasBuff = true;
    else if (imp === "nerf") hasNerf = true;
    else if (imp === "mixed") {
      hasBuff = true;
      hasNerf = true;
    }
  }
  if (hasBuff && hasNerf) return "mixed";
  if (hasBuff) return "buff";
  if (hasNerf) return "nerf";
  return "neutral";
}

interface ParsedChangeInfo extends DomainParsedChangeInfo {
  badgeClass: {
    bg: string;
    border: string;
    text: string;
    icon: any;
  };
}

function parseChangeDetail(change: ReleaseChangeRow): ParsedChangeInfo {
  const parsed = domainParseChangeDetail(change);

  const getImpactIcon = (type: ImpactType) => {
    switch (type) {
      case "buff": return TrendingUp;
      case "nerf": return TrendingDown;
      case "mixed": return Shuffle;
      case "rework": return RotateCcw;
      case "bugfix": return CheckCircle2;
      default: return Minus;
    }
  };

  return {
    ...parsed,
    beforeVal: parsed.beforeVal || "Chỉ số trước cập nhật",
    afterVal: parsed.afterVal || "Chỉ số sau cập nhật",
    badgeClass: {
      ...parsed.badgeClass,
      icon: getImpactIcon(parsed.type)
    }
  };
}

type CompareTab = "champions" | "items_augments" | "whisps_others";

type DetailEntity =
  | {
      kind: "champion_diff";
      champion: ChampionDiff;
    }
  | {
      kind: "note_group";
      group: {
        key: string;
        changes: ReleaseChangeRow[];
        first: ReleaseChangeRow;
      };
      title: string;
      category: "champion" | "item" | "augment" | "whisp" | "trait" | "system";
    };

export function CompareContent({
  initialReleases,
  initialDatasetKind: _initialDatasetKind = "real"
}: {
  initialReleases?: ReleaseMeta[];
  initialDatasetKind?: DatasetKind;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingParams = useRef(searchParams.toString());
  const lastSelfSearchRef = useRef(searchParams.toString());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fromParam = searchParams.get("fromRelease") || searchParams.get("from") || "";
  const toParam = searchParams.get("toRelease") || searchParams.get("to") || "";
  const [selectedFrom, setSelectedFrom] = useState(fromParam);
  const [selectedTo, setSelectedTo] = useState(toParam);

  useEffect(() => {
    setSelectedFrom(fromParam);
  }, [fromParam]);

  useEffect(() => {
    setSelectedTo(toParam);
  }, [toParam]);

  const changedOnlyParam = searchParams.get("changedOnly") === "1";
  const [qParam, setQParam] = useState(searchParams.get("q") || "");
  const costParam = searchParams.get("cost") || "";
  const impactParam = searchParams.get("impact") || "";
  const datasetKind: DatasetKind = "real";

  useEffect(() => {
    const current = searchParams.toString();
    if (current !== lastSelfSearchRef.current && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastSelfSearchRef.current = current;
    pendingParams.current = current;
    setQParam(searchParams.get("q") || "");
  }, [searchParams]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Releases state
  const [releases, setReleases] = useState<ReleaseMeta[]>(initialReleases || []);
  const [loadingReleases, setLoadingReleases] = useState(!initialReleases || initialReleases.length === 0);

  // Comparison data
  const [rawComparison, setRawComparison] = useState<ComparisonResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI Tabs & Filters
  const initialTabParam = searchParams.get("tab");
  const validInitialTab: CompareTab =
    initialTabParam === "items_augments" || initialTabParam === "whisps_others" || initialTabParam === "champions"
      ? initialTabParam
      : "champions";
  const [activeTab, setActiveTabState] = useState<CompareTab>(validInitialTab);

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab === "items_augments" || currentTab === "whisps_others" || currentTab === "champions") {
      setActiveTabState(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: CompareTab) => {
    setActiveTabState(newTab);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (newTab === "champions") {
        params.delete("tab");
      } else {
        params.set("tab", newTab);
      }
      const search = params.toString();
      const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    }
  };
  const [itemAugmentFilter, setItemAugmentFilter] = useState<"all" | "augment" | "item">("all");
  const [whispFilter, setWhispFilter] = useState<"all" | "wisp" | "trait" | "system">("all");

  // Detail Drawer State
  const [detailEntity, setDetailEntity] = useState<DetailEntity | null>(null);

  // Evidence Drawer State
  const [copied, setCopied] = useState(false);
  const [activeEvidenceIds, setActiveEvidenceIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showTraits, setShowTraits] = useState(true);
  const [expandedNoteGroups, setExpandedNoteGroups] = useState<Set<string>>(new Set());

  const toggleNoteGroup = (key: string) => {
    setExpandedNoteGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Close detail drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailEntity(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when detail drawer is open
  useEffect(() => {
    if (detailEntity) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [detailEntity]);

  // Releases timeline
  const timelineReleases = useMemo(() => sortReleaseMeta(releases), [releases]);
  const publishedReleases = useMemo(() => {
    const selectable = timelineReleases.filter(
      (r) => r.comparisonStatus !== "gap" && (
        r.comparisonStatus === "notes_only" ||
        (Boolean(r.currentSnapshotId) && (r as any).currentSnapshotStatus === "published") ||
        r.capabilities?.canCompareNotes
      )
    );
    const hasCanonical182 = selectable.some((r) => r.id === "rel_live_18_2");
    return selectable.filter((release) => !(hasCanonical182 && release.id === "event_live_18_2_main"));
  }, [timelineReleases]);

  // 1. Fetch releases on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/releases?dataset=real`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          setReleases(json.data);
          const selectable = json.data.filter((r: any) => r.comparisonStatus !== "gap" && (r.comparisonStatus === "notes_only" || r.currentSnapshotStatus === "published" || r.capabilities?.canCompareNotes));
          const byId = new Map<string, any>(selectable.map((r: any) => [String(r.id), r] as [string, any]));
          const bySnapshot = new Map<string, any>(selectable.filter((r: any) => r.currentSnapshotId).map((r: any) => [String(r.currentSnapshotId), r] as [string, any]));
          const latestParams = new URLSearchParams(pendingParams.current);
          const latestFrom = latestParams.get("fromRelease") || latestParams.get("from") || "";
          const latestTo = latestParams.get("toRelease") || latestParams.get("to") || "";
          const normalizedFrom = byId.get(latestFrom)?.id || bySnapshot.get(latestFrom)?.id || "";
          const normalizedTo = byId.get(latestTo)?.id || bySnapshot.get(latestTo)?.id || "";
          const isFromValid = Boolean(normalizedFrom);
          const isToValid = Boolean(normalizedTo);

          if ((latestFrom && !isFromValid) || (latestTo && !isToValid)) {
            updateUrl({ fromRelease: isFromValid ? normalizedFrom : null, toRelease: isToValid ? normalizedTo : null });
          } else if (!latestFrom && !latestTo) {
            const live = selectable.filter((r: any) => r.channel === "live");
            if (live.length >= 2) {
              const pair = live.slice(-2);
              updateUrl({ fromRelease: pair[0].id, toRelease: pair[1].id });
            }
          }
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setErrorMsg(err.message);
      })
      .finally(() => setLoadingReleases(false));
    return () => controller.abort();
  }, [datasetKind]);

  // Update query params helper
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [fromParam, toParam]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const updateUrl = (updates: Record<string, string | number | boolean | null>, immediate = true) => {
    const params = new URLSearchParams(pendingParams.current);
    for (const [k, v] of Object.entries(updates)) {
      const normalizedKey = k === "from" ? "fromRelease" : k === "to" ? "toRelease" : k;
      if (v === null || v === "") {
        params.delete(normalizedKey);
        if (normalizedKey === "fromRelease") params.delete("from");
        if (normalizedKey === "toRelease") params.delete("to");
      } else {
        params.set(normalizedKey, v.toString());
        if (normalizedKey === "fromRelease") params.delete("from");
        if (normalizedKey === "toRelease") params.delete("to");
      }
    }
    params.set("mode", datasetKind);
    const searchString = params.toString();
    lastSelfSearchRef.current = searchString;
    pendingParams.current = searchString;
    const targetUrl = `/compare?${searchString}`;
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", targetUrl);
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (immediate) {
      router.replace(targetUrl, { scroll: false });
    } else {
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        router.replace(targetUrl, { scroll: false });
      }, 350);
    }
  };

  // 2. Fetch Comparison Diff when release pair or dataset changes
  useEffect(() => {
    if (!selectedFrom || !selectedTo) {
      setRawComparison(null);
      return;
    }
    if (loadingReleases) return;

    if (releases.length > 0) {
      const validReleases = new Set(publishedReleases.map((r: any) => r.id));
      if (!validReleases.has(selectedFrom) || !validReleases.has(selectedTo)) {
        setRawComparison(null);
        return;
      }
    }

    setLoadingDiff(true);
    setErrorMsg(null);

    const query = new URLSearchParams({
      fromRelease: selectedFrom,
      toRelease: selectedTo,
      dataset: datasetKind
    });
    if (changedOnlyParam) query.set("changedOnly", "1");

    let active = true;
    const controller = new AbortController();

    fetch(`/api/v1/compare?${query.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Không thể tải chênh lệch phiên bản");
        return json.data as ComparisonResult;
      })
      .then((data) => {
        if (!active) return;
        setRawComparison(data);
      })
      .catch((err) => {
        if (active && err?.name !== "AbortError") setErrorMsg(err.message);
      })
      .finally(() => { if (active) setLoadingDiff(false); });
    return () => { active = false; controller.abort(); };
  }, [selectedFrom, selectedTo, changedOnlyParam, publishedReleases, datasetKind, loadingReleases]);

  // Client-side Instant Memoized Comparison Filter
  const comparison = useMemo(() => {
    if (!rawComparison) return null;
    let champions = rawComparison.champions || [];
    let changes = rawComparison.changes || [];

    if (qParam) {
      const normQ = normalizeSearchString(qParam);
      champions = champions.filter((c) =>
        normalizeSearchString(c.nameVi).includes(normQ) ||
        normalizeSearchString(c.nameEn).includes(normQ) ||
        normalizeSearchString(c.championId).includes(normQ) ||
        (c.traits || []).some((t) => normalizeSearchString(t).includes(normQ))
      );
      changes = changes.filter((ch) =>
        normalizeSearchString(ch.rawEntityName || ch.entityId || "").includes(normQ) ||
        normalizeSearchString(ch.rawText || "").includes(normQ) ||
        normalizeSearchString(ch.fieldKey || "").includes(normQ)
      );
    }

    if (costParam) {
      const costNum = parseInt(costParam, 10);
      if (!isNaN(costNum)) {
        champions = champions.filter((c) => c.cost === costNum);
      }
    }

    if (impactParam) {
      champions = champions.filter((c) => c.summaryImpact === impactParam);
      changes = changes.filter((ch) => {
        const parsed = parseChangeDetail(ch);
        const canonicalImpact = parsed.impact ?? parsed.type;
        if (
          impactParam === "buff" ||
          impactParam === "nerf" ||
          impactParam === "mixed" ||
          impactParam === "neutral" ||
          impactParam === "unknown"
        ) {
          return canonicalImpact === impactParam;
        }
        if (impactParam === "adjustment") {
          return (
            canonicalImpact === "mixed" ||
            canonicalImpact === "neutral" ||
            canonicalImpact === "unknown"
          );
        }
        return parsed.type === impactParam || canonicalImpact === impactParam;
      });
    }

    return {
      ...rawComparison,
      champions,
      changes
    };
  }, [rawComparison, qParam, costParam, impactParam]);

  // Sắp xếp tướng: Tướng có thay đổi (buff/nerf) ưu tiên hiển thị lên đầu
  const sortedChampions = useMemo(() => {
    if (!comparison) return [];
    return [...comparison.champions].sort((a, b) => {
      const aChanged = a.status !== "unchanged";
      const bChanged = b.status !== "unchanged";
      if (aChanged && !bChanged) return -1;
      if (!aChanged && bChanged) return 1;
      if ((b.cost || 0) !== (a.cost || 0)) {
        return (b.cost || 0) - (a.cost || 0);
      }
      return a.nameVi.localeCompare(b.nameVi, "vi");
    });
  }, [comparison]);

  // Gom nhóm tất cả changes từ patch notes
  const noteGroups = useMemo(() => {
    const groups = new Map<string, ReleaseChangeRow[]>();
    for (const change of comparison?.changes || []) {
      const key = `${change.entityKind}:${change.entityId || change.rawEntityName || change.id}`;
      const rows = groups.get(key) || [];
      rows.push(change);
      groups.set(key, rows);
    }
    return Array.from(groups.entries()).map(([key, changes]) => ({ key, changes, first: changes[0] }));
  }, [comparison]);

  // Phân loại ghi chú thành 3 nhóm lớn: Tướng, Lõi & Đồ, Whisp & Khác
  const categorizedNotes = useMemo(() => {
    const champions: typeof noteGroups = [];
    const items: typeof noteGroups = [];
    const augments: typeof noteGroups = [];
    const whisps: typeof noteGroups = [];
    const traits: typeof noteGroups = [];
    const others: typeof noteGroups = [];

    for (const group of noteGroups) {
      const rawName = String(group.first.rawEntityName || group.first.entityId || "").toLowerCase();
      const rawText = String(group.first.rawText || "").toLowerCase();
      const kind = group.first.entityKind;

      if (kind === "champion") {
        champions.push(group);
      } else if (kind === "augment") {
        augments.push(group);
      } else if (kind === "item") {
        items.push(group);
      } else if (rawName.includes("wisp") || rawText.includes("wisp")) {
        whisps.push(group);
      } else if (kind === "trait") {
        traits.push(group);
      } else {
        others.push(group);
      }
    }

    return {
      champions,
      items,
      augments,
      itemsAndAugments: [...items, ...augments],
      whisps,
      traits,
      others,
      whispsAndOthers: [...whisps, ...traits, ...others]
    };
  }, [noteGroups]);

  // Swap From and To
  const handleSwap = () => {
    const nextFrom = selectedTo;
    const nextTo = selectedFrom;
    setSelectedFrom(nextFrom);
    setSelectedTo(nextTo);
    updateUrl({ fromRelease: nextFrom, toRelease: nextTo });
  };

  // Copy Link
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    }
  };

  // Preset handlers
  const releaseLabel = (release: ReleaseMeta) => {
    if (release.id === "event_live_18_1_launch" || release.occurrenceKey === "event_live_18_1_launch") {
      return "Bản 18.1 · Khởi Đầu Mùa 18";
    }
    if (release.id === "event_live_18_1_mid_aug27" || release.occurrenceKey === "event_live_18_1_mid_aug27") {
      return "Bản 18.1 (Vá 27/08 · Quy ước 18.1a · Sửa lỗi & Cân bằng)";
    }
    if (release.id === "event_live_18_1_mid_aug28" || release.occurrenceKey === "event_live_18_1_mid_aug28") {
      return "Bản 18.1 (Vá 28/08 · Sửa lỗi)";
    }
    if (release.id === "event_live_18_1_mid_aug31" || release.occurrenceKey === "event_live_18_1_mid_aug31") {
      return "Bản 18.1 (Vá 31/08 · Quy ước 18.1b · Cân bằng nóng)";
    }
    if (release.id === "rel_live_18_2" || release.occurrenceKey === "live_18_2_official") {
      return "Bản 18.2 · Khu Rừng Kỳ Bí (Cân bằng & Dữ liệu máy chủ)";
    }
    if (release.id === "rel_live_18_3" || release.occurrenceKey === "rel_live_18_3") {
      return "Bản 18.3 · Cân Bằng Giữa Mùa";
    }
    if (release.id === "rel_live_18_4" || release.occurrenceKey === "rel_live_18_4") {
      return "Bản 18.4 · Tinh Chỉnh Cân Bằng";
    }
    if (release.id === "rel_live_18_5" || release.occurrenceKey === "rel_live_18_5") {
      return "Bản 18.5 · Cân Bằng Chung Kết Thế Giới";
    }
    if (release.id === "rel_live_18_5c" || release.occurrenceKey === "rel_live_18_5c") {
      return "Bản 18.5c (Mới nhất · Vá khẩn cấp CKTG)";
    }
    if (release.id === "rel_pbe_18_3" || release.occurrenceKey === "pbe_18_3_testing") {
      return "Bản 18.3 PBE (Máy chủ thử nghiệm Riot)";
    }

    const label = release.displayLabel || release.displayVersion || release.patchLabel || release.occurrenceKey;
    return label.replace(/\bLive\b/gi, "Bản").replace(/\bPBE\b/gi, "PBE");
  };

  const statusLabel = (status?: string | null) => ({
    available: "đầy đủ",
    notes_only: "chỉ có ghi chú",
    quarantined: "cách ly",
    collecting: "đang thu thập",
    gap: "thiếu dữ liệu",
    unknown: "chưa rõ"
  } as Record<string, string>)[status || "unknown"] || "chưa rõ";

  const choosePair = (from: ReleaseMeta | undefined, to: ReleaseMeta | undefined) => {
    if (from?.id && to?.id) {
      updateUrl({ fromRelease: from.id, toRelease: to.id });
      return true;
    }
    return false;
  };

  const handlePreset = (type: string) => {
    if (publishedReleases.length < 2) {
      setErrorMsg("Chưa đủ 2 mốc release có bằng chứng để áp dụng mẫu so sánh.");
      return;
    }

    if (type === "patch_18_2") {
      const live18_1 = publishedReleases.find((r) => r.channel === "live" && r.versionKey?.includes(":18.1"));
      const live18_2 = publishedReleases.find((r) => r.channel === "live" && r.versionKey?.includes(":18.2"));
      if (choosePair(live18_1, live18_2)) return;
    } else if (type === "latest_meta") {
      const from = publishedReleases.find((r) => r.id === "rel_live_18_2");
      const to = publishedReleases.find((r) => r.id === "rel_live_18_5c");
      if (choosePair(from, to)) return;
    } else if (type === "patch_18_5c") {
      const from = publishedReleases.find((r) => r.id === "rel_live_18_5");
      const to = publishedReleases.find((r) => r.id === "rel_live_18_5c");
      if (choosePair(from, to)) return;
    } else if (type === "adjacent" && publishedReleases.length >= 2) {
      choosePair(publishedReleases[publishedReleases.length - 2], publishedReleases[publishedReleases.length - 1]);
    } else if (type === "pbe_to_launch") {
      const pbe = publishedReleases.find((r) => r.channel === "pbe");
      const launch = publishedReleases.find((r) => r.isLaunchRelease || r.channel === "live");
      choosePair(pbe, launch);
    } else if (type === "pbe_latest_vs_live_latest") {
      const pbeLatest = [...publishedReleases].reverse().find((r) => r.channel === "pbe");
      const liveLatest = [...publishedReleases].reverse().find((r) => r.channel === "live");
      choosePair(pbeLatest, liveLatest);
    }
  };

  // Open Evidence
  const openEvidence = (sourceRefIds: string[]) => {
    setActiveEvidenceIds(sourceRefIds);
    setDrawerOpen(true);
  };

  const renderDiffValue = (val: any, champId?: string, champCost?: number) => {
    if (val === null || val === undefined || val === "N/A") {
      return <span className="text-slate-500 italic">Chưa có bằng chứng</span>;
    }
    if (Array.isArray(val)) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {val.map((item, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm"
            >
              {item}
            </span>
          ))}
        </div>
      );
    }
    if (typeof val === "number") {
      return <span className="font-mono">{val.toLocaleString()}</span>;
    }
    const str = String(val);
    if (str.includes("<") || str.includes("@") || str.includes("\n") || str.includes("\\n") || str.length > 50) {
      return <FormattedDescription text={str} championId={champId} cost={champCost} />;
    }
    return <span>{str}</span>;
  };

  // Counts for tabs
  const champCount = comparison?.champions.length
    ? (comparison.summary.changedChampionCount ?? comparison.summary.changedChampions)
    : categorizedNotes.champions.length;
  const itemAugmentCount = categorizedNotes.itemsAndAugments.length;
  const whispOtherCount = categorizedNotes.whispsAndOthers.length;

  // Auto switch tab if current tab is empty and another tab has changes
  useEffect(() => {
    if (!comparison) return;
    if (activeTab === "whisps_others" && whispOtherCount === 0) {
      if (champCount > 0) setActiveTabState("champions");
      else if (itemAugmentCount > 0) setActiveTabState("items_augments");
    } else if (activeTab === "items_augments" && itemAugmentCount === 0) {
      if (champCount > 0) setActiveTabState("champions");
      else if (whispOtherCount > 0) setActiveTabState("whisps_others");
    } else if (activeTab === "champions" && champCount === 0) {
      if (itemAugmentCount > 0) setActiveTabState("items_augments");
      else if (whispOtherCount > 0) setActiveTabState("whisps_others");
    }
  }, [comparison, champCount, itemAugmentCount, whispOtherCount, activeTab]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Version Selectors */}
      <div className="glass-panel-elevated rounded-2xl border border-white/[0.08] p-5 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <SlidersHorizontal className="w-6 h-6 text-amber-400 shrink-0" />
              <span>So Sánh Phiên Bản TFT Mùa 18</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full border text-emerald-300 border-emerald-500/40 bg-emerald-500/15 font-bold">
                DỮ LIỆU THẬT
              </span>
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Theo dõi chi tiết mọi thay đổi chỉ số nền, tỷ lệ kỹ năng theo cấp sao và mô tả cơ chế theo từng mốc có bằng chứng.
            </p>
          </div>

          {/* Presets & Copy Button */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              onChange={(e) => handlePreset(e.target.value)}
              defaultValue=""
              disabled={publishedReleases.length < 2}
              className="bg-[#0c0e17] border border-white/[0.08] text-xs text-slate-200 rounded-full px-3.5 py-2 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
            >
              <option value="" disabled>
                {publishedReleases.length < 2 ? "Chưa đủ mốc công bố..." : "Mốc so sánh mẫu..."}
              </option>
              <option value="latest_meta">18.2 → 18.5c (Mới nhất - Vá CKTG)</option>
              <option value="patch_18_5c">18.5 → 18.5c (Vá khẩn cấp CKTG)</option>
              <option value="patch_18_2">18.1 → 18.2 (Khu Rừng Kỳ Bí)</option>
              <option value="adjacent">Hai bản liền kề</option>
              <option value="pbe_to_launch">PBE sớm nhất → Bản ra mắt</option>
            </select>

            <button
              onClick={handleCopyLink}
              className="capsule-sheen flex items-center gap-1.5 bg-[#161926] hover:bg-[#1f2336] border border-white/[0.08] text-slate-200 text-xs px-3.5 py-2 rounded-full transition shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Đã chép link" : "Sao chép link"}</span>
            </button>
          </div>
        </div>

        {/* Thông báo hướng dẫn mốc so sánh */}
        {publishedReleases.length < 2 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Chưa đủ 2 mốc release có bằng chứng để so sánh</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Mốc chỉ có ghi chú vẫn có thể mở để đọc thay đổi Riot công bố; trạng thái thiếu ảnh chụp được giữ nguyên và không dựng số liệu.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/history"
                className="inline-flex max-w-full items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow"
              >
                <span className="text-left break-words">Xem lịch sử thay đổi chính thức qua ghi chú cập nhật</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </Link>
              <Link
                href="/timeline"
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Xem dòng thời gian phát hành
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span>
                Chọn 2 mốc bất kỳ để xem phân tích buff/nerf tự động giữa các phiên bản. Số liệu hiển thị theo ảnh chụp dữ liệu thật đã xác minh.
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] shrink-0">
              <Link
                href="/history"
                className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
              >
                <span>Ghi chú Riot</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                href="/timeline"
                className="text-slate-400 hover:text-slate-200 underline"
              >
                Dòng thời gian
              </Link>
            </div>
          </div>
        )}

        {/* From / Swap / To Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-3 pt-1">
          {/* Version A */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bản A (Trước)</label>
            <select
              aria-label="Bản A (Trước)"
              value={selectedFrom}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFrom(val);
                updateUrl({ fromRelease: val });
              }}
              disabled={!hydrated || loadingReleases || publishedReleases.length === 0}
              className="w-full bg-[#0c0e17] border border-white/[0.08] text-slate-100 rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] font-medium outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{publishedReleases.length === 0 ? "-- Chưa có release có bằng chứng --" : "-- Chọn mốc bắt đầu --"}</option>
              {publishedReleases.map((r) => (
                <option key={`from_${r.id}`} value={r.id}>
                  [{r.channel === "live" ? "CHÍNH THỨC" : "PBE"}] {releaseLabel(r)} ({new Date(r.effectiveAt || r.observedAt).toLocaleDateString("vi-VN")})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center md:pt-5">
            <button
              onClick={handleSwap}
              title="Đổi chiều so sánh"
              aria-label="Đổi chiều so sánh"
              disabled={publishedReleases.length < 2}
              className="capsule-sheen p-2.5 rounded-full bg-[#161926] hover:bg-amber-400/10 text-slate-200 hover:text-amber-300 border border-white/[0.1] hover:border-amber-400/40 shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Version B */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bản B (Sau)</label>
            <select
              aria-label="Bản B (Sau)"
              value={selectedTo}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTo(val);
                updateUrl({ toRelease: val });
              }}
              disabled={!hydrated || loadingReleases || publishedReleases.length === 0}
              className="w-full bg-[#0c0e17] border border-white/[0.08] text-slate-100 rounded-xl px-3.5 py-2.5 text-xs sm:text-[13px] font-medium outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{publishedReleases.length === 0 ? "-- Chưa có release có bằng chứng --" : "-- Chọn mốc so sánh --"}</option>
              {publishedReleases.map((r) => (
                <option key={`to_${r.id}`} value={r.id}>
                  [{r.channel === "live" ? "CHÍNH THỨC" : "PBE"}] {releaseLabel(r)} ({new Date(r.effectiveAt || r.observedAt).toLocaleDateString("vi-VN")})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Thông báo cho các bản cập nhật chỉ có ghi chú hoặc ảnh chụp đang cách ly */}
        {releases.some((r) => !r.currentSnapshotId || (r as any).currentSnapshotStatus === "quarantined") && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              ℹ️ <strong>Các mốc chỉ có ghi chú hoặc ảnh chụp đang cách ly kiểm toán:</strong>{" "}
              {releases
                .filter((r) => !r.currentSnapshotId || (r as any).currentSnapshotStatus === "quarantined")
                .map((r) => `${releaseLabel(r)} · ${statusLabel(r.comparisonStatus)}`)
                .join(", ")}.
            </span>
            <Link href="/history" className="text-emerald-400 hover:underline font-semibold shrink-0">
              Xem ghi chú cập nhật →
            </Link>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Dòng thời gian có thứ tự</div>
          <div className="flex flex-wrap gap-2">
            {timelineReleases.map((release) => (
              <span key={`timeline_${release.id}`} className={`px-2 py-1 rounded-md border text-[11px] ${release.comparisonStatus === "available" ? "border-emerald-500/30 text-emerald-300" : "border-slate-700 text-slate-400"}`}>
                {releaseLabel(release)} · {statusLabel(release.comparisonStatus)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Top Summary Counters & Meta Context */}
      {comparison && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400 px-1">
            <div>
              {comparison.summary.rosterTotal !== null ? (
                <>Tổng số tướng: <span className="text-slate-200 font-bold">{comparison.summary.rosterTotal} tướng toàn mùa</span></>
              ) : (
                <>Phạm vi so sánh: <span className="text-slate-200 font-bold">Ghi chú cân bằng chính thức từ Riot Games (Set 18)</span></>
              )}
            </div>
            <div>•</div>
            <div>
              Tướng thay đổi: <span className="text-emerald-400 font-bold">{comparison.summary.changedChampionCount ?? comparison.summary.changedChampions}</span>
            </div>
            <div>•</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              Buff: <span className="text-emerald-400 font-bold">{comparison.summary.buffedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
              Nerf: <span className="text-rose-400 font-bold">{comparison.summary.nerfedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
              Hỗn hợp: <span className="text-amber-400 font-bold">{comparison.summary.mixedCount}</span>
            </div>
            {(comparison.summary.changedItemCount || comparison.summary.changedAugmentCount || comparison.summary.changedTraitCount) ? (
              <div className="text-slate-400">
                Tách riêng: {comparison.summary.changedItemCount || 0} trang bị · {comparison.summary.changedAugmentCount || 0} lõi · {comparison.summary.changedTraitCount || 0} tộc/hệ
              </div>
            ) : null}
            {(comparison.summary.hiddenMaintenanceCount || 0) > 0 && (
              <div className="text-slate-500">Đã ẩn {comparison.summary.hiddenMaintenanceCount} mục sửa lỗi, hiển thị hoặc khác chế độ; vẫn giữ trong bằng chứng.</div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-300 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-100 break-words">
                {comparison.fromDisplayLabel || comparison.fromSnapshotId} → {comparison.toDisplayLabel || comparison.toSnapshotId}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400 shrink-0">
                {comparison.comparisonMode === "range" ? "so sánh theo khoảng" : "hai mốc liền kề"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 shrink-0 ${comparison.evidenceStatus === "available" ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}`}>
                bằng chứng: {statusLabel(comparison.evidenceStatus)}
              </span>
            </div>
            {comparison.intermediateVersions && comparison.intermediateVersions.length > 0 && (
              <div className="text-amber-300 break-words">
                Khoảng này đi qua: {comparison.intermediateVersions.map((version) => `${version.displayVersion} (${statusLabel(version.comparisonStatus)})`).join(" → ")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN TABS BAR: TƯỚNG | LÕI & TRANG BỊ | TINH LINH / TỘC-HỆ / HỆ THỐNG */}
      <div className="border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-2.5 scrollbar-none">
          {/* Tab 1: Tướng */}
          <button
            type="button"
            onClick={() => handleTabChange("champions")}
            className={`capsule-sheen flex items-center gap-2 py-2 px-4 rounded-full font-bold text-xs sm:text-[13px] transition-all relative shrink-0 ${
              activeTab === "champions"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
                : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Tướng</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === "champions"
                  ? "bg-black/30 text-slate-950"
                  : "bg-black/40 text-slate-400"
              }`}
            >
              {champCount}
            </span>
          </button>

          {/* Tab 2: Lõi & Trang bị */}
          <button
            type="button"
            onClick={() => handleTabChange("items_augments")}
            className={`capsule-sheen flex items-center gap-2 py-2 px-4 rounded-full font-bold text-xs sm:text-[13px] transition-all relative shrink-0 ${
              activeTab === "items_augments"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
                : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lõi & Trang bị</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === "items_augments"
                  ? "bg-black/30 text-slate-950"
                  : "bg-black/40 text-slate-400"
              }`}
            >
              {itemAugmentCount}
            </span>
          </button>

          {/* Tab 3: Tinh Linh / Tộc-hệ / Hệ thống */}
          <button
            type="button"
            onClick={() => handleTabChange("whisps_others")}
            className={`capsule-sheen flex items-center gap-2 py-2 px-4 rounded-full font-bold text-xs sm:text-[13px] transition-all relative shrink-0 ${
              activeTab === "whisps_others"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-300/60"
                : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
            }`}
          >
            <Ghost className="w-3.5 h-3.5" />
            <span>Tinh Linh / Tộc-hệ / Hệ thống</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === "whisps_others"
                  ? "bg-black/30 text-slate-950"
                  : "bg-black/40 text-slate-400"
              }`}
            >
              {whispOtherCount}
            </span>
          </button>
        </div>

        {/* Dynamic Trait mechanism toggle */}
        <button
          type="button"
          onClick={() => setShowTraits(!showTraits)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition shrink-0"
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tộc/Hệ tiêu điểm</span>
          {showTraits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Trait Overview Accordion */}
      {showTraits && comparison && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 text-xs text-slate-300 flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Đối chiếu thay đổi mốc kích hoạt Tộc/Hệ Set 18
            </span>
            <span className="text-[11px] text-slate-500">
              {categorizedNotes.traits.length > 0 ? `${categorizedNotes.traits.length} tộc/hệ có thay đổi` : "Trích xuất từ dữ liệu trò chơi"}
            </span>
          </div>
          {categorizedNotes.traits.length > 0 ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categorizedNotes.traits.map((group) => {
                const title = noteEntityLabel(group.first);
                return (
                  <div key={group.key} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        {title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                        Cân bằng
                      </span>
                    </div>
                    <div className="text-slate-300 font-mono text-[11px]">
                      {String(group.first.before?.value ?? "-")} <span className="text-slate-500">⇒</span> <span className="text-emerald-400 font-bold">{String(group.first.after?.value ?? "-")}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {group.first.rawText}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-xs text-slate-400 text-center">
              Chưa ghi nhận thay đổi chỉ số Tộc/Hệ riêng lẻ trong phạm vi hai mốc được chọn. Các tương tác Tộc/Hệ hiện được đối chiếu trực tiếp theo từng tướng bên dưới.
            </div>
          )}
        </div>
      )}

      {/* 4. Sub-Filter Toolbars Per Tab */}
      {activeTab === "champions" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={qParam}
                placeholder="Tìm tướng (Việt / Anh)..."
                onChange={(e) => {
                  const val = e.target.value;
                  setQParam(val);
                  updateUrl({ q: val }, false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateUrl({ q: qParam }, true);
                  }
                }}
                onBlur={() => updateUrl({ q: qParam }, true)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Cost Filter */}
            <select
              value={costParam}
              onChange={(e) => updateUrl({ cost: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
            >
              <option value="">Mọi giá vàng</option>
              <option value="1">1 vàng</option>
              <option value="2">2 vàng</option>
              <option value="3">3 vàng</option>
              <option value="4">4 vàng</option>
              <option value="5">5 vàng</option>
            </select>

            {/* Impact Filter */}
            <select
              value={impactParam}
              onChange={(e) => updateUrl({ impact: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
            >
              <option value="">Tất cả tác động</option>
              <option value="buff">Tăng</option>
              <option value="nerf">Giảm</option>
              <option value="mixed">Hỗn hợp</option>
              <option value="neutral">Điều chỉnh / Giữ nguyên</option>
            </select>
          </div>

          {/* View Mode Tabs: All vs Changed */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => updateUrl({ changedOnly: null })}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                !changedOnlyParam
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tất cả tướng ({comparison ? (comparison.summary.rosterTotal === null ? "—" : (comparison.summary.rosterTotal ?? comparison.summary.totalChampions)) : "—"})</span>
            </button>
            <button
              onClick={() => updateUrl({ changedOnly: "1" })}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                changedOnlyParam
                  ? "bg-emerald-500 text-slate-950 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Có thay đổi ({comparison ? (comparison.summary.changedChampionCount ?? comparison.summary.changedChampions) : "—"})</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "items_augments" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-slate-400 font-semibold mr-1">Bộ lọc:</span>
            <button
              type="button"
              onClick={() => setItemAugmentFilter("all")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                itemAugmentFilter === "all"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              Tất cả ({categorizedNotes.itemsAndAugments.length})
            </button>
            <button
              type="button"
              onClick={() => setItemAugmentFilter("augment")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                itemAugmentFilter === "augment"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              ⚡ Lõi nâng cấp ({categorizedNotes.augments.length})
            </button>
            <button
              type="button"
              onClick={() => setItemAugmentFilter("item")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                itemAugmentFilter === "item"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              🛡️ Trang bị ({categorizedNotes.items.length})
            </button>
          </div>
          <span className="text-xs text-slate-400 italic">Bấm vào bất kỳ mục nào để xem thanh bên chi tiết thông số</span>
        </div>
      )}

      {activeTab === "whisps_others" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-slate-400 font-semibold mr-1">Phân loại:</span>
            <button
              type="button"
              onClick={() => setWhispFilter("all")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                whispFilter === "all"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              Tất cả ({categorizedNotes.whispsAndOthers.length})
            </button>
            <button
              type="button"
              onClick={() => setWhispFilter("wisp")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                whispFilter === "wisp"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              ✨ Wisps ({categorizedNotes.whisps.length})
            </button>
            <button
              type="button"
              onClick={() => setWhispFilter("trait")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                whispFilter === "trait"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              🌿 Tộc / Hệ ({categorizedNotes.traits.length})
            </button>
            <button
              type="button"
              onClick={() => setWhispFilter("system")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                whispFilter === "system"
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              ⚙️ Cơ chế & Hệ thống ({categorizedNotes.others.length})
            </button>
          </div>
          <span className="text-xs text-slate-400 italic">Hiển thị đầy đủ tất cả thông số & dẫn chứng nguồn</span>
        </div>
      )}

      {/* 5. Main Content Area */}
      {loadingDiff ? (
        <div className="py-20 text-center text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm">Đang tính toán chênh lệch chỉ số giữa hai phiên bản...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{errorMsg.includes("quarantined") ? "Mốc dữ liệu đã bị cách ly hoặc thu hồi" : "Lỗi so sánh dữ liệu"}</span>
          </div>
          <p>{errorMsg}</p>
          {errorMsg.includes("quarantined") && (
            <p className="text-xs text-rose-400">
              Ảnh chụp được chọn đã bị thu hồi do dữ liệu tự sinh hoặc vi phạm tiêu chuẩn kiểm định nguồn. Vui lòng chọn các mốc dữ liệu hợp lệ khác.
            </p>
          )}
        </div>
      ) : (!selectedFrom || !selectedTo || selectedFrom === selectedTo) ? (
        <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm">
          Vui lòng chọn 2 phiên bản khác nhau ở trên để tính toán và so sánh sự thay đổi chỉ số.
        </div>
      ) : !comparison ? (
        <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm">
          Chưa có dữ liệu so sánh cho cặp mốc này.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Note comparison banner */}
          {comparison.changes && comparison.changes.length > 0 && comparison.champions.length === 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <strong>Theo ghi chú cập nhật</strong> · Mỗi thẻ giữ nguyên giá trị trước/sau và liên kết bằng chứng; ô thiếu không được suy diễn thành ảnh chụp.
            </div>
          )}

          {/* TAB 1: TƯỚNG (CHAMPIONS) */}
          {activeTab === "champions" && (
            <div>
              {/* Snapshot champions */}
              {sortedChampions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedChampions.map((champ) => {
                    const colorClasses = getImpactColorClasses(champ.summaryImpact);
                    const isChanged = champ.status !== "unchanged";

                    return (
                      <article
                        key={champ.championId}
                        onClick={() => setDetailEntity({ kind: "champion_diff", champion: champ })}
                        className={`group p-4 rounded-xl border bg-slate-900/90 hover:bg-slate-850 transition cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between gap-3 ${
                          champ.summaryImpact === "buff"
                            ? "border-emerald-500/30 hover:border-emerald-500/60"
                            : champ.summaryImpact === "nerf"
                              ? "border-rose-500/30 hover:border-rose-500/60"
                              : champ.summaryImpact === "mixed"
                                ? "border-amber-500/30 hover:border-amber-500/60"
                                : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {/* Header: Avatar, Name, Cost, Badge */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <ChampionAvatar
                              icon={champ.icon}
                              name={champ.nameVi}
                              cost={champ.cost}
                              size="md"
                            />
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition truncate">
                                {champ.nameVi}
                              </h3>
                              <p className="text-[11px] text-slate-400 truncate">
                                {champ.nameEn} {champ.cost ? `• ${champ.cost} vàng` : ""}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {champ.traits.slice(0, 2).map((t) => (
                                  <span key={t} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${colorClasses.badge}`}>
                            {getImpactLabelVi(champ.summaryImpact)}
                          </span>
                        </div>

                        {/* Highlights info */}
                        <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1">
                          {isChanged && champ.fieldDiffs.length > 0 ? (
                            champ.fieldDiffs.slice(0, 2).map((diff, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-slate-400 truncate">{diff.fieldLabelVi}:</span>
                                <span className={`font-mono font-semibold shrink-0 ${
                                  diff.impact === "buff" ? "text-emerald-400" : diff.impact === "nerf" ? "text-rose-400" : "text-slate-300"
                                }`}>
                                  {formatDelta(diff.absoluteDelta, diff.relativeDeltaPercent, diff.percentagePointDelta, diff.unit)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-[11px] text-slate-500 italic">
                              Giữ nguyên toàn bộ chỉ số giữa hai bản
                            </div>
                          )}
                          {champ.fieldDiffs.length > 2 && (
                            <div className="text-[10px] text-slate-500">
                              +{champ.fieldDiffs.length - 2} thay đổi khác...
                            </div>
                          )}
                        </div>

                        {/* Click CTA hint */}
                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium pt-1">
                          <span>Chi tiết thông số</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : categorizedNotes.champions.length > 0 ? (
                /* Note champions */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categorizedNotes.champions.map((group) => {
                    const title = noteEntityLabel(group.first);
                    const impact = computeNoteGroupImpact(group.changes);
                    const colorClasses = getImpactColorClasses(impact);
                    const entry = resolveSet18Champion(group.first.entityId || group.first.rawEntityName);
                    const isExpanded = expandedNoteGroups.has(group.key);
                    const displayedChanges = isExpanded ? group.changes : group.changes.slice(0, 2);

                    return (
                      <article
                        key={group.key}
                        onClick={() => setDetailEntity({ kind: "note_group", group, title, category: "champion" })}
                        className="group p-4 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-850 hover:border-emerald-500/50 transition cursor-pointer shadow-sm flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <ChampionAvatar
                              icon={null}
                              name={title}
                              cost={entry?.cost}
                              size="md"
                            />
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition truncate">
                                {title}
                              </h3>
                              <p className="text-[11px] text-slate-400 truncate">
                                Theo ghi chú cập nhật ({group.changes.length} thay đổi)
                              </p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${colorClasses.badge}`}>
                            {getImpactLabelVi(impact)}
                          </span>
                        </div>

                        {/* Summary lines */}
                        <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1">
                          {displayedChanges.map((change, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-400 truncate">{formatNoteFieldLabel(change)}</span>
                              <span className="font-mono text-slate-200 text-[10px] truncate">
                                {change.before.state === "known" ? String(change.before.value) : "—"} → {change.after.state === "known" ? String(change.after.value) : "—"}
                              </span>
                            </div>
                          ))}

                          {group.changes.length > 2 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNoteGroup(group.key);
                              }}
                              className="w-full mt-1.5 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Thu gọn danh sách</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>Xem toàn bộ ({group.changes.length} thay đổi)</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium pt-1">
                          <span>Chi tiết ghi chú</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm">
                  {(comparison.hiddenChanges?.length || 0) > 0 && !(comparison.changes?.length) ? (
                    <span>Mốc này chỉ có mục sửa lỗi hoặc hiển thị ({comparison.hiddenChanges?.length}); không có thay đổi chỉ số tướng để hiển thị.</span>
                  ) : changedOnlyParam ? (
                    comparison.summary.changedChampions === 0 ? (
                      <span>Không có tướng nào thay đổi chỉ số giữa hai phiên bản này (0 thay đổi).</span>
                    ) : (
                      <span>Không tìm thấy tướng thay đổi nào khớp với bộ lọc tìm kiếm.</span>
                    )
                  ) : (
                    <span>Không tìm thấy tướng nào khớp với bộ lọc hiện tại (trong tổng số {comparison.summary.totalChampions} tướng).</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LÕI & ĐỒ (AUGMENTS & ITEMS) */}
          {activeTab === "items_augments" && (
            <div>
              {categorizedNotes.itemsAndAugments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categorizedNotes.itemsAndAugments
                    .filter((g) => {
                      if (itemAugmentFilter === "augment") return g.first.entityKind === "augment";
                      if (itemAugmentFilter === "item") return g.first.entityKind === "item";
                      return true;
                    })
                    .map((group) => {
                      const title = noteEntityLabel(group.first);
                      const impact = computeNoteGroupImpact(group.changes);
                      const colorClasses = getImpactColorClasses(impact);
                      const isItem = group.first.entityKind === "item";

                      return (
                        <article
                          key={group.key}
                          onClick={() => setDetailEntity({ kind: "note_group", group, title, category: isItem ? "item" : "augment" })}
                          className="group p-4 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-850 hover:border-emerald-500/50 transition cursor-pointer shadow-sm flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              {isItem ? (
                                <ItemMiniChip itemName={group.first.rawEntityName || group.first.entityId || "item"} className="w-10 h-10 shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition truncate">
                                  {title}
                                </h3>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {isItem ? "Trang bị" : "Lõi nâng cấp"} • {group.changes.length} thay đổi
                                </p>
                              </div>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${colorClasses.badge}`}>
                              {getImpactLabelVi(impact)}
                            </span>
                          </div>

                          {/* Highlights */}
                          <div className="pt-2 border-t border-slate-800/80 text-xs space-y-1">
                            {group.changes.slice(0, 2).map((change, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-slate-400 truncate">{formatNoteFieldLabel(change)}:</span>
                                <span className="font-mono text-slate-200 text-[10px] shrink-0 truncate">
                                  {change.before.state === "known" ? String(change.before.value) : "—"} → {change.after.state === "known" ? String(change.after.value) : "—"}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium pt-1">
                            <span>Chi tiết thông số</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : (
                <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm space-y-2">
                  <Sparkles className="w-6 h-6 text-slate-500 mx-auto" />
                  <p>Không ghi nhận thay đổi trang bị hoặc lõi trong phạm vi cập nhật này.</p>
                  <p className="text-xs text-slate-500">
                    Dữ liệu ảnh chụp độc lập (CDragon) hiện theo dõi 74 tướng; các điều chỉnh trang bị/lõi được cập nhật đầy đủ qua Ghi chú cập nhật chính thức.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WHISP VÀ NHỮNG THỨ CÒN LẠI (HIỂN THỊ ĐẦY ĐỦ TRỰC TIẾP) */}
          {activeTab === "whisps_others" && (
            <div>
              {categorizedNotes.whispsAndOthers.length > 0 ? (
                <div className="space-y-3">
                  {categorizedNotes.whispsAndOthers
                    .filter((g) => {
                      if (whispFilter === "wisp") return categorizedNotes.whisps.some((w) => w.key === g.key);
                      if (whispFilter === "trait") return categorizedNotes.traits.some((t) => t.key === g.key);
                      if (whispFilter === "system") return categorizedNotes.others.some((o) => o.key === g.key);
                      return true;
                    })
                    .map((group) => {
                      const title = noteEntityLabel(group.first);
                      const isWisp = categorizedNotes.whisps.some((w) => w.key === gKey(group));
                      const isTrait = categorizedNotes.traits.some((t) => t.key === gKey(group));
                      const impact = computeNoteGroupImpact(group.changes);
                      const colorClasses = getImpactColorClasses(impact);

                      return (
                        <article
                          key={group.key}
                          className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow space-y-3"
                        >
                          {/* Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                                isWisp
                                  ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
                                  : isTrait
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                              }`}>
                                {isWisp ? <Ghost className="w-5 h-5" /> : isTrait ? <Shield className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
                              </div>
                              <div>
                                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                                  {title}
                                  {isWisp && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold border-purple-500/40 bg-purple-500/10 text-purple-300">
                                      WISP MÙA 18
                                    </span>
                                  )}
                                  {isTrait && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                                      TỘC / HỆ
                                    </span>
                                  )}
                                  {!isWisp && !isTrait && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold border-blue-500/40 bg-blue-500/10 text-blue-300">
                                      HỆ THỐNG & CƠ CHẾ
                                    </span>
                                  )}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {group.changes.length} thay đổi được ghi nhận
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${colorClasses.badge}`}>
                                {getImpactLabelVi(impact)}
                              </span>
                              {group.first.sourceUrl && (
                                <a
                                  href={group.first.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  <span>Nguồn Riot</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Full Changes List (Hiển thị đầy đủ trực tiếp) */}
                          <div className="space-y-2">
                            {group.changes.map((change) => (
                              <div
                                key={change.id}
                                className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-slate-200 font-semibold truncate">
                                    {formatNoteFieldLabel(change)}
                                  </div>
                                  {change.changeType && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 bg-slate-800/50">
                                      {formatChangeTypeVi(change.changeType)}
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center font-mono py-1">
                                  <span className="text-slate-400 break-words">
                                    {change.before.state === "known" ? JSON.stringify(change.before.value) : "Chưa có bằng chứng"}
                                  </span>
                                  <span className="text-slate-600 font-bold">→</span>
                                  <span className="text-slate-100 font-bold break-words">
                                    {change.after.state === "known" ? JSON.stringify(change.after.value) : "Chưa có bằng chứng"}
                                  </span>
                                </div>

                                {change.rawText && (
                                  <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
                                    <span className="text-slate-500 block mb-0.5 font-sans text-[10px]">Nguyên văn:</span>
                                    <p className="break-words">{change.rawText}</p>
                                  </div>
                                )}

                                {change.sourceLocator && (
                                  <div className="text-[10px] text-slate-500 font-mono pt-1">
                                    Vị trí văn bản: {change.sourceLocator}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : (
                <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm space-y-2">
                  <Ghost className="w-6 h-6 text-slate-500 mx-auto" />
                  <p>Không có thay đổi nào cho Wisps hoặc cơ chế hệ thống trong phạm vi này.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. SIDEBAR DRAWER: CHI TIẾT TƯỚNG / ĐỒ / LÕI KHI BẤM VÀO */}
      {detailEntity && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-150"
            onClick={() => setDetailEntity(null)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Thanh bên chi tiết"
            className="fixed inset-y-0 right-0 z-40 w-full sm:max-w-lg lg:max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {detailEntity.kind === "champion_diff" ? (
                  <ChampionAvatar
                    icon={detailEntity.champion.icon}
                    name={detailEntity.champion.nameVi}
                    cost={detailEntity.champion.cost}
                    size="lg"
                  />
                ) : detailEntity.category === "item" ? (
                  <ItemMiniChip itemName={detailEntity.group.first.rawEntityName || detailEntity.group.first.entityId || "item"} className="w-12 h-12 shrink-0" />
                ) : detailEntity.category === "champion" ? (
                  <ChampionAvatar
                    icon={null}
                    name={detailEntity.title}
                    size="lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-100 truncate">
                      {detailEntity.kind === "champion_diff" ? detailEntity.champion.nameVi : detailEntity.title}
                    </h2>
                  </div>

                  <p className="text-xs text-slate-400 mt-0.5">
                    {detailEntity.kind === "champion_diff"
                      ? `${detailEntity.champion.nameEn} • ${detailEntity.champion.cost || 1} vàng`
                      : detailEntity.category === "item"
                        ? "Trang bị"
                        : detailEntity.category === "augment"
                          ? "Lõi nâng cấp"
                          : "Tướng (theo ghi chú)"}
                  </p>

                  {detailEntity.kind === "champion_diff" && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {detailEntity.champion.traits.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {detailEntity.kind === "champion_diff" && (
                  <Link
                    href={`/champions/${detailEntity.champion.championId}?from=${selectedFrom}&to=${selectedTo}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                    title="Mở hồ sơ chi tiết tướng"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setDetailEntity(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  aria-label="Đóng thanh bên"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Overall Impact Badge */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-xs text-slate-400 font-semibold">Tác động tổng thể:</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  detailEntity.kind === "champion_diff"
                    ? getImpactColorClasses(detailEntity.champion.summaryImpact).badge
                    : getImpactColorClasses(computeNoteGroupImpact(detailEntity.group.changes)).badge
                }`}>
                  {detailEntity.kind === "champion_diff"
                    ? getImpactLabelVi(detailEntity.champion.summaryImpact)
                    : getImpactLabelVi(computeNoteGroupImpact(detailEntity.group.changes))}
                </span>
              </div>

              {/* Case 1: Champion from Snapshot Diff */}
              {detailEntity.kind === "champion_diff" && (
                <div className="space-y-6">
                  {/* Field Diffs Table */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Swords className="w-4 h-4 text-emerald-400" />
                      Thay đổi thông số & kỹ năng
                    </h3>

                    {detailEntity.champion.fieldDiffs.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Chỉ số và kỹ năng của tướng được giữ nguyên giữa hai mốc này.</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/60">
                            <tr>
                              <th className="py-2.5 px-3">Chỉ số</th>
                              <th className="py-2.5 px-3">Bản A</th>
                              <th className="py-2.5 px-3">Bản B</th>
                              <th className="py-2.5 px-3">Chênh lệch</th>
                              <th className="py-2.5 px-3 text-right">Nguồn</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {detailEntity.champion.fieldDiffs.map((diff, idx) => {
                              const beforeVal = diff.before.state === "known" ? diff.before.value : null;
                              const afterVal = diff.after.state === "known" ? diff.after.value : null;
                              const deltaStr = formatDelta(diff.absoluteDelta, diff.relativeDeltaPercent, diff.percentagePointDelta, diff.unit);
                              const diffColor = getImpactColorClasses(diff.impact);

                              return (
                                <tr key={idx} className="hover:bg-slate-900/50">
                                  <td className="py-2.5 px-3 font-medium text-slate-200">
                                    {diff.fieldLabelVi}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                                    {renderDiffValue(beforeVal, detailEntity.champion.championId, detailEntity.champion.cost ?? undefined)}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-100 font-mono text-[11px]">
                                    {renderDiffValue(afterVal, detailEntity.champion.championId, detailEntity.champion.cost ?? undefined)}
                                  </td>
                                  <td className={`py-2.5 px-3 font-bold ${diffColor.text}`}>
                                    {deltaStr || "—"}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {diff.after.sourceRefIds && diff.after.sourceRefIds.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => openEvidence(diff.after.sourceRefIds)}
                                        className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
                                      >
                                        <span>Xem</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Base Stats */}
                  {detailEntity.champion.baseStats && detailEntity.champion.baseStats.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-blue-400" />
                        Chỉ số cơ bản
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {detailEntity.champion.baseStats.map((stat) => (
                          <div key={stat.key} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                            <span className="text-[10px] text-slate-400 block">{stat.labelVi}</span>
                            <span className="text-xs font-bold text-slate-100 mt-0.5 block font-mono">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ability */}
                  {detailEntity.champion.ability && detailEntity.champion.ability.nameVi && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-purple-400" />
                        Kỹ năng: {detailEntity.champion.ability.nameVi}
                      </h3>
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs leading-relaxed text-slate-300">
                        <FormattedDescription
                          text={detailEntity.champion.ability.descVi}
                          championId={detailEntity.champion.championId}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Case 2: Note group (Champion, Item, Augment, Trait, etc.) */}
              {detailEntity.kind === "note_group" && (() => {
                const isItemKind = detailEntity.category === "item" || detailEntity.group.first.entityKind === "item";
                const itemInfo = isItemKind
                  ? (getItemInfo(detailEntity.title) || resolveItemInfo(detailEntity.title) || resolveItemInfo(detailEntity.group.first.rawEntityName || "") || resolveItemInfo(detailEntity.group.first.entityId || ""))
                  : null;

                const categoryLabels: Record<string, string> = {
                  ad: "Sát thương vật lý (AD)",
                  ap: "Sức mạnh phép thuật (AP)",
                  tank: "Đỡ đòn / Phòng thủ",
                  mana: "Hồi phục Năng lượng",
                  utility: "Đa dụng / Hỗ trợ"
                };

                return (
                  <div className="space-y-4">
                    {/* Item Profile Card if it's an Item */}
                    {itemInfo && (
                      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 rounded-xl p-4 space-y-3 shadow-lg">
                        <div className="flex items-center gap-3.5">
                          {itemInfo.imageUrl ? (
                            <img
                              src={itemInfo.imageUrl}
                              alt={itemInfo.nameVi}
                              className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500/40 shadow-md shrink-0 bg-slate-950"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-200 shrink-0">
                              {itemInfo.abbr || "ITEM"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-extrabold text-base text-slate-100 truncate">
                                {itemInfo.nameVi}
                              </h3>
                              {itemInfo.category && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-emerald-300">
                                  {categoryLabels[itemInfo.category] || "Trang bị"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                              {itemInfo.nameEn}
                            </p>
                          </div>
                        </div>

                        {/* Chỉ số trang bị */}
                        {itemInfo.statsVi && (
                          <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Chỉ số cơ bản
                              </span>
                              {itemInfo.verificationStatus === "unverified" && (
                                <span className="text-[9px] font-medium text-amber-400 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded">
                                  Tham khảo · Chưa kiểm chứng
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-200 font-mono">
                              {itemInfo.statsVi}
                            </p>
                          </div>
                        )}

                        {/* Công dụng trang bị */}
                        {itemInfo.descriptionVi && (
                          <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Công dụng & Hiệu ứng đặc biệt
                              </span>
                              {itemInfo.verificationStatus === "unverified" && (
                                <span className="text-[9px] font-medium text-amber-400 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded">
                                  Tham khảo · Chưa kiểm chứng
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {itemInfo.descriptionVi}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section: Chỉnh sửa Buff / Nerf */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          Chi tiết chỉnh sửa & cân bằng ({detailEntity.group.changes.length})
                        </h3>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Theo bản cập nhật
                        </span>
                      </div>

                      <div className="space-y-3">
                        {detailEntity.group.changes.map((change) => {
                          const parsed = parseChangeDetail(change);
                          const IconComp = parsed.badgeClass.icon;

                          return (
                            <div
                              key={change.id}
                              className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-xs space-y-3 shadow-sm hover:border-slate-700 transition"
                            >
                              {/* Header: Field + Buff/Nerf Badge to rõ ràng */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                                <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                                  {formatNoteFieldLabel(change)}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-extrabold text-[11px] shadow-sm tracking-wide ${parsed.badgeClass.bg} ${parsed.badgeClass.border} ${parsed.badgeClass.text}`}
                                >
                                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                                  <span>{parsed.typeLabelVi}</span>
                                </span>
                              </div>

                              {/* Box so sánh Trước ➜ Sau nổi bật */}
                              <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 items-center font-mono py-1">
                                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-slate-300 break-words">
                                  <span className="text-[10px] text-slate-400 font-sans font-bold block mb-1 uppercase tracking-wider">
                                    Trước cập nhật:
                                  </span>
                                  <span className="text-xs font-semibold">
                                    {parsed.beforeVal}
                                  </span>
                                </div>

                                <div className="flex items-center justify-center">
                                  <ArrowRight className="w-5 h-5 text-emerald-400 shrink-0" />
                                </div>

                                <div
                                  className={`p-3 rounded-lg border break-words ${
                                    parsed.type === "buff"
                                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-extrabold"
                                      : parsed.type === "nerf"
                                      ? "bg-rose-950/40 border-rose-500/40 text-rose-300 font-extrabold"
                                      : "bg-slate-900/90 border-slate-800 text-slate-100 font-bold"
                                  }`}
                                >
                                  <span className="text-[10px] text-slate-400 font-sans font-bold block mb-1 uppercase tracking-wider">
                                    Sau cập nhật:
                                  </span>
                                  <span className="text-xs">
                                    {parsed.afterVal}
                                  </span>
                                </div>
                              </div>

                              {/* Trích dẫn Riot chính thức */}
                              {change.rawText && (
                                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                                  <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">
                                    Trích dẫn Riot Games:
                                  </span>
                                  <p className="break-words leading-relaxed font-sans">
                                    {change.rawText}
                                  </p>
                                </div>
                              )}

                              {/* Bằng chứng & vị trí */}
                              <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-500 font-mono">
                                <span>{change.sourceLocator ? `Vị trí: ${change.sourceLocator}` : ""}</span>
                                {change.sourceUrl && (
                                  <a
                                    href={change.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-sans font-medium"
                                  >
                                    <span>Bằng chứng bài viết Riot</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </aside>
        </>
      )}

      {/* 7. Evidence Drawer Modal */}
      <EvidenceDrawer
        isOpen={drawerOpen}
        evidenceIds={activeEvidenceIds}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

// Helper for key
function gKey(group: any) {
  return group.key;
}

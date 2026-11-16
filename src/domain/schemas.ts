import { z } from "zod";

export const ChannelSchema = z.enum(["pbe", "live"]);
export const DatasetKindSchema = z.enum(["real", "demo"]);
export const StarLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const EvidenceQualitySchema = z.enum(["extracted", "corroborated", "conflict"]);
export const ValueOriginSchema = z.enum(["source", "derived", "manual"]);
export const StatUnitSchema = z.enum([
  "flat",
  "percent",
  "seconds",
  "attacks_per_second",
  "hexes",
  "mana",
  "count",
  "gold",
  "ratio"
]);
export const EntityKindSchema = z.enum(["shop_champion", "summon", "npc", "unknown"]);

export const KnownDatumSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    state: z.literal("known"),
    value: valueSchema,
    sourceRefIds: z.array(z.string()).min(1),
    quality: EvidenceQualitySchema,
    origin: ValueOriginSchema,
    derivationId: z.string().optional()
  });

export const MissingDatumSchema = z.object({
  state: z.enum(["missing", "not_applicable"]),
  reason: z.string(),
  sourceRefIds: z.array(z.string())
});

export const DatumSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.union([KnownDatumSchema(valueSchema), MissingDatumSchema]);

export const NumericParameterSchema = z.object({
  key: z.string().min(1),
  labelVi: z.string(),
  labelEn: z.string(),
  unit: StatUnitSchema,
  byStar: z.record(z.string(), DatumSchema(z.number())),
  contextKey: z.string().default("base"),
  formulaText: DatumSchema(z.string()).optional()
});

export const AbilityRecordSchema = z.object({
  abilityKey: z.string().min(1),
  name: z.object({
    en: DatumSchema(z.string()),
    vi: DatumSchema(z.string())
  }),
  description: z.object({
    en: DatumSchema(z.string()),
    vi: DatumSchema(z.string())
  }),
  icon: DatumSchema(z.string()).optional(),
  parameters: z.array(NumericParameterSchema)
});

export const ChampionVariantSchema = z.object({
  variantKey: z.string().min(1),
  label: z.string(),
  stats: z.array(NumericParameterSchema),
  abilities: z.array(AbilityRecordSchema)
});

export const ChampionRecordSchema = z.object({
  championId: z.string().min(1),
  sourceApiNames: z.array(z.string()),
  name: z.object({
    en: DatumSchema(z.string()),
    vi: DatumSchema(z.string())
  }),
  aliases: z.array(z.string()),
  cost: DatumSchema(z.number()),
  traitIds: DatumSchema(z.array(z.string())),
  icon: DatumSchema(z.string()),
  entityKind: EntityKindSchema,
  variants: z.array(ChampionVariantSchema)
});

export const SnapshotPayloadSchema = z.object({
  schemaVersion: z.string(),
  datasetKind: DatasetKindSchema,
  setNumber: z.number().int(),
  gameMode: z.string(),
  channel: ChannelSchema,
  rosterCompleteness: z.enum(["complete", "partial", "unknown"]),
  fieldCoverage: z.record(z.string(), z.object({ known: z.number(), applicable: z.number() })),
  champions: z.array(ChampionRecordSchema)
});

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["raw_artifact", "patch_notes", "manual_entry", "demo_fixture"]),
  sourceId: z.string(),
  title: z.string(),
  url: z.string().nullable().optional(),
  locator: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  sourcePublishedAt: z.string().nullable().optional(),
  datasetKind: DatasetKindSchema
});

export const ImportEnvelopeSchema = z.object({
  importSchemaVersion: z.literal("1"),
  idempotencyKey: z.string().min(1),
  release: z.object({
    channel: ChannelSchema,
    patchLabel: z.string().nullable(),
    buildId: z.string().nullable(),
    effectiveAt: z.string().nullable(),
    timePrecision: z.enum(["second", "day", "unknown"]),
    timeBasis: z.enum(["verified_release", "source_publication", "observation"]),
    occurrenceKey: z.string().min(1)
  }),
  payload: SnapshotPayloadSchema,
  evidence: z.array(EvidenceRecordSchema),
  notes: z.array(z.string())
});

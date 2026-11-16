# Set 18 identity registry

The application resolves champion identities through the CommunityDragon source
key first. `DA_18_Ahri`, `TFT18_DA_18_Ahri`, `Ahri`, and the Vietnamese display
name all resolve to the same compatibility id used by existing snapshots.

The application ships a generated registry containing 74 Set 18 shop champions,
their CommunityDragon source keys, costs, traits, and source icon paths. The
current generated input is content-addressed by SHA-256
`39bdb478ed181a891bd42ddebd566ffba0b32a30ad1ccf0532faf98d62208020` and is
captured at `2026-09-10T15:27:13.626Z`. The bilingual file supplies the display
names while the generated file supplies gameplay metadata.

To refresh it from a captured CommunityDragon live or PBE payload:

```text
pnpm tsx scripts/meta/generate-set18-registry.ts --input <captured-cdragon-json>
```

The generator refuses to write output when the payload does not contain Set 18
shop champions. It records the source URL/path and SHA-256 of the exact input;
it never invents champion keys or fills missing champions from another patch.
Asset URLs are built only from a registry icon path and are left unresolved when
the source has no icon; no other champion's image is used as a fallback.

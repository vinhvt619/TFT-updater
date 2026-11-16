import { SET18_ARCHETYPES } from "../../src/domain/meta/archetypes";
console.log(JSON.stringify(SET18_ARCHETYPES.map(a => ({ id: a.id, nameVi: a.nameVi, nameEn: a.nameEn, carry: a.coreCarryChampionId, aliases: a.aliases })), null, 2));

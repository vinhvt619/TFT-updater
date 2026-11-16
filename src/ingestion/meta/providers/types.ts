import { SourceCompObservation, SourceId, SourceScope } from "../../../domain/meta/schemas";

export interface WebsiteProviderOptions {
  datasetKind?: "real" | "demo";
  patchEpochId?: string;
}

export interface WebsiteProvider {
  sourceId: SourceId;
  name: string;
  canonicalUrl: string;
  fetchObservations(scope?: Partial<SourceScope> & WebsiteProviderOptions): Promise<SourceCompObservation[]>;
}

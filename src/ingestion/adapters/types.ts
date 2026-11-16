import { SnapshotPayload, EvidenceRecord } from "../../domain/types";

export interface SourceProbeResult {
  reachable: boolean;
  httpStatus?: number;
  etag?: string;
  lastModified?: string;
  hasTargetSet: boolean;
  diagnostics: Record<string, any>;
}

export interface SourceFetchResult {
  rawBuffer: Buffer;
  contentType: string;
  etag?: string;
  lastModified?: string;
}

export interface SourceNormalizeResult {
  success: boolean;
  errorCode?: string;
  payload?: SnapshotPayload;
  evidence: EvidenceRecord[];
  diagnostics: Record<string, any>;
}

export interface SourceAdapter {
  id: string;
  parserVersion: string;
  mappingVersion: string;
  probe(sourceConfig: any): Promise<SourceProbeResult>;
  fetch(sourceConfig: any, headers?: Record<string, string>): Promise<SourceFetchResult>;
  normalize(rawContent: Buffer, sourceConfig: any): Promise<SourceNormalizeResult>;
}

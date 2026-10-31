import { resolveEvidenceInput } from "../EvidenceInputResolver.js";
import type { EvidenceReader } from "./InvestigationRecordPort.js";
import { uniqueSorted } from "../../domain/canonicalOrdering.js";
import {
  EvidenceReferenceError,
  type EvidenceIntegrityError,
} from "../../domain/evidenceErrors.js";
import { err, ok, type Result } from "../../domain/result.js";

/**
 * Follow exact session references without exporting unrelated records or
 * Unknowns. `inlineIds` names records the caller already supplied inline; a
 * missing one still fails closed, but is reported as a missing retained
 * closure rather than as a reference that inline input could repair.
 */
export const resolveInvestigationEvidenceClosure = (
  reader: Pick<EvidenceReader, "evidenceForAnalysis">,
  seedIds: readonly string[],
  inlineIds: ReadonlySet<string> = new Set(),
): Result<string[], EvidenceIntegrityError> => {
  const lookup = reader.evidenceForAnalysis.bind(reader);
  const visited = new Set<string>();
  const pending = [...seedIds];
  while (pending.length > 0) {
    const evidenceId = pending.pop();
    if (evidenceId === undefined || visited.has(evidenceId)) continue;
    const evidence = resolveEvidenceInput(
      { kind: "retained-evidence", evidence_id: evidenceId },
      lookup,
    );
    if (!evidence.ok)
      return evidence.error.reason === "missing" && inlineIds.has(evidenceId)
        ? err(
            new EvidenceReferenceError(
              evidenceId,
              "missing",
              evidence.error.expected,
              evidence.error.actual,
              true,
            ),
          )
        : evidence;
    visited.add(evidenceId);
    pending.push(...evidence.value.evidence_links);
  }
  return ok(uniqueSorted([...visited]));
};

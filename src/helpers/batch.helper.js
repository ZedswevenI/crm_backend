import Batch from '../models/batch.model.js';

// Accepts either a batch's real batchId (UUID) or its batchCode and returns the canonical
// batchId. Callers (frontend, imports, older integrations) have been observed sending batchCode
// where batchId is expected, which silently produced empty student rosters and broken joins
// downstream. Resolving here keeps every write/query keyed on the one canonical id.
export const resolveBatchId = async (tenantId, batchIdOrCode) => {
  const input = (batchIdOrCode == null ? '' : String(batchIdOrCode)).trim();
  if (!input) return null;
  const batch = await Batch.findOne(
    { tenantId, isdeleted: false, $or: [{ batchId: input }, { batchCode: input }] },
    { batchId: 1 }
  ).lean();
  return batch ? batch.batchId : input;
};

export const resolveBatchIds = async (tenantId, batchIdsOrCodes) => {
  const inputs = (Array.isArray(batchIdsOrCodes) ? batchIdsOrCodes : []).map((v) => (v == null ? '' : String(v)).trim()).filter(Boolean);
  if (!inputs.length) return [];
  const batches = await Batch.find({ tenantId, isdeleted: false, $or: [{ batchId: { $in: inputs } }, { batchCode: { $in: inputs } }] }, { batchId: 1, batchCode: 1 }).lean();
  const byId = new Map(batches.map((b) => [b.batchId, b.batchId]));
  const byCode = new Map(batches.map((b) => [b.batchCode, b.batchId]));
  return inputs.map((v) => byId.get(v) || byCode.get(v) || v);
};

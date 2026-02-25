import User from '../models/users.model.js';
import Staff from '../models/staff.model.js';
import Batch from '../models/batch.model.js';

export const validateStaffBatchAccess = async (tenantId, userId, targetBatchCodes) => {
  if (!targetBatchCodes || targetBatchCodes.length === 0) return { ok: true };
  const user = await User.findOne({ tenantId, userId, isdeleted: false }).lean();
  if (!user) return { ok: false, message: 'User not found' };
  if (['L1', 'L2', 'L3', 'L4'].includes(user.roleLevel)) {
    return { ok: true };
  }
  if (user.roleLevel === 'L5') {
    const staff = await Staff.findOne({ tenantId, userId, isdeleted: false }).lean();
    if (!staff) return { ok: false, message: 'Staff profile not found for this user' };
    const unauthorizedBatches = await Batch.find({
      tenantId,
      batchCode: { $in: targetBatchCodes },
      'staffMap.staffId': { $ne: staff.staffId },
      isdeleted: false
    }).lean();
    if (unauthorizedBatches.length > 0) {
      const unauthCodes = unauthorizedBatches.map((b) => b.batchCode).join(', ');
      return {
        ok: false,
        message: `Unauthorized: You are not assigned as faculty to the following batch(es): ${unauthCodes}`
      };
    }
    return { ok: true };
  }
  return { ok: false, message: 'Invalid user role' };
};

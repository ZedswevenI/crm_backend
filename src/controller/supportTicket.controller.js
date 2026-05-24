import { v4 as uuid } from 'uuid';
import constants from '../helpers/constants.js';
import SupportTicket from '../models/supportTicket.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || req?.query?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const createTicket = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { studentNo, area, issueSubject, issueDetails, priority } = req.body;
    if (!tenantId || !studentNo || !area || !issueSubject || !issueDetails) {
      return res.status(400).json({ status: false, message: 'tenantId, studentNo, area, issueSubject, and issueDetails are required.' });
    }
    const newTicket = await SupportTicket.create({
      tenantId,
      ticketId: uuid(),
      studentNo: safeTrim(studentNo),
      area: safeTrim(area).toUpperCase(),
      issueSubject: safeTrim(issueSubject),
      issueDetails: safeTrim(issueDetails),
      priority: priority ? safeTrim(priority).toUpperCase() : 'MEDIUM',
      status: 'OPEN',
      requestedAt: Date.now(),
      isdeleted: false,
      createdBy: userId,
      updatedBy: userId
    });
    return res.status(201).json({ status: true, message: 'Support ticket raised successfully', data: newTicket });
  } catch (err) {
    return next(err);
  }
};

const listTicketstudent = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const page = parseInt(req.query.page || req.body.page, 10) || 1;
    const limit = parseInt(req.query.limit || req.body.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const area = safeTrim(req.query.area);
    const studentNo = safeTrim(req.query.studentNo);
    const query = { tenantId, isdeleted: false };
    if (area) query.area = area.toUpperCase();
    if (studentNo) query.studentNo = studentNo;
    if (search) {
      const rx = { $regex: search, $options: 'i' };
      query.$or = [{ issueSubject: rx }, { issueDetails: rx }, { ticketId: rx }];
    }
    const listMode = String(req.query.list || req.body.list || '').toLowerCase();
    if (listMode === 'full') {
      const rows = await SupportTicket.find(query)
        .sort(sort)
        .populate({
          path: 'assignedStaffId',
          localField: 'assignedStaffId',
          foreignField: 'staffId',
          model: 'staff',
          justOne: true,
          select: 'staffName staffCode facultyType _id'
        })
        .lean();
      return res.status(constants.HTTPS_SUCCESS || 200).send({ status: true, data: rows, count: rows.length, message: 'Tickets retrieved successfully' });
    }
    const [rows, count] = await Promise.all([
      SupportTicket.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'assignedStaffId',
          localField: 'assignedStaffId',
          foreignField: 'staffId',
          model: 'staff',
          justOne: true,
          select: 'staffName staffCode facultyType _id'
        })
        .lean(),
      SupportTicket.countDocuments(query)
    ]);
    return res.status(constants.HTTPS_SUCCESS || 200).send({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      message: 'Tickets retrieved successfully'
    });
  } catch (err) {
    next(err);
  }
};

const listTickets = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const page = parseInt(req.query.page || req.body.page, 10) || 1;
    const limit = parseInt(req.query.limit || req.body.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const area = safeTrim(req.query.area);
    const status = safeTrim(req.query.status);
    const priority = safeTrim(req.query.priority);
    const studentNo = safeTrim(req.query.studentNo);
    const assignedStaffId = safeTrim(req.query.assignedStaffId);
    const query = { tenantId, isdeleted: false };
    if (area) query.area = area.toUpperCase();
    if (status) query.status = status.toUpperCase();
    if (priority) query.priority = priority.toUpperCase();
    if (studentNo) query.studentNo = studentNo;
    if (assignedStaffId) query.assignedStaffId = assignedStaffId;
    if (search) {
      const rx = { $regex: search, $options: 'i' };
      query.$or = [{ issueSubject: rx }, { issueDetails: rx }, { ticketId: rx }];
    }
    const listMode = String(req.query.list || req.body.list || '').toLowerCase();
    if (listMode === 'full') {
      const rows = await SupportTicket.find(query)
        .sort(sort)
        .populate({
          path: 'studentNo',
          localField: 'studentNo',
          foreignField: 'admissionNo', // Fixed
          model: 'studentprofile', // Fixed
          justOne: true,
          select: 'student.name student.email student.parentName student.parentPhone _id'
        })
        .populate({
          path: 'assignedStaffId',
          localField: 'assignedStaffId',
          foreignField: 'staffId',
          model: 'staff',
          justOne: true,
          select: 'staffName staffCode facultyType _id'
        })
        .lean();
      return res.status(constants.HTTPS_SUCCESS || 200).send({ status: true, data: rows, count: rows.length, message: 'Tickets retrieved successfully' });
    }
    const [rows, count] = await Promise.all([
      SupportTicket.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'assignedStaffId',
          localField: 'assignedStaffId',
          foreignField: 'staffId',
          model: 'staff',
          justOne: true,
          select: 'staffName staffCode facultyType _id'
        })
        .lean(),
      SupportTicket.countDocuments(query)
    ]);
    return res.status(constants.HTTPS_SUCCESS || 200).send({
      status: true,
      data: rows,
      page,
      limit,
      count,
      pages: Math.ceil(count / limit) || 0,
      message: 'Tickets retrieved successfully'
    });
  } catch (err) {
    next(err);
  }
};

const viewTicket = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ticketId = safeTrim(req.body?.ticketId || req.query?.ticketId);
    if (!tenantId || !ticketId) {
      return res.status(400).json({ status: false, message: 'tenantId and ticketId are required' });
    }
    const ticket = await SupportTicket.findOne({ tenantId, ticketId, isdeleted: false })
      .populate({
        path: 'studentNo',
        localField: 'studentNo',
        foreignField: 'admissionNo',
        model: 'studentprofile',
        justOne: true,
        select: 'student.name student.email student.parentName student.parentPhone _id'
      })
      .populate({
        path: 'assignedStaffId',
        localField: 'assignedStaffId',
        foreignField: 'staffId',
        model: 'staff',
        justOne: true,
        select: 'staffName staffCode facultyType _id'
      })
      .lean();
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, message: 'Ticket retrieved', data: ticket });
  } catch (err) {
    return next(err);
  }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ticketId = safeTrim(req.body?.ticketId);
    const status = safeTrim(req.body?.status);
    const feedback = safeTrim(req.body?.feedback);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !ticketId || !status) {
      return res.status(400).json({ status: false, message: 'tenantId, ticketId, and status are required' });
    }
    const upperStatus = status.toUpperCase();
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({ status: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    let completedAtValue = undefined;
    if (upperStatus === 'RESOLVED' || upperStatus === 'CLOSED') {
      completedAtValue = Date.now();
    } else if (upperStatus === 'OPEN' || upperStatus === 'IN_PROGRESS') {
      completedAtValue = null;
    }
    const updateFields = {
      status: upperStatus,
      feedback: feedback || null,
      updatedBy: userId
    };
    if (completedAtValue !== undefined) {
      updateFields.completedAt = completedAtValue;
    }
    const updatedTicket = await SupportTicket.findOneAndUpdate({ tenantId, ticketId, isdeleted: false }, { $set: updateFields }, { new: true }).lean();
    if (!updatedTicket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    return res.status(200).json({ status: true, message: 'Ticket status updated successfully', data: updatedTicket });
  } catch (err) {
    return next(err);
  }
};

const assignTicket = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ticketId = safeTrim(req.body?.ticketId);
    const assignedStaffId = safeTrim(req.body?.assignedStaffId);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !ticketId || !assignedStaffId) {
      return res.status(400).json({ status: false, message: 'tenantId, ticketId, and assignedStaffId are required' });
    }
    const ticket = await SupportTicket.findOne({ tenantId, ticketId, isdeleted: false });
    if (!ticket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    const newStatus = ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;
    ticket.assignedStaffId = assignedStaffId;
    ticket.status = newStatus;
    ticket.assignedAt = Date.now();
    ticket.updatedBy = userId;
    await ticket.save();
    return res.status(200).json({ status: true, message: 'Ticket assigned successfully', data: ticket });
  } catch (err) {
    return next(err);
  }
};

const updateTicketPriority = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ticketId = safeTrim(req.body?.ticketId);
    const priority = safeTrim(req.body?.priority);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId || !ticketId || !priority) {
      return res.status(400).json({ status: false, message: 'tenantId, ticketId, and priority are required' });
    }
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority.toUpperCase())) {
      return res.status(400).json({ status: false, message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
    }
    const updatedTicket = await SupportTicket.findOneAndUpdate(
      { tenantId, ticketId, isdeleted: false },
      {
        $set: { priority: priority.toUpperCase(), updatedBy: userId }
      },
      { new: true }
    ).lean();
    if (!updatedTicket) return res.status(404).json({ status: false, message: 'Ticket not found' });
    return res.status(200).json({ status: true, message: 'Ticket priority updated', data: updatedTicket });
  } catch (err) {
    return next(err);
  }
};

const getTicketReports = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const fromDate = req.query.fromDate || req.body.fromDate;
    const toDate = req.query.toDate || req.body.toDate;
    const matchStage = { tenantId, isdeleted: false };
    if (fromDate || toDate) {
      matchStage.createdAt = {};
      if (fromDate) matchStage.createdAt.$gte = new Date(Number(fromDate));
      if (toDate) matchStage.createdAt.$lte = new Date(Number(toDate));
    }
    const [statusReport, areaReport, priorityReport, totalCount] = await Promise.all([
      SupportTicket.aggregate([{ $match: matchStage }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      SupportTicket.aggregate([{ $match: matchStage }, { $group: { _id: '$area', count: { $sum: 1 } } }]),
      SupportTicket.aggregate([{ $match: matchStage }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      SupportTicket.countDocuments(matchStage)
    ]);
    const formatReport = (data) => data.map((item) => ({ name: item._id, count: item.count }));
    return res.status(200).json({
      status: true,
      message: 'Ticket reports generated successfully',
      data: {
        totalTickets: totalCount,
        byStatus: formatReport(statusReport),
        byArea: formatReport(areaReport),
        byPriority: formatReport(priorityReport)
      }
    });
  } catch (err) {
    return next(err);
  }
};

const reopenTicket = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const ticketId = safeTrim(req.body?.ticketId);
    const studentNo = safeTrim(req.body?.studentNo);
    const userId = safeTrim(req.body?.userId);
    const reason = safeTrim(req.body?.reason);
    if (!tenantId || !ticketId || !studentNo) {
      return res.status(400).json({ status: false, message: 'tenantId, ticketId, and studentNo are required' });
    }
    const ticket = await SupportTicket.findOne({
      tenantId,
      ticketId,
      studentNo,
      isdeleted: false
    }).lean();
    console.log('ticket ', ticket, tenantId, ticketId, studentNo);
    if (!ticket) {
      return res.status(404).json({ status: false, message: 'Ticket not found or you are not authorized to access it' });
    }
    if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      return res.status(400).json({ status: false, message: `Ticket is currently ${ticket.status}. Only RESOLVED or CLOSED tickets can be reopened.` });
    }
    const updatedFeedback = reason ? (ticket.feedback ? `${ticket.feedback} | [Reopened]: ${reason}` : `[Reopened]: ${reason}`) : ticket.feedback;
    // const updatedTicket = await SupportTicket.findOneAndUpdate(
    //   { tenantId, ticketId, studentNo },
    //   {
    //     $set: {
    //       status: 'OPEN',
    //       completedAt: null,
    //       feedback: updatedFeedback,
    //       updatedBy: userId || studentNo
    //     }
    //   },
    //   { new: true }
    // ).lean();
    const updatedTicket = await SupportTicket.findOneAndUpdate(
      { tenantId, ticketId, studentNo },
      {
        $set: {
          status: 'OPEN',
          completedAt: null,
          feedback: updatedFeedback,
          updatedBy: userId || studentNo
        },
        $inc: { reopenCount: 1 },
        $push: {
          reopenHistory: {
            reopenedAt: Date.now(),
            reason: reason || null,
            reopenedBy: userId || studentNo,
            prevStatus: ticket.status
          }
        }
      },
      { new: true }
    ).lean();
    return res.status(200).json({ status: true, message: 'Ticket reopened successfully', data: updatedTicket });
  } catch (err) {
    return next(err);
  }
};

export default {
  createTicket,
  listTickets,
  listTicketstudent,
  viewTicket,
  updateTicketStatus,
  assignTicket,
  updateTicketPriority,
  getTicketReports,
  reopenTicket
};

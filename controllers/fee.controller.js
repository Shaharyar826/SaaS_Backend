const Fee = require('../models/Fee');
const Student = require('../models/Student');
const { getLastDateOfCurrentMonth, getLastDateOfMonthForDate } = require('../utils/dateHelpers');
const { getTenantModel } = require('../middleware/tenant');

// Dynamic arrears calculation - only unpaid amounts from previous months
exports.calculateStudentArrears = async (studentId, req) => {
  try {
    if (!studentId) {
      return { totalArrears: 0, breakdown: [] };
    }

    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const previousFees = await TenantFee.find({
      student: studentId,
      tenant: req.tenantId,
      dueDate: { $lt: currentMonth },
      status: { $in: ['unpaid', 'partial', 'overdue'] }
    }).sort({ dueDate: 1 });

    let totalArrears = 0;
    const breakdown = [];

    previousFees.forEach(fee => {
      const remainingAmount = fee.remainingAmount || 0;
      if (remainingAmount > 0) {
        totalArrears += remainingAmount;
        breakdown.push({
          month: fee.dueDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
          amount: remainingAmount,
          feeType: fee.feeType,
          status: fee.status
        });
      }
    });

    return { totalArrears, breakdown };
  } catch (error) {
    console.error('Error calculating arrears:', error);
    return { totalArrears: 0, breakdown: [] };
  }
};

// Create initial fee record for new students
exports.createInitialFeeRecord = async (studentId, recordedById, monthlyFeeAmount, req) => {
  try {
    if (!studentId || !recordedById) {
      console.error('Missing required parameters for createInitialFeeRecord');
      return null;
    }

    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const amount = monthlyFeeAmount || 0;
    const currentDate = new Date();
    const dueDate = getLastDateOfCurrentMonth();

    const feeData = {
      tenant: req.tenantId,
      student: studentId,
      feeType: 'tuition',
      amount: amount,
      monthlyFee: amount,
      dueDate: dueDate,
      status: 'unpaid',
      recordedBy: recordedById,
      description: `Monthly tuition fee for ${currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`
    };

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const existingFee = await TenantFee.findOne({
      student: studentId,
      tenant: req.tenantId,
      feeType: 'tuition',
      dueDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    let fee;
    if (existingFee) {
      fee = await TenantFee.findByIdAndUpdate(existingFee._id, feeData, { new: true, runValidators: true });
    } else {
      fee = await TenantFee.create(feeData);
    }

    return fee;
  } catch (error) {
    console.error('Error creating initial fee record:', error);
    return null;
  }
};

// Get all fee records with proper filtering
exports.getFeeRecords = async (req, res) => {
  try {
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    
    let query = { tenant: req.tenantId };
    const reqQuery = { ...req.query };

    // Handle date filtering
    if (req.query.month && req.query.year) {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      reqQuery.dueDate = { $gte: startDate, $lte: endDate };
    }

    const removeFields = ['select', 'sort', 'page', 'limit', 'month', 'year', 'studentId'];
    removeFields.forEach(param => delete reqQuery[param]);

    // Handle student filtering
    if (req.query.studentId) {
      const studentIds = Array.isArray(req.query.studentId) ? req.query.studentId : [req.query.studentId];
      if (studentIds.length > 1) {
        reqQuery.$or = studentIds.map(id => ({ student: id }));
      } else {
        reqQuery.student = studentIds[0];
      }
    }

    // For students, only show their own records
    if (req.user.role === 'student') {
      const student = await TenantStudent.findOne({ user: req.user.id, tenant: req.tenantId });
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }
      reqQuery.student = student._id;
    }

    Object.assign(query, reqQuery);

    // Build query
    let feeQuery = TenantFee.find(query)
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate({ path: 'recordedBy', select: 'name role' });

    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      feeQuery = feeQuery.select(fields);
    }

    feeQuery = feeQuery.sort(req.query.sort ? req.query.sort.split(',').join(' ') : '-dueDate');

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const total = await TenantFee.countDocuments(query);

    feeQuery = feeQuery.skip(startIndex).limit(limit);
    const feeRecords = await feeQuery;

    const pagination = {};
    if (startIndex + limit < total) pagination.next = { page: page + 1, limit };
    if (startIndex > 0) pagination.prev = { page: page - 1, limit };

    res.status(200).json({ success: true, count: feeRecords.length, pagination, data: feeRecords });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get single fee record
exports.getFeeRecord = async (req, res) => {
  try {
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);

    const fee = await TenantFee.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate({ path: 'recordedBy', select: 'name role' });

    if (!fee) {
      return res.status(404).json({ success: false, message: `No fee record found with id ${req.params.id}` });
    }

    // For students, only allow access to their own records
    if (req.user.role === 'student') {
      const student = await TenantStudent.findOne({ user: req.user.id, tenant: req.tenantId });
      if (!student || fee.student._id.toString() !== student._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.status(200).json({ success: true, data: fee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Create fee record
exports.createFeeRecord = async (req, res) => {
  try {
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    
    req.body.tenant = req.tenantId;
    req.body.recordedBy = req.user.id;
    
    if (!req.body.monthlyFee && req.body.amount) {
      req.body.monthlyFee = req.body.amount;
    }

    const student = await TenantStudent.findOne({ _id: req.body.student, tenant: req.tenantId });
    if (!student) {
      return res.status(404).json({ success: false, message: `No student found with id ${req.body.student}` });
    }

    // Handle "all" fee type
    if (req.body.feeType === 'all') {
      const feeTypes = ['tuition', 'exam'];
      const createdFees = [];

      for (const feeType of feeTypes) {
        const feeData = { ...req.body, feeType };
        const dueDate = new Date(req.body.dueDate);
        const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
        const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);

        const existingFee = await TenantFee.findOne({
          student: req.body.student,
          tenant: req.tenantId,
          feeType,
          dueDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        let fee;
        if (existingFee) {
          fee = await TenantFee.findByIdAndUpdate(existingFee._id, feeData, { new: true, runValidators: true });
        } else {
          fee = await TenantFee.create(feeData);
        }
        createdFees.push(fee);
      }

      return res.status(201).json({
        success: true,
        message: `Created/Updated ${createdFees.length} fee records`,
        data: createdFees
      });
    }

    // Single fee type
    const dueDate = new Date(req.body.dueDate);
    const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);

    const existingFee = await TenantFee.findOne({
      student: req.body.student,
      tenant: req.tenantId,
      feeType: req.body.feeType,
      dueDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    let fee;
    if (existingFee) {
      fee = await TenantFee.findByIdAndUpdate(existingFee._id, req.body, { new: true, runValidators: true });
    } else {
      fee = await TenantFee.create(req.body);
    }

    res.status(201).json({ success: true, data: fee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Complete remaining fee controller methods
exports.updateFeeRecord = async (req, res) => {
  try {
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    let fee = await TenantFee.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!fee) {
      return res.status(404).json({ success: false, message: `No fee record found with id ${req.params.id}` });
    }

    if (fee.recordedBy.toString() !== req.user.id && !['admin', 'principal'].includes(req.user.role)) {
      return res.status(401).json({ success: false, message: 'Not authorized to update this fee record' });
    }

    Object.keys(req.body).forEach(key => { fee[key] = req.body[key]; });
    await fee.save();
    res.status(200).json({ success: true, data: fee });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteFeeRecord = async (req, res) => {
  try {
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const fee = await TenantFee.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!fee) {
      return res.status(404).json({ success: false, message: `No fee record found with id ${req.params.id}` });
    }

    if (fee.recordedBy.toString() !== req.user.id && !['admin', 'principal'].includes(req.user.role)) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this fee record' });
    }

    await fee.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getStudentArrears = async (req, res) => {
  try {
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const studentId = req.params.studentId;
    const student = await TenantStudent.findOne({ _id: studentId, tenant: req.tenantId });
    if (!student) {
      return res.status(404).json({ success: false, message: `No student found with id ${studentId}` });
    }

    const arrearsData = await exports.calculateStudentArrears(studentId, req);
    res.status(200).json({ success: true, data: arrearsData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Process aggregated payment - FIXED ORDER
exports.processAggregatedPayment = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { paidAmount, paymentMethod, transactionId, remarks, absenceFine, otherAdjustments } = req.body;

    // Get all unpaid fees sorted by due date (oldest first)
    const unpaidFees = await Fee.find({
      student: studentId,
      status: { $in: ['unpaid', 'partial', 'overdue'] }
    }).sort({ dueDate: 1 });

    if (unpaidFees.length === 0) {
      return res.status(404).json({ success: false, message: 'No unpaid fees found for this student' });
    }

    // Add fines to the most recent fee FIRST
    const mostRecentFee = unpaidFees[unpaidFees.length - 1];
    if (mostRecentFee && (absenceFine || otherAdjustments)) {
      if (!mostRecentFee.monthlyFee) {
        mostRecentFee.monthlyFee = mostRecentFee.amount || 0;
      }
      mostRecentFee.absenceFine = absenceFine || 0;
      mostRecentFee.otherAdjustments = otherAdjustments || 0;
      await mostRecentFee.save();
    }

    // Refresh fees after adding fines
    const refreshedFees = await Fee.find({
      student: studentId,
      status: { $in: ['unpaid', 'partial', 'overdue'] }
    }).sort({ dueDate: 1 });

    // Process payment from oldest to newest
    let remainingPayment = paidAmount;
    const updatedFees = [];

    for (const fee of refreshedFees) {
      if (remainingPayment <= 0) break;

      const feeRemaining = fee.remainingAmount || 0;
      const paymentForThisFee = Math.min(remainingPayment, feeRemaining);

      if (paymentForThisFee > 0) {
        fee.paidAmount = (fee.paidAmount || 0) + paymentForThisFee;
        fee.paymentMethod = paymentMethod;
        fee.paymentDate = new Date();
        fee.transactionId = transactionId;
        fee.remarks = remarks;
        
        await fee.save();
        updatedFees.push(fee);
        remainingPayment -= paymentForThisFee;
      }
    }

    res.status(200).json({
      success: true,
      message: `Payment processed across ${updatedFees.length} fee records`,
      data: { updatedFees: updatedFees.length, remainingPayment }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get aggregated unpaid fees
exports.getStudentAggregatedFees = async (req, res) => {
  try {
    const { studentId } = req.params;

    const unpaidFees = await Fee.find({
      student: studentId,
      status: { $in: ['unpaid', 'partial', 'overdue'] }
    }).sort({ dueDate: 1 });

    if (unpaidFees.length === 0) {
      return res.status(404).json({ success: false, message: 'No unpaid fees found for this student' });
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    let baseAmount = 0;
    let previousArrears = 0;
    let totalAbsenceFines = 0;
    let totalOtherFines = 0;
    let currentMonthFeeId = null;

    unpaidFees.forEach(fee => {
      const feeDate = new Date(fee.dueDate);
      const feeMonth = feeDate.getMonth();
      const feeYear = feeDate.getFullYear();

      if (feeMonth === currentMonth && feeYear === currentYear) {
        baseAmount = fee.monthlyFee || fee.amount || 0;
        currentMonthFeeId = fee._id;
        totalAbsenceFines += fee.absenceFine || 0;
        totalOtherFines += fee.otherAdjustments || 0;
      } else {
        previousArrears += fee.remainingAmount || 0;
      }
    });

    const aggregatedData = {
      studentId,
      currentMonthFeeId,
      baseAmount,
      previousArrears,
      absenceFines: totalAbsenceFines,
      otherFines: totalOtherFines,
      totalDue: baseAmount + previousArrears + totalAbsenceFines + totalOtherFines,
      unpaidFeesCount: unpaidFees.length
    };

    res.status(200).json({ success: true, data: aggregatedData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Generate monthly fees
exports.generateMonthlyFees = async (req, res) => {
  try {
    if (!['admin', 'principal'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to perform this action' });
    }

    const { month, year, feeAmount = 2500 } = req.body;
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const students = await Student.find({ isActive: true }).populate('user');
    const dueDate = getLastDateOfMonthForDate(new Date(targetYear, targetMonth - 1, 1));
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0);

    let created = 0;
    let updated = 0;
    const errors = [];

    for (const student of students) {
      try {
        const existingFee = await Fee.findOne({
          student: student._id,
          feeType: 'tuition',
          dueDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (existingFee) {
          updated++;
        } else {
          const monthlyAmount = student.monthlyFee || feeAmount;
          await Fee.create({
            student: student._id,
            feeType: 'tuition',
            amount: monthlyAmount,
            monthlyFee: monthlyAmount,
            dueDate,
            status: 'unpaid',
            recordedBy: req.user.id
          });
          created++;
        }
      } catch (error) {
        errors.push({ studentId: student._id, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Monthly fees generated for ${targetMonth}/${targetYear}`,
      data: { created, updated, errors, totalStudents: students.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get fee history
exports.getFeeHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    let query = { student: studentId };
    if (startDate && endDate) {
      query.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const fees = await Fee.find(query).sort({ dueDate: -1 }).populate('recordedBy', 'name role');
    const arrearsData = await exports.calculateStudentArrears(studentId);

    res.status(200).json({
      success: true,
      data: {
        fees,
        arrears: arrearsData,
        student: {
          name: student.user?.name,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get complete fee statement for a student
exports.getStudentFeeStatement = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await Student.findById(studentId).populate('user', 'name email');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get all fee records for the student
    const fees = await Fee.find({ student: studentId })
      .sort({ dueDate: 1 })
      .populate('recordedBy', 'name role');

    // Calculate totals
    let totalAssigned = 0;
    let totalPaid = 0;
    let totalArrears = 0;
    let totalFines = 0;

    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    fees.forEach(fee => {
      totalAssigned += fee.monthlyFee || fee.amount || 0;
      totalPaid += fee.paidAmount || 0;
      totalFines += (fee.absenceFine || 0) + (fee.otherAdjustments || 0);
      
      // Calculate arrears (overdue amounts from previous months)
      const feeDate = new Date(fee.dueDate);
      if (feeDate < currentMonth && fee.status !== 'paid') {
        totalArrears += fee.remainingAmount || 0;
      }
    });

    const remainingBalance = (totalAssigned + totalFines) - totalPaid;

    const summary = {
      totalAssigned,
      totalPaid,
      totalArrears,
      totalFines,
      remainingBalance: Math.max(0, remainingBalance)
    };

    res.status(200).json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.user?.name,
          email: student.user?.email,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section,
          monthlyFee: student.monthlyFee
        },
        fees,
        summary
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cleanup orphaned fees
exports.cleanupOrphanedFees = async (req, res) => {
  try {
    if (!['admin', 'principal'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to perform this action' });
    }

    const allFees = await Fee.find({}).populate('student');
    const orphanedFees = allFees.filter(fee => !fee.student || fee.student.isActive === false);
    const orphanedFeeIds = orphanedFees.map(fee => fee._id);

    if (orphanedFeeIds.length > 0) {
      const deleteResult = await Fee.deleteMany({ _id: { $in: orphanedFeeIds } });
      res.status(200).json({
        success: true,
        message: `Successfully cleaned up ${deleteResult.deletedCount} orphaned fee records`,
        data: { deletedCount: deleteResult.deletedCount, orphanedFeeIds }
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'No orphaned fee records found',
        data: { deletedCount: 0, orphanedFeeIds: [] }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
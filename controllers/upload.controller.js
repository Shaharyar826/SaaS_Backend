const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const AdminStaff = require('../models/AdminStaff');
const SupportStaff = require('../models/SupportStaff');
const UploadHistory = require('../models/UploadHistory');
const Fee = require('../models/Fee');

const { getTenantModel } = require('../middleware/tenant');
const SAAS_CONFIG = require('../config/saas');
const { createInitialFeeRecord } = require('./fee.controller');
const { getLastDateOfMonthForDate } = require('../utils/dateHelpers');

// ── Helpers ──────────────────────────────────────────────────────────────────

const isValidEmail = (email) =>
  /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);

const generatePassword = () => Math.random().toString(36).slice(-8);

const generateStudentPassword = (firstName) => `${firstName}@123`;

// ── Buffer-based file parser (no disk I/O — Worker compatible) ───────────────

const parseBuffer = async (buffer, originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  let rawData = [];

  if (ext === '.csv') {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let inQuotes = false;
      let cur = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i - 1] !== '\\') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { row.push(cur); cur = ''; }
        else { cur += ch; }
      }
      row.push(cur);
      rawData.push(row.map(v => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v)));
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    if (!workbook.worksheets?.length) throw new Error('The uploaded Excel file has no sheets.');
    const ws = workbook.worksheets[0];
    if (!ws || ws.rowCount < 2) throw new Error('The uploaded Excel file is empty or invalid.');
    ws.eachRow({ includeEmpty: false }, (row) => {
      const rowData = [];
      row.eachCell({ includeEmpty: true }, (cell) => rowData.push(cell.value ?? ''));
      rawData.push(rowData);
    });
  }

  if (rawData.length < 2) throw new Error('File must contain a header row and at least one data row.');

  const headers = rawData[0].map(h => {
    if (!h) return '';
    const text = h.richText ? h.richText.map(rt => rt.text).join('') : h.toString();
    const m = text.match(/^([^(]+)/);
    return m ? m[1].trim() : text.trim();
  });

  if (headers.some(h => h === '')) throw new Error('Empty column headers found.');

  const data = [];
  for (let i = 1; i < rawData.length; i++) {
    const obj = {};
    let isEmpty = true;
    headers.forEach((h, idx) => {
      if (h && idx < rawData[i].length) {
        const val = rawData[i][idx] ?? '';
        obj[h] = val;
        const s = String(val).toUpperCase();
        if (val !== '' && !s.includes('IMPORTANT') && !s.includes('NOTE') && !s.includes('INSTRUCTION')) isEmpty = false;
      }
    });
    if (!isEmpty && ['firstName', 'lastName', 'email'].some(k => obj[k] !== '')) data.push(obj);
  }
  return data;
};

// ── Fee helpers ───────────────────────────────────────────────────────────────

const createFeeRecordsWithArrears = async (studentId, recordedById, monthlyFee, admissionDate, arrears = 0) => {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const start = new Date(admissionDate);
  let m = start.getMonth() + 1;
  let y = start.getFullYear();
  if (m > 11) { m = 0; y++; }

  if (y > curYear || (y === curYear && m > curMonth)) {
    return createInitialFeeRecord(studentId, recordedById, monthlyFee);
  }

  const records = [];
  while (y < curYear || (y === curYear && m <= curMonth)) {
    const monthsFromCurrent = (curYear - y) * 12 + (curMonth - m);
    const isCurrent = y === curYear && m === curMonth;
    if (isCurrent || (arrears > 0 && monthsFromCurrent < arrears)) {
      const dueDate = getLastDateOfMonthForDate(new Date(y, m, 1));
      const exists = await Fee.findOne({
        student: studentId, feeType: 'tuition',
        dueDate: { $gte: new Date(y, m, 1), $lte: new Date(y, m + 1, 0) }
      });
      if (!exists) {
        records.push(await Fee.create({
          student: studentId, feeType: 'tuition', amount: monthlyFee,
          monthlyFee, dueDate, status: 'unpaid', recordedBy: recordedById,
          paidAmount: 0, remainingAmount: monthlyFee
        }));
      }
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return records;
};

const saveUploadHistory = async (TenantUploadHistory, userType, file, userId, status, total, success, errors) => {
  try {
    await TenantUploadHistory.create({
      userType,
      filename: file.originalname,
      originalFilename: file.originalname,
      uploadedBy: userId,
      status, totalRecords: total, successCount: success,
      errorCount: errors.length, errors
    });
  } catch (e) { console.error('Upload history save failed:', e); }
};

// ── Unique email helper ───────────────────────────────────────────────────────

const ensureUniqueEmail = async (TenantUser, baseEmail, tenantId) => {
  let email = baseEmail;
  const [base, domain] = baseEmail.split('@');
  let counter = 1;
  while (await TenantUser.findOne({ email, tenant: tenantId })) {
    email = `${base}${counter}@${domain}`;
    counter++;
  }
  return email;
};

// ── Upload Students ───────────────────────────────────────────────────────────

exports.uploadStudents = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

  const TenantUser = getTenantModel(req, 'User', User.schema);
  const TenantStudent = getTenantModel(req, 'Student', Student.schema);
  const TenantUploadHistory = getTenantModel(req, 'UploadHistory', UploadHistory.schema);

  const errors = [];
  let successCount = 0;

  try {
    const students = await parseBuffer(req.file.buffer, req.file.originalname);

    if (!students.length) return res.status(400).json({ success: false, message: 'The uploaded file contains no data' });

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const rowNum = i + 2;
      try {
        const missing = ['firstName','lastName','rollNumber','class','section','gender','monthlyFee','fatherName','motherName','contactNumber']
          .filter(f => !s[f]);
        if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);

        const baseEmail = SAAS_CONFIG.generateEmail('std', s.firstName, s.lastName, req.tenant.subdomain);
        s.email = await ensureUniqueEmail(TenantUser, baseEmail, req.tenantId);

        if (await TenantStudent.findOne({ rollNumber: s.rollNumber, tenant: req.tenantId }))
          throw new Error('Roll number already exists');

        const user = await TenantUser.create({
          tenant: req.tenantId, firstName: s.firstName, middleName: s.middleName || '',
          lastName: s.lastName, email: s.email, password: generateStudentPassword(s.firstName),
          role: 'student', isApproved: true, status: 'active',
          approvedBy: req.user.id, approvedAt: Date.now()
        });

        const student = await TenantStudent.create({
          tenant: req.tenantId, user: user._id, rollNumber: s.rollNumber,
          dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : new Date(),
          gender: s.gender.toLowerCase(), class: s.class, section: s.section,
          monthlyFee: parseFloat(s.monthlyFee) || 0,
          address: { street: s.street||'', city: s.city||'', state: s.state||'', zipCode: s.zipCode||'', country: s.country||'' },
          parentInfo: { fatherName: s.fatherName, motherName: s.motherName, guardianName: s.guardianName||'',
            contactNumber: s.contactNumber, email: s.parentEmail||'', occupation: s.occupation||'' },
          admissionDate: s.admissionDate ? new Date(s.admissionDate) : new Date()
        });

        if (student.monthlyFee > 0) {
          await createFeeRecordsWithArrears(student._id, req.user.id, student.monthlyFee,
            student.admissionDate, parseInt(s.arrears) || 0).catch(e =>
            console.error(`Fee record error for student ${student._id}:`, e));
        }
        successCount++;
      } catch (e) { errors.push({ row: rowNum, message: e.message }); }
    }

    await saveUploadHistory(TenantUploadHistory, 'student', req.file, req.user.id,
      errors.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
      students.length, successCount, errors);

    res.status(200).json({
      success: true,
      message: `Processed ${students.length} records. Success: ${successCount}, Failed: ${errors.length}`,
      data: { totalRecords: students.length, successCount, errorCount: errors.length, errors }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error processing file', error: e.message });
  }
};

// ── Upload Teachers ───────────────────────────────────────────────────────────

exports.uploadTeachers = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

  const TenantUser = getTenantModel(req, 'User', User.schema);
  const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
  const TenantUploadHistory = getTenantModel(req, 'UploadHistory', UploadHistory.schema);

  const errors = [];
  let successCount = 0;

  try {
    const teachers = await parseBuffer(req.file.buffer, req.file.originalname);

    if (!teachers.length) return res.status(400).json({ success: false, message: 'The uploaded file contains no data' });

    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      const rowNum = i + 2;
      try {
        if (!t.firstName || !t.lastName || !t.phoneNumber || !t.qualification ||
            !t.experience || !t.subjects || !t.gender || !t.salary)
          throw new Error('Missing required fields');

        const baseEmail = SAAS_CONFIG.generateEmail('tch', t.firstName, t.lastName, req.tenant.subdomain);
        t.email = await ensureUniqueEmail(TenantUser, baseEmail, req.tenantId);

        const teacherCount = await TenantTeacher.countDocuments({ tenant: req.tenantId });
        const yr = new Date().getFullYear().toString().slice(-2);
        const employeeId = `TCH${yr}${(teacherCount + 1).toString().padStart(4, '0')}`;

        const user = await TenantUser.create({
          tenant: req.tenantId, firstName: t.firstName, middleName: t.middleName || '',
          lastName: t.lastName, email: t.email, password: generatePassword(),
          role: 'teacher', isApproved: true, status: 'active',
          approvedBy: req.user.id, approvedAt: Date.now()
        });

        const subjects = Array.isArray(t.subjects) ? t.subjects : t.subjects.split(',').map(s => s.trim());
        const classes = t.classes ? (Array.isArray(t.classes) ? t.classes : t.classes.split(',').map(c => c.trim())) : [];

        await TenantTeacher.create({
          tenant: req.tenantId, user: user._id, employeeId,
          dateOfBirth: t.dateOfBirth ? new Date(t.dateOfBirth) : new Date(),
          gender: t.gender.toLowerCase(), phoneNumber: t.phoneNumber,
          qualification: t.qualification, experience: parseInt(t.experience),
          subjects, classes, salary: parseFloat(t.salary),
          address: { street: t.street||'', city: t.city||'', state: t.state||'', zipCode: t.zipCode||'', country: t.country||'' },
          joiningDate: t.joiningDate ? new Date(t.joiningDate) : new Date()
        });
        successCount++;
      } catch (e) { errors.push({ row: rowNum, message: e.message }); }
    }

    await saveUploadHistory(TenantUploadHistory, 'teacher', req.file, req.user.id,
      errors.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
      teachers.length, successCount, errors);

    res.status(200).json({
      success: true,
      message: `Processed ${teachers.length} records. Success: ${successCount}, Failed: ${errors.length}`,
      data: { totalRecords: teachers.length, successCount, errorCount: errors.length, errors }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error processing file', error: e.message });
  }
};

// ── Upload Admin Staff ────────────────────────────────────────────────────────

exports.uploadAdminStaff = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

  const TenantUser = getTenantModel(req, 'User', User.schema);
  const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
  const TenantUploadHistory = getTenantModel(req, 'UploadHistory', UploadHistory.schema);

  const errors = [];
  let successCount = 0;

  try {
    const staffList = await parseBuffer(req.file.buffer, req.file.originalname);

    if (!staffList.length) return res.status(400).json({ success: false, message: 'The uploaded file contains no data' });

    for (let i = 0; i < staffList.length; i++) {
      const s = staffList[i];
      const rowNum = i + 2;
      try {
        if (!s.firstName || !s.lastName || !s.employeeId || !s.phoneNumber ||
            !s.qualification || !s.experience || !s.position || !s.department || !s.gender || !s.salary)
          throw new Error('Missing required fields');

        const baseEmail = SAAS_CONFIG.generateEmail('adm', s.firstName, s.lastName, req.tenant.subdomain);
        s.email = await ensureUniqueEmail(TenantUser, baseEmail, req.tenantId);

        if (await TenantAdminStaff.findOne({ employeeId: s.employeeId, tenant: req.tenantId }))
          throw new Error('Employee ID already exists');

        const user = await TenantUser.create({
          tenant: req.tenantId, firstName: s.firstName, middleName: s.middleName || '',
          lastName: s.lastName, email: s.email, password: generatePassword(),
          role: s.role || 'admin', isApproved: true, status: 'active',
          approvedBy: req.user.id, approvedAt: Date.now()
        });

        const responsibilities = s.responsibilities
          ? (Array.isArray(s.responsibilities) ? s.responsibilities : s.responsibilities.split(',').map(r => r.trim()))
          : [];

        await TenantAdminStaff.create({
          tenant: req.tenantId, user: user._id, employeeId: s.employeeId,
          dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : new Date(),
          gender: s.gender.toLowerCase(), phoneNumber: s.phoneNumber,
          qualification: s.qualification, experience: parseInt(s.experience),
          position: s.position, department: s.department, salary: parseFloat(s.salary),
          responsibilities,
          address: { street: s.street||'', city: s.city||'', state: s.state||'', zipCode: s.zipCode||'', country: s.country||'' },
          joiningDate: s.joiningDate ? new Date(s.joiningDate) : new Date()
        });
        successCount++;
      } catch (e) { errors.push({ row: rowNum, message: e.message }); }
    }

    await saveUploadHistory(TenantUploadHistory, 'admin-staff', req.file, req.user.id,
      errors.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
      staffList.length, successCount, errors);

    res.status(200).json({
      success: true,
      message: `Processed ${staffList.length} records. Success: ${successCount}, Failed: ${errors.length}`,
      data: { totalRecords: staffList.length, successCount, errorCount: errors.length, errors }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error processing file', error: e.message });
  }
};

// ── Upload Support Staff ──────────────────────────────────────────────────────

exports.uploadSupportStaff = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });

  const TenantUser = getTenantModel(req, 'User', User.schema);
  const TenantSupportStaff = getTenantModel(req, 'SupportStaff', SupportStaff.schema);
  const TenantUploadHistory = getTenantModel(req, 'UploadHistory', UploadHistory.schema);

  const errors = [];
  let successCount = 0;

  try {
    const staffList = await parseBuffer(req.file.buffer, req.file.originalname);

    if (!staffList.length) return res.status(400).json({ success: false, message: 'The uploaded file contains no data' });

    for (let i = 0; i < staffList.length; i++) {
      const s = staffList[i];
      const rowNum = i + 2;
      try {
        if (!s.firstName || !s.lastName || !s.employeeId || !s.phoneNumber ||
            !s.position || !s.experience || !s.gender || !s.salary)
          throw new Error('Missing required fields');

        const baseEmail = SAAS_CONFIG.generateEmail('sup', s.firstName, s.lastName, req.tenant.subdomain);
        s.email = await ensureUniqueEmail(TenantUser, baseEmail, req.tenantId);

        if (await TenantSupportStaff.findOne({ employeeId: s.employeeId, tenant: req.tenantId }))
          throw new Error('Employee ID already exists');

        const user = await TenantUser.create({
          tenant: req.tenantId, firstName: s.firstName, middleName: s.middleName || '',
          lastName: s.lastName, email: s.email, password: generatePassword(),
          role: 'support-staff', isApproved: true, status: 'active',
          approvedBy: req.user.id, approvedAt: Date.now()
        });

        const daysOfWeek = s.daysOfWeek
          ? (Array.isArray(s.daysOfWeek) ? s.daysOfWeek : s.daysOfWeek.split(',').map(d => d.trim()))
          : [];

        await TenantSupportStaff.create({
          tenant: req.tenantId, user: user._id, employeeId: s.employeeId,
          dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : new Date(),
          gender: s.gender.toLowerCase(), position: s.position.toLowerCase(),
          phoneNumber: s.phoneNumber, experience: parseInt(s.experience), salary: parseFloat(s.salary),
          workingHours: { startTime: s.startTime||'', endTime: s.endTime||'', daysOfWeek },
          emergencyContact: { name: s.emergencyName||'', relationship: s.emergencyRelationship||'', phoneNumber: s.emergencyPhone||'' },
          address: { street: s.street||'', city: s.city||'', state: s.state||'', zipCode: s.zipCode||'', country: s.country||'' },
          joiningDate: s.joiningDate ? new Date(s.joiningDate) : new Date()
        });
        successCount++;
      } catch (e) { errors.push({ row: rowNum, message: e.message }); }
    }

    await saveUploadHistory(TenantSupportStaff, 'support-staff', req.file, req.user.id,
      errors.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
      staffList.length, successCount, errors);

    res.status(200).json({
      success: true,
      message: `Processed ${staffList.length} records. Success: ${successCount}, Failed: ${errors.length}`,
      data: { totalRecords: staffList.length, successCount, errorCount: errors.length, errors }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error processing file', error: e.message });
  }
};

// ── Upload History ────────────────────────────────────────────────────────────

exports.getUploadHistory = async (req, res) => {
  try {
    const TenantUploadHistory = getTenantModel(req, 'UploadHistory', UploadHistory.schema);
    const history = await TenantUploadHistory.find({ /* tenant scoped via tenantDB */ })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'firstName lastName');
    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error retrieving upload history', error: e.message });
  }
};

// ── Template Downloads (read static .xlsx files — Workers CAN read bundled assets) ──

const sendTemplate = async (res, fileName) => {
  try {
    const filePath = path.join(__dirname, '../templates', fileName);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ success: false, message: 'Template file not found.' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error sending template', error: e.message });
  }
};

exports.getStudentTemplate = (req, res) => sendTemplate(res, 'student-template.xlsx');
exports.getTeacherTemplate = (req, res) => sendTemplate(res, 'teacher-template.xlsx');
exports.getAdminStaffTemplate = (req, res) => sendTemplate(res, 'admin-staff-template.xlsx');
exports.getSupportStaffTemplate = (req, res) => sendTemplate(res, 'support-staff-template.xlsx');

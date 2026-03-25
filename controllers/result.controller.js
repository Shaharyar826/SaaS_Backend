const Exam = require('../models/Exam');
const Result = require('../models/Result');
const Student = require('../models/Student');
const asyncHandler = require('../middleware/async');
const { getTenantModel } = require('../middleware/tenant');

// Helper to calculate grade
const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

// @desc    Create exam
// @route   POST /api/results/exams
// @access  Private (Admin/Teacher)
exports.createExam = asyncHandler(async (req, res) => {
  const TenantExam = getTenantModel(req, 'Exam', Exam.schema);
  
  const exam = await TenantExam.create({
    ...req.body,
    tenant: req.tenantId,
    createdBy: req.user.id
  });

  res.status(201).json({ success: true, data: exam });
});

// @desc    Get all exams
// @route   GET /api/results/exams
// @access  Private
exports.getExams = asyncHandler(async (req, res) => {
  const TenantExam = getTenantModel(req, 'Exam', Exam.schema);
  
  const query = { tenant: req.tenantId };
  if (req.query.class) query.class = req.query.class;
  if (req.query.section) query.section = req.query.section;
  if (req.query.status) query.status = req.query.status;

  const exams = await TenantExam.find(query).sort('-createdAt');
  
  res.status(200).json({ success: true, count: exams.length, data: exams });
});

// @desc    Get single exam
// @route   GET /api/results/exams/:id
// @access  Private
exports.getExam = asyncHandler(async (req, res) => {
  const TenantExam = getTenantModel(req, 'Exam', Exam.schema);
  
  const exam = await TenantExam.findOne({ _id: req.params.id, tenant: req.tenantId });
  
  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  res.status(200).json({ success: true, data: exam });
});

// @desc    Update exam
// @route   PUT /api/results/exams/:id
// @access  Private (Admin/Teacher)
exports.updateExam = asyncHandler(async (req, res) => {
  const TenantExam = getTenantModel(req, 'Exam', Exam.schema);
  
  const exam = await TenantExam.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  res.status(200).json({ success: true, data: exam });
});

// @desc    Delete exam
// @route   DELETE /api/results/exams/:id
// @access  Private (Admin)
exports.deleteExam = asyncHandler(async (req, res) => {
  const TenantExam = getTenantModel(req, 'Exam', Exam.schema);
  const TenantResult = getTenantModel(req, 'Result', Result.schema);
  
  const exam = await TenantExam.findOne({ _id: req.params.id, tenant: req.tenantId });
  
  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  await TenantResult.deleteMany({ exam: exam._id, tenant: req.tenantId });
  await exam.deleteOne();

  res.status(200).json({ success: true, data: {} });
});

// @desc    Enter/Update marks for student
// @route   POST /api/results/marks
// @access  Private (Admin/Teacher)
exports.enterMarks = asyncHandler(async (req, res) => {
  const TenantResult = getTenantModel(req, 'Result', Result.schema);
  const { examId, studentId, marks } = req.body;

  const totalMarks = marks.reduce((sum, m) => sum + m.marksObtained, 0);
  const totalMaxMarks = marks.reduce((sum, m) => sum + m.maxMarks, 0);
  const percentage = (totalMarks / totalMaxMarks) * 100;
  const grade = calculateGrade(percentage);

  const marksWithGrades = marks.map(m => ({
    ...m,
    grade: calculateGrade((m.marksObtained / m.maxMarks) * 100)
  }));

  const result = await TenantResult.findOneAndUpdate(
    { exam: examId, student: studentId, tenant: req.tenantId },
    {
      marks: marksWithGrades,
      totalMarks,
      totalMaxMarks,
      percentage,
      grade,
      enteredBy: req.user.id
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({ success: true, data: result });
});

// @desc    Get results for exam
// @route   GET /api/results/exam/:examId
// @access  Private
exports.getExamResults = asyncHandler(async (req, res) => {
  const TenantResult = getTenantModel(req, 'Result', Result.schema);
  
  const results = await TenantResult.find({ 
    exam: req.params.examId, 
    tenant: req.tenantId 
  }).populate('student').sort('-percentage');

  res.status(200).json({ success: true, count: results.length, data: results });
});

// @desc    Get student results
// @route   GET /api/results/student/:studentId
// @access  Private
exports.getStudentResults = asyncHandler(async (req, res) => {
  const TenantResult = getTenantModel(req, 'Result', Result.schema);
  
  const query = { 
    student: req.params.studentId, 
    tenant: req.tenantId 
  };
  
  if (req.user.role === 'student' || req.user.role === 'parent') {
    query.status = 'published';
  }

  const results = await TenantResult.find(query)
    .populate('exam')
    .sort('-createdAt');

  res.status(200).json({ success: true, count: results.length, data: results });
});

// @desc    Publish results
// @route   PUT /api/results/publish/:examId
// @access  Private (Admin/Teacher)
exports.publishResults = asyncHandler(async (req, res) => {
  const TenantResult = getTenantModel(req, 'Result', Result.schema);
  const TenantExam = getTenantModel(req, 'Exam', Exam.schema);

  await TenantResult.updateMany(
    { exam: req.params.examId, tenant: req.tenantId },
    { status: 'published', publishedAt: new Date() }
  );

  await TenantExam.findOneAndUpdate(
    { _id: req.params.examId, tenant: req.tenantId },
    { status: 'published' }
  );

  res.status(200).json({ success: true, message: 'Results published successfully' });
});

// @desc    Get parent's children results
// @route   GET /api/results/parent/children/:childId
// @access  Private (Parent)
exports.getChildResults = asyncHandler(async (req, res) => {
  const TenantResult = getTenantModel(req, 'Result', Result.schema);
  const TenantParent = getTenantModel(req, 'Parent', require('../models/Parent').schema);

  const parent = await TenantParent.findOne({ user: req.user.id, tenant: req.tenantId });
  
  if (!parent || !parent.children.includes(req.params.childId)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const results = await TenantResult.find({ 
    student: req.params.childId, 
    tenant: req.tenantId,
    status: 'published'
  }).populate('exam').sort('-createdAt');

  res.status(200).json({ success: true, count: results.length, data: results });
});

const express = require('express');
const router = express.Router();
const {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam,
  enterMarks,
  getExamResults,
  getStudentResults,
  publishResults,
  getChildResults
} = require('../controllers/result.controller');
const { protect, authorize } = require('../middleware/auth');
const { checkTenantFeature } = require('../middleware/tenantFeatures');
const { FEATURES } = require('../config/features');

router.use(protect);
router.use(checkTenantFeature(FEATURES.RESULTS));

// Exam routes
router.route('/exams')
  .get(getExams)
  .post(authorize('admin', 'principal', 'teacher'), createExam);

router.route('/exams/:id')
  .get(getExam)
  .put(authorize('admin', 'principal', 'teacher'), updateExam)
  .delete(authorize('admin', 'principal'), deleteExam);

// Marks entry
router.post('/marks', authorize('admin', 'principal', 'teacher'), enterMarks);

// Results
router.get('/exam/:examId', getExamResults);
router.get('/student/:studentId', getStudentResults);
router.put('/publish/:examId', authorize('admin', 'principal', 'teacher'), publishResults);

// Parent routes
router.get('/parent/children/:childId', authorize('parent'), getChildResults);

module.exports = router;

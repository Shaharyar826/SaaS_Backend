const express = require('express');
const {
  getSalaryRecords,
  getSalaryRecord,
  createSalaryRecord,
  updateSalaryRecord,
  deleteSalaryRecord
} = require('../controllers/salary.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getSalaryRecords)
  .post(protect, authorize('admin', 'principal'), createSalaryRecord);

router
  .route('/:id')
  .get(protect, getSalaryRecord)
  .put(protect, authorize('admin', 'principal'), updateSalaryRecord)
  .delete(protect, authorize('admin', 'principal'), deleteSalaryRecord);

module.exports = router;

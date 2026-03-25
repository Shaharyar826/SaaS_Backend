const express = require('express');
const {
  getSupportStaff,
  getSupportStaffMember,
  createSupportStaff,
  updateSupportStaff,
  deleteSupportStaff
} = require('../controllers/supportStaff.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getSupportStaff)
  .post(protect, authorize('admin', 'principal'), createSupportStaff);

router
  .route('/:id')
  .get(protect, getSupportStaffMember)
  .put(protect, authorize('admin', 'principal'), updateSupportStaff)
  .delete(protect, authorize('admin'), deleteSupportStaff);

module.exports = router;

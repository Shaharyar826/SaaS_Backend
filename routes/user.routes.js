const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  resetTempPassword
} = require('../controllers/user.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, authorize('admin', 'principal'), getUsers)
  .post(protect, authorize('admin'), createUser);

router
  .route('/:id')
  .get(protect, authorize('admin', 'principal'), getUser)
  .put(protect, authorize('admin'), updateUser)
  .delete(protect, authorize('admin'), deleteUser);

// Password reset routes - accessible to all authenticated users
router.post('/reset-password', protect, resetPassword);
router.post('/reset-temp-password', protect, resetTempPassword);

module.exports = router;

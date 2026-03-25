const StudentLimitService = require('../services/studentLimitService');

// Middleware to check student limits before adding students
const checkStudentLimit = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant;
    
    // Determine how many students are being added
    let countToAdd = 1;
    
    // For bulk upload, check the array length
    if (req.body.students && Array.isArray(req.body.students)) {
      countToAdd = req.body.students.length;
    }
    
    // Check if we can add these students
    const limitCheck = await StudentLimitService.canAddStudents(tenantId, countToAdd);
    
    if (!limitCheck.canAdd) {
      return res.status(400).json({
        success: false,
        message: `Student limit exceeded. You can only have ${limitCheck.limit} students. Currently have ${limitCheck.currentCount} students. Cannot add ${countToAdd} more.`,
        data: {
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          requestedCount: countToAdd
        }
      });
    }
    
    // Add limit info to request for use in controllers
    req.studentLimitInfo = limitCheck;
    next();
  } catch (error) {
    console.error('Student limit check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking student limits'
    });
  }
};

module.exports = { checkStudentLimit };
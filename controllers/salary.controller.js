const Salary = require('../models/Salary');
const Teacher = require('../models/Teacher');
const AdminStaff = require('../models/AdminStaff');
const SupportStaff = require('../models/SupportStaff');

// @desc    Get all salary records
// @route   GET /api/salaries
// @access  Private
exports.getSalaryRecords = async (req, res) => {
  try {
    // Build query
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Handle month filtering specifically
    if (reqQuery.month) {
      console.log(`Original month filter: ${reqQuery.month}`);

      // Check if the month is in YYYY-MM format (from HTML input type="month")
      if (reqQuery.month.match(/^\d{4}-\d{2}$/)) {
        // Convert from YYYY-MM format to MM/YYYY format
        const [year, month] = reqQuery.month.split('-');
        if (year && month) {
          reqQuery.month = `${month}/${year}`;
          console.log(`Converted month filter to: ${reqQuery.month}`);
        }
      }
      // Check if it's already in MM/YYYY format
      else if (reqQuery.month.match(/^\d{2}\/\d{4}$/)) {
        console.log(`Month filter already in correct format: ${reqQuery.month}`);
      }
      // If it's in any other format, log a warning
      else {
        console.warn(`Month filter in unexpected format: ${reqQuery.month}`);
      }
    }

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // If user is a teacher, only return their own salary records
    if (req.user.role === 'teacher') {
      // Find the teacher profile for this user
      const teacher = await Teacher.findOne({ user: req.user.id });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Teacher profile not found'
        });
      }

      // Add teacher ID to query to filter only their records
      const parsedQuery = JSON.parse(queryStr);
      parsedQuery.teacher = teacher._id;
      queryStr = JSON.stringify(parsedQuery);
    }

    // Finding resource
    query = Salary.find(JSON.parse(queryStr))
      .populate({
        path: 'teacher',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'adminStaff',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'supportStaff',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-month');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Salary.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Log the final query for debugging
    console.log('Final query:', JSON.stringify(JSON.parse(queryStr)));

    // Executing query
    let salaryRecords = await query;
    console.log(`Found ${salaryRecords.length} salary records initially`);

    // If filtering by month, log the months of the records found
    if (reqQuery.month) {
      console.log('Months of records found:', salaryRecords.map(record => record.month));

      // Double-check the month filtering to ensure exact matches
      // This is a fallback in case the database query doesn't filter correctly
      const monthFilter = reqQuery.month;
      salaryRecords = salaryRecords.filter(record => record.month === monthFilter);
      console.log(`After additional filtering, found ${salaryRecords.length} salary records for month ${monthFilter}`);
    }

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: salaryRecords.length,
      pagination,
      data: salaryRecords
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single salary record
// @route   GET /api/salaries/:id
// @access  Private
exports.getSalaryRecord = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id)
      .populate({
        path: 'teacher',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'adminStaff',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'supportStaff',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: `No salary record found with id ${req.params.id}`
      });
    }

    // If user is a teacher, they can only view their own salary records
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: 'Teacher profile not found'
        });
      }

      // Check if this salary record belongs to the teacher
      if (salary.staffType === 'teacher' && salary.teacher &&
          salary.teacher._id.toString() !== teacher._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this salary record'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: salary
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create salary record
// @route   POST /api/salaries
// @access  Private
exports.createSalaryRecord = async (req, res) => {
  try {
    // Add user to req.body
    req.body.recordedBy = req.user.id;

    // Validate staff type and existence based on staffType
    const { staffType } = req.body;

    if (!staffType) {
      return res.status(400).json({
        success: false,
        message: 'Staff type is required'
      });
    }

    // Check if the staff exists based on staffType
    if (staffType === 'teacher') {
      if (!req.body.teacher) {
        return res.status(400).json({
          success: false,
          message: 'Teacher ID is required for teacher staff type'
        });
      }

      const teacher = await Teacher.findById(req.body.teacher);
      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: `No teacher found with id ${req.body.teacher}`
        });
      }

      // Ensure other staff fields are null
      req.body.adminStaff = null;
      req.body.supportStaff = null;
    } else if (staffType === 'admin-staff') {
      if (!req.body.adminStaff) {
        return res.status(400).json({
          success: false,
          message: 'Admin staff ID is required for admin-staff staff type'
        });
      }

      const adminStaff = await AdminStaff.findById(req.body.adminStaff);
      if (!adminStaff) {
        return res.status(404).json({
          success: false,
          message: `No admin staff found with id ${req.body.adminStaff}`
        });
      }

      // Ensure other staff fields are null
      req.body.teacher = null;
      req.body.supportStaff = null;
    } else if (staffType === 'support-staff') {
      if (!req.body.supportStaff) {
        return res.status(400).json({
          success: false,
          message: 'Support staff ID is required for support-staff staff type'
        });
      }

      const supportStaff = await SupportStaff.findById(req.body.supportStaff);
      if (!supportStaff) {
        return res.status(404).json({
          success: false,
          message: `No support staff found with id ${req.body.supportStaff}`
        });
      }

      // Ensure other staff fields are null
      req.body.teacher = null;
      req.body.adminStaff = null;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff type'
      });
    }

    const salary = await Salary.create(req.body);

    res.status(201).json({
      success: true,
      data: salary
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update salary record
// @route   PUT /api/salaries/:id
// @access  Private
exports.updateSalaryRecord = async (req, res) => {
  try {
    let salary = await Salary.findById(req.params.id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: `No salary record found with id ${req.params.id}`
      });
    }

    // Make sure user is the record creator or an admin/principal
    if (
      salary.recordedBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this salary record`
      });
    }

    salary = await Salary.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: salary
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete salary record
// @route   DELETE /api/salaries/:id
// @access  Private
exports.deleteSalaryRecord = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: `No salary record found with id ${req.params.id}`
      });
    }

    // Make sure user is the record creator or an admin/principal
    if (
      salary.recordedBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this salary record`
      });
    }

    await salary.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

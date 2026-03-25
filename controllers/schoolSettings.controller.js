const SchoolSettings = require('../models/SchoolSettings');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { trackUpdate } = require('../utils/historyHelpers');

// @desc    Get public school settings
// @route   GET /api/school-settings/public
// @access  Public
exports.getPublicSchoolSettings = async (req, res) => {
  try {
    // Find settings or create default if none exists
    const settings = await SchoolSettings.findOneOrCreate();

    // Update stats with real-time data
    const studentCount = await Student.countDocuments({ isActive: true });
    const teacherCount = await Teacher.countDocuments({ isActive: true });

    // Get unique classes count
    const classes = new Set();
    const studentClasses = await Student.distinct('class');
    studentClasses.forEach(cls => {
      if (cls !== 'Not assigned') {
        classes.add(cls);
      }
    });

    // Create response object with updated stats
    const responseData = settings.toObject();
    responseData.landingPage.stats.studentCount = studentCount;
    responseData.landingPage.stats.teacherCount = teacherCount;
    responseData.landingPage.stats.classesCount = classes.size;

    // Remove sensitive or unnecessary fields for public view
    delete responseData.updatedBy;
    delete responseData.__v;

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get school settings
// @route   GET /api/school-settings
// @access  Private/Admin,Principal
exports.getSchoolSettings = async (req, res) => {
  try {
    // Find settings or create default if none exists
    const settings = await SchoolSettings.findOneOrCreate(req.user.id);

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update school settings
// @route   PUT /api/school-settings
// @access  Private/Admin,Principal
exports.updateSchoolSettings = async (req, res) => {
  try {
    // Find settings or create default if none exists
    let settings = await SchoolSettings.findOneOrCreate(req.user.id);

    // Track the update for history
    await trackUpdate('SchoolSettings', settings._id, settings, req.body, req.user.id);

    // Update settings with request body
    settings = await SchoolSettings.findOneAndUpdate(
      {},
      {
        ...req.body,
        updatedBy: req.user.id
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Upload hero image
// @route   POST /api/school-settings/hero-image
// @access  Private/Admin,Principal
exports.uploadHeroImage = async (req, res) => {
  try {
    // Check if Cloudinary URL was provided by middleware
    if (!req.cloudinaryUrl) {
      return res.status(400).json({
        success: false,
        message: 'No image was uploaded'
      });
    }

    // Find settings or create default if none exists
    const settings = await SchoolSettings.findOneOrCreate(req.user.id);

    // Update hero image with Cloudinary URL
    const updatedSettings = await SchoolSettings.findOneAndUpdate(
      {},
      {
        'landingPage.heroImage': req.cloudinaryUrl,
        updatedBy: req.user.id
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: updatedSettings
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

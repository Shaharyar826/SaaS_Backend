const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const User = require('../models/User');
const EventNotice = require('../models/Notice');
const SchoolSettings = require('../models/SchoolSettings');
const AboutUsContent = require('../models/AboutUsContent');
const AdmissionsContent = require('../models/AdmissionsContent');
const AcademicsContent = require('../models/AcademicsContent');
const GalleryImage = require('../models/GalleryImage');

// @desc    Get featured teachers for public display
// @route   GET /api/public/teachers
// @access  Public
exports.getFeaturedTeachers = async (req, res) => {
  try {
    // Get limit from query or default to 6
    const limit = parseInt(req.query.limit) || 6;

    // Find active teachers with populated user data
    const teachers = await Teacher.find({ isActive: true })
      .populate({
        path: 'user',
        select: 'name profileImage'
      })
      .limit(limit);

    // Format the response
    const formattedTeachers = teachers.map(teacher => ({
      id: teacher._id,
      name: teacher.user.name,
      profileImage: teacher.user.profileImage,
      qualification: teacher.qualification,
      experience: teacher.experience,
      subjects: teacher.subjects,
      employeeId: teacher.employeeId
    }));

    res.status(200).json({
      success: true,
      count: formattedTeachers.length,
      data: formattedTeachers
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get public events and notices
// @route   GET /api/public/events-notices
// @access  Public
exports.getPublicEventsNotices = async (req, res) => {
  try {
    // Get limit from query or default to 5
    const limit = parseInt(req.query.limit) || 5;

    // Get type filter from query (event, notice, or all)
    const type = req.query.type;

    // Build query
    const query = {
      isActive: true,
      // Only show events/notices targeted to 'all' or 'parents' for public view
      targetAudience: { $in: ['all', 'parents'] }
    };

    // Add type filter if specified
    if (type && type !== 'all') {
      query.type = type;
    }

    // Find events and notices
    const eventsNotices = await EventNotice.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: 'createdBy',
        select: 'name role'
      });

    res.status(200).json({
      success: true,
      count: eventsNotices.length,
      data: eventsNotices
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get school statistics
// @route   GET /api/public/stats
// @access  Public
exports.getSchoolStats = async (req, res) => {
  try {
    // Get counts
    const studentCount = await Student.countDocuments({ isActive: true });
    const teacherCount = await Teacher.countDocuments({ isActive: true });

    // Get unique classes
    const classes = new Set();
    const studentClasses = await Student.distinct('class');
    studentClasses.forEach(cls => {
      if (cls !== 'Not assigned') {
        classes.add(cls);
      }
    });

    // Find system admin user for content creation if needed
    const systemAdmin = await User.findOne({ isSystemAccount: true, role: 'admin' });
    const systemUserId = systemAdmin ? systemAdmin._id : null;

    if (!systemUserId) {
      return res.status(500).json({
        success: false,
        message: 'System configuration error: No system admin account found'
      });
    }

    // Get school settings for success rate
    const settings = await SchoolSettings.findOneOrCreate(systemUserId);

    res.status(200).json({
      success: true,
      data: {
        studentCount,
        teacherCount,
        classesCount: classes.size,
        successRate: settings.landingPage.stats.successRate || 95
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get landing page data (combined endpoint)
// @route   GET /api/public/landing-page
// @access  Public
exports.getLandingPageData = async (req, res) => {
  try {
    // Find system admin user for content creation if needed
    const systemAdmin = await User.findOne({ isSystemAccount: true, role: 'admin' });
    const systemUserId = systemAdmin ? systemAdmin._id : null;

    if (!systemUserId) {
      return res.status(500).json({
        success: false,
        message: 'System configuration error: No system admin account found'
      });
    }

    // Get school settings
    const settings = await SchoolSettings.findOneOrCreate(systemUserId);

    // Get featured teachers from the new FeaturedTeacher model
    const FeaturedTeacher = require('../models/FeaturedTeacher');
    const LandingPageEvent = require('../models/LandingPageEvent');
    const Testimonial = require('../models/Testimonial');

    // Try to get custom featured teachers first
    let featuredTeachers = await FeaturedTeacher.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(6);

    // If no custom featured teachers, fall back to regular teachers
    if (featuredTeachers.length === 0) {
      const teachers = await Teacher.find({ isActive: true })
        .populate({
          path: 'user',
          select: 'name profileImage'
        })
        .limit(6);

      // Format teachers
      featuredTeachers = teachers.map(teacher => ({
        id: teacher._id,
        name: teacher.user.name,
        image: teacher.user.profileImage,
        qualification: teacher.qualification,
        experience: teacher.experience,
        subjects: teacher.subjects,
        employeeId: teacher.employeeId
      }));
    }

    // Try to get custom landing page events first
    let landingPageEvents = await LandingPageEvent.find({ isActive: true })
      .sort({ displayOrder: 1, date: 1 })
      .limit(5);

    // If no custom landing page events, fall back to regular events and notices
    if (landingPageEvents.length === 0) {
      landingPageEvents = await EventNotice.find({
        isActive: true,
        targetAudience: { $in: ['all', 'parents'] }
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({
          path: 'createdBy',
          select: 'name role'
        });
    }

    // Get testimonials
    const testimonials = await Testimonial.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(6);

    // Get stats
    const studentCount = await Student.countDocuments({ isActive: true });
    const teacherCount = await Teacher.countDocuments({ isActive: true });

    // Get unique classes
    const classes = new Set();
    const studentClasses = await Student.distinct('class');
    studentClasses.forEach(cls => {
      if (cls !== 'Not assigned') {
        classes.add(cls);
      }
    });

    // Update settings stats
    const settingsObj = settings.toObject();
    settingsObj.landingPage.stats.studentCount = studentCount;
    settingsObj.landingPage.stats.teacherCount = teacherCount;
    settingsObj.landingPage.stats.classesCount = classes.size;

    // Remove sensitive fields
    delete settingsObj.updatedBy;
    delete settingsObj.__v;

    res.status(200).json({
      success: true,
      data: {
        settings: settingsObj,
        teachers: featuredTeachers,
        eventsNotices: landingPageEvents,
        testimonials: testimonials,
        stats: {
          studentCount,
          teacherCount,
          classesCount: classes.size,
          successRate: settings.landingPage.stats.successRate || 95
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get all public content (combined endpoint)
// @route   GET /api/public/all-content
// @access  Public
exports.getAllPublicContent = async (req, res) => {
  try {
    // Set a timeout for this operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
    });

    const dataPromise = (async () => {
      // Find system admin user for content creation if needed
      const systemAdmin = await User.findOne({ isSystemAccount: true, role: 'admin' });
      const systemUserId = systemAdmin ? systemAdmin._id : null;

      if (!systemUserId) {
        throw new Error('System configuration error: No system admin account found');
      }

      return systemUserId;
    })();

    const systemUserId = await Promise.race([dataPromise, timeoutPromise]);

    // Get school settings
    const settings = await SchoolSettings.findOneOrCreate(systemUserId);

    // Get about us content
    const aboutUsContent = await AboutUsContent.findOneOrCreate(systemUserId);

    // Get admissions content
    const admissionsContent = await AdmissionsContent.findOneOrCreate(systemUserId);

    // Get academics content
    const academicsContent = await AcademicsContent.findOneOrCreate(systemUserId);

    // Get featured teachers
    const FeaturedTeacher = require('../models/FeaturedTeacher');
    let featuredTeachers = await FeaturedTeacher.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });

    // If no custom featured teachers, fall back to regular teachers
    if (featuredTeachers.length === 0) {
      const teachers = await Teacher.find({ isActive: true })
        .populate({
          path: 'user',
          select: 'name profileImage'
        });

      // Format teachers
      featuredTeachers = teachers.map(teacher => ({
        id: teacher._id,
        name: teacher.user.name,
        image: teacher.user.profileImage,
        qualification: teacher.qualification,
        experience: teacher.experience,
        subjects: teacher.subjects,
        employeeId: teacher.employeeId
      }));
    }

    // Get events and notices
    const LandingPageEvent = require('../models/LandingPageEvent');
    let events = await LandingPageEvent.find({ isActive: true })
      .sort({ displayOrder: 1, date: 1 });

    // If no custom landing page events, fall back to regular events and notices
    if (events.length === 0) {
      events = await EventNotice.find({
        isActive: true,
        targetAudience: { $in: ['all', 'parents'] }
      })
        .sort({ createdAt: -1 })
        .populate({
          path: 'createdBy',
          select: 'name role'
        });
    }

    // Get gallery images (limit to 12 for initial load)
    const galleryImages = await GalleryImage.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(12);

    // Get testimonials
    const Testimonial = require('../models/Testimonial');
    const testimonials = await Testimonial.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });

    // Calculate real-time stats
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

    // Update settings stats with real-time data
    const settingsObj = settings.toObject();
    settingsObj.landingPage.stats.studentCount = studentCount;
    settingsObj.landingPage.stats.teacherCount = teacherCount;
    settingsObj.landingPage.stats.classesCount = classes.size;
    delete settingsObj.updatedBy;
    delete settingsObj.__v;

    const aboutUsObj = aboutUsContent.toObject();
    delete aboutUsObj.updatedBy;
    delete aboutUsObj.__v;

    const admissionsObj = admissionsContent.toObject();
    delete admissionsObj.updatedBy;
    delete admissionsObj.__v;

    const academicsObj = academicsContent.toObject();
    delete academicsObj.updatedBy;
    delete academicsObj.__v;

    res.status(200).json({
      success: true,
      data: {
        settings: settingsObj,
        aboutUs: aboutUsObj,
        admissions: admissionsObj,
        academics: academicsObj,
        teachers: featuredTeachers,
        events: events,
        gallery: galleryImages,
        testimonials: testimonials,
        stats: {
          studentCount,
          teacherCount,
          classesCount: classes.size,
          successRate: settingsObj.landingPage.stats.successRate || 95
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
const FeaturedTeacher = require('../models/FeaturedTeacher');
const LandingPageEvent = require('../models/LandingPageEvent');
const Testimonial = require('../models/Testimonial');
const Teacher = require('../models/Teacher');
const { trackCreation, trackUpdate, trackDeletion } = require('../utils/historyHelpers');

// @desc    Get all featured teachers
// @route   GET /api/landing-page/teachers
// @access  Private/Admin,Principal
exports.getFeaturedTeachers = async (req, res) => {
  try {
    const teachers = await FeaturedTeacher.find().sort({ displayOrder: 1, _id: 1 });

    res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single featured teacher
// @route   GET /api/landing-page/teachers/:id
// @access  Private/Admin,Principal
exports.getFeaturedTeacher = async (req, res) => {
  try {
    const teacher = await FeaturedTeacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Featured teacher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create featured teacher
// @route   POST /api/landing-page/teachers
// @access  Private/Admin,Principal
exports.createFeaturedTeacher = async (req, res) => {
  try {
    console.log('Creating featured teacher with body:', req.body);
    console.log('File:', req.file);

    // Add user to req.body
    req.body.createdBy = req.user.id;

    // Handle image if uploaded
    if (req.cloudinaryUrl) {
      req.body.image = req.cloudinaryUrl;
    } else if (req.body.profileImage) {
      // If no new file but profileImage is provided, use it for the image field
      req.body.image = req.body.profileImage;
    }

    // Handle subjects array
    if (req.body.subjects && !Array.isArray(req.body.subjects)) {
      // If subjects is a string, try to parse it as JSON
      try {
        if (req.body.subjects.startsWith('[') && req.body.subjects.endsWith(']')) {
          req.body.subjects = JSON.parse(req.body.subjects);
        } else {
          // If it's a single value, convert to array
          req.body.subjects = [req.body.subjects];
        }
      } catch (error) {
        console.error('Error parsing subjects:', error);
        req.body.subjects = req.body.subjects ? [req.body.subjects] : [];
      }
    }

    console.log('Processed body before creation:', req.body);

    // Create featured teacher
    const teacher = await FeaturedTeacher.create(req.body);
    console.log('Created teacher:', teacher);

    // Track creation for history
    await trackCreation('FeaturedTeacher', teacher, req.user.id);

    res.status(201).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    console.error('Error creating featured teacher:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update featured teacher
// @route   PUT /api/landing-page/teachers/:id
// @access  Private/Admin,Principal
exports.updateFeaturedTeacher = async (req, res) => {
  try {
    console.log('Updating featured teacher with body:', req.body);
    console.log('File:', req.file);

    let teacher = await FeaturedTeacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Featured teacher not found'
      });
    }

    // Handle image if uploaded
    if (req.cloudinaryUrl) {
      req.body.image = req.cloudinaryUrl;
    } else if (req.body.profileImage) {
      // If no new file but profileImage is provided, use it for the image field
      req.body.image = req.body.profileImage;
    }

    // Handle subjects array
    if (req.body.subjects && !Array.isArray(req.body.subjects)) {
      // If subjects is a string, try to parse it as JSON
      try {
        if (req.body.subjects.startsWith('[') && req.body.subjects.endsWith(']')) {
          req.body.subjects = JSON.parse(req.body.subjects);
        } else {
          // If it's a single value, convert to array
          req.body.subjects = [req.body.subjects];
        }
      } catch (error) {
        console.error('Error parsing subjects:', error);
        req.body.subjects = req.body.subjects ? [req.body.subjects] : [];
      }
    }

    console.log('Processed body before update:', req.body);

    // Track update for history
    await trackUpdate('FeaturedTeacher', teacher, req.body, req.user.id);

    // Update teacher
    teacher = await FeaturedTeacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    console.log('Updated teacher:', teacher);

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    console.error('Error updating featured teacher:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete featured teacher
// @route   DELETE /api/landing-page/teachers/:id
// @access  Private/Admin,Principal
exports.deleteFeaturedTeacher = async (req, res) => {
  try {
    const teacher = await FeaturedTeacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Featured teacher not found'
      });
    }

    // Track deletion for history
    await trackDeletion('FeaturedTeacher', teacher, req.user.id);

    await teacher.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get all landing page events
// @route   GET /api/landing-page/events
// @access  Private/Admin,Principal
exports.getLandingPageEvents = async (req, res) => {
  try {
    const events = await LandingPageEvent.find().sort({ displayOrder: 1, date: 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single landing page event
// @route   GET /api/landing-page/events/:id
// @access  Private/Admin,Principal
exports.getLandingPageEvent = async (req, res) => {
  try {
    const event = await LandingPageEvent.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Landing page event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create landing page event
// @route   POST /api/landing-page/events
// @access  Private/Admin,Principal
exports.createLandingPageEvent = async (req, res) => {
  try {
    req.body.createdBy = req.user.id;
    // Validation
    if (!req.body.title || !req.body.date || !req.body.description) {
      return res.status(400).json({ success: false, message: 'Title, date, and description are required.' });
    }
    // Handle image upload to Cloudinary
    if (req.cloudinaryUrl) {
      req.body.image = req.cloudinaryUrl;
    }
    const event = await LandingPageEvent.create(req.body);
    await trackCreation('LandingPageEvent', event, req.user.id);
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update landing page event
// @route   PUT /api/landing-page/events/:id
// @access  Private/Admin,Principal
exports.updateLandingPageEvent = async (req, res) => {
  try {
    let event = await LandingPageEvent.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Landing page event not found' });
    }
    // Validation
    if (!req.body.title || !req.body.date || !req.body.description) {
      return res.status(400).json({ success: false, message: 'Title, date, and description are required.' });
    }
    // Handle image upload to Cloudinary
    if (req.cloudinaryUrl) {
      req.body.image = req.cloudinaryUrl;
    }
    await trackUpdate('LandingPageEvent', event, req.body, req.user.id);
    event = await LandingPageEvent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Delete landing page event
// @route   DELETE /api/landing-page/events/:id
// @access  Private/Admin,Principal
exports.deleteLandingPageEvent = async (req, res) => {
  try {
    const event = await LandingPageEvent.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Landing page event not found'
      });
    }

    // Track deletion for history
    await trackDeletion('LandingPageEvent', event, req.user.id);

    await event.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get all testimonials
// @route   GET /api/landing-page/testimonials
// @access  Private/Admin,Principal
exports.getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single testimonial
// @route   GET /api/landing-page/testimonials/:id
// @access  Private/Admin,Principal
exports.getTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.status(200).json({
      success: true,
      data: testimonial
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create testimonial
// @route   POST /api/landing-page/testimonials
// @access  Private/Admin,Principal
exports.createTestimonial = async (req, res) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;

    // Handle image if uploaded
    if (req.cloudinaryUrl) {
      req.body.image = req.cloudinaryUrl;
    } else if (req.body.originalImage) {
      // If no new file but originalImage is provided, use it for the image field
      req.body.image = req.body.originalImage;
    }

    // Create testimonial
    const testimonial = await Testimonial.create(req.body);

    // Track creation for history
    await trackCreation('Testimonial', testimonial, req.user.id);

    res.status(201).json({
      success: true,
      data: testimonial
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update testimonial
// @route   PUT /api/landing-page/testimonials/:id
// @access  Private/Admin,Principal
exports.updateTestimonial = async (req, res) => {
  try {
    let testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    // Handle image if uploaded
    if (req.cloudinaryUrl) {
      req.body.image = req.cloudinaryUrl;
    } else if (req.body.originalImage) {
      // If no new file but originalImage is provided, use it for the image field
      req.body.image = req.body.originalImage;
    }

    // Track update for history
    await trackUpdate('Testimonial', testimonial, req.body, req.user.id);

    // Update testimonial
    testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: testimonial
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete testimonial
// @route   DELETE /api/landing-page/testimonials/:id
// @access  Private/Admin,Principal
exports.deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    // Track deletion for history
    await trackDeletion('Testimonial', testimonial, req.user.id);

    await testimonial.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get active teachers for selection
// @route   GET /api/landing-page/active-teachers
// @access  Private/Admin,Principal
exports.getActiveTeachersForSelection = async (req, res) => {
  try {
    // Get active teachers with their users
    const teachers = await Teacher.find({ isActive: true })
      .populate({
        path: 'user',
        select: 'name profileImage isApproved status',
        match: { isApproved: true, status: 'active' }
      });

    // Filter out teachers whose users are not approved or inactive
    const activeTeachers = teachers.filter(teacher => teacher.user);

    // Format the response
    const formattedTeachers = activeTeachers.map(teacher => ({
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

// @desc    Get all landing page content
// @route   GET /api/landing-page/content
// @access  Public
exports.getLandingPageContent = async (req, res) => {
  try {
    // Get featured teachers
    const teachers = await FeaturedTeacher.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });

    // Get landing page events
    const events = await LandingPageEvent.find({ isActive: true })
      .sort({ displayOrder: 1, date: 1 });

    // Get testimonials
    const testimonials = await Testimonial.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        featuredTeachers: teachers,
        landingPageEvents: events,
        testimonials: testimonials
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
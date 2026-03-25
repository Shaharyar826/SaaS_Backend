const AboutUsContent = require('../models/AboutUsContent');
const AdmissionsContent = require('../models/AdmissionsContent');
const AcademicsContent = require('../models/AcademicsContent');
const { trackUpdate } = require('../utils/historyHelpers');
const FeaturedTeacher = require('../models/FeaturedTeacher');
const FacultyPageContent = require('../models/FacultyPageContent');


const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Fixed Admissions controllers
exports.getAdmissionsContent = async (req, res) => {
  try {
    const content = await AdmissionsContent.findOneOrCreate();
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.updateAdmissionsContent = async (req, res) => {
  try {
    let content = await AdmissionsContent.findOneOrCreate(req.user.id);
    await trackUpdate('AdmissionsContent', content._id, content, req.body, req.user.id);
    content = await AdmissionsContent.findOneAndUpdate(
      {},
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
// @desc    Get about us content
// @route   GET /api/page-content/about
// @access  Public
exports.getAboutUsContent = async (req, res) => {
  try {
    // Find content or create default if none exists
    const content = await AboutUsContent.findOneOrCreate();

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update about us content
// @route   PUT /api/page-content/about
// @access  Private/Admin,Principal
exports.updateAboutUsContent = async (req, res) => {
  try {
    // Find content or create default if none exists
    let content = await AboutUsContent.findOneOrCreate(req.user.id);

    // Track the update for history
    await trackUpdate('AboutUsContent', content._id, content, req.body, req.user.id);

    // Update content with request body
    content = await AboutUsContent.findOneAndUpdate(
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
      data: content
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Upload about us banner image
// @route   POST /api/page-content/about/banner-image
// @access  Private/Admin,Principal
exports.uploadAboutUsBannerImage = async (req, res) => {
  try {
    // Check if Cloudinary URL was provided by middleware
    if (!req.cloudinaryUrl) {
      return res.status(400).json({
        success: false,
        message: 'No image was uploaded'
      });
    }

    // Find content or create default if none exists
    const content = await AboutUsContent.findOneOrCreate(req.user.id);

    // Update banner image with Cloudinary URL
    const updatedContent = await AboutUsContent.findOneAndUpdate(
      {},
      {
        bannerImage: req.cloudinaryUrl,
        updatedBy: req.user.id
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: updatedContent
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Upload leadership team member photo
// @route   POST /api/page-content/about/leadership-photo/:memberIndex
// @access  Private/Admin,Principal
exports.uploadLeadershipPhoto = async (req, res) => {
  try {
    // Check if Cloudinary URL was provided by middleware
    if (!req.cloudinaryUrl) {
      return res.status(400).json({
        success: false,
        message: 'No image was uploaded'
      });
    }

    const { memberIndex } = req.params;

    // Find content or create default if none exists
    let content = await AboutUsContent.findOneOrCreate(req.user.id);

    // Check if the member exists
    if (!content.leadership || !content.leadership.team || !content.leadership.team[memberIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Leadership team member not found'
      });
    }

    // Update the team member's photo with Cloudinary URL
    content.leadership.team[memberIndex].photo = req.cloudinaryUrl;
    content.updatedBy = req.user.id;

    // Save the updated content
    await content.save();

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};


exports.getAdmissionsContent = async (req, res) => {
  try {
    const content = await AdmissionsContent.findOneOrCreate();

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Admissions content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load admissions content'
    });
  }
};

exports.updateAdmissionsContent = async (req, res) => {
  try {
    let content = await AdmissionsContent.findOneOrCreate(req.user.id);

    content = await AdmissionsContent.findOneAndUpdate(
      {},
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
// @desc    Upload admissions downloadable file
// @route   POST /api/page-content/admissions/file
// @access  Private/Admin,Principal
exports.uploadAdmissionsFile = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a title for the file'
      });
    }

    // Find content or create default if none exists
    let content = await AdmissionsContent.findOneOrCreate(req.user.id);

    // Add new file to downloadableFiles array
    const newFile = {
      title,
      description: description || '',
      file: req.cloudinaryUrl || req.file.filename // Use Cloudinary URL if available, fallback to filename for non-images
    };
    content.downloadableFiles.push(newFile);

    // Save updated content
    await content.save();

    res.status(200).json({
      success: true,
      data: newFile
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete admissions downloadable file
// @route   DELETE /api/page-content/admissions/file/:fileId
// @access  Private/Admin,Principal
exports.deleteAdmissionsFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Find content
    let content = await AdmissionsContent.findOne();

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Admissions content not found'
      });
    }

    // Remove file from downloadableFiles array
    content.downloadableFiles = content.downloadableFiles.filter(
      file => file._id.toString() !== fileId
    );

    // Save updated content
    await content.save();

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get academics content
// @route   GET /api/page-content/academics
// @access  Public
exports.getAcademicsContent = async (req, res) => {
  try {
    // Find content or create default if none exists
    const content = await AcademicsContent.findOneOrCreate();

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update academics content
// @route   PUT /api/page-content/academics
// @access  Private/Admin,Principal
exports.updateAcademicsContent = async (req, res) => {
  try {
    // Find content or create default if none exists
    let content = await AcademicsContent.findOneOrCreate(req.user.id);

    // Track the update for history
    await trackUpdate('AcademicsContent', content._id, content, req.body, req.user.id);

    // Update content with request body
    content = await AcademicsContent.findOneAndUpdate(
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
      data: content
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get faculty content
// @route   GET /api/page-content/faculty
// @access  Public
// exports.getFacultyContent = async (req, res) => {
//   try {
//     const allTeachers = await FeaturedTeacher.find({ isActive: true }).sort({ displayOrder: 1 });
//     const leadership = allTeachers.filter(t => t.section === 'leadership');
//     const departmentHeads = allTeachers.filter(t => t.section === 'departmentHead');
//     const teachingStaff = allTeachers.filter(t => t.section === 'teachingStaff');
//     // const departments = [...new Set(allTeachers.map(t => t.department).filter(Boolean))];
//     // res.status(200).json({
//     //   success: true,
//     //   data: {
//     //     leadership,
//     //     departmentHeads,
//     //     teachingStaff,
//     //     departments
//     //   }
//     // });
// const pageContent = await FacultyPageContent.findOne() || { departments: [] };

// res.status(200).json({
//   success: true,
//   data: {
//     leadership,
//     departmentHeads,
//     teachingStaff,
//     departments: pageContent.departments
//   }
// });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// };



exports.getFacultyContent = async (req, res) => {
  try {
    const allTeachers = await FeaturedTeacher.find({ isActive: true }).sort({ displayOrder: 1 });

    const leadership = allTeachers.filter(t => t.section === 'leadership');
    const departmentHeads = allTeachers.filter(t => t.section === 'departmentHead');
    const teachingStaff = allTeachers.filter(t => t.section === 'teachingStaff');

    const pageContent = await FacultyPageContent.findOne();
    const departments = pageContent?.departments || [];

    res.status(200).json({
      success: true,
      data: {
        leadership,
        departmentHeads,
        teachingStaff,
        departments
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};







// @desc    Update faculty content
// @route   PUT /api/page-content/faculty
// @access  Private/Admin,Principal
// exports.updateFacultyContent = async (req, res) => {
//   try {
//     const { leadership = [], departmentHeads = [], teachingStaff = [], departments = [] } = req.body;
//     // Remove all existing teachers (or update as needed)
//     await FeaturedTeacher.deleteMany({});
//     // Insert new teachers
//     const allTeachers = [...leadership, ...departmentHeads, ...teachingStaff].map(t => ({ ...t, isActive: true }));
//     await FeaturedTeacher.insertMany(allTeachers);
//     res.status(200).json({
//       success: true,
//       data: req.body
//     });
//   } catch (err) {
//     res.status(400).json({
//       success: false,
//       message: err.message
//     });
//   }
// };



exports.updateFacultyContent = async (req, res) => {
  try {
    const { leadership = [], departmentHeads = [], teachingStaff = [], departments = [] } = req.body;

    // Remove existing teachers
    await FeaturedTeacher.deleteMany({});

    // Save new teachers
    const allTeachers = [...leadership, ...departmentHeads, ...teachingStaff].map(t => ({ ...t, isActive: true }));
    await FeaturedTeacher.insertMany(allTeachers);

    // Save departments
    let pageContent = await FacultyPageContent.findOne();
    if (!pageContent) {
      pageContent = new FacultyPageContent();
    }
    pageContent.departments = departments;
    pageContent.updatedAt = new Date();
    await pageContent.save();

    res.status(200).json({
      success: true,
      data: {
        leadership,
        departmentHeads,
        teachingStaff,
        departments
      }
    });

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};








// @desc    Upload faculty member photo
// @route   POST /api/page-content/faculty/photo
// @access  Private
exports.uploadFacultyPhoto = async (req, res) => {
  try {
    // Check if Cloudinary URL was provided by middleware
    if (!req.cloudinaryUrl) {
      return res.status(400).json({
        success: false,
        message: 'No image was uploaded'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        imageUrl: req.cloudinaryUrl
      }
    });
  } catch (error) {
    console.error('Error uploading faculty photo:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading photo'
    });
  }
};

const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// @desc    Upload profile image
// @route   POST /api/profile-image/upload
// @access  Private
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.cloudinaryUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Determine which user to update
    const targetUserId = req.body.targetUserId || req.user.id;

    // If updating another user's profile, ensure current user has permission
    if (targetUserId !== req.user.id) {
      if (!['admin', 'principal'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update other users\' profile images'
        });
      }
    }

    // Find the target user
    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If user has an existing profile image, delete it from Cloudinary
    if (user.profileImage?.metadata?.publicId) {
      await cloudinary.uploader.destroy(user.profileImage.metadata.publicId);
    }

    // Update user with new profile image
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      {
        profileImage: {
          url: req.cloudinaryUrl,
          metadata: {
            ...req.cloudinaryMetadata,
            publicId: req.cloudinaryPublicId
          }
        }
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        profileImage: updatedUser.profileImage
      },
      message: 'Profile image uploaded successfully'
    });
  } catch (err) {
    console.error('Error uploading profile image:', err);
    res.status(500).json({
      success: false,
      message: 'Error uploading profile image',
      error: err.message
    });
  }
};

// @desc    Delete profile image
// @route   DELETE /api/profile-image
// @access  Private
exports.deleteProfileImage = async (req, res) => {
  try {
    // Find the user
    const user = await User.findById(req.user.id);

    // If user has an existing profile image, delete it from Cloudinary
    if (user.profileImage?.metadata?.publicId) {
      await cloudinary.uploader.destroy(user.profileImage.metadata.publicId);
    }

    // Reset user profile image to null
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting profile image:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting profile image',
      error: err.message
    });
  }
};

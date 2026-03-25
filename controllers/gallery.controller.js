const GalleryImage = require('../models/GalleryImage');
const { trackCreation, trackUpdate, trackDeletion } = require('../utils/historyHelpers');
const cloudinary = require('../config/cloudinary');

// @desc    Get all gallery images
// @route   GET /api/gallery
// @access  Public
exports.getGalleryImages = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const query = {};
    if (!req.user || !['admin', 'principal'].includes(req.user.role)) {
      query.isActive = true;
    }

    const total = await GalleryImage.countDocuments(query);
    const images = await GalleryImage.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('createdBy', 'name');

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
      count: images.length,
      pagination,
      data: images
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single gallery image
// @route   GET /api/gallery/:id
// @access  Public
exports.getGalleryImage = async (req, res) => {
  try {
    const galleryImage = await GalleryImage.findById(req.params.id);

    if (!galleryImage) {
      return res.status(404).json({
        success: false,
        message: 'Gallery image not found'
      });
    }

    // Public access should only see active images
    if ((!req.user || (req.user.role !== 'admin' && req.user.role !== 'principal')) && !galleryImage.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Gallery image not found'
      });
    }

    res.status(200).json({
      success: true,
      data: galleryImage
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create gallery image
// @route   POST /api/gallery
// @access  Private/Admin,Principal
exports.createGalleryImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Convert the buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'gallery',
      resource_type: 'auto'
    });

    // Add user to req.body
    req.body.createdBy = req.user.id;

    // Create gallery image with Cloudinary URL and metadata
    const galleryImage = await GalleryImage.create({
      ...req.body,
      imageUrl: result.secure_url,
      imageMetadata: {
        ...result,
        publicId: result.public_id
      }
    });

    // Track creation for history
    await trackCreation('GalleryImage', galleryImage, req.user.id);

    res.status(201).json({
      success: true,
      data: galleryImage
    });
  } catch (err) {
    console.error('Error creating gallery image:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update gallery image
// @route   PUT /api/gallery/:id
// @access  Private/Admin,Principal
exports.updateGalleryImage = async (req, res) => {
  try {
    let galleryImage = await GalleryImage.findById(req.params.id);

    if (!galleryImage) {
      return res.status(404).json({
        success: false,
        message: 'Gallery image not found'
      });
    }

    // Track update for history (fix parameter order)
    await trackUpdate('GalleryImage', galleryImage, req.body, req.user.id);

    // If new image is uploaded via Cloudinary
    if (req.cloudinaryUrl) {
      // Delete old image from Cloudinary if it exists
      if (galleryImage.imageMetadata && galleryImage.imageMetadata.publicId) {
        await cloudinary.uploader.destroy(galleryImage.imageMetadata.publicId);
      }

      // Update with new Cloudinary data
      req.body.imageUrl = req.cloudinaryUrl;
      req.body.imageMetadata = {
        ...req.cloudinaryMetadata,
        publicId: req.cloudinaryPublicId
      };
    }

    galleryImage = await GalleryImage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: galleryImage
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete gallery image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin,Principal
exports.deleteGalleryImage = async (req, res) => {
  try {
    const galleryImage = await GalleryImage.findById(req.params.id);

    if (!galleryImage) {
      return res.status(404).json({
        success: false,
        message: 'Gallery image not found'
      });
    }

    // Track deletion for history (fix parameter order)
    await trackDeletion('GalleryImage', galleryImage, req.user.id);

    // Delete image from Cloudinary if it exists
    if (galleryImage.imageMetadata && galleryImage.imageMetadata.publicId) {
      await cloudinary.uploader.destroy(galleryImage.imageMetadata.publicId);
    }

    // Use deleteOne instead of remove (which is deprecated)
    await GalleryImage.deleteOne({ _id: req.params.id });

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

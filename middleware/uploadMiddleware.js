const cloudinary = require('../config/cloudinary');

const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return next();
        }

        // Get the image type from the request or default to 'misc'
        const imageType = req.body.imageType || 'misc';

        // Map image types to Cloudinary folders
        const folderMap = {
            'profile': 'profile_pictures',
            'banner': 'banners',
            'hero': 'hero_images',
            'background': 'backgrounds',
            'gallery': 'gallery',
            'notice': 'notices',
            'event': 'events',
            'misc': 'miscellaneous'
        };

        // Get the appropriate folder or default to miscellaneous
        const folder = folderMap[imageType] || folderMap.misc;

        // Convert the buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

        // Create a unique public_id based on type and timestamp
        const timestamp = new Date().getTime();
        const uniqueIdentifier = req.user ? `${req.user.id}_${timestamp}` : `anon_${timestamp}`;
        const public_id = `${folder}/${uniqueIdentifier}`;

        // Upload to cloudinary with specific folder and public_id
        const result = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: folder,
            public_id: uniqueIdentifier,
            overwrite: true,
            invalidate: true,
            timeout: 120000 // 2 minutes timeout
        });

        // Add the cloudinary url and metadata to the request
        req.cloudinaryUrl = result.secure_url;
        req.cloudinaryPublicId = result.public_id;
        req.cloudinaryMetadata = {
            folder: folder,
            format: result.format,
            resourceType: result.resource_type,
            createdAt: result.created_at
        };

        next();
    } catch (error) {
        console.error('Error uploading to cloudinary:', error);
        res.status(500).json({ success: false, message: 'Error uploading image' });
    }
};

// Function to delete image from Cloudinary
const deleteImage = async (publicId) => {
    try {
        if (!publicId) return;
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
    }
};

module.exports = { uploadImage, deleteImage };
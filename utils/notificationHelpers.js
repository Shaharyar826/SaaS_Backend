const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Create notifications for all users targeted by an event or notice
 * @param {Object} eventNotice - The event or notice object
 * @param {String} creatorId - ID of the user who created the event/notice
 * @returns {Promise<Array>} - Array of created notification IDs
 */
exports.createEventNoticeNotifications = async (eventNotice, creatorId) => {
  try {
    const notificationIds = [];
    const targetAudience = eventNotice.targetAudience || ['all'];
    
    // Determine which user roles to target
    let targetRoles = [];
    
    if (targetAudience.includes('all')) {
      // Target all roles
      targetRoles = ['admin', 'principal', 'vice-principal', 'teacher', 'student', 'accountant'];
    } else {
      // Map audience to roles
      const audienceToRoleMap = {
        'teachers': ['teacher'],
        'students': ['student'],
        'parents': [], // Not implemented yet
        'staff': ['admin', 'principal', 'vice-principal', 'accountant']
      };
      
      // Combine all target roles
      targetAudience.forEach(audience => {
        if (audienceToRoleMap[audience]) {
          targetRoles = [...targetRoles, ...audienceToRoleMap[audience]];
        }
      });
    }
    
    // Remove duplicates
    targetRoles = [...new Set(targetRoles)];
    
    // Find all users with the target roles
    const users = await User.find({
      role: { $in: targetRoles },
      isActive: true,
      _id: { $ne: creatorId } // Don't notify the creator
    });
    
    // Create a notification for each user
    const notificationPromises = users.map(user => {
      const notification = new Notification({
        user: user._id,
        type: eventNotice.type === 'event' ? 'notice' : 'notice', // Using 'notice' type for both for now
        title: eventNotice.type === 'event' ? 'New Event' : 'New Notice',
        message: `${eventNotice.title}: ${eventNotice.content.substring(0, 100)}${eventNotice.content.length > 100 ? '...' : ''}`,
        relatedEntity: {
          entityType: 'Notice', // Using 'Notice' for both events and notices
          entityId: eventNotice._id
        },
        priority: eventNotice.priority || 'medium',
        // Set expiration date to the event/notice end date or 30 days from now
        expiresAt: eventNotice.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      
      return notification.save().then(savedNotification => {
        notificationIds.push(savedNotification._id);
        return savedNotification;
      });
    });
    
    await Promise.all(notificationPromises);
    
    return notificationIds;
  } catch (error) {
    console.error('Error creating event/notice notifications:', error);
    return [];
  }
};

const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const SupportStaff = require('../models/SupportStaff');
const AdminStaff = require('../models/AdminStaff');
const { trackCreation, trackUpdate, trackDeletion, trackCancellation } = require('../utils/historyHelpers');

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
exports.getMeetings = async (req, res) => {
  try {
    // Build query
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    query = Meeting.find(JSON.parse(queryStr))
      .populate({
        path: 'organizer',
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
      query = query.sort('-date');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Meeting.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const meetings = await query;

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
      count: meetings.length,
      pagination,
      data: meetings
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get meetings for current user
// @route   GET /api/meetings/my-meetings
// @access  Private
exports.getMyMeetings = async (req, res) => {
  try {
    const user = req.user;
    let userRole = user.role;
    let meetings = [];

    // Find meetings where the user is the organizer
    const organizedMeetings = await Meeting.find({
      organizer: user._id,
      isActive: true
    }).populate({
      path: 'organizer',
      select: 'name role'
    }).sort('-date');

    // Find meetings where the user's role is in participants
    const participantMeetings = await Meeting.find({
      participants: { $in: [userRole, 'all'] },
      isActive: true
    }).populate({
      path: 'organizer',
      select: 'name role'
    }).sort('-date');

    // For admin and principal roles, also include ALL meetings regardless of participants
    let adminPrincipalMeetings = [];
    if (userRole === 'admin' || userRole === 'principal') {
      console.log(`User is ${userRole}, fetching all meetings`);

      // Find all meetings (admins and principals should see everything)
      adminPrincipalMeetings = await Meeting.find({
        isActive: true,
        organizer: { $ne: user._id } // Not created by current user (already in organizedMeetings)
      }).populate({
        path: 'organizer',
        select: 'name role'
      }).sort('-date');

      console.log(`Found ${adminPrincipalMeetings.length} additional meetings for ${userRole} with ID ${user._id}`);
    }

    // Combine and remove duplicates
    const allMeetings = [...organizedMeetings, ...participantMeetings, ...adminPrincipalMeetings];
    const uniqueMeetings = Array.from(new Map(allMeetings.map(meeting =>
      [meeting._id.toString(), meeting]
    )).values());

    console.log(`Returning ${uniqueMeetings.length} meetings for ${userRole} with ID ${user._id}`);

    res.status(200).json({
      success: true,
      count: uniqueMeetings.length,
      data: uniqueMeetings
    });
  } catch (err) {
    console.error('Error getting meetings:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to get meetings'
    });
  }
};

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
exports.getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate({
      path: 'organizer',
      select: 'name role'
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    res.status(200).json({
      success: true,
      data: meeting
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create meeting
// @route   POST /api/meetings
// @access  Private/Admin,Principal
exports.createMeeting = async (req, res) => {
  try {
    console.log('Creating new meeting with data:', req.body);

    // Add user to req.body
    req.body.organizer = req.user.id;

    const meeting = await Meeting.create(req.body);
    console.log('Meeting created successfully:', meeting._id);

    // Create notifications for participants
    try {
      await createMeetingNotifications(meeting);
    } catch (notificationError) {
      console.error('Error creating notifications, but meeting was created:', notificationError);
      // Continue with the response even if notifications fail
    }

    // Track meeting creation in history
    try {
      await trackCreation('Meeting', meeting, req.user.id, 'Meeting created');
    } catch (historyError) {
      console.error('Error tracking meeting creation history:', historyError);
      // Continue with the response even if history tracking fails
    }

    res.status(201).json({
      success: true,
      data: meeting
    });
  } catch (err) {
    console.error('Error creating meeting:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to create meeting'
    });
  }
};

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private/Admin,Principal
exports.updateMeeting = async (req, res) => {
  try {
    console.log('Updating meeting with ID:', req.params.id);

    let meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      console.log('Meeting not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Make sure user is meeting organizer or admin/principal
    if (
      meeting.organizer.toString() !== req.user.id &&
      !['admin', 'principal'].includes(req.user.role)
    ) {
      console.log('User not authorized to update meeting. User:', req.user.id, 'Role:', req.user.role);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update this meeting'
      });
    }

    // Store the previous state for history tracking
    const previousState = { ...meeting.toObject() };

    meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    console.log('Meeting updated successfully:', meeting._id);

    // Update notifications for participants if meeting details changed
    try {
      await updateMeetingNotifications(meeting);
    } catch (notificationError) {
      console.error('Error updating notifications, but meeting was updated:', notificationError);
      // Continue with the response even if notifications fail
    }

    // Track meeting update in history
    try {
      await trackUpdate('Meeting', previousState, meeting, req.user.id, 'Meeting updated');
    } catch (historyError) {
      console.error('Error tracking meeting update history:', historyError);
      // Continue with the response even if history tracking fails
    }

    res.status(200).json({
      success: true,
      data: meeting
    });
  } catch (err) {
    console.error('Error updating meeting:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to update meeting'
    });
  }
};

// @desc    Cancel meeting
// @route   PUT /api/meetings/:id/cancel
// @access  Private/Admin,Principal
exports.cancelMeeting = async (req, res) => {
  try {
    console.log('Cancelling meeting with ID:', req.params.id);

    let meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      console.log('Meeting not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Make sure user is meeting organizer or admin/principal
    if (
      meeting.organizer.toString() !== req.user.id &&
      !['admin', 'principal'].includes(req.user.role)
    ) {
      console.log('User not authorized to cancel meeting. User:', req.user.id, 'Role:', req.user.role);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to cancel this meeting'
      });
    }

    // Store the previous state for history tracking
    const previousState = { ...meeting.toObject() };

    // Update meeting status to cancelled
    meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true, runValidators: true }
    );

    console.log('Meeting cancelled successfully:', meeting._id);

    // Update notifications for participants
    try {
      await updateMeetingNotifications(meeting);
    } catch (notificationError) {
      console.error('Error updating notifications, but meeting was cancelled:', notificationError);
      // Continue with the response even if notifications fail
    }

    // Track meeting cancellation in history
    try {
      await trackCancellation('Meeting', previousState, meeting, req.user.id, 'Meeting cancelled');
    } catch (historyError) {
      console.error('Error tracking meeting cancellation history:', historyError);
      // Continue with the response even if history tracking fails
    }

    res.status(200).json({
      success: true,
      data: meeting
    });
  } catch (err) {
    console.error('Error cancelling meeting:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to cancel meeting'
    });
  }
};

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private/Admin,Principal
exports.deleteMeeting = async (req, res) => {
  try {
    console.log('Deleting meeting with ID:', req.params.id);

    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      console.log('Meeting not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Make sure user is meeting organizer or admin/principal
    if (
      meeting.organizer.toString() !== req.user.id &&
      !['admin', 'principal'].includes(req.user.role)
    ) {
      console.log('User not authorized to delete meeting. User:', req.user.id, 'Role:', req.user.role);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to delete this meeting'
      });
    }

    // Track meeting deletion in history before deleting
    try {
      await trackDeletion('Meeting', meeting, req.user.id, 'Meeting deleted');
    } catch (historyError) {
      console.error('Error tracking meeting deletion history:', historyError);
      // Continue with the deletion even if history tracking fails
    }

    await Meeting.deleteOne({ _id: meeting._id });
    console.log('Meeting deleted successfully:', meeting._id);

    // Delete related notifications
    const deleteResult = await Notification.deleteMany({
      'relatedEntity.entityType': 'Meeting',
      'relatedEntity.entityId': meeting._id
    });
    console.log(`Deleted ${deleteResult.deletedCount} related notifications`);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Error deleting meeting:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to delete meeting'
    });
  }
};

// Helper function to create meeting notifications
const createMeetingNotifications = async (meeting) => {
  try {
    console.log('Creating meeting notifications for meeting:', meeting._id);
    const participants = meeting.participants;
    const users = [];

    // Get all users based on participant roles
    for (const role of participants) {
      let roleUsers = [];

      if (role === 'all') {
        roleUsers = await User.find({ isApproved: true, status: 'active' });
        console.log(`Found ${roleUsers.length} users for 'all' role`);
      } else if (role === 'teachers') {
        // Find all teacher users
        try {
          roleUsers = await User.find({ role: 'teacher', isApproved: true, status: 'active' });
          console.log(`Found ${roleUsers.length} users for 'teachers' role`);

          // If no teachers found, log more details
          if (roleUsers.length === 0) {
            const allTeachers = await User.find({ role: 'teacher' });
            console.log(`Total teachers in system: ${allTeachers.length}`);
            console.log(`Teachers not approved: ${allTeachers.filter(t => !t.isApproved).length}`);
            console.log(`Teachers not active: ${allTeachers.filter(t => t.status !== 'active').length}`);
          }
        } catch (err) {
          console.error('Error finding teachers:', err);
        }
      } else if (role === 'students') {
        roleUsers = await User.find({ role: 'student', isApproved: true, status: 'active' });
        console.log(`Found ${roleUsers.length} users for 'students' role`);
      } else if (role === 'admin-staff') {
        roleUsers = await User.find({ role: 'admin', isApproved: true, status: 'active' });
        console.log(`Found ${roleUsers.length} users for 'admin-staff' role`);
      } else if (role === 'support-staff') {
        // Get support staff users
        const supportStaff = await SupportStaff.find({ isActive: true }).select('user');
        const supportStaffUserIds = supportStaff.map(staff => staff.user);
        roleUsers = await User.find({ _id: { $in: supportStaffUserIds }, isApproved: true, status: 'active' });
        console.log(`Found ${roleUsers.length} users for 'support-staff' role`);
      } else if (role === 'parents') {
        // For parents, we don't have a separate model, so we'll skip for now
        console.log('Parents role not implemented yet');
      }

      users.push(...roleUsers);
    }

    // Always include admin and principal users regardless of selected participants
    // This ensures both admin and principal see all meetings
    console.log('Adding admin and principal users to notifications regardless of selected participants');

    // Find admin users
    const adminUsers = await User.find({ role: 'admin', isApproved: true, status: 'active' });
    console.log(`Found ${adminUsers.length} admin users to add to notifications`);
    if (adminUsers.length > 0) {
      users.push(...adminUsers);
    } else {
      console.log('No admin users found');
    }

    // Find principal users
    const principalUsers = await User.find({ role: 'principal', isApproved: true, status: 'active' });
    console.log(`Found ${principalUsers.length} principal users to add to notifications`);
    if (principalUsers.length > 0) {
      users.push(...principalUsers);
    } else {
      console.log('No principal users found');
    }

    // Remove duplicates
    const uniqueUsers = Array.from(new Map(users.map(user =>
      [user._id.toString(), user]
    )).values());

    console.log(`Creating notifications for ${uniqueUsers.length} unique users`);

    // If no users found, return early
    if (uniqueUsers.length === 0) {
      console.log('No users found to create notifications for');
      return;
    }

    // Create notification for each user
    const notifications = uniqueUsers.map(user => ({
      user: user._id,
      type: 'meeting',
      title: 'New Meeting',
      message: `You have a new meeting: ${meeting.title} on ${new Date(meeting.date).toLocaleDateString()} at ${meeting.startTime}`,
      relatedEntity: {
        entityType: 'Meeting',
        entityId: meeting._id
      },
      priority: 'medium',
      expiresAt: new Date(meeting.date)
    }));

    const result = await Notification.insertMany(notifications);
    console.log(`Successfully created ${result.length} notifications`);
  } catch (error) {
    console.error('Error creating meeting notifications:', error);
    // Don't throw the error, just log it
  }
};

// Helper function to update meeting notifications
const updateMeetingNotifications = async (meeting) => {
  try {
    console.log('Updating meeting notifications for meeting:', meeting._id);

    // Delete existing notifications
    const deleteResult = await Notification.deleteMany({
      'relatedEntity.entityType': 'Meeting',
      'relatedEntity.entityId': meeting._id
    });

    console.log(`Deleted ${deleteResult.deletedCount} existing notifications`);

    // Create new notifications
    await createMeetingNotifications(meeting);
  } catch (error) {
    console.error('Error updating meeting notifications:', error);
    // Don't throw the error, just log it
  }
};

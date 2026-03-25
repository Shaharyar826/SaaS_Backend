const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const AdminStaff = require('../models/AdminStaff');
const SupportStaff = require('../models/SupportStaff');

// @desc    Get available classes for public access (registration)
// @route   GET /api/filters/public/classes
// @access  Public
exports.getPublicClasses = async (req, res) => {
  try {
    let classes = new Set();

    // Get classes from students
    const studentClasses = await Student.distinct('class');
    if (studentClasses && studentClasses.length > 0) {
      studentClasses.forEach(cls => {
        if (cls !== 'Not assigned') {
          classes.add(cls);
        }
      });
    }

    // Get classes from teachers
    const teachers = await Teacher.find().select('classes');
    if (teachers && teachers.length > 0) {
      teachers.forEach(teacher => {
        if (teacher.classes && teacher.classes.length > 0) {
          teacher.classes.forEach(cls => {
            if (cls !== 'Not assigned') {
              classes.add(cls);
            }
          });
        }
      });
    }

    // If no classes found, add default classes (1-12)
    if (classes.size === 0) {
      console.log('No classes found in database, adding default classes (1-12)');
      for (let i = 1; i <= 12; i++) {
        classes.add(i.toString());
      }
    }

    // Convert Set to array and format for response
    let classesArray = Array.from(classes).map(cls => ({ value: cls, label: `Class ${cls}` }));

    // Sort classes numerically
    classesArray.sort((a, b) => {
      const numA = isNaN(parseInt(a.value)) ? 0 : parseInt(a.value);
      const numB = isNaN(parseInt(b.value)) ? 0 : parseInt(b.value);
      return numA - numB;
    });

    // Log the classes found for debugging
    console.log('Public classes endpoint found:', classesArray.length, 'classes');
    console.log('Classes:', classesArray.map(c => c.value).join(', '));

    // Return classes
    res.status(200).json({
      success: true,
      data: classesArray
    });
  } catch (err) {
    console.error('Error fetching public classes:', err);

    // Return default classes on error
    const defaultClasses = Array.from({ length: 12 }, (_, i) => ({
      value: (i + 1).toString(),
      label: `Class ${i + 1}`
    }));

    res.status(200).json({
      success: true,
      data: defaultClasses
    });
  }
};

// @desc    Get available user types
// @route   GET /api/filters/user-types
// @access  Private
exports.getUserTypes = async (req, res) => {
  try {
    let userTypes = [];

    // Role-based user type restrictions
    if (req.user.role === 'teacher') {
      // Teachers can only mark attendance for students
      userTypes = [
        { value: 'student', label: 'Student' }
      ];
    } else if (['admin', 'principal', 'vice-principal'].includes(req.user.role)) {
      // Admin and principals can mark attendance for all user types
      userTypes = [
        { value: 'student', label: 'Student' },
        { value: 'teacher', label: 'Teacher' },
        { value: 'admin-staff', label: 'Admin Staff' },
        { value: 'support-staff', label: 'Support Staff' }
      ];
    } else {
      // Other roles (like accountant) can only view student attendance
      userTypes = [
        { value: 'student', label: 'Student' }
      ];
    }

    res.status(200).json({
      success: true,
      data: userTypes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get available classes based on user type
// @route   GET /api/filters/classes
// @access  Private
exports.getClasses = async (req, res) => {
  try {
    const { userType, forEdit } = req.query;
    let classes = [];

    // Special case: When a teacher is editing their own profile, show all available classes
    if (req.user.role === 'teacher' && forEdit === 'true') {
      console.log('Teacher editing their own profile, showing all available classes');

      // Get unique classes from both students and teachers
      const classesSet = new Set();

      // Get classes from students
      const studentClasses = await Student.distinct('class');
      studentClasses.forEach(cls => {
        if (cls !== 'Not assigned') {
          classesSet.add(cls);
        }
      });

      // Get classes from teachers
      const teachers = await Teacher.find().select('classes');
      teachers.forEach(teacher => {
        if (teacher.classes && teacher.classes.length > 0) {
          teacher.classes.forEach(cls => {
            if (cls !== 'Not assigned') {
              classesSet.add(cls);
            }
          });
        }
      });

      // Add some default classes if no classes are found
      if (classesSet.size === 0) {
        for (let i = 1; i <= 12; i++) {
          classesSet.add(i.toString());
        }
      }

      classes = Array.from(classesSet).map(cls => ({ value: cls, label: `Class ${cls}` }));
    }
    // For teachers viewing student data, only show their assigned classes
    else if (req.user.role === 'teacher' && userType === 'student' && forEdit !== 'true') {
      const teacher = await Teacher.findOne({ user: req.user.id });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        // Filter out 'Not assigned' from teacher's classes
        const validClasses = teacher.classes.filter(cls => cls !== 'Not assigned');
        classes = validClasses.map(cls => ({ value: cls, label: `Class ${cls}` }));
      }
    } else if (userType === 'student') {
      // Get unique classes from students
      const studentClasses = await Student.distinct('class');
      classes = studentClasses.map(cls => ({ value: cls, label: `Class ${cls}` }));
    } else if (userType === 'teacher') {
      // Get unique classes from teachers
      const teachers = await Teacher.find().select('classes');
      const teacherClasses = new Set();

      teachers.forEach(teacher => {
        if (teacher.classes && teacher.classes.length > 0) {
          teacher.classes.forEach(cls => {
            // Don't add 'Not assigned' to the available classes
            if (cls !== 'Not assigned') {
              teacherClasses.add(cls);
            }
          });
        }
      });

      // Get unique classes from students as well to ensure all classes are available
      const studentClasses = await Student.distinct('class');
      studentClasses.forEach(cls => {
        if (cls !== 'Not assigned') {
          teacherClasses.add(cls);
        }
      });

      // Add some default classes if no classes are found
      if (teacherClasses.size === 0) {
        for (let i = 1; i <= 12; i++) {
          teacherClasses.add(i.toString());
        }
      }

      classes = Array.from(teacherClasses).map(cls => ({ value: cls, label: `Class ${cls}` }));
    } else if (userType === 'admin-staff' || userType === 'support-staff') {
      // Admin staff and support staff don't have classes, but we'll return an empty array
      classes = [];
    }

    // Sort classes numerically
    classes.sort((a, b) => {
      // Handle non-numeric classes
      const numA = isNaN(parseInt(a.value)) ? 0 : parseInt(a.value);
      const numB = isNaN(parseInt(b.value)) ? 0 : parseInt(b.value);
      return numA - numB;
    });

    console.log(`Returning ${classes.length} classes for userType: ${userType}, forEdit: ${forEdit}`);

    res.status(200).json({
      success: true,
      data: classes
    });
  } catch (err) {
    console.error(`Error fetching classes: ${err.message}`);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get available sections based on user type and class
// @route   GET /api/filters/sections
// @access  Private
exports.getSections = async (req, res) => {
  try {
    const { userType, class: classValue } = req.query;
    let sections = [];

    // For teachers, verify they teach the requested class
    if (req.user.role === 'teacher' && userType === 'student' && classValue) {
      const teacher = await Teacher.findOne({ user: req.user.id });

      if (!teacher || !teacher.classes || !teacher.classes.includes(classValue)) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view sections for this class'
        });
      }

      // Get unique sections from students in the specified class
      const studentSections = await Student.distinct('section', { class: classValue });
      sections = studentSections.map(section => ({ value: section, label: `Section ${section}` }));
    } else if (userType === 'student' && classValue) {
      // Get unique sections from students in the specified class
      const studentSections = await Student.distinct('section', { class: classValue });
      sections = studentSections.map(section => ({ value: section, label: `Section ${section}` }));
    } else if (userType === 'teacher' && classValue) {
      // For teachers, we need to find sections indirectly through students
      // First, find teachers who teach the specified class
      const teachers = await Teacher.find({ classes: classValue });

      if (teachers.length > 0) {
        // Then find all sections in that class
        const studentSections = await Student.distinct('section', { class: classValue });
        sections = studentSections.map(section => ({ value: section, label: `Section ${section}` }));
      }
    } else if (userType === 'admin-staff' || userType === 'support-staff') {
      // Admin staff and support staff don't have sections, but we'll return an empty array
      sections = [];
    }

    // Sort sections alphabetically
    sections.sort((a, b) => a.value.localeCompare(b.value));

    res.status(200).json({
      success: true,
      data: sections
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get users based on filters
// @route   GET /api/filters/users
// @access  Private
exports.getFilteredUsers = async (req, res) => {
  try {
    const { userType, class: classValue, section, date, excludeAttendanceId } = req.query;
    let users = [];
    let markedUserIds = [];

    // If date is provided, find users who already have attendance for that date
    if (date) {
      const Attendance = require('../models/Attendance');

      // Create start and end date for the selected day (start of day to end of day)
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      console.log(`Filtering attendance for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log(`Filtering for user type: ${userType}`);

      // Build query to find attendance records
      const attendanceQuery = {
        date: { $gte: startDate, $lte: endDate },
        userType: userType
      };

      // If excludeAttendanceId is provided (edit mode), exclude that specific record
      if (excludeAttendanceId) {
        attendanceQuery._id = { $ne: excludeAttendanceId };
        console.log(`Excluding attendance record: ${excludeAttendanceId}`);
      }

      // Find all attendance records for the selected date and user type
      const attendanceRecords = await Attendance.find(attendanceQuery);

      // Extract user IDs from attendance records
      markedUserIds = attendanceRecords.map(record => record.userId.toString());
      console.log(`Found ${markedUserIds.length} users with attendance already marked for ${date}`);

      if (markedUserIds.length > 0) {
        console.log('Sample of marked user IDs:', markedUserIds.slice(0, 3));
      }
    }

    if (userType === 'student') {
      // Build query for students
      const query = {};
      if (classValue) query.class = classValue;
      if (section) query.section = section;

      // For teachers, only show students from their assigned classes
      if (req.user.role === 'teacher') {
        const teacher = await Teacher.findOne({ user: req.user.id });
        if (teacher && teacher.classes && teacher.classes.length > 0) {
          // If a specific class is requested, make sure it's one of the teacher's classes
          if (classValue) {
            if (!teacher.classes.includes(classValue)) {
              return res.status(403).json({
                success: false,
                message: 'You are not authorized to view students from this class'
              });
            }
          } else {
            // If no specific class is requested, limit to teacher's classes
            query.class = { $in: teacher.classes };
          }
        }
      }

      // Find students matching the query
      const students = await Student.find(query).populate({
        path: 'user',
        select: 'name email role profileImage'
      });

      console.log(`Found ${students.length} total students matching class/section filters`);

      // Filter out students who already have attendance marked for the selected date
      const filteredStudents = markedUserIds.length > 0
        ? students.filter(student => !markedUserIds.includes(student._id.toString()))
        : students;

      console.log(`After filtering, ${filteredStudents.length} students remain without attendance marked`);

      users = filteredStudents.map(student => ({
        id: student._id,
        userId: student.user._id,
        name: student.user.name,
        identifier: student.rollNumber,
        class: student.class,
        section: student.section,
        type: 'student'
      }));
    } else if (userType === 'teacher') {
      // Build query for teachers
      let query = {};

      if (classValue) {
        query.classes = classValue;
      }

      // Find teachers matching the query
      const teachers = await Teacher.find(query).populate({
        path: 'user',
        select: 'name email role profileImage'
      });

      console.log(`Found ${teachers.length} total teachers matching class filter`);

      // If section is specified, we need to filter teachers who teach that section
      let filteredTeachers = teachers;
      if (section && classValue) {
        // This is a placeholder - in a real system, you'd have a more sophisticated way
        // to determine which teachers teach which sections
        filteredTeachers = teachers;
      }

      // Filter out teachers who already have attendance marked for the selected date
      filteredTeachers = markedUserIds.length > 0
        ? filteredTeachers.filter(teacher => !markedUserIds.includes(teacher._id.toString()))
        : filteredTeachers;

      console.log(`After filtering, ${filteredTeachers.length} teachers remain without attendance marked`);

      users = filteredTeachers.map(teacher => ({
        id: teacher._id,
        userId: teacher.user._id,
        name: teacher.user.name,
        identifier: teacher.employeeId,
        classes: teacher.classes,
        type: 'teacher'
      }));
    } else if (userType === 'admin-staff') {
      // Admin staff don't have class/section, so we just return all of them
      const adminStaff = await AdminStaff.find().populate({
        path: 'user',
        select: 'name email role profileImage'
      });

      console.log(`Found ${adminStaff.length} total admin staff`);

      // Filter out admin staff who already have attendance marked for the selected date
      const filteredAdminStaff = markedUserIds.length > 0
        ? adminStaff.filter(staff => !markedUserIds.includes(staff._id.toString()))
        : adminStaff;

      console.log(`After filtering, ${filteredAdminStaff.length} admin staff remain without attendance marked`);

      users = filteredAdminStaff.map(staff => ({
        id: staff._id,
        userId: staff.user._id,
        name: staff.user.name,
        identifier: staff.employeeId,
        position: staff.position,
        department: staff.department,
        type: 'admin-staff'
      }));
    } else if (userType === 'support-staff') {
      // Support staff don't have class/section, so we just return all of them
      const supportStaff = await SupportStaff.find().populate({
        path: 'user',
        select: 'name email role profileImage'
      });

      console.log(`Found ${supportStaff.length} total support staff`);

      // Filter out support staff who already have attendance marked for the selected date
      const filteredSupportStaff = markedUserIds.length > 0
        ? supportStaff.filter(staff => !markedUserIds.includes(staff._id.toString()))
        : supportStaff;

      console.log(`After filtering, ${filteredSupportStaff.length} support staff remain without attendance marked`);

      users = filteredSupportStaff.map(staff => ({
        id: staff._id,
        userId: staff.user._id,
        name: staff.user.name,
        identifier: staff.employeeId,
        position: staff.position,
        type: 'support-staff'
      }));
    }

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    console.error('Error fetching filtered users:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

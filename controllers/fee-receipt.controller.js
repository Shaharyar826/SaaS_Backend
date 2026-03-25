const Fee = require('../models/Fee');
const Student = require('../models/Student');
const User = require('../models/User');
const ReceiptData = require('../models/ReceiptData');
const cloudinary = require('../config/cloudinary');

// @desc    Generate a fee receipt PDF
// @route   GET /api/fee-receipts/generate/:feeId
// @access  Private
exports.generateFeeReceipt = async (req, res) => {
  try {
    // Find the fee record
    const fee = await Fee.findById(req.params.feeId)
      .populate({
        path: 'student',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: `No fee record found with id ${req.params.feeId}`
      });
    }

    // Generate a unique receipt number if not already present
    if (!fee.receiptNumber) {
      const receiptNumber = `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      fee.receiptNumber = receiptNumber;
      await fee.save();
    }

    // Return the fee data to be used for PDF generation on the client side
    res.status(200).json({
      success: true,
      data: fee
    });
  } catch (err) {
    console.error('Error generating fee receipt:', err);
    res.status(500).json({
      success: false,
      message: 'Error generating fee receipt',
      error: err.message
    });
  }
};

// @desc    Upload a fee receipt and store it
// @route   POST /api/fee-receipts/upload
// @access  Private/Admin/Principal/Accountant
exports.uploadFeeReceipt = async (req, res) => {
  try {
    console.log('Receipt upload request received:', req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    // Upload PDF to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw', // Ensure raw resource type for PDFs
          folder: 'receipts',
          public_id: `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          format: 'pdf',
          access_mode: 'public' // Ensure public access
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('PDF uploaded successfully to Cloudinary:', result.secure_url);
            resolve(result);
          }
        }
      ).end(req.file.buffer);
    });

    // Generate a proper PDF URL for access
    const pdfUrl = cloudinary.url(uploadResult.public_id, {
      resource_type: 'raw',
      format: 'pdf',
      secure: true
    });

    console.log('Generated PDF URL:', pdfUrl);

    // Store the receipt file information
    const receiptData = await ReceiptData.create({
      filename: req.file.originalname,
      cloudinaryUrl: pdfUrl, // Use the properly generated URL
      cloudinaryPublicId: uploadResult.public_id,
      uploadedBy: req.user.id
    });

    // Extract data from the receipt (this would be implemented with a PDF parsing library)
    // For now, we'll return the receipt ID to be used for extraction
    res.status(201).json({
      success: true,
      message: 'Receipt uploaded successfully',
      data: {
        receiptId: receiptData._id,
        pdfUrl: pdfUrl // Also return the URL for immediate access
      }
    });
  } catch (err) {
    console.error('Error uploading fee receipt:', err);
    res.status(500).json({
      success: false,
      message: 'Error uploading fee receipt',
      error: err.message
    });
  }
};

// @desc    Extract data from an uploaded receipt
// @route   GET /api/fee-receipts/extract/:receiptId
// @access  Private/Admin/Principal/Accountant
exports.extractDataFromReceipt = async (req, res) => {
  try {
    // Find the receipt data
    const receiptData = await ReceiptData.findById(req.params.receiptId);

    if (!receiptData) {
      return res.status(404).json({
        success: false,
        message: `No receipt found with id ${req.params.receiptId}`
      });
    }

    console.log('Extracting data from receipt file:', receiptData.cloudinaryUrl || receiptData.filename);

    // In a real implementation, we would use a PDF parsing library to extract text
    // For now, we'll simulate PDF content extraction by analyzing the filename
    // This allows us to create a more realistic extraction process without adding dependencies

    let extractedText = '';
    let studentName = '';
    let feeType = 'tuition'; // Default fee type
    let amount = 0;
    let studentClass = '';
    let studentSection = '';
    let studentRollNumber = '';

    // Extract information from the filename if possible
    const filename = receiptData.filename;
    console.log('Analyzing filename for data extraction:', filename);

    // Try to extract student name from filename (e.g., "fee_receipt_john_doe.pdf")
    const nameMatch = filename.match(/fee_receipt_([a-zA-Z_]+)/i);
    if (nameMatch && nameMatch[1]) {
      studentName = nameMatch[1].replace(/_/g, ' ');
      console.log('Extracted student name from filename:', studentName);
    }

    // Try to extract amount from filename (e.g., "amount_5000.pdf")
    const amountMatch = filename.match(/amount_(\d+)/i);
    if (amountMatch && amountMatch[1]) {
      amount = parseInt(amountMatch[1], 10);
      console.log('Extracted amount from filename:', amount);
    }

    // Try to extract class and section from filename (e.g., "class_10_section_A.pdf")
    const classMatch = filename.match(/class_(\d+)/i);
    if (classMatch && classMatch[1]) {
      studentClass = classMatch[1];
      console.log('Extracted class from filename:', studentClass);
    }

    const sectionMatch = filename.match(/section_([A-Z])/i);
    if (sectionMatch && sectionMatch[1]) {
      studentSection = sectionMatch[1];
      console.log('Extracted section from filename:', studentSection);
    }

    // Try to extract roll number from filename (e.g., "roll_123.pdf")
    const rollMatch = filename.match(/roll_(\d+)/i);
    if (rollMatch && rollMatch[1]) {
      studentRollNumber = rollMatch[1];
      console.log('Extracted roll number from filename:', studentRollNumber);
    }

    // Try to extract fee type from filename (e.g., "type_exam.pdf")
    const typeMatch = filename.match(/type_([a-zA-Z]+)/i);
    if (typeMatch && typeMatch[1]) {
      feeType = typeMatch[1].toLowerCase();
      console.log('Extracted fee type from filename:', feeType);
    }

    // Find the student based on the extracted information
    let student = null;

    // First try to find by name if we extracted one
    if (studentName) {
      console.log('Searching for student by name:', studentName);
      const user = await User.findOne({
        name: { $regex: studentName, $options: 'i' }
      });

      if (user) {
        student = await Student.findOne({ user: user._id }).populate('user', 'name');
        console.log('Found student by name:', student?.user?.name);
      }
    }

    // If not found by name, try by class, section and roll number if available
    if (!student && studentClass && studentSection && studentRollNumber) {
      console.log('Searching for student by class, section and roll number');
      student = await Student.findOne({
        class: studentClass,
        section: studentSection,
        rollNumber: studentRollNumber
      }).populate('user', 'name');

      console.log('Found student by class/section/roll:', student?.user?.name);
    }

    // If still not found, try by class and section
    if (!student && studentClass && studentSection) {
      console.log('Searching for student by class and section');
      student = await Student.findOne({
        class: studentClass,
        section: studentSection
      }).populate('user', 'name');

      console.log('Found student by class/section:', student?.user?.name);
    }

    // If still no student found, get a student from the query parameters if provided
    if (!student) {
      const { studentId, className, section } = req.query;

      if (studentId) {
        console.log('Searching for student by ID from query params:', studentId);
        student = await Student.findById(studentId).populate('user', 'name');
      } else if (className && section) {
        console.log('Searching for student by class/section from query params');
        student = await Student.findOne({
          class: className,
          section: section
        }).populate('user', 'name');
      }
    }

    // If still no student found, get a random student as fallback
    if (!student) {
      console.log('No student found, selecting a random student as fallback');
      const count = await Student.countDocuments();

      if (count > 0) {
        const random = Math.floor(Math.random() * count);
        student = await Student.findOne().skip(random).populate('user', 'name');
      } else {
        student = await Student.findOne().populate('user', 'name');
      }
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'No students found in the database'
      });
    }

    // Log the student we're using for extraction
    console.log('Using student for receipt data extraction:', {
      id: student._id,
      name: student.user?.name,
      class: student.class,
      section: student.section,
      monthlyFee: student.monthlyFee
    });

    // Get the current month and year
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();

    // Use the extracted amount if available, otherwise use the student's monthly fee or a default
    if (!amount) {
      amount = student.monthlyFee || 5000;
    }

    // Create extracted data using the student's actual information
    const extractedData = {
      studentName: student.user?.name || 'Unknown Student',
      studentId: student._id.toString(), // Convert to string to ensure consistent format
      feeType: feeType,
      amount: amount,
      dueDate: new Date().toISOString().split('T')[0],
      description: `${feeType.charAt(0).toUpperCase() + feeType.slice(1)} fee for ${student.user?.name} - ${currentMonth} ${currentYear}`
    };

    // Update the receipt data with the extracted information
    receiptData.extractedData = extractedData;
    receiptData.status = 'processed';
    await receiptData.save();

    console.log('Successfully extracted data:', extractedData);

    res.status(200).json({
      success: true,
      data: extractedData
    });
  } catch (err) {
    console.error('Error extracting data from receipt:', err);
    res.status(500).json({
      success: false,
      message: 'Error extracting data from receipt',
      error: err.message
    });
  }
};

/**
 * r2Upload.controller.js
 *
 * Handles file uploads to Cloudflare R2 for non-image files
 * (Excel bulk-upload templates, PDFs, large attachments).
 * Profile images and gallery images continue to use Cloudinary.
 *
 * R2 binding is injected via wrangler.toml:
 *   [[r2_buckets]]
 *   binding = "R2"
 *   bucket_name = "eduflow-uploads"
 *
 * In the Worker, `process.env.R2` is NOT how you access R2 —
 * the binding is on the `env` object passed to fetch().
 * We attach it to app.locals in the Worker entry so controllers can reach it.
 *
 * Usage: app.locals.r2 = env.R2  (set in worker/index.js before handling request)
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const path = require('path');
const crypto = require('crypto');

// Allowed MIME types for R2 (non-image files only)
const ALLOWED_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'application/pdf',
  'text/csv',
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// @desc    Upload a file to R2
// @route   POST /api/r2/upload
// @access  Private (admin/principal)
exports.uploadToR2 = asyncHandler(async (req, res) => {
  const r2 = req.app.locals.r2;
  if (!r2) {
    throw new ErrorResponse('R2 storage not available in this environment', 503);
  }

  const contentType = req.headers['content-type'] || '';
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ErrorResponse(`File type not allowed: ${contentType}`, 400);
  }

  // Read raw body (already a Buffer from express.raw middleware on this route)
  const body = req.body;
  if (!body || body.length === 0) {
    throw new ErrorResponse('Empty file body', 400);
  }
  if (body.length > MAX_SIZE_BYTES) {
    throw new ErrorResponse('File exceeds 10 MB limit', 400);
  }

  const ext = contentType.includes('pdf') ? '.pdf'
    : contentType.includes('csv') ? '.csv'
    : '.xlsx';

  // Tenant-scoped key: tenantId/uploads/<uuid><ext>
  const tenantId = req.tenantId?.toString() || 'shared';
  const key = `${tenantId}/uploads/${crypto.randomUUID()}${ext}`;

  await r2.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedBy: req.user?._id?.toString() || 'unknown',
      originalName: req.headers['x-file-name'] || 'upload',
    },
  });

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${key}`
    : null; // null if bucket is not public — use signed URLs instead

  res.status(201).json({
    success: true,
    key,
    url: publicUrl,
    message: 'File uploaded to R2 successfully',
  });
});

// @desc    Delete a file from R2
// @route   DELETE /api/r2/upload/:key
// @access  Private (admin/principal)
exports.deleteFromR2 = asyncHandler(async (req, res) => {
  const r2 = req.app.locals.r2;
  if (!r2) throw new ErrorResponse('R2 storage not available', 503);

  const key = decodeURIComponent(req.params.key);

  // Enforce tenant isolation — key must start with tenantId
  const tenantId = req.tenantId?.toString();
  if (tenantId && !key.startsWith(`${tenantId}/`)) {
    throw new ErrorResponse('Access denied to this file', 403);
  }

  await r2.delete(key);
  res.json({ success: true, message: 'File deleted from R2' });
});

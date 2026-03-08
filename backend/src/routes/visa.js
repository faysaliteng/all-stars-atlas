const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const db = require('../config/db');
const { authenticate, requireAdmin, formatUser } = require('../middleware/auth');
const { notifyVisaStatus } = require('../services/notify');

const router = express.Router();

// ============ MULTER SETUP ============
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const VISA_DIR = path.join(UPLOAD_DIR, 'visa-documents');

// Ensure directory exists
if (!fs.existsSync(VISA_DIR)) {
  fs.mkdirSync(VISA_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create per-application subfolder using a temp ID (will be renamed)
    const appDir = path.join(VISA_DIR, req.params.applicationId || 'temp');
    if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
    cb(null, appDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
});

// ============ PUBLIC/USER ROUTES ============

// POST /visa/upload-documents — upload files before or during application
router.post('/visa/upload-documents', authenticate, upload.array('documents', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded', status: 400 });
    }
    const files = req.files.map(f => ({
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      path: `/uploads/visa-documents/temp/${f.filename}`,
      url: `/uploads/visa-documents/temp/${f.filename}`,
    }));
    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed', status: 500 });
  }
});

// POST /visa/apply — submit visa application with all data + document references
router.post('/visa/apply', authenticate, async (req, res) => {
  try {
    const { country, visaType, applicantInfo, processingFee, documents } = req.body;
    const id = uuidv4();

    // Move temp files to application folder
    const appDir = path.join(VISA_DIR, id);
    if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

    const finalDocs = [];
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.filename) {
          const tempPath = path.join(VISA_DIR, 'temp', doc.filename);
          const newPath = path.join(appDir, doc.filename);
          if (fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, newPath);
          }
          finalDocs.push({
            ...doc,
            path: `/uploads/visa-documents/${id}/${doc.filename}`,
            url: `/uploads/visa-documents/${id}/${doc.filename}`,
          });
        } else if (doc.label) {
          finalDocs.push(doc);
        }
      }
    }

    await db.query(
      `INSERT INTO visa_applications (id, user_id, country, visa_type, status, applicant_info, documents, processing_fee, submitted_at)
       VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, NOW())`,
      [id, req.user.sub, country || '', visaType || '', JSON.stringify(applicantInfo || {}), JSON.stringify(finalDocs), processingFee || 0]
    );

    res.status(201).json({ id, country, visaType, status: 'submitted', processingFee, submittedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// GET /visa/applications — user's own applications
router.get('/visa/applications', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM visa_applications WHERE user_id = ? ORDER BY created_at DESC', [req.user.sub]);
    const data = rows.map(r => ({
      id: r.id, country: r.country, visaType: r.visa_type, status: r.status,
      applicantInfo: JSON.parse(r.applicant_info || '{}'),
      documents: JSON.parse(r.documents || '[]'),
      processingFee: r.processing_fee ? parseFloat(r.processing_fee) : 0,
      submittedAt: r.submitted_at, processedAt: r.processed_at, notes: r.notes, createdAt: r.created_at,
    }));
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// ============ ADMIN ROUTES ============

// GET /admin/visa — list all applications with full data
router.get('/admin/visa', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, country, search, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT v.*, u.first_name, u.last_name, u.email as user_email FROM visa_applications v JOIN users u ON v.user_id = u.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND v.status = ?'; params.push(status); }
    if (country) { sql += ' AND v.country LIKE ?'; params.push(`%${country}%`); }
    if (search) { sql += ' AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR v.country LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT v.*, u.first_name, u.last_name, u.email as user_email', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    // Stats
    const [totalStat] = await db.query('SELECT COUNT(*) as c FROM visa_applications');
    const [submittedStat] = await db.query("SELECT COUNT(*) as c FROM visa_applications WHERE status = 'submitted'");
    const [processingStat] = await db.query("SELECT COUNT(*) as c FROM visa_applications WHERE status = 'processing'");
    const [approvedStat] = await db.query("SELECT COUNT(*) as c FROM visa_applications WHERE status = 'approved'");
    const [rejectedStat] = await db.query("SELECT COUNT(*) as c FROM visa_applications WHERE status = 'rejected'");

    const data = rows.map(v => {
      const info = JSON.parse(v.applicant_info || '{}');
      const docs = v.documents ? JSON.parse(v.documents) : [];
      return {
        id: v.id, country: v.country, visaType: v.visa_type, status: v.status,
        processingFee: v.processing_fee ? parseFloat(v.processing_fee) : 0,
        user: { name: `${v.first_name} ${v.last_name}`, email: v.user_email },
        submittedAt: v.submitted_at, processedAt: v.processed_at, notes: v.notes,
        applicantInfo: info, documents: docs,
      };
    });

    res.json({
      data,
      stats: {
        total: totalStat[0].c,
        submitted: submittedStat[0].c,
        processing: processingStat[0].c,
        approved: approvedStat[0].c,
        rejected: rejectedStat[0].c,
      },
      total: countResult[0].total, page: parseInt(page), limit: parseInt(limit),
      totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// PUT /admin/visa/:id — update status, notes
router.put('/admin/visa/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const sets = []; const params = [];
    if (status) {
      sets.push('status = ?'); params.push(status);
      if (status === 'approved' || status === 'rejected') sets.push('processed_at = NOW()');
    }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (sets.length > 0) {
      params.push(req.params.id);
      await db.query(`UPDATE visa_applications SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await db.query('SELECT * FROM visa_applications WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Application not found', status: 404 });

    // Notify user of status change
    if (status) {
      notifyVisaStatus(rows[0].user_id, rows[0].country, status, notes).catch(console.error);
    }

    res.json({ id: rows[0].id, status: rows[0].status, notes: rows[0].notes, processedAt: rows[0].processed_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// GET /admin/visa/:id/download-documents — ZIP all documents for an application
router.get('/admin/visa/:id/download-documents', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM visa_applications WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Not found', status: 404 });

    const docs = JSON.parse(rows[0].documents || '[]');
    const appDir = path.join(VISA_DIR, req.params.id);

    // Check if directory exists
    if (!fs.existsSync(appDir)) {
      return res.status(404).json({ message: 'No documents found on disk', status: 404 });
    }

    const info = JSON.parse(rows[0].applicant_info || '{}');
    const zipName = `visa-docs-${info.firstName || 'applicant'}-${info.lastName || ''}-${req.params.id.substring(0, 8)}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Add all files in the application directory
    const files = fs.readdirSync(appDir);
    for (const file of files) {
      const filePath = path.join(appDir, file);
      // Find original name from docs array
      const docInfo = docs.find(d => d.filename === file);
      const displayName = docInfo?.originalName || file;
      archive.file(filePath, { name: displayName });
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Download failed', status: 500 });
  }
});

module.exports = router;

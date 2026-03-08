const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireAdmin, formatUser } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [users] = await db.query('SELECT COUNT(*) as total FROM users');
    const [bookings] = await db.query('SELECT COUNT(*) as total FROM bookings');
    const [revenue] = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type = 'payment' AND status = 'completed'");
    const [visas] = await db.query("SELECT COUNT(*) as total FROM visa_applications WHERE status IN ('submitted','processing')");

    const [byType] = await db.query('SELECT booking_type, COUNT(*) as count FROM bookings GROUP BY booking_type');
    const bookingsByType = {};
    byType.forEach(r => { bookingsByType[r.booking_type] = r.count; });

    const [monthlyRev] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%b %Y') as month, SUM(amount) as revenue, COUNT(*) as bookings
       FROM transactions WHERE type = 'payment' AND status = 'completed'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY MIN(created_at)`
    );

    const [recentBookings] = await db.query(
      `SELECT b.*, u.first_name, u.last_name, u.email as user_email FROM bookings b JOIN users u ON b.user_id = u.id ORDER BY b.booked_at DESC LIMIT 5`
    );
    const [recentUsers] = await db.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 5');

    res.json({
      totalUsers: users[0].total,
      totalBookings: bookings[0].total,
      totalRevenue: parseFloat(revenue[0].total),
      activeVisaApplications: visas[0].total,
      bookingsByType,
      monthlyRevenue: monthlyRev.map(m => ({ month: m.month, revenue: parseFloat(m.revenue), bookings: m.bookings })),
      recentBookings: recentBookings.map(b => ({
        id: b.id, bookingRef: b.booking_ref, bookingType: b.booking_type, status: b.status,
        totalAmount: parseFloat(b.total_amount), bookedAt: b.booked_at,
        user: { name: `${b.first_name} ${b.last_name}`, email: b.user_email },
      })),
      recentUsers: recentUsers.map(formatUser),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (role) { sql += ' AND role = ?'; params.push(role); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);

    // Stats
    const [totalStat] = await db.query('SELECT COUNT(*) as c FROM users');
    const [activeStat] = await db.query("SELECT COUNT(*) as c FROM users WHERE email_verified = 1");
    const [suspendedStat] = await db.query("SELECT COUNT(*) as c FROM users WHERE email_verified = 0");
    const [newStat] = await db.query('SELECT COUNT(*) as c FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    // Get booking counts per user
    const userIds = rows.map(r => r.id);
    let bookingCounts = {};
    if (userIds.length > 0) {
      const [bc] = await db.query(`SELECT user_id, COUNT(*) as count FROM bookings WHERE user_id IN (${userIds.map(() => '?').join(',')}) GROUP BY user_id`, userIds);
      bc.forEach(r => { bookingCounts[r.user_id] = r.count; });
    }

    const users = rows.map(u => ({
      id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email, phone: u.phone || '-',
      joined: u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-',
      bookings: bookingCounts[u.id] || 0,
      status: u.email_verified ? 'active' : 'inactive',
      role: u.role,
    }));

    res.json({
      users,
      stats: { total: totalStat[0].c, active: activeStat[0].c, suspended: suspendedStat[0].c, newThisMonth: newStat[0].c },
      total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found', status: 404 });
    const [bookings] = await db.query('SELECT * FROM bookings WHERE user_id = ? ORDER BY booked_at DESC LIMIT 10', [req.params.id]);
    res.json({ ...formatUser(rows[0]), bookings: bookings.map(b => ({ id: b.id, bookingRef: b.booking_ref, bookingType: b.booking_type, status: b.status, totalAmount: parseFloat(b.total_amount), bookedAt: b.booked_at })) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// PUT /admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { role, emailVerified, phoneVerified } = req.body;
    const sets = []; const params = [];
    if (role !== undefined) { sets.push('role = ?'); params.push(role); }
    if (emailVerified !== undefined) { sets.push('email_verified = ?'); params.push(emailVerified ? 1 : 0); }
    if (phoneVerified !== undefined) { sets.push('phone_verified = ?'); params.push(phoneVerified ? 1 : 0); }
    if (sets.length > 0) { params.push(req.params.id); await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params); }
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(formatUser(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// DELETE /admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/bookings
router.get('/bookings', async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT b.*, u.first_name, u.last_name, u.email as user_email FROM bookings b JOIN users u ON b.user_id = u.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND b.status = ?'; params.push(status); }
    if (type) { sql += ' AND b.booking_type = ?'; params.push(type); }
    if (search) { sql += ' AND (b.booking_ref LIKE ? OR u.first_name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT b.*, u.first_name, u.last_name, u.email as user_email', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY b.booked_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    const data = rows.map(b => ({
      id: b.id, bookingRef: b.booking_ref, bookingType: b.booking_type, status: b.status,
      totalAmount: parseFloat(b.total_amount), currency: b.currency, paymentMethod: b.payment_method,
      paymentStatus: b.payment_status, details: JSON.parse(b.details || '{}'),
      user: { name: `${b.first_name} ${b.last_name}`, email: b.user_email },
      bookedAt: b.booked_at,
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// PUT /admin/bookings/:id
router.put('/bookings/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const sets = []; const params = [];
    if (status) { sets.push('status = ?'); params.push(status); }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (sets.length > 0) { params.push(req.params.id); await db.query(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`, params); }
    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json(rows[0] ? { id: rows[0].id, bookingRef: rows[0].booking_ref, status: rows[0].status } : {});
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/payments
router.get('/payments', async (req, res) => {
  try {
    const { status, method, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT t.*, u.first_name, u.last_name, u.email as user_email FROM transactions t JOIN users u ON t.user_id = u.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (method) { sql += ' AND t.payment_method = ?'; params.push(method); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT t.*, u.first_name, u.last_name, u.email as user_email', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    const data = rows.map(t => ({
      id: t.id, type: t.type, amount: parseFloat(t.amount), currency: t.currency, status: t.status,
      paymentMethod: t.payment_method, reference: t.reference, description: t.description,
      user: { name: `${t.first_name} ${t.last_name}`, email: t.user_email },
      createdAt: t.created_at,
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/reports
router.get('/reports', async (req, res) => {
  try {
    const { type = 'revenue', dateFrom, dateTo, groupBy = 'month' } = req.query;
    let dateFormat = '%Y-%m';
    if (groupBy === 'day') dateFormat = '%Y-%m-%d';
    if (groupBy === 'week') dateFormat = '%Y-%u';

    const [data] = await db.query(
      `SELECT DATE_FORMAT(created_at, ?) as period, SUM(amount) as revenue, COUNT(*) as bookings
       FROM transactions WHERE type = 'payment' AND status = 'completed'
       ${dateFrom ? 'AND created_at >= ?' : ''} ${dateTo ? 'AND created_at <= ?' : ''}
       GROUP BY period ORDER BY period`,
      [dateFormat, ...(dateFrom ? [dateFrom] : []), ...(dateTo ? [dateTo] : [])]
    );

    const totalRevenue = data.reduce((sum, d) => sum + parseFloat(d.revenue || 0), 0);
    const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);

    res.json({
      type, dateFrom, dateTo,
      data: data.map(d => ({ period: d.period, revenue: parseFloat(d.revenue), bookings: d.bookings })),
      summary: { totalRevenue, totalBookings, averageOrderValue: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0, growthRate: 12.5 },
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM system_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json({
      siteName: settings.site_name || 'Seven Trip',
      supportEmail: settings.support_email || '',
      supportPhone: settings.support_phone || '',
      defaultCurrency: settings.currency || 'BDT',
      paymentGateways: [
        { id: 'bkash', name: 'bKash', enabled: true },
        { id: 'nagad', name: 'Nagad', enabled: true },
        { id: 'rocket', name: 'Rocket', enabled: false },
        { id: 'card', name: 'Credit/Debit Card', enabled: true },
        { id: 'bank_transfer', name: 'Bank Transfer', enabled: true },
      ],
      smtpSettings: { host: 'smtp.gmail.com', port: 587, username: settings.support_email || '' },
      notifications: [
        { id: 'new_booking', label: 'New Booking Alert', enabled: true },
        { id: 'payment_received', label: 'Payment Received', enabled: true },
        { id: 'visa_update', label: 'Visa Status Change', enabled: true },
      ],
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// PUT /admin/settings
router.put('/settings', async (req, res) => {
  try {
    const { siteName, supportEmail, supportPhone, defaultCurrency } = req.body;
    const updates = { site_name: siteName, support_email: supportEmail, support_phone: supportPhone, currency: defaultCurrency };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await db.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
      }
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /admin/visa
router.get('/visa', async (req, res) => {
  try {
    const { status, country, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT v.*, u.first_name, u.last_name, u.email as user_email FROM visa_applications v JOIN users u ON v.user_id = u.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND v.status = ?'; params.push(status); }
    if (country) { sql += ' AND v.country LIKE ?'; params.push(`%${country}%`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT v.*, u.first_name, u.last_name, u.email as user_email', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    const data = rows.map(v => ({
      id: v.id, country: v.country, visaType: v.visa_type, status: v.status,
      processingFee: v.processing_fee ? parseFloat(v.processing_fee) : 0,
      user: { name: `${v.first_name} ${v.last_name}`, email: v.user_email },
      submittedAt: v.submitted_at, processedAt: v.processed_at, notes: v.notes,
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// PUT /admin/visa/:id
router.put('/visa/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const sets = []; const params = [];
    if (status) { sets.push('status = ?'); params.push(status); if (status === 'approved' || status === 'rejected') sets.push('processed_at = NOW()'); }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (sets.length > 0) { params.push(req.params.id); await db.query(`UPDATE visa_applications SET ${sets.join(', ')} WHERE id = ?`, params); }
    res.json({ message: 'Visa application updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

module.exports = router;

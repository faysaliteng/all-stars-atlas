const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, formatUser } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(authenticate);

// GET /dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.sub;
    const [bookingCount] = await db.query('SELECT COUNT(*) as total FROM bookings WHERE user_id = ?', [userId]);
    const [upcoming] = await db.query("SELECT COUNT(*) as total FROM bookings WHERE user_id = ? AND status IN ('confirmed','pending')", [userId]);
    const [totalSpent] = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type = 'payment' AND status = 'completed'", [userId]);
    const [travellers] = await db.query('SELECT COUNT(*) as total FROM travellers WHERE user_id = ?', [userId]);

    const [recentBookings] = await db.query('SELECT * FROM bookings WHERE user_id = ? ORDER BY booked_at DESC LIMIT 5', [userId]);
    const recent = recentBookings.map(b => ({
      id: b.id, bookingRef: b.booking_ref, bookingType: b.booking_type,
      status: b.status, totalAmount: parseFloat(b.total_amount),
      booked_at: b.booked_at, details: JSON.parse(b.details || '{}'),
    }));

    // Monthly spending (last 6 months)
    const [monthly] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%b') as month, SUM(amount) as amount
       FROM transactions WHERE user_id = ? AND type = 'payment' AND status = 'completed'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY MIN(created_at)`, [userId]
    );

    res.json({
      totalBookings: bookingCount[0].total,
      upcomingTrips: upcoming[0].total,
      totalSpent: parseFloat(totalSpent[0].total),
      savedTravellers: travellers[0].total,
      recentBookings: recent,
      monthlySpending: monthly.map(m => ({ month: m.month, amount: parseFloat(m.amount) })),
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/bookings
router.get('/bookings', async (req, res) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM bookings WHERE user_id = ?';
    const params = [req.user.sub];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (type) { sql += ' AND booking_type = ?'; params.push(type); }
    if (search) { sql += ' AND booking_ref LIKE ?'; params.push(`%${search}%`); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY booked_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    const data = rows.map(b => ({
      id: b.id, bookingRef: b.booking_ref, bookingType: b.booking_type,
      status: b.status, totalAmount: parseFloat(b.total_amount), currency: b.currency,
      paymentMethod: b.payment_method, paymentStatus: b.payment_status,
      details: JSON.parse(b.details || '{}'), passengerInfo: JSON.parse(b.passenger_info || '[]'),
      contactInfo: JSON.parse(b.contact_info || '{}'), notes: b.notes,
      bookedAt: b.booked_at, updatedAt: b.updated_at,
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [req.user.sub];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (status) { sql += ' AND status = ?'; params.push(status); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);

    // Summary
    const [inflow] = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type = 'refund' AND status = 'completed'", [req.user.sub]);
    const [outflow] = await db.query("SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type != 'refund' AND status = 'completed'", [req.user.sub]);

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    const data = rows.map(t => ({
      id: t.id, type: t.type, amount: parseFloat(t.amount), currency: t.currency,
      status: t.status, paymentMethod: t.payment_method, reference: t.reference,
      description: t.description, meta: t.meta ? JSON.parse(t.meta) : null, createdAt: t.created_at,
    }));

    res.json({
      data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit),
      totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
      summary: { totalInflow: parseFloat(inflow[0].total), totalOutflow: parseFloat(outflow[0].total), balance: parseFloat(inflow[0].total) - parseFloat(outflow[0].total) }
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/travellers
router.get('/travellers', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM travellers WHERE user_id = ? ORDER BY created_at DESC', [req.user.sub]);
    const data = rows.map(t => ({
      id: t.id, firstName: t.first_name, lastName: t.last_name, email: t.email, phone: t.phone,
      dateOfBirth: t.date_of_birth, gender: t.gender, nationality: t.nationality,
      passportNo: t.passport_no, passportExpiry: t.passport_expiry, documentType: t.document_type,
    }));
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// POST /dashboard/travellers
router.post('/travellers', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, dateOfBirth, gender, nationality, passportNo, passportExpiry, documentType } = req.body;
    const id = uuidv4();
    await db.query(
      `INSERT INTO travellers (id, user_id, first_name, last_name, email, phone, date_of_birth, gender, nationality, passport_no, passport_expiry, document_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.sub, firstName, lastName, email || null, phone || null, dateOfBirth || null, gender || null, nationality || null, passportNo || null, passportExpiry || null, documentType || 'passport']
    );
    res.status(201).json({ id, firstName, lastName, email, phone, dateOfBirth, gender, nationality, passportNo, passportExpiry, documentType: documentType || 'passport' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// DELETE /dashboard/travellers/:id
router.delete('/travellers/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM travellers WHERE id = ? AND user_id = ?', [req.params.id, req.user.sub]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/payments
router.get('/payments', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM transactions WHERE user_id = ? AND type = 'payment' ORDER BY created_at DESC LIMIT 50", [req.user.sub]);
    const data = rows.map(t => ({
      id: t.id, amount: parseFloat(t.amount), currency: t.currency, status: t.status,
      paymentMethod: t.payment_method, reference: t.reference, description: t.description, createdAt: t.created_at,
    }));
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// POST /dashboard/payments
router.post('/payments', async (req, res) => {
  try {
    const { method, details } = req.body;
    res.status(201).json({ id: uuidv4(), method, details, message: 'Payment method saved' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/tickets
router.get('/tickets', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM tickets WHERE user_id = ?';
    const params = [req.user.sub];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY issued_at DESC';
    const [rows] = await db.query(sql, params);
    const data = rows.map(t => ({
      id: t.id, bookingId: t.booking_id, ticketNo: t.ticket_no, pnr: t.pnr,
      status: t.status, pdfUrl: t.pdf_url, details: JSON.parse(t.details || '{}'), issuedAt: t.issued_at,
    }));
    res.json({ data, total: data.length, page: 1, limit: 50, totalPages: 1 });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/wishlist
router.get('/wishlist', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM wishlist WHERE user_id = ? ORDER BY created_at DESC', [req.user.sub]);
    const data = rows.map(w => ({
      id: w.id, itemType: w.item_type, itemId: w.item_id,
      itemData: JSON.parse(w.item_data || '{}'), createdAt: w.created_at,
    }));
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// POST /dashboard/wishlist
router.post('/wishlist', async (req, res) => {
  try {
    const { itemType, itemId, itemData } = req.body;
    const id = uuidv4();
    await db.query(
      `INSERT INTO wishlist (id, user_id, item_type, item_id, item_data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE item_data = ?`,
      [id, req.user.sub, itemType, itemId, JSON.stringify(itemData || {}), JSON.stringify(itemData || {})]
    );
    res.status(201).json({ id, itemType, itemId, itemData, createdAt: new Date().toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// DELETE /dashboard/wishlist/:id
router.delete('/wishlist/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM wishlist WHERE id = ? AND user_id = ?', [req.params.id, req.user.sub]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// GET /dashboard/settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found', status: 404 });
    const u = rows[0];
    res.json({
      profile: { name: `${u.first_name} ${u.last_name}`, firstName: u.first_name, lastName: u.last_name, email: u.email, phone: u.phone, avatar: u.avatar },
      notifications: [
        { id: 'booking_updates', label: 'Booking Updates', enabled: true },
        { id: 'promotions', label: 'Promotional Offers', enabled: true },
        { id: 'newsletter', label: 'Weekly Newsletter', enabled: false },
        { id: 'sms_alerts', label: 'SMS Alerts', enabled: false },
      ],
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// PUT /dashboard/settings
router.put('/settings', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const parts = (name || '').split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    await db.query('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?', [firstName, lastName, phone || null, req.user.sub]);
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    res.json(formatUser(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// PATCH /dashboard/settings/profile
router.patch('/settings/profile', async (req, res) => {
  try {
    const { name, firstName, lastName, phone, avatar } = req.body;
    const fn = firstName || (name ? name.split(' ')[0] : undefined);
    const ln = lastName || (name ? name.split(' ').slice(1).join(' ') : undefined);
    const sets = []; const params = [];
    if (fn !== undefined) { sets.push('first_name = ?'); params.push(fn); }
    if (ln !== undefined) { sets.push('last_name = ?'); params.push(ln); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (avatar !== undefined) { sets.push('avatar = ?'); params.push(avatar); }
    if (sets.length > 0) {
      params.push(req.user.sub);
      await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    res.json(formatUser(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// POST /dashboard/settings/password
router.post('/settings/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Valid current and new password (min 8 chars) required', status: 400 });
    }
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.sub]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect', status: 400 });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.sub]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

module.exports = router;

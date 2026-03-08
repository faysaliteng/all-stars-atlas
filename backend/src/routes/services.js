// Combined routes for: holidays, visa, medical, cars, esim, recharge, paybill, contact
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ============ HOLIDAYS ============

router.get('/holidays/search', async (req, res) => {
  try {
    const { destination, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM holiday_packages WHERE available = 1';
    const params = [];
    if (destination) { sql += ' AND destination LIKE ?'; params.push(`%${destination}%`); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (minPrice) { sql += ' AND price >= ?'; params.push(parseFloat(minPrice)); }
    if (maxPrice) { sql += ' AND price <= ?'; params.push(parseFloat(maxPrice)); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY rating DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);

    const data = rows.map(r => ({
      id: r.id, title: r.title, destination: r.destination, country: r.country,
      duration: r.duration, price: parseFloat(r.price), currency: r.currency,
      discountPct: r.discount_pct, images: JSON.parse(r.images || '[]'),
      highlights: JSON.parse(r.highlights || '[]'), category: r.category,
      rating: r.rating ? parseFloat(r.rating) : null, reviewCount: r.review_count,
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.get('/holidays/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM holiday_packages WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Package not found', status: 404 });
    const r = rows[0];
    res.json({
      id: r.id, title: r.title, destination: r.destination, country: r.country,
      duration: r.duration, price: parseFloat(r.price), currency: r.currency,
      discountPct: r.discount_pct, images: JSON.parse(r.images || '[]'),
      highlights: JSON.parse(r.highlights || '[]'), itinerary: JSON.parse(r.itinerary || '[]'),
      inclusions: JSON.parse(r.inclusions || '[]'), exclusions: JSON.parse(r.exclusions || '[]'),
      category: r.category, rating: r.rating ? parseFloat(r.rating) : null, reviewCount: r.review_count,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.post('/holidays/book', authenticate, async (req, res) => {
  try {
    const { packageId, travellers, contactInfo, paymentMethod } = req.body;
    const bookingId = uuidv4();
    const bookingRef = `ST-HP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*999)).padStart(3,'0')}`;
    const [pkgs] = await db.query('SELECT * FROM holiday_packages WHERE id = ?', [packageId]);
    const totalAmount = pkgs.length > 0 ? parseFloat(pkgs[0].price) * (travellers?.length || 1) : 0;

    await db.query(
      `INSERT INTO bookings (id, user_id, booking_type, booking_ref, status, total_amount, payment_method, payment_status, details, passenger_info, contact_info) VALUES (?, ?, 'holiday', ?, 'confirmed', ?, ?, 'paid', ?, ?, ?)`,
      [bookingId, req.user.sub, bookingRef, totalAmount, paymentMethod || 'card', JSON.stringify(pkgs[0] || {}), JSON.stringify(travellers || []), JSON.stringify(contactInfo || {})]
    );
    await db.query(`INSERT INTO transactions (id, user_id, booking_id, type, amount, status, payment_method, reference, description) VALUES (?, ?, ?, 'payment', ?, 'completed', ?, ?, ?)`,
      [uuidv4(), req.user.sub, bookingId, totalAmount, paymentMethod || 'card', bookingRef, `Holiday package: ${pkgs[0]?.title || ''}`]);

    res.status(201).json({ id: bookingId, bookingRef, status: 'confirmed', totalAmount, currency: 'BDT', bookingType: 'holiday', createdAt: new Date().toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ VISA ============

router.get('/visa/countries', async (req, res) => {
  // Return static visa countries data
  res.json({
    data: [
      { code: 'TH', name: 'Thailand', visaTypes: [{ type: 'tourist', label: 'Tourist Visa', processingDays: 5, fee: 4500 }, { type: 'business', label: 'Business Visa', processingDays: 10, fee: 8000 }], requiredDocuments: ['Passport', 'Photo', 'Bank Statement', 'Hotel Booking'], processingTime: '5-10 working days' },
      { code: 'MY', name: 'Malaysia', visaTypes: [{ type: 'tourist', label: 'Tourist Visa', processingDays: 5, fee: 6200 }], requiredDocuments: ['Passport', 'Photo', 'Bank Statement'], processingTime: '5-7 working days' },
      { code: 'SG', name: 'Singapore', visaTypes: [{ type: 'tourist', label: 'Tourist Visa', processingDays: 5, fee: 5800 }], requiredDocuments: ['Passport', 'Photo', 'Bank Statement', 'Employment proof'], processingTime: '5-7 working days' },
      { code: 'AE', name: 'UAE', visaTypes: [{ type: 'tourist', label: 'Tourist Visa', processingDays: 3, fee: 8500 }, { type: 'business', label: 'Business Visa', processingDays: 7, fee: 12000 }], requiredDocuments: ['Passport', 'Photo', 'Bank Statement', 'Hotel Booking'], processingTime: '3-5 working days' },
      { code: 'IN', name: 'India', visaTypes: [{ type: 'tourist', label: 'Tourist Visa', processingDays: 7, fee: 3200 }, { type: 'medical', label: 'Medical Visa', processingDays: 5, fee: 4000 }], requiredDocuments: ['Passport', 'Photo', 'Bank Statement'], processingTime: '7-10 working days' },
    ]
  });
});

router.post('/visa/apply', authenticate, async (req, res) => {
  try {
    const { country, visaType, applicantInfo, processingFee } = req.body;
    const id = uuidv4();
    await db.query(
      `INSERT INTO visa_applications (id, user_id, country, visa_type, status, applicant_info, processing_fee, submitted_at) VALUES (?, ?, ?, ?, 'submitted', ?, ?, NOW())`,
      [id, req.user.sub, country || '', visaType || '', JSON.stringify(applicantInfo || {}), processingFee || 0]
    );
    res.status(201).json({ id, country, visaType, status: 'submitted', processingFee, submittedAt: new Date().toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.get('/visa/applications', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM visa_applications WHERE user_id = ? ORDER BY created_at DESC', [req.user.sub]);
    const data = rows.map(r => ({
      id: r.id, country: r.country, visaType: r.visa_type, status: r.status,
      applicantInfo: JSON.parse(r.applicant_info || '{}'), processingFee: r.processing_fee ? parseFloat(r.processing_fee) : 0,
      submittedAt: r.submitted_at, processedAt: r.processed_at, notes: r.notes, createdAt: r.created_at,
    }));
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ MEDICAL ============

router.get('/medical/hospitals', async (req, res) => {
  try {
    const { country, specialty, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM medical_hospitals WHERE available = 1';
    const params = [];
    if (country) { sql += ' AND country LIKE ?'; params.push(`%${country}%`); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    sql += ` LIMIT ? OFFSET ?`; params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);
    const data = rows.map(r => ({
      id: r.id, name: r.name, city: r.city, country: r.country,
      specialties: JSON.parse(r.specialties || '[]'), accreditations: JSON.parse(r.accreditations || '[]'),
      rating: r.rating ? parseFloat(r.rating) : null, priceRange: r.price_range, description: r.description,
      images: JSON.parse(r.images || '[]'), contact: JSON.parse(r.contact || '{}'),
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.get('/medical/search', async (req, res) => {
  try {
    const { treatment, country, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM medical_hospitals WHERE available = 1';
    const params = [];
    if (country) { sql += ' AND country LIKE ?'; params.push(`%${country}%`); }
    if (treatment) { sql += ' AND specialties LIKE ?'; params.push(`%${treatment}%`); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    sql += ` LIMIT ? OFFSET ?`; params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);
    const data = rows.map(r => ({
      id: r.id, name: r.name, city: r.city, country: r.country,
      specialties: JSON.parse(r.specialties || '[]'), accreditations: JSON.parse(r.accreditations || '[]'),
      rating: r.rating ? parseFloat(r.rating) : null, priceRange: r.price_range, description: r.description, images: JSON.parse(r.images || '[]'),
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.post('/medical/book', authenticate, async (req, res) => {
  try {
    const { hospitalId, treatmentType, patientInfo, contactInfo, paymentMethod } = req.body;
    const bookingId = uuidv4();
    const bookingRef = `ST-MD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*999)).padStart(3,'0')}`;
    await db.query(
      `INSERT INTO bookings (id, user_id, booking_type, booking_ref, status, total_amount, payment_method, payment_status, details, passenger_info, contact_info) VALUES (?, ?, 'medical', ?, 'confirmed', 0, ?, 'paid', ?, ?, ?)`,
      [bookingId, req.user.sub, bookingRef, paymentMethod || 'card', JSON.stringify({ hospitalId, treatmentType }), JSON.stringify(patientInfo || {}), JSON.stringify(contactInfo || {})]
    );
    res.status(201).json({ id: bookingId, bookingRef, status: 'confirmed', bookingType: 'medical', createdAt: new Date().toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ CARS ============

router.get('/cars/search', async (req, res) => {
  try {
    const { city, type, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM cars WHERE available = 1';
    const params = [];
    if (city) { sql += ' AND city LIKE ?'; params.push(`%${city}%`); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (minPrice) { sql += ' AND price_per_day >= ?'; params.push(parseFloat(minPrice)); }
    if (maxPrice) { sql += ' AND price_per_day <= ?'; params.push(parseFloat(maxPrice)); }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    sql += ` LIMIT ? OFFSET ?`; params.push(parseInt(limit), offset);
    const [rows] = await db.query(sql, params);
    const data = rows.map(r => ({
      id: r.id, name: r.name, type: r.type, brand: r.brand, model: r.model, year: r.year,
      seats: r.seats, transmission: r.transmission, fuelType: r.fuel_type,
      pricePerDay: parseFloat(r.price_per_day), currency: r.currency,
      images: JSON.parse(r.images || '[]'), features: JSON.parse(r.features || '[]'), city: r.city,
    }));
    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.get('/cars/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Car not found', status: 404 });
    const r = rows[0];
    res.json({
      id: r.id, name: r.name, type: r.type, brand: r.brand, model: r.model, year: r.year,
      seats: r.seats, transmission: r.transmission, fuelType: r.fuel_type,
      pricePerDay: parseFloat(r.price_per_day), currency: r.currency,
      images: JSON.parse(r.images || '[]'), features: JSON.parse(r.features || '[]'), city: r.city,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.post('/cars/book', authenticate, async (req, res) => {
  try {
    const { carId, pickupDate, returnDate, driverInfo, contactInfo, paymentMethod } = req.body;
    const bookingId = uuidv4();
    const bookingRef = `ST-CR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*999)).padStart(3,'0')}`;
    const [cars] = await db.query('SELECT * FROM cars WHERE id = ?', [carId]);
    const days = pickupDate && returnDate ? Math.max(1, Math.ceil((new Date(returnDate) - new Date(pickupDate)) / 86400000)) : 1;
    const totalAmount = cars.length > 0 ? parseFloat(cars[0].price_per_day) * days : 0;

    await db.query(
      `INSERT INTO bookings (id, user_id, booking_type, booking_ref, status, total_amount, payment_method, payment_status, details, passenger_info, contact_info) VALUES (?, ?, 'car', ?, 'confirmed', ?, ?, 'paid', ?, ?, ?)`,
      [bookingId, req.user.sub, bookingRef, totalAmount, paymentMethod || 'card', JSON.stringify({ car: cars[0]?.name, pickupDate, returnDate }), JSON.stringify(driverInfo || {}), JSON.stringify(contactInfo || {})]
    );
    res.status(201).json({ id: bookingId, bookingRef, status: 'confirmed', totalAmount, currency: 'BDT', bookingType: 'car', createdAt: new Date().toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ eSIM ============

router.get('/esim/plans', async (req, res) => {
  try {
    const { country, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM esim_plans WHERE available = 1';
    const params = [];
    if (country) { sql += ' AND country LIKE ?'; params.push(`%${country}%`); }
    const [rows] = await db.query(sql, params);
    const data = rows.map(r => ({
      id: r.id, country: r.country, region: r.region, dataAmount: r.data_amount,
      duration: r.duration, price: parseFloat(r.price), currency: r.currency,
      provider: r.provider, features: JSON.parse(r.features || '[]'),
    }));
    res.json({ data, total: data.length, page: 1, limit: 50, totalPages: 1 });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.post('/esim/purchase', authenticate, async (req, res) => {
  try {
    const { planId, email, paymentMethod } = req.body;
    const txnId = uuidv4();
    const [plans] = await db.query('SELECT * FROM esim_plans WHERE id = ?', [planId]);
    const amount = plans.length > 0 ? parseFloat(plans[0].price) : 0;

    await db.query(
      `INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description) VALUES (?, ?, 'esim_purchase', ?, 'completed', ?, ?)`,
      [txnId, req.user.sub, amount, paymentMethod || 'bkash', `eSIM purchase: ${plans[0]?.country || ''} ${plans[0]?.data_amount || ''}`]
    );
    res.status(201).json({ id: uuidv4(), qrCode: 'https://placehold.co/300x300?text=eSIM+QR', activationCode: 'LPA:1$example.com$ABCD1234', instructions: 'Go to Settings > Cellular > Add eSIM > Scan QR Code', transactionId: txnId });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ RECHARGE ============

router.get('/recharge/operators', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM recharge_operators WHERE active = 1');
    res.json({ data: rows.map(r => ({ id: r.id, name: r.name, logo: r.logo, type: r.type })) });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.post('/recharge/submit', authenticate, async (req, res) => {
  try {
    const { operator, phoneNumber, amount, type, paymentMethod } = req.body;
    const txnId = uuidv4();
    await db.query(
      `INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, meta) VALUES (?, ?, 'recharge', ?, 'completed', ?, ?, ?)`,
      [txnId, req.user.sub, amount || 0, paymentMethod || 'bkash', `Recharge ৳${amount} to ${phoneNumber}`, JSON.stringify({ operator, phoneNumber, rechargeType: type })]
    );
    res.status(201).json({ id: uuidv4(), status: 'completed', transactionId: txnId, message: `Recharge of ৳${amount} to ${phoneNumber} successful` });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ PAY BILL ============

router.get('/paybill/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM bill_categories WHERE active = 1');
    const data = rows.map(r => ({
      id: r.id, name: r.name, icon: r.icon, billers: JSON.parse(r.billers || '[]'),
    }));
    res.json({ data });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.get('/paybill/billers', async (req, res) => {
  try {
    const { category } = req.query;
    const [rows] = await db.query('SELECT billers FROM bill_categories WHERE name LIKE ? AND active = 1', [`%${category || ''}%`]);
    const billers = rows.length > 0 ? JSON.parse(rows[0].billers || '[]') : [];
    res.json({ data: billers });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

router.post('/paybill/submit', authenticate, async (req, res) => {
  try {
    const { billerId, accountNumber, amount, paymentMethod, month } = req.body;
    const txnId = uuidv4();
    await db.query(
      `INSERT INTO transactions (id, user_id, type, amount, status, payment_method, description, meta) VALUES (?, ?, 'bill_payment', ?, 'completed', ?, ?, ?)`,
      [txnId, req.user.sub, amount || 0, paymentMethod || 'bkash', `Bill payment ৳${amount} to ${billerId}`, JSON.stringify({ billerId, accountNumber, month })]
    );
    res.status(201).json({ id: uuidv4(), status: 'completed', transactionId: txnId, message: `Bill payment of ৳${amount} successful` });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

// ============ CONTACT ============

router.post('/contact/submit', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required', status: 400 });
    }
    const id = uuidv4();
    await db.query(
      `INSERT INTO contact_submissions (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)`,
      [id, name, email, subject || '', message]
    );
    res.status(201).json({ id, message: "Thank you! We'll get back to you within 24 hours." });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Something went wrong', status: 500 }); }
});

module.exports = router;

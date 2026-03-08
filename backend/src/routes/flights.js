const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /flights/search
router.get('/search', async (req, res) => {
  try {
    const { origin, destination, departDate, cabinClass, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM flights WHERE 1=1';
    const params = [];

    if (origin) { sql += ' AND origin = ?'; params.push(origin); }
    if (destination) { sql += ' AND destination = ?'; params.push(destination); }
    if (departDate) { sql += ' AND DATE(departure_time) = ?'; params.push(departDate); }
    if (cabinClass) { sql += ' AND cabin_class = ?'; params.push(cabinClass); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countResult] = await db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    sql += ` ORDER BY price ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(sql, params);
    const data = rows.map(r => ({
      id: r.id, airline: r.airline, airlineCode: r.airline_code, airlineLogo: r.airline_logo,
      flightNumber: r.flight_number, origin: r.origin, originCity: r.origin_city,
      destination: r.destination, destinationCity: r.destination_city,
      departureTime: r.departure_time, arrivalTime: r.arrival_time,
      duration: r.duration, stops: r.stops, cabinClass: r.cabin_class,
      price: parseFloat(r.price), currency: r.currency, seatsAvailable: r.seats_available,
      baggage: r.baggage, refundable: !!r.refundable,
    }));

    res.json({ data, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(countResult[0].total / parseInt(limit)) });
  } catch (err) {
    console.error('Flight search error:', err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// GET /flights/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM flights WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Flight not found', status: 404 });
    const r = rows[0];
    res.json({
      id: r.id, airline: r.airline, airlineCode: r.airline_code, airlineLogo: r.airline_logo,
      flightNumber: r.flight_number, origin: r.origin, originCity: r.origin_city,
      destination: r.destination, destinationCity: r.destination_city,
      departureTime: r.departure_time, arrivalTime: r.arrival_time,
      duration: r.duration, stops: r.stops, cabinClass: r.cabin_class,
      price: parseFloat(r.price), currency: r.currency, seatsAvailable: r.seats_available,
      baggage: r.baggage, refundable: !!r.refundable, meta: r.meta ? JSON.parse(r.meta) : null,
    });
  } catch (err) {
    console.error('Flight detail error:', err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// POST /flights/book
router.post('/book', authenticate, async (req, res) => {
  try {
    const { flightId, passengers, contactInfo, paymentMethod } = req.body;
    const bookingId = uuidv4();
    const bookingRef = `ST-FL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*999)).padStart(3,'0')}`;

    const [flights] = await db.query('SELECT * FROM flights WHERE id = ?', [flightId]);
    const totalAmount = flights.length > 0 ? parseFloat(flights[0].price) * (passengers?.length || 1) : 0;

    await db.query(
      `INSERT INTO bookings (id, user_id, booking_type, booking_ref, status, total_amount, payment_method, payment_status, details, passenger_info, contact_info)
       VALUES (?, ?, 'flight', ?, 'confirmed', ?, ?, 'paid', ?, ?, ?)`,
      [bookingId, req.user.sub, bookingRef, totalAmount, paymentMethod || 'card',
       JSON.stringify(flights[0] || {}), JSON.stringify(passengers || []), JSON.stringify(contactInfo || {})]
    );

    // Create transaction
    await db.query(
      `INSERT INTO transactions (id, user_id, booking_id, type, amount, status, payment_method, reference, description)
       VALUES (?, ?, ?, 'payment', ?, 'completed', ?, ?, ?)`,
      [uuidv4(), req.user.sub, bookingId, totalAmount, paymentMethod || 'card', bookingRef, `Flight booking ${flights[0]?.origin || ''} → ${flights[0]?.destination || ''}`]
    );

    // Create ticket
    const ticketNo = `098-${String(Math.floor(Math.random()*9999999999)).padStart(10,'0')}`;
    await db.query(
      `INSERT INTO tickets (id, booking_id, user_id, ticket_no, pnr, status, details)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [uuidv4(), bookingId, req.user.sub, ticketNo, bookingRef.slice(-6).toUpperCase(),
       JSON.stringify({ airline: flights[0]?.airline, flightNumber: flights[0]?.flight_number, origin: flights[0]?.origin, destination: flights[0]?.destination, departureTime: flights[0]?.departure_time, passenger: passengers?.[0]?.firstName + ' ' + passengers?.[0]?.lastName })]
    );

    res.status(201).json({ id: bookingId, bookingRef, status: 'confirmed', totalAmount, currency: 'BDT', bookingType: 'flight', createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('Flight booking error:', err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

module.exports = router;

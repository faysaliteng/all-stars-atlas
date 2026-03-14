const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { notifyBookingConfirm } = require('../services/notify');
const { searchFlights: ttiSearch, createBooking: ttiCreateBooking } = require('./tti-flights');
const { searchFlights: bdfSearch, createBooking: bdfCreateBooking } = require('./bdf-flights');
const { searchFlights: flyhubSearch, createBooking: flyhubCreateBooking } = require('./flyhub-flights');
const { searchFlights: sabreSearch, createBooking: sabreCreateBooking, revalidatePrice: sabreRevalidate, getBooking: sabreGetBooking, checkTicketStatus: sabreCheckTickets, getSeatsRest: sabreGetSeatsRest } = require('./sabre-flights');
const { searchFlights: galileoSearch } = require('./galileo-flights');
const { searchFlights: ndcSearch } = require('./ndc-flights');
const { searchAllLCCs } = require('./lcc-flights');

const router = express.Router();

// ─── Travel Document Upload (Passport/Visa copies) ───
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const TRAVEL_DOCS_DIR = path.join(UPLOAD_DIR, 'travel-documents');
if (!fs.existsSync(TRAVEL_DOCS_DIR)) fs.mkdirSync(TRAVEL_DOCS_DIR, { recursive: true });

const travelDocStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(TRAVEL_DOCS_DIR, req.user.sub);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const docType = file.fieldname || 'doc'; // passport_0 or visa_0
    cb(null, `${docType}-${Date.now()}${ext}`);
  },
});
const travelDocUpload = multer({
  storage: travelDocStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
});

// POST /flights/upload-travel-docs — upload passport + visa copies per passenger
router.post('/upload-travel-docs', authenticate, travelDocUpload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded', status: 400 });
    }
    const docs = req.files.map(f => ({
      fieldname: f.fieldname,
      originalName: f.originalname,
      filename: f.filename,
      size: f.size,
      mimetype: f.mimetype,
      url: `/uploads/travel-documents/${req.user.sub}/${f.filename}`,
    }));
    res.json({ message: 'Documents uploaded', documents: docs });
  } catch (err) {
    console.error('Travel doc upload error:', err);
    res.status(500).json({ message: 'Upload failed', status: 500 });
  }
});

// GET /flights/travel-docs/:bookingId — admin: list travel docs for a booking
router.get('/travel-docs/:bookingId', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT details, user_id FROM bookings WHERE id = ?', [req.params.bookingId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
    const details = typeof rows[0].details === 'string' ? JSON.parse(rows[0].details) : (rows[0].details || {});
    const travelDocs = details.travelDocuments || [];
    res.json({ documents: travelDocs, userId: rows[0].user_id });
  } catch (err) {
    console.error('Travel docs fetch error:', err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});


// ─── Sabre REST: Price Revalidation ───
router.post('/revalidate-price', authenticate, async (req, res) => {
  try {
    const { flights, adults, children, infants, cabinClass } = req.body;
    if (!flights || !Array.isArray(flights) || flights.length === 0) {
      return res.status(400).json({ message: 'flights array is required' });
    }
    const result = await sabreRevalidate({ flights, adults, children, infants, cabinClass });
    res.json(result);
  } catch (err) {
    console.error('[RevalidatePrice] Error:', err.message);
    res.status(500).json({ message: 'Price revalidation failed', error: err.message });
  }
});

// ─── Sabre REST: Get Booking ───
router.get('/booking/:pnr', authenticate, async (req, res) => {
  try {
    const { pnr } = req.params;
    if (!pnr) return res.status(400).json({ message: 'PNR is required' });
    const result = await sabreGetBooking({ pnr });
    res.json(result);
  } catch (err) {
    console.error('[GetBooking] Error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve booking', error: err.message });
  }
});

// ─── Sabre REST: Check Ticket Status ───
router.get('/ticket-status/:pnr', authenticate, async (req, res) => {
  try {
    const { pnr } = req.params;
    if (!pnr) return res.status(400).json({ message: 'PNR is required' });
    const result = await sabreCheckTickets({ pnr });
    res.json(result);
  } catch (err) {
    console.error('[CheckTickets] Error:', err.message);
    res.status(500).json({ message: 'Failed to check ticket status', error: err.message });
  }
});

// ─── Seat Map (REST with SOAP fallback for pre-booking) ───
router.get('/seats-rest', async (req, res) => {
  try {
    const { origin, destination, departureDate, airlineCode, flightNumber, cabinClass, pnr } = req.query;
    if (!origin || !destination || !departureDate || !airlineCode || !flightNumber) {
      return res.status(400).json({ message: 'Required: origin, destination, departureDate, airlineCode, flightNumber' });
    }

    // If PNR exists, try REST first
    if (pnr) {
      const result = await sabreGetSeatsRest({ origin, destination, departureDate, airlineCode, flightNumber, cabinClass, pnr });
      if (result?.success) return res.json(result);
      console.log('[SeatsRest] REST failed for PNR, falling back to SOAP...');
    }

    // Pre-booking or REST fallback: use SOAP EnhancedSeatMapRQ (no PNR needed)
    try {
      const { getSeatMap } = require('./sabre-soap');
      const BD_AIRPORTS = ['DAC', 'CXB', 'CGP', 'ZYL', 'JSR', 'RJH', 'SPD', 'BZL', 'IRD', 'TKR'];
      const isDomestic = BD_AIRPORTS.includes(origin) && BD_AIRPORTS.includes(destination);
      const soapResult = await getSeatMap({
        origin, destination, departureDate,
        marketingCarrier: airlineCode,
        operatingCarrier: airlineCode,
        flightNumber: String(flightNumber).replace(/^[A-Z]{2}/i, ''),
        cabinClass: cabinClass || 'Economy',
        isDomestic,
      });
      if (soapResult && (soapResult.rows?.length > 0 || soapResult.totalRows > 0)) {
        return res.json({ success: true, ...soapResult, source: 'sabre-soap' });
      }
    } catch (soapErr) {
      console.error('[SeatsRest] SOAP fallback error:', soapErr.message);
    }

    res.json({ success: false, source: 'none', error: 'No seat map available from REST or SOAP', rows: [], available: false });
  } catch (err) {
    console.error('[SeatsRest] Error:', err.message);
    res.status(500).json({ message: 'Failed to load seat map', error: err.message });
  }
});

// POST /flights/assign-seats — assign seats to an existing PNR
router.post('/assign-seats', authenticate, async (req, res) => {
  try {
    const { pnr, seatAssignments, source } = req.body;
    if (!pnr || !seatAssignments?.length) {
      return res.status(400).json({ message: 'pnr and seatAssignments[] required' });
    }

    const providerSource = String(source || '').toLowerCase();

    if (providerSource.includes('sabre') || !providerSource) {
      // Default to Sabre seat assignment
      const { assignSeats } = require('./sabre-flights');
      const result = await assignSeats({ pnr, seatAssignments });
      return res.json(result);
    }

    if (providerSource.includes('tti') || providerSource.includes('astra')) {
      // TTI seat assignment via SpecialService with Seat data
      // TTI uses UpdateBooking with SpecialServices[].Code="SEAT", Data.Seat.SeatRow + SeatLetter
      const { ttiRequest, getTTIConfig } = require('./tti-flights');
      const config = await getTTIConfig();
      if (!config) return res.status(500).json({ message: 'TTI not configured' });

      const specialServices = seatAssignments.map(sa => ({
        Code: 'SEAT',
        RefPassenger: String((sa.passengerIndex || 0) + 1),
        RefSegment: String(sa.segmentNumber || 1),
        Data: {
          Seat: {
            SeatRow: parseInt(String(sa.seatNumber || '').replace(/[A-Za-z]+$/, '')) || 0,
            SeatLetter: String(sa.seatNumber || '').replace(/^\d+/, '') || 'A',
          },
        },
      }));

      try {
        const response = await ttiRequest('UpdateBooking', {
          RequestInfo: { AuthenticationKey: config.key },
          BookingID: pnr,
          SpecialServices: specialServices,
        });
        return res.json({ success: true, rawResponse: response });
      } catch (ttiErr) {
        return res.json({ success: false, error: ttiErr.message });
      }
    }

    return res.status(400).json({ message: `Seat assignment not supported for provider: ${source}` });
  } catch (err) {
    console.error('[AssignSeats] Error:', err.message);
    res.status(500).json({ message: 'Failed to assign seats', error: err.message });
  }
});

// POST /flights/purchase-ancillary — purchase ancillary services (extra baggage, meals) for an existing PNR
router.post('/purchase-ancillary', authenticate, async (req, res) => {
  try {
    const { pnr, ancillaries, source } = req.body;
    // ancillaries: [{ type: 'baggage'|'meal', code: 'XBAG'|'VGML', passengerIndex: 0, segmentNumber: 1, offerId?: string }]
    if (!pnr || !ancillaries?.length) {
      return res.status(400).json({ message: 'pnr and ancillaries[] required' });
    }

    const providerSource = String(source || '').toLowerCase();

    if (providerSource.includes('sabre') || !providerSource) {
      const { addAncillarySSR } = require('./sabre-flights');
      const ssrList = ancillaries.map(anc => ({
        code: anc.code || 'OTHS',
        text: anc.text || `${anc.code} - ${anc.type}`,
        passengerIndex: anc.passengerIndex || 0,
        segmentNumber: anc.segmentNumber || 'A',
        airlineCode: anc.airlineCode || '',
      }));

      const result = await addAncillarySSR({ pnr, ssrList });
      return res.json(result);
    }

    return res.status(400).json({ message: `Ancillary purchase not supported for provider: ${source}` });
  } catch (err) {
    console.error('[PurchaseAncillary] Error:', err.message);
    res.status(500).json({ message: 'Failed to purchase ancillary', error: err.message });
  }
});


router.get('/tti-diagnostic', async (req, res) => {
  try {
    const { getTTIConfig, ttiRequest } = require('./tti-flights');
    const dns = require('dns').promises;
    const config = await getTTIConfig();
    if (!config) {
      return res.json({ success: false, error: 'TTI not configured in database. Go to Admin → Settings → API Integrations → Air Astra TTI', config: null });
    }

    const results = { environment: config.environment, apiUrl: config.url, agencyId: config.agencyId, agencyName: config.agencyName };

    // Test 0: DNS resolution
    try {
      const hostname = new URL(config.url).hostname;
      const addresses = await dns.resolve4(hostname);
      results.dns = { hostname, resolved: true, addresses };
    } catch (e) {
      results.dns = { error: e.message, hint: 'DNS resolution failed — VPS cannot resolve TTI hostname. Check /etc/resolv.conf or try adding 8.8.8.8' };
    }

    // Test 1: Raw HTTP connectivity (bypass ttiRequest to get detailed errors)
    const baseUrl = config.url.replace(/\/+$/, '');
    const httpsUrl = baseUrl.replace('http://', 'https://');
    const urlsToTest = [baseUrl, httpsUrl];

    results.connectivityTests = [];
    for (const testBaseUrl of urlsToTest) {
      const testUrl = `${testBaseUrl}/Ping`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const r = await fetch(testUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ RequestInfo: { AuthenticationKey: config.key } }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await r.text();
        let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }
        results.connectivityTests.push({
          url: testBaseUrl, status: r.status, ok: r.ok,
          bodyPreview: text.slice(0, 500),
          parsed: parsed ? Object.keys(parsed) : null,
        });
      } catch (e) {
        results.connectivityTests.push({
          url: testBaseUrl, error: e.message,
          cause: e.cause ? String(e.cause) : undefined,
          code: e.code || undefined,
        });
      }
    }

    // Test 2: Full search via ttiRequest (uses HTTP/HTTPS fallback)
    const searchDate = new Date();
    searchDate.setDate(searchDate.getDate() + 3);
    try {
      const searchReq = {
        RequestInfo: { AuthenticationKey: config.key },
        Passengers: [{ Ref: '1', PassengerTypeCode: 'AD', PassengerQuantity: 1 }],
        OriginDestinations: [{ Ref: '1', OriginCode: 'DAC', DestinationCode: 'CGP', TargetDate: `/Date(${searchDate.getTime()})/` }],
        FareDisplaySettings: { SaleCurrencyCode: 'BDT' },
      };
      const raw = await ttiRequest('SearchFlights', searchReq);
      results.testSearch = {
        route: 'DAC → CGP',
        date: searchDate.toISOString().slice(0, 10),
        segmentCount: raw?.Segments?.length || 0,
        itineraryCount: raw?.FareInfo?.Itineraries?.length || 0,
        errors: raw?.ResponseInfo?.Errors || [],
        rawKeys: raw ? Object.keys(raw) : [],
      };
    } catch (e) {
      results.testSearch = { error: e.message };
    }

    results.success = true;
    results.nodeVersion = process.version;
    results.timestamp = new Date().toISOString();
    res.json(results);
  } catch (err) {
    console.error('TTI diagnostic error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /flights/tti-methods — discover which API methods exist on TTI
router.get('/tti-methods', async (req, res) => {
  try {
    const { getTTIConfig } = require('./tti-flights');
    const config = await getTTIConfig();
    if (!config) return res.json({ success: false, error: 'TTI not configured' });

    const baseUrl = config.url.replace(/\/+$/, '');
    const urls = baseUrl.startsWith('https://') 
      ? [baseUrl, baseUrl.replace('https://', 'http://')]
      : [baseUrl, baseUrl.replace('http://', 'https://')];

    const dummyBody = JSON.stringify({
      request: { RequestInfo: { AuthenticationKey: config.key }, BookingReference: 'TEST', AgencyInfo: { AgencyId: config.agencyId } }
    });

    const methods = [
      // Booking lifecycle
      'Cancel', 'CancelBooking', 'CancelPNR',
      'SearchFlights', 'CreateBooking', 'Confirm', 'Book',
      // Ticketing (Cancel method may handle this too via CancelTicketSettings)
      'TicketBooking', 'IssueTicket', 'Ticket', 'IssueETicket', 'ConfirmBooking', 'Ticketing',
      // Void
      'VoidTicket', 'Void', 'VoidETicket',
      // Ancillaries — seat selection, baggage, meals, SSR
      'GetSeatMap', 'GetSSR', 'GetValueCodes', 'AddServices', 'GetServices',
      'GetAncillaries', 'GetExtras', 'GetBaggage', 'AddBaggage', 'GetMeals',
      'SelectSeat', 'AssignSeat', 'SeatMap', 'PreSeatBooking',
      'GetFareRules', 'GetFareQuote', 'Reprice', 'RepriceBooking',
      // Retrieve / manage PNR
      'GetBooking', 'RetrieveBooking', 'GetPNR', 'RetrievePNR', 'ReadBooking', 'DisplayPNR',
      // Utility
      'Ping', 'Help', 'GetMethods', 'GetSchedules', 'GetAvailability',
    ];

    const results = {};
    for (const method of methods) {
      for (const tryUrl of urls) {
        const fullUrl = `${tryUrl}/${method}`;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const r = await fetch(fullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: dummyBody,
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const text = await r.text();
          results[method] = { status: r.status, exists: r.status !== 404, bodyPreview: text.slice(0, 300) };
          break;
        } catch (e) {
          results[method] = { error: e.message, exists: false };
          break;
        }
      }
    }

    const existingMethods = Object.entries(results)
      .filter(([, v]) => v.exists)
      .map(([k, v]) => ({ method: k, status: v.status }));

    res.json({ success: true, baseUrl, existingMethods, allResults: results, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const {
      origin, destination, from, to,
      departDate, date, depart,
      returnDate, return: returnParam,
      cabinClass, class: classParam, cabin,
      adults, children, infants,
      sort, priceMin, priceMax,
      page = 1, limit = 500,
      segments: segmentsRaw, // multi-city: JSON array of {from, to, date}
    } = req.query;

    // Parse multi-city segments
    let multiCitySegments = null;
    if (segmentsRaw) {
      try {
        multiCitySegments = JSON.parse(segmentsRaw);
        if (!Array.isArray(multiCitySegments) || multiCitySegments.length < 2) {
          multiCitySegments = null;
        }
      } catch { multiCitySegments = null; }
    }
    const isMultiCity = !!multiCitySegments;

    // Normalize params (frontend sends various names)
    const originCode = origin || from || '';
    const destCode = destination || to || '';
    const dDate = departDate || date || depart || '';
    const rDate = returnDate || returnParam || '';
    const cabClass = cabinClass || classParam || cabin || '';
    const adultCount = parseInt(adults) || 1;
    const childCount = parseInt(children) || 0;
    const infantCount = parseInt(infants) || 0;

    // ── Multi-provider parallel search ──
    const searchParams = {
      origin: isMultiCity ? multiCitySegments[0].from : originCode,
      destination: isMultiCity ? multiCitySegments[multiCitySegments.length - 1].to : destCode,
      departDate: isMultiCity ? multiCitySegments[0].date : dDate,
      returnDate: isMultiCity ? undefined : (rDate || undefined),
      adults: adultCount,
      children: childCount,
      infants: infantCount,
      cabinClass: cabClass || undefined,
      segments: multiCitySegments || undefined, // pass segments for multi-city Sabre BFM
    };

    if (isMultiCity) {
      console.log(`[Search] Multi-city: ${multiCitySegments.map(s => `${s.from}→${s.to}`).join(', ')}`);
    }

    const [dbFlights, ttiFlights, bdfFlights, flyhubFlights, sabreFlights, galileoFlights, ndcFlights, lccFlights] = await Promise.allSettled([
      isMultiCity ? Promise.resolve([]) : searchDB({ originCode, destCode, dDate, cabClass, page, limit }),
      isMultiCity ? Promise.resolve([]) : ttiSearch(searchParams).catch(err => {
        console.error('TTI search failed (continuing with other providers):', err.message);
        return [];
      }),
      isMultiCity ? Promise.resolve([]) : bdfSearch(searchParams).catch(err => {
        console.error('BDFare search failed (continuing with other providers):', err.message);
        return [];
      }),
      isMultiCity ? Promise.resolve([]) : flyhubSearch(searchParams).catch(err => {
        console.error('FlyHub search failed (continuing with other providers):', err.message);
        return [];
      }),
      sabreSearch(searchParams).catch(err => {
        console.error('Sabre search failed (continuing with other providers):', err.message);
        return [];
      }),
      isMultiCity ? Promise.resolve([]) : galileoSearch(searchParams).catch(err => {
        console.error('Galileo search failed (continuing with other providers):', err.message);
        return [];
      }),
      isMultiCity ? Promise.resolve([]) : ndcSearch(searchParams).catch(err => {
        console.error('NDC search failed (continuing with other providers):', err.message);
        return [];
      }),
      isMultiCity ? Promise.resolve([]) : searchAllLCCs(searchParams).catch(err => {
        console.error('LCC search failed (continuing with other providers):', err.message);
        return [];
      }),
    ]);

    // Collect results
    let flights = [];

    const providerResults = [dbFlights, ttiFlights, bdfFlights, flyhubFlights, sabreFlights, galileoFlights, ndcFlights, lccFlights];
    for (const result of providerResults) {
      if (result.status === 'fulfilled') {
        const val = result.value;
        flights.push(...(val?.rows || val || []));
      }
    }

    // ── Multi-city per-segment fallback ──
    // If unified BFM returned 0 multi-city results, search each segment individually
    // across all providers, then combine into multi-city itinerary cards (like BDFare)
    if (isMultiCity && flights.filter(f => f.isMultiCity || f.direction === 'multicity').length === 0 && multiCitySegments.length >= 2) {
      console.log(`[Search] Multi-city unified returned 0 — falling back to per-segment search for ${multiCitySegments.length} segments`);

      // Search each segment in parallel across all providers
      const segmentResults = await Promise.all(
        multiCitySegments.map(async (seg, idx) => {
          const segParams = {
            origin: seg.from,
            destination: seg.to,
            departDate: seg.date,
            adults: adultCount,
            children: childCount,
            infants: infantCount,
            cabinClass: cabClass || undefined,
          };
          console.log(`[Search] Segment ${idx + 1}: ${seg.from}→${seg.to} on ${seg.date}`);

          const results = await Promise.allSettled([
            ttiSearch(segParams).catch(() => []),
            bdfSearch(segParams).catch(() => []),
            flyhubSearch(segParams).catch(() => []),
            sabreSearch(segParams).catch(() => []),
            galileoSearch(segParams).catch(() => []),
            ndcSearch(segParams).catch(() => []),
            searchAllLCCs(segParams).catch(() => []),
          ]);

          let segFlights = [];
          for (const r of results) {
            if (r.status === 'fulfilled') segFlights.push(...(r.value || []));
          }
          // Filter out return-direction flights; only keep outbound/one-way
          segFlights = segFlights.filter(f => f.direction !== 'return');
          // Sort by price
          segFlights.sort((a, b) => (a.price || 0) - (b.price || 0));
          console.log(`[Search] Segment ${idx + 1} (${seg.from}→${seg.to}): ${segFlights.length} flights found`);
          return segFlights;
        })
      );

      // Check all segments have at least 1 result
      const allSegmentsHaveFlights = segmentResults.every(sr => sr.length > 0);

      if (allSegmentsHaveFlights) {
        // Build combined multi-city cards by grouping top flights from each segment
        // Take top N from each segment and create combinations
        const MAX_PER_SEGMENT = 30;
        const trimmed = segmentResults.map(sr => sr.slice(0, MAX_PER_SEGMENT));

        // Group by airline across segments for same-airline combos first, then mixed
        const airlineGroups = {};
        for (let si = 0; si < trimmed.length; si++) {
          for (const f of trimmed[si]) {
            const code = f.airlineCode || 'XX';
            if (!airlineGroups[code]) airlineGroups[code] = Array.from({ length: trimmed.length }, () => []);
            airlineGroups[code][si].push(f);
          }
        }

        const combinedFlights = [];
        const usedKeys = new Set();

        // 1) Same-airline combinations
        for (const [code, segArrays] of Object.entries(airlineGroups)) {
          const allHave = segArrays.every(arr => arr.length > 0);
          if (!allHave) continue;

          // Take cheapest from each segment for this airline
          for (let ci = 0; ci < Math.min(segArrays[0].length, 5); ci++) {
            const combo = segArrays.map((arr, si) => arr[Math.min(ci, arr.length - 1)]);
            const comboKey = combo.map(f => `${f.flightNumber}-${f.departureTime}`).join('|');
            if (usedKeys.has(comboKey)) continue;
            usedKeys.add(comboKey);

            const segments = combo.map((f, si) => ({
              segmentIndex: si,
              origin: f.origin,
              destination: f.destination,
              departureTime: f.departureTime,
              arrivalTime: f.arrivalTime,
              duration: f.duration,
              durationMinutes: f.durationMinutes || 0,
              stops: f.stops || 0,
              stopCodes: f.stopCodes || [],
              airline: f.airline,
              airlineCode: f.airlineCode,
              flightNumber: f.flightNumber,
              legs: f.legs || [f],
              baggage: f.baggage,
              handBaggage: f.handBaggage,
              aircraft: f.legs?.[0]?.aircraft || '',
              price: f.price || 0,
              baseFare: f.baseFare || 0,
              taxes: f.taxes || 0,
              source: f.source,
              refundable: f.refundable || false,
              _originalFlight: f, // keep reference for booking
            }));

            const totalPrice = segments.reduce((s, seg) => s + (seg.price || 0), 0);
            const totalBaseFare = segments.reduce((s, seg) => s + (seg.baseFare || 0), 0);
            const totalTaxes = segments.reduce((s, seg) => s + (seg.taxes || 0), 0);
            const totalDuration = segments.reduce((s, seg) => s + (seg.durationMinutes || 0), 0);

            combinedFlights.push({
              id: `mc-combo-${combinedFlights.length}`,
              source: segments[0].source || 'sabre',
              direction: 'multicity',
              isMultiCity: true,
              isCombined: true, // flag: built from per-segment searches
              segmentCount: segments.length,
              segments,
              airline: segments[0].airline,
              airlineCode: segments[0].airlineCode,
              airlineLogo: null,
              flightNumber: segments.map(s => s.flightNumber).join(', '),
              origin: segments[0].origin,
              destination: segments[segments.length - 1].destination,
              departureTime: segments[0].departureTime,
              arrivalTime: segments[segments.length - 1].arrivalTime,
              duration: formatDuration(totalDuration),
              durationMinutes: totalDuration,
              stops: segments.reduce((s, seg) => s + seg.stops, 0),
              stopCodes: segments.flatMap(s => s.stopCodes),
              cabinClass: cabClass || 'Economy',
              price: totalPrice,
              baseFare: totalBaseFare,
              taxes: totalTaxes,
              currency: 'BDT',
              refundable: segments.every(s => s.refundable),
              baggage: segments[0].baggage,
              handBaggage: segments[0].handBaggage,
              legs: segments.flatMap(s => s.legs || []),
            });
          }
        }

        // 2) Mixed-airline: cheapest per segment regardless of airline
        for (let ci = 0; ci < Math.min(trimmed[0].length, 15); ci++) {
          const combo = trimmed.map((segArr, si) => segArr[Math.min(ci, segArr.length - 1)]);
          const comboKey = combo.map(f => `${f.flightNumber}-${f.departureTime}`).join('|');
          if (usedKeys.has(comboKey)) continue;
          usedKeys.add(comboKey);

          const segments = combo.map((f, si) => ({
            segmentIndex: si,
            origin: f.origin,
            destination: f.destination,
            departureTime: f.departureTime,
            arrivalTime: f.arrivalTime,
            duration: f.duration,
            durationMinutes: f.durationMinutes || 0,
            stops: f.stops || 0,
            stopCodes: f.stopCodes || [],
            airline: f.airline,
            airlineCode: f.airlineCode,
            flightNumber: f.flightNumber,
            legs: f.legs || [f],
            baggage: f.baggage,
            handBaggage: f.handBaggage,
            aircraft: f.legs?.[0]?.aircraft || '',
            price: f.price || 0,
            baseFare: f.baseFare || 0,
            taxes: f.taxes || 0,
            source: f.source,
            refundable: f.refundable || false,
            _originalFlight: f,
          }));

          const totalPrice = segments.reduce((s, seg) => s + (seg.price || 0), 0);
          const totalBaseFare = segments.reduce((s, seg) => s + (seg.baseFare || 0), 0);
          const totalTaxes = segments.reduce((s, seg) => s + (seg.taxes || 0), 0);
          const totalDuration = segments.reduce((s, seg) => s + (seg.durationMinutes || 0), 0);

          combinedFlights.push({
            id: `mc-mix-${combinedFlights.length}`,
            source: 'combined',
            direction: 'multicity',
            isMultiCity: true,
            isCombined: true,
            segmentCount: segments.length,
            segments,
            airline: segments.map(s => s.airline).filter((v, i, a) => a.indexOf(v) === i).join(' + '),
            airlineCode: segments[0].airlineCode,
            airlineLogo: null,
            flightNumber: segments.map(s => s.flightNumber).join(', '),
            origin: segments[0].origin,
            destination: segments[segments.length - 1].destination,
            departureTime: segments[0].departureTime,
            arrivalTime: segments[segments.length - 1].arrivalTime,
            duration: formatDuration(totalDuration),
            durationMinutes: totalDuration,
            stops: segments.reduce((s, seg) => s + seg.stops, 0),
            stopCodes: segments.flatMap(s => s.stopCodes),
            cabinClass: cabClass || 'Economy',
            price: totalPrice,
            baseFare: totalBaseFare,
            taxes: totalTaxes,
            currency: 'BDT',
            refundable: segments.every(s => s.refundable),
            baggage: segments[0].baggage,
            handBaggage: segments[0].handBaggage,
            legs: segments.flatMap(s => s.legs || []),
          });
        }

        // Sort combined by price and add to flights
        combinedFlights.sort((a, b) => a.price - b.price);
        flights.push(...combinedFlights);
        console.log(`[Search] Multi-city fallback: built ${combinedFlights.length} combined itineraries`);
      } else {
        console.log(`[Search] Multi-city fallback: some segments have no flights — ${segmentResults.map((sr, i) => `Seg${i + 1}:${sr.length}`).join(', ')}`);
      }
    }

    // Deduplicate flights from multiple providers
    // Key includes ALL leg flight numbers + times to preserve different round-trip/connection combos
    const seen = new Set();
    flights = flights.filter(f => {
      // Build a comprehensive key from all legs
      const legsKey = (f.legs || []).map(l => `${l.flightNumber || ''}@${l.departureTime || ''}`).join('|');
      const stopKey = (f.stopCodes || []).join(',');
      const key = `${f.flightNumber}-${f.departureTime}-${f.arrivalTime || ''}-${f.destination}-${f.stops ?? 0}-${stopKey}-${f.direction || ''}-${legsKey}`;
      if (key === '---------' || !f.flightNumber) return true; // keep unkeyed
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Apply per-airline fare rules from admin settings ──
    try {
      const [settingsRows] = await db.query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('markup_config', 'airline_markup_config')"
      );
      let globalDiscount = 6.30;
      let globalAitVat = 0.3;
      let airlineOverrides = {};

      for (const row of settingsRows) {
        const parsed = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : (row.setting_value || {});
        // markup_config stores per-segment configs; FLIGHT segment has fareSummaryDiscount/fareSummaryAitVat
        if (parsed.FLIGHT && parsed.FLIGHT.fareSummaryDiscount !== undefined) {
          globalDiscount = parseFloat(parsed.FLIGHT.fareSummaryDiscount) || 6.30;
          globalAitVat = parseFloat(parsed.FLIGHT.fareSummaryAitVat) || 0.3;
        }
        // airline_markup_config is keyed by airline IATA code
        if (parsed && !parsed.FLIGHT && typeof parsed === 'object') {
          airlineOverrides = parsed;
        }
      }

      flights = flights.map(f => {
        const code = f.airlineCode || '';
        const override = airlineOverrides[code];
        let discount = globalDiscount;
        let aitVat = globalAitVat;
        let markup = 0;
        let fixedMarkup = 0;

        if (override && !override.useGlobal) {
          discount = parseFloat(override.discount) || 0;
          markup = parseFloat(override.markup) || 0;
          fixedMarkup = parseFloat(override.fixedMarkup) || 0;
        }

        // Attach fare rule params for frontend fare summary display
        f.fareRules = { discount, aitVat, markup, fixedMarkup, isGlobal: !override || override.useGlobal };
        return f;
      });
    } catch (fareRuleErr) {
      console.error('Fare rule loading failed (using defaults):', fareRuleErr.message);
      // Attach default rules so frontend always has them
      flights = flights.map(f => {
        f.fareRules = { discount: 6.30, aitVat: 0.3, markup: 0, fixedMarkup: 0, isGlobal: true };
        return f;
      });
    }

    // Apply client-side filters
    if (priceMin) flights = flights.filter(f => f.price >= parseFloat(priceMin));
    if (priceMax) flights = flights.filter(f => f.price <= parseFloat(priceMax));

    // Sort
    switch (sort) {
      case 'cheapest':
      case 'price':
        flights.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'earliest':
        flights.sort((a, b) => new Date(a.departureTime || 0) - new Date(b.departureTime || 0));
        break;
      case 'fastest':
        flights.sort((a, b) => (a.durationMinutes || 999) - (b.durationMinutes || 999));
        break;
      case 'best':
      default:
        flights.sort((a, b) => {
          const scoreA = (a.price || 0) + (a.durationMinutes || 0) * 50;
          const scoreB = (b.price || 0) + (b.durationMinutes || 0) * 50;
          return scoreA - scoreB;
        });
        break;
    }

    // Extract unique airlines
    const airlines = [...new Set(flights.map(f => f.airline).filter(Boolean))];
    const cheapest = flights.length > 0 ? Math.min(...flights.map(f => f.price || Infinity)) : 0;

    const responseData = {
      data: flights,
      airlines,
      cheapest,
      total: flights.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(flights.length / parseInt(limit)),
      sources: {
        db: dbFlights.status === 'fulfilled' ? (dbFlights.value?.rows || []).length : 0,
        tti: ttiFlights.status === 'fulfilled' ? (ttiFlights.value || []).length : 0,
        bdfare: bdfFlights.status === 'fulfilled' ? (bdfFlights.value || []).length : 0,
        flyhub: flyhubFlights.status === 'fulfilled' ? (flyhubFlights.value || []).length : 0,
        sabre: sabreFlights.status === 'fulfilled' ? (sabreFlights.value || []).length : 0,
        galileo: galileoFlights.status === 'fulfilled' ? (galileoFlights.value || []).length : 0,
        ndc: ndcFlights.status === 'fulfilled' ? (ndcFlights.value || []).length : 0,
        lcc: lccFlights.status === 'fulfilled' ? (lccFlights.value || []).length : 0,
      },
    };


    res.json(responseData);
  } catch (err) {
    console.error('Flight search error:', err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});

// Helper: search local DB flights
async function searchDB({ originCode, destCode, dDate, cabClass, page, limit }) {
  let sql = 'SELECT * FROM flights WHERE 1=1';
  const params = [];

  if (originCode) { sql += ' AND origin = ?'; params.push(originCode); }
  if (destCode) { sql += ' AND destination = ?'; params.push(destCode); }
  if (dDate) { sql += ' AND DATE(departure_time) = ?'; params.push(dDate); }
  if (cabClass) { sql += ' AND cabin_class = ?'; params.push(cabClass); }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  sql += ` ORDER BY price ASC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const [rows] = await db.query(sql, params);
  const data = rows.map(r => ({
    id: r.id,
    source: 'db',
    airline: r.airline,
    airlineCode: r.airline_code,
    airlineLogo: r.airline_logo,
    flightNumber: r.flight_number,
    origin: r.origin,
    originCity: r.origin_city,
    destination: r.destination,
    destinationCity: r.destination_city,
    departureTime: r.departure_time,
    arrivalTime: r.arrival_time,
    duration: r.duration,
    durationMinutes: parseDurationToMinutes(r.duration),
    stops: r.stops,
    stopCodes: [],
    cabinClass: r.cabin_class,
    price: parseFloat(r.price),
    baseFare: parseFloat(r.base_fare || r.price),
    taxes: parseFloat(r.taxes || 0),
    currency: r.currency || 'BDT',
    availableSeats: r.seats_available ?? null,
    baggage: r.baggage || null,
    handBaggage: null,
    refundable: !!r.refundable,
    aircraft: '',
    legs: [{
      origin: r.origin,
      destination: r.destination,
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
      duration: r.duration,
      durationMinutes: parseDurationToMinutes(r.duration),
      flightNumber: r.flight_number,
      airlineCode: r.airline_code,
      aircraft: '',
      stops: [],
    }],
  }));

  return { rows: data };
}

function parseDurationToMinutes(dur) {
  if (!dur) return 0;
  const match = dur.match(/(\d+)h\s*(\d+)?m?/i);
  if (match) return parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
  const minMatch = dur.match(/(\d+)\s*m/i);
  if (minMatch) return parseInt(minMatch[1]);
  return 0;
}

function formatDuration(mins) {
  if (!mins || mins <= 0) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

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

// Bangladesh domestic airports
const BD_AIRPORTS = ['DAC', 'CXB', 'CGP', 'ZYL', 'JSR', 'RJH', 'SPD', 'BZL', 'IRD', 'TKR'];

function flattenLegs(items = []) {
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    if (Array.isArray(item?.legs) && item.legs.length > 0) return flattenLegs(item.legs);
    return item ? [item] : [];
  });
}

function mergeBookingFlightData({ flightData, returnFlightData, multiCityFlights = [], isRoundTrip = false }) {
  const merged = { ...(flightData || {}) };

  if (isRoundTrip && returnFlightData) {
    const outLegs = flattenLegs(flightData?.legs?.length ? flightData.legs : [flightData]);
    const retLegs = flattenLegs(returnFlightData?.legs?.length ? returnFlightData.legs : [returnFlightData]);
    merged.legs = [...outLegs, ...retLegs];
  } else if (Array.isArray(multiCityFlights) && multiCityFlights.length >= 2) {
    merged.legs = flattenLegs(multiCityFlights);
  } else {
    merged.legs = flattenLegs(flightData?.legs?.length ? flightData.legs : [flightData]);
  }

  return merged;
}

function toDateOnly(dateTime) {
  if (!dateTime) return null;
  const raw = String(dateTime);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function getPassengerCounts(passengers = []) {
  return passengers.reduce((acc, p) => {
    const type = String(p?.type || 'adult').toLowerCase();
    if (type === 'child') acc.children += 1;
    else if (type === 'infant') acc.infants += 1;
    else acc.adults += 1;
    return acc;
  }, { adults: 0, children: 0, infants: 0 });
}

function extractDistinctSabreAirlinePnr(rawBooking, gdsPnr) {
  const gds = String(gdsPnr || '').trim().toUpperCase();
  const candidates = [];
  const stack = [rawBooking];
  const seen = new Set();

  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item) => stack.push(item));
      continue;
    }

    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object') {
        stack.push(value);
        continue;
      }
      if (typeof value !== 'string') continue;
      
      // Standard named fields
      if (/(vendorlocator|airlinelocator|airlinepnr|confirmationid|confirmationnumber|reservationnumber|locator|recordlocator|supplierref|airlineconfirmation|operatingairlineconfirmation)/i.test(key)) {
        const code = value.trim().toUpperCase();
        if (/^[A-Z0-9]{5,20}$/.test(code)) candidates.push(code);
      }
      
      // Extract from /DCBS*09HUEY or /DCAI*FCQGEC patterns in segment data
      if (typeof value === 'string') {
        const dcMatch = value.match(/\/DC[A-Z]{2}\*([A-Z0-9]{4,8})/i);
        if (dcMatch) {
          candidates.push(dcMatch[1].toUpperCase());
        }
      }
    }
  }

  const distinct = candidates.find((code) => code !== gds);
  return distinct || null;
}

function normalizeLocatorCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{5,20}$/.test(code) ? code : null;
}

function resolveCancelLocators(booking = {}, details = {}) {
  const gdsCandidates = [
    details?.gdsPnr,
    booking?.pnr,
    details?.gdsBookingResult?.pnr,
    details?.outbound?.pnr,
  ].map(normalizeLocatorCode).filter(Boolean);

  const airlineCandidates = [
    details?.airlinePnr,
    details?.gdsBookingResult?.airlinePnr,
    details?.outbound?.airlinePnr,
  ].map(normalizeLocatorCode).filter(Boolean);

  const gdsPnr = gdsCandidates.find((c) => !airlineCandidates.includes(c)) || gdsCandidates[0] || null;
  const airlinePnr = airlineCandidates[0] || null;

  return { gdsPnr, airlinePnr };
}

async function hydrateTtiContextForBooking({ mergedFlightData, returnFlightData, isRoundTrip, passengers }) {
  if (mergedFlightData?._ttiOffer?.Ref && mergedFlightData?._ttiItineraryRef) {
    return mergedFlightData;
  }

  const legs = flattenLegs(mergedFlightData?.legs?.length ? mergedFlightData.legs : [mergedFlightData]);
  const firstLeg = legs[0];
  if (!firstLeg?.origin || !firstLeg?.destination || !firstLeg?.departureTime) {
    return mergedFlightData;
  }

  const counts = getPassengerCounts(passengers);
  const returnDate = isRoundTrip
    ? (toDateOnly(returnFlightData?.departureTime)
      || toDateOnly(legs.find((l) => l?.origin === firstLeg.destination && l?.destination === firstLeg.origin)?.departureTime))
    : undefined;

  const searchParams = {
    origin: firstLeg.origin,
    destination: firstLeg.destination,
    departDate: toDateOnly(firstLeg.departureTime),
    returnDate,
    adults: Math.max(counts.adults, 1),
    children: counts.children,
    infants: counts.infants,
    cabinClass: mergedFlightData?.cabinClass || 'Economy',
  };

  try {
    const results = await ttiSearch(searchParams);
    if (!Array.isArray(results) || results.length === 0) {
      return mergedFlightData;
    }

    const wantedFlightNo = String(firstLeg.flightNumber || '').replace(/\D/g, '');
    const wantedAirline = String(firstLeg.airlineCode || '').toUpperCase();

    const best = results.find((r) => {
      if (!r?._ttiOffer?.Ref || !r?._ttiItineraryRef) return false;
      if (wantedAirline && String(r.airlineCode || '').toUpperCase() !== wantedAirline) return false;
      if (!wantedFlightNo) return true;
      return String(r.flightNumber || '').replace(/\D/g, '') === wantedFlightNo;
    }) || results.find((r) => r?._ttiOffer?.Ref && r?._ttiItineraryRef);

    if (!best) return mergedFlightData;

    console.log('[Booking][TTI] Hydrated search context:', JSON.stringify({
      itineraryRef: best._ttiItineraryRef,
      offerRef: best._ttiOffer?.Ref || null,
      airline: best.airlineCode,
      flightNumber: best.flightNumber,
    }));

    return {
      ...mergedFlightData,
      _ttiItineraryRef: best._ttiItineraryRef,
      _ttiRawItinerary: best._ttiRawItinerary,
      _ttiRawFares: best._ttiRawFares,
      _ttiRawSegments: best._ttiRawSegments,
      _ttiFullFareInfo: best._ttiFullFareInfo,
      _ttiAllSegments: best._ttiAllSegments,
      _ttiOffer: best._ttiOffer,
      _ttiPassengers: best._ttiPassengers,
    };
  } catch (err) {
    console.warn('[Booking][TTI] Context hydration failed:', err.message);
    return mergedFlightData;
  }
}

/**
 * Determine payment deadline.
 * API-ONLY: Uses airline-provided timeLimit / LastTicketingDate from GDS.
 * No hardcoded fallbacks — if GDS provides no deadline, returns null.
 */
function resolvePaymentDeadline(airlineTimeLimit) {
  if (airlineTimeLimit) {
    const tl = new Date(airlineTimeLimit);
    if (!isNaN(tl.getTime()) && tl > new Date()) {
      return tl;
    }
  }
  return null; // No deadline from API — booking stays open until airline auto-cancels
}

// POST /flights/book
router.post('/book', authenticate, async (req, res) => {
  try {
    const {
      flightData,
      returnFlightData,
      passengers: rawPassengers,
      isRoundTrip,
      isDomestic,
      payLater,
      paymentMethod,
      totalAmount,
      baseFare,
      taxes,
      serviceCharge,
      addOns,
      contactInfo,
      travelDocuments,
      specialServices,
    } = req.body;

    const passengers = (Array.isArray(rawPassengers) ? rawPassengers : []).map((p) => {
      const titleRaw = String(p?.title || p?.civility || '').trim();
      const title = titleRaw || 'Mr';
      const firstName = String(p?.firstName || p?.firstname || p?.givenName || '').trim();
      const lastName = String(p?.lastName || p?.lastname || p?.surname || '').trim();
      const dateOfBirth = p?.dateOfBirth || p?.dob || p?.birthDate || null;
      const passportNumber = p?.passportNumber || p?.passport || p?.documentNumber || null;
      const passportExpiry = p?.passportExpiry || p?.documentExpiry || p?.expiryDate || null;
      const passportCountry = p?.passportCountry || p?.documentCountry || p?.nationality || 'BD';
      const nationality = p?.nationality || passportCountry || 'BD';
      const genderRaw = String(p?.gender || '').trim().toLowerCase();
      const gender = genderRaw || (/^(mr|mstr)$/i.test(title) ? 'male' : 'female');

      return {
        ...p,
        title,
        firstName,
        lastName,
        dateOfBirth,
        dob: dateOfBirth,
        gender,
        type: p?.type || 'adult',
        nationality,
        passportCountry,
        passportNumber,
        passport: passportNumber,
        passportExpiry,
      };
    });

    const bookingId = uuidv4();
    // Temporary fallback ref — will be replaced with real PNR after GDS booking
    let bookingRef = `ST-FL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(Math.floor(Math.random()*999)).padStart(3,'0')}`;

    const origin = flightData?.origin || '';
    const destination = flightData?.destination || '';
    const departureTime = flightData?.departureTime || new Date().toISOString();

    // Determine domestic/international
    const domestic = isDomestic !== undefined ? isDomestic : (BD_AIRPORTS.includes(origin.toUpperCase()) && BD_AIRPORTS.includes(destination.toUpperCase()));

    // Resolve payment deadline: API-only, from airline GDS timeLimit
    const airlineTimeLimit = flightData?.timeLimit || null;
    let paymentDeadline = null;
    if (payLater) {
      paymentDeadline = resolvePaymentDeadline(airlineTimeLimit);
    }

    const status = payLater ? 'on_hold' : 'confirmed';
    const payStatus = payLater ? 'pending' : 'paid';

    const flightSourceRaw = flightData?.source || flightData?.provider || '';
    const flightSource = String(flightSourceRaw).toLowerCase().trim();
    const airlineCode = String(flightData?.airlineCode || '').toUpperCase();
    const isTtiFlight = flightSource.includes('tti') || flightSource.includes('astra') || ['2A', 'S2'].includes(airlineCode);
    const isSabreFlight = flightSource.includes('sabre') || !!flightData?._sabreSource;
    const isBdfareFlight = flightSource.includes('bdfare') || flightSource.includes('bdf');
    const isFlyhubFlight = flightSource.includes('flyhub');
    const isGdsFlight = isTtiFlight || isSabreFlight || isBdfareFlight || isFlyhubFlight;

    if (isGdsFlight) {
      const missingPassportIndex = passengers.findIndex((p) => !p.passportNumber || !p.passportExpiry || !p.nationality);
      if (missingPassportIndex >= 0) {
        return res.status(422).json({
          message: `Passenger ${missingPassportIndex + 1} missing passport fields (number/expiry/nationality)`,
          gdsBooked: false,
        });
      }
    }

    const details = {
      outbound: flightData || {},
      return: returnFlightData || null,
      multiCityFlights: req.body.multiCityFlights || [],
      isRoundTrip: !!isRoundTrip,
      isMultiCity: !!(req.body.isMultiCity || (req.body.multiCityFlights || []).length >= 2),
      isDomestic: domestic,
      source: flightSource || null,
      addOns: addOns || {},
      specialServices: specialServices || {},
      baseFare, taxes, serviceCharge,
      travelDocuments: travelDocuments || [],
    };

    // Create booking in external GDS first (TTI/Sabre)
    let gdsPnr = null;
    let gdsBookingResult = null;
    let airlinePnr = null; // Actual airline record locator
    let gdsBookingId = null; // Provider-specific internal booking identifier

    const multiCityFlights = req.body.multiCityFlights || [];
    const mergedFlightData = mergeBookingFlightData({ flightData, returnFlightData, multiCityFlights, isRoundTrip });

    console.log('[Booking] Merged legs count:', mergedFlightData.legs?.length || 0);
    (mergedFlightData.legs || []).forEach((l, i) => {
      console.log(`[Booking]   Leg ${i + 1}: ${l.airlineCode || '?'}${l.flightNumber || '?'} ${l.origin || '?'}→${l.destination || '?'} ${l.departureTime || '?'}`);
    });

    if (isTtiFlight) {
      console.log('[Booking] TTI/Air Astra flight detected — creating GDS booking...');
      try {
        const ttiFlightData = await hydrateTtiContextForBooking({
          mergedFlightData,
          returnFlightData,
          isRoundTrip: !!isRoundTrip,
          passengers,
        });

        gdsBookingResult = await ttiCreateBooking({
          flightData: ttiFlightData,
          passengers,
          contactInfo: contactInfo || {},
        });

        if (gdsBookingResult?.success && gdsBookingResult?.pnr) {
          gdsPnr = gdsBookingResult.pnr;
          airlinePnr = gdsBookingResult.airlinePnr || gdsBookingResult.pnr || null;
          gdsBookingId = gdsBookingResult.ttiBookingId || null;
          console.log('[Booking] TTI success | PNR:', gdsPnr, '| Airline PNR:', airlinePnr, '| Booking ID:', gdsBookingId);

          if (gdsBookingResult.ticketTimeLimit && payLater) {
            const ttiDeadline = new Date(gdsBookingResult.ticketTimeLimit);
            if (!isNaN(ttiDeadline.getTime()) && ttiDeadline > new Date()) {
              paymentDeadline = ttiDeadline;
            }
          }
        } else {
          console.warn('[Booking] TTI booking failed:', gdsBookingResult?.error || 'Unknown TTI error');
        }
      } catch (ttiErr) {
        console.error('[Booking] TTI CreateBooking exception:', ttiErr.message);
      }
    }

    if (!gdsPnr && isSabreFlight) {
      console.log('[Booking] ═══════════════════════════════════════════════════');
      console.log('[Booking] Sabre flight detected — creating GDS booking with SSR/DOCS...');
      console.log('[Booking] isRoundTrip:', isRoundTrip, '| isMultiCity:', !!(req.body.isMultiCity || (req.body.multiCityFlights || []).length >= 2));
      console.log('[Booking] returnFlightData:', returnFlightData ? 'YES' : 'NO');
      console.log('[Booking] multiCityFlights:', (req.body.multiCityFlights || []).length, 'segments');
      console.log('[Booking] Passengers:', passengers.length, '| Contact:', contactInfo?.email);
      passengers.forEach((p, i) => {
        console.log(`[Booking] Pax ${i + 1}: ${(p.title || p.prefix || '').toUpperCase()} ${p.firstName || p.givenName} ${p.lastName || p.surname} | DOB: ${p.dateOfBirth || p.dob} | Passport: ${p.passportNumber || p.passportNo || p.passport} | Expiry: ${p.passportExpiry || p.passportEx} | Gender: ${p.gender} | Type: ${p.type || p.passengerType}`);
      });

      try {
        gdsBookingResult = await sabreCreateBooking({
          flightData: mergedFlightData,
          passengers,
          contactInfo: contactInfo || {},
          specialServices: specialServices || {},
        });

        console.log('[Booking] Sabre result: success=', gdsBookingResult?.success, '| pnr=', gdsBookingResult?.pnr, '| error=', gdsBookingResult?.error || 'none');

        if (gdsBookingResult?.success && gdsBookingResult?.pnr) {
          gdsPnr = gdsBookingResult.pnr;
          gdsBookingId = gdsBookingResult.pnr;
          airlinePnr = gdsBookingResult.airlinePnr || null;
          console.log('[Booking] ✓ Sabre GDS PNR created:', gdsPnr, '| createVariant:', gdsBookingResult.createVariant || 'unknown');

          if (airlinePnr) {
            console.log('[Booking] ✓ Distinct Airline PNR from CreatePNR response:', airlinePnr);
          } else {
            try {
              console.log('[Booking] Fetching GetBooking to extract distinct Airline PNR...');
              const bookingDetail = await sabreGetBooking({ pnr: gdsPnr });
              if (bookingDetail?.success) {
                // Use vendorLocators array from enhanced GetBooking
                if (bookingDetail.vendorLocators?.length > 0) {
                  airlinePnr = bookingDetail.vendorLocators[0];
                  console.log('[Booking] ✓ Distinct Airline PNR from vendorLocators:', airlinePnr);
                } else {
                  // Fallback: deep scan raw response
                  airlinePnr = extractDistinctSabreAirlinePnr(bookingDetail.rawResponse, gdsPnr);
                  if (airlinePnr) {
                    console.log('[Booking] ✓ Distinct Airline PNR from deep scan:', airlinePnr);
                  } else {
                    console.log('[Booking] No distinct airline locator found — airline PNR may equal GDS PNR or be assigned after ticketing');
                  }
                }
              } else {
                console.warn('[Booking] GetBooking returned no data:', bookingDetail?.error);
              }
            } catch (getBookErr) {
              console.warn('[Booking] GetBooking for airline PNR extraction failed:', getBookErr.message);
            }
          }

          if (gdsBookingResult.ticketTimeLimit && payLater) {
            const sabreDeadline = new Date(gdsBookingResult.ticketTimeLimit);
            if (!isNaN(sabreDeadline.getTime()) && sabreDeadline > new Date()) {
              paymentDeadline = sabreDeadline;
              console.log('[Booking] Sabre ticket time limit:', paymentDeadline.toISOString());
            }
          }
        } else {
          console.warn('[Booking] Sabre booking failed:', gdsBookingResult?.error || 'Unknown Sabre error');
        }
      } catch (sabreErr) {
        console.error('[Booking] Sabre CreateBooking exception:', sabreErr.message);
      }
    }

    // ── BDFare booking ──
    if (!gdsPnr && isBdfareFlight) {
      console.log('[Booking] BDFare flight detected — creating GDS booking...');
      try {
        const bdfOfferId = flightData?._bdfOfferId || flightData?.id || null;
        if (!bdfOfferId) {
          console.warn('[Booking] BDFare: No offerId found in flight data');
        } else {
          gdsBookingResult = await bdfCreateBooking({
            offerId: bdfOfferId,
            passengers: passengers.map(p => ({
              type: p.type === 'child' ? 'CHD' : p.type === 'infant' ? 'INF' : 'ADT',
              title: p.title || 'Mr',
              firstName: p.firstName,
              lastName: p.lastName,
              dob: p.dateOfBirth || p.dob,
              gender: p.gender || 'male',
              nationality: p.nationality || 'BD',
              passport: p.passportNumber || p.passport,
              passportExpiry: p.passportExpiry,
            })),
            contactInfo: contactInfo || {},
          });

          if (gdsBookingResult?.success && gdsBookingResult?.pnr) {
            gdsPnr = gdsBookingResult.pnr;
            airlinePnr = gdsBookingResult.pnr;
            gdsBookingId = gdsBookingResult.orderId || null;
            console.log('[Booking] ✓ BDFare PNR:', gdsPnr, '| OrderId:', gdsBookingId);
          } else {
            console.warn('[Booking] BDFare booking failed:', gdsBookingResult?.error);
          }
        }
      } catch (bdfErr) {
        console.error('[Booking] BDFare CreateBooking exception:', bdfErr.message);
      }
    }

    // ── FlyHub booking ──
    if (!gdsPnr && isFlyhubFlight) {
      console.log('[Booking] FlyHub flight detected — creating GDS booking...');
      try {
        const flyhubResultId = flightData?._flyhubResultId || flightData?.id || null;
        if (!flyhubResultId) {
          console.warn('[Booking] FlyHub: No resultId found in flight data');
        } else {
          gdsBookingResult = await flyhubCreateBooking({
            resultId: flyhubResultId,
            passengers: passengers.map(p => ({
              title: p.title || 'Mr',
              firstName: p.firstName,
              lastName: p.lastName,
              type: p.type === 'child' ? 'Child' : p.type === 'infant' ? 'Infant' : 'Adult',
              dob: p.dateOfBirth || p.dob,
              gender: p.gender || 'male',
              nationality: p.nationality || 'BD',
              passport: p.passportNumber || p.passport,
              passportExpiry: p.passportExpiry,
            })),
            contactInfo: contactInfo || {},
          });

          if (gdsBookingResult?.success && gdsBookingResult?.pnr) {
            gdsPnr = gdsBookingResult.pnr;
            airlinePnr = gdsBookingResult.pnr;
            gdsBookingId = gdsBookingResult.bookingId || null;
            console.log('[Booking] ✓ FlyHub PNR:', gdsPnr, '| BookingId:', gdsBookingId);
          } else {
            console.warn('[Booking] FlyHub booking failed:', gdsBookingResult?.error);
          }
        }
      } catch (fhErr) {
        console.error('[Booking] FlyHub CreateBooking exception:', fhErr.message);
      }
    }


    // Airline PNR is best-effort (often only available after ticketing for Sabre)
    if (isGdsFlight && !gdsPnr) {
      return res.status(422).json({
        message: 'GDS booking failed: no PNR was returned from the provider',
        gdsBooked: false,
        gdsError: gdsBookingResult?.error || 'Booking failed - no GDS PNR generated',
        gdsPnr: null,
        airlinePnr: null,
        gdsBookingId: gdsBookingId || null,
      });
    }

    // Use real PNR as booking reference when available
    if (gdsPnr) {
      bookingRef = gdsPnr;
    }

    // Build route string
    const multiCityFlightsArr = req.body.multiCityFlights || [];
    let flightRoute;
    if (multiCityFlightsArr.length >= 2) {
      flightRoute = multiCityFlightsArr.map(f => f.origin).concat(multiCityFlightsArr[multiCityFlightsArr.length - 1]?.destination).filter(Boolean).join('-');
    } else if (isRoundTrip && returnFlightData) {
      flightRoute = `${origin}-${destination}-${origin}`;
    } else {
      flightRoute = `${origin}-${destination}`;
    }
    const flightProvider = flightSource || (isTtiFlight ? 'tti' : (isSabreFlight ? 'sabre' : (gdsPnr ? 'gds' : 'local')));

    await db.query(
      `INSERT INTO bookings (id, user_id, booking_type, booking_ref, pnr, status, ticket_status, provider, route, total_amount, payment_method, payment_status, details, passenger_info, contact_info, payment_deadline)
       VALUES (?, ?, 'flight', ?, ?, ?, 'not_issued', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, req.user.sub, bookingRef, gdsPnr || null, status, flightProvider, flightRoute, totalAmount || 0, paymentMethod || 'pay_later', payStatus,
       JSON.stringify({ ...details, gdsPnr, airlinePnr, gdsBookingId, gdsBookingResult: gdsBookingResult || null }),
       JSON.stringify(passengers || []), JSON.stringify(contactInfo || {}),
       paymentDeadline]
    );

    // Create transaction only if paid
    if (!payLater) {
      await db.query(
        `INSERT INTO transactions (id, user_id, booking_id, type, amount, status, payment_method, reference, description)
         VALUES (?, ?, ?, 'payment', ?, 'completed', ?, ?, ?)`,
        [uuidv4(), req.user.sub, bookingId, totalAmount || 0, paymentMethod || 'card', bookingRef, `Flight booking ${origin} → ${destination}`]
      );

      // Create ticket only if paid immediately
      const ticketNo = `098-${String(Math.floor(Math.random()*9999999999)).padStart(10,'0')}`;
      await db.query(
        `INSERT INTO tickets (id, booking_id, user_id, ticket_no, pnr, status, details)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
        [uuidv4(), bookingId, req.user.sub, ticketNo, gdsPnr || bookingRef.slice(-6).toUpperCase(),
         JSON.stringify({ airline: flightData?.airline, flightNumber: flightData?.flightNumber, origin, destination, departureTime, passenger: passengers?.[0]?.firstName + ' ' + passengers?.[0]?.lastName })]
      );
    }

    notifyBookingConfirm(req.user.sub, { bookingRef, type: 'Flight', amount: totalAmount || 0 }).catch(console.error);
    res.status(201).json({
      id: bookingId,
      bookingRef,
      status,
      payLater: !!payLater,
      paymentDeadline: paymentDeadline ? paymentDeadline.toISOString() : null,
      totalAmount: totalAmount || 0,
      currency: 'BDT',
      bookingType: 'flight',
      pnr: gdsPnr || null,
      airlinePnr: airlinePnr || null,
      gdsBookingId: gdsBookingId || null,
      gdsBooked: !!(gdsBookingResult?.success),
      gdsError: gdsBookingResult && !gdsBookingResult.success ? (gdsBookingResult.error || null) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Flight booking error:', err);
    res.status(500).json({ message: 'Something went wrong', status: 500 });
  }
});
// POST /flights/cancel — customer cancellation
router.post('/cancel', authenticate, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.user.sub]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const booking = rows[0];
    if (['cancelled', 'void', 'refunded', 'completed'].includes(booking.status)) {
      return res.status(422).json({ message: `Booking already ${booking.status}` });
    }

    const details = typeof booking.details === 'string' ? JSON.parse(booking.details) : (booking.details || {});
    const sourceRaw = details.outbound?.source || details.source || booking.provider || '';
    const source = String(sourceRaw).toLowerCase().trim();

    const airlineCode = String(details.outbound?.airlineCode || details.airlineCode || '').toUpperCase();
    const isSabreSource = source.includes('sabre');
    const isTtiSource = source.includes('tti') || source.includes('astra') || ['2A', 'S2'].includes(airlineCode);
    const isBdfareSource = source.includes('bdfare') || source.includes('bdf');
    const isFlyhubSource = source.includes('flyhub');
    const isGdsProvider = isSabreSource || isTtiSource || isBdfareSource || isFlyhubSource;

    const { gdsPnr, airlinePnr } = resolveCancelLocators(booking, details);

    // For TTI, provider booking id from GDS response is required (local booking.id is NOT valid for TTI Cancel API)
    const ttiBookingId = details?.gdsBookingResult?.ttiBookingId
      || details?.gdsBookingId
      || details?.ttiBookingId
      || details?.outbound?._ttiBookingId
      || null;

    if (isGdsProvider && !gdsPnr) {
      return res.status(422).json({
        message: 'Missing GDS PNR — cancellation blocked to prevent local/GDS mismatch',
        gdsError: `No valid GDS PNR found (airlinePnr=${airlinePnr || 'none'})`,
        hint: 'This booking must store the provider GDS PNR for cancellation.',
      });
    }

    // Attempt GDS cancellation if PNR exists
    let gdsCancelResult = null;
    let gdsCancelFailed = false;
    if (gdsPnr) {
      try {
        console.log(`[Cancel] Provider source='${source}' | airlineCode='${airlineCode || '-'}' | booking.provider='${booking.provider || ''}' | bookingRef='${booking.booking_ref || '-'}' | gdsPnr='${gdsPnr}' | airlinePnr='${airlinePnr || '-'}' | ttiBookingId='${ttiBookingId || '-'}'`);

        if (isSabreSource) {
          const { cancelBooking: sabreCancelBooking } = require('./sabre-flights');
          gdsCancelResult = await sabreCancelBooking({ pnr: gdsPnr });
          if (!gdsCancelResult?.success) gdsCancelFailed = true;
        } else if (isTtiSource) {
          const { cancelBooking: ttiCancelBooking } = require('./tti-flights');
          gdsCancelResult = await ttiCancelBooking({ pnr: gdsPnr, bookingId: ttiBookingId });
          if (!gdsCancelResult?.success) gdsCancelFailed = true;
        } else if (isBdfareSource) {
          const { cancelBooking: bdfCancelBooking } = require('./bdf-flights');
          const bdfOrderId = details?.gdsBookingId || details?.gdsBookingResult?.orderId || null;
          gdsCancelResult = await bdfCancelBooking({ orderId: bdfOrderId, pnr: gdsPnr });
          if (!gdsCancelResult?.success) gdsCancelFailed = true;
        } else if (isFlyhubSource) {
          const { cancelBooking: fhCancelBooking } = require('./flyhub-flights');
          const fhBookingId = details?.gdsBookingId || details?.gdsBookingResult?.bookingId || gdsPnr;
          gdsCancelResult = await fhCancelBooking({ bookingId: fhBookingId, pnr: gdsPnr });
          if (!gdsCancelResult?.success) gdsCancelFailed = true;
        } else {
          gdsCancelFailed = true;
          gdsCancelResult = { success: false, error: `Unsupported provider/source for cancellation: ${source || 'unknown'}` };
        }
      } catch (gdsErr) {
        console.error('[Cancel] GDS cancel error:', gdsErr.message);
        gdsCancelFailed = true;
        gdsCancelResult = { success: false, error: gdsErr.message };
      }
    }

    // Safety block: if GDS cancel failed and PNR exists, don't update local status
    if (gdsCancelFailed && gdsPnr) {
      console.warn(`[Cancel] GDS cancel failed for PNR ${gdsPnr} — local status NOT changed`);
      return res.status(422).json({
        message: 'GDS cancellation failed — booking status unchanged',
        gdsError: gdsCancelResult?.error || 'Provider returned failure',
        hint: 'Contact support or try again later',
      });
    }

    await db.query('UPDATE bookings SET status = ?, notes = CONCAT(IFNULL(notes,""), ?) WHERE id = ?', [
      'cancelled',
      `\n[Customer Cancel ${new Date().toISOString()}] ${reason || 'No reason provided'}${gdsPnr ? ` | GDS: ${gdsCancelResult?.success ? 'OK' : 'N/A'}` : ''}`,
      bookingId,
    ]);

    console.log(`[Cancel] Booking ${booking.booking_ref} cancelled by user ${req.user.sub}`);
    res.json({ success: true, message: 'Booking cancelled', gdsCancelled: !!(gdsCancelResult?.success) });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;

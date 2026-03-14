# Seven Trip — Sabre GDS Feature Audit (v3.9.9.9)

> Complete gap analysis: what's implemented vs what's needed from Sabre sections 1–26.
> Generated: 2026-03-14 | PCC: J4YL | EPR: 631470

---

## Summary Matrix

| # | Feature | Status | Backend File | Endpoint |
|---|---------|--------|-------------|----------|
| 1 | OAuth v3 Auth | ✅ DONE | `sabre-flights.js` | `POST /v3/auth/token` |
| 2 | Flight Search (BFM v5) | ✅ DONE | `sabre-flights.js` | `POST /v5/offers/shop` |
| 3 | Price Revalidation (v4) | ✅ DONE | `sabre-flights.js` | `POST /v4/shop/flights/revalidate` |
| 4 | Create PNR (v2.4.0) | ✅ DONE | `sabre-flights.js` | `POST /v2.4.0/passenger/records?mode=create` |
| 5 | Retrieve Booking | ✅ DONE | `sabre-flights.js` | `POST /v1/trip/orders/getBooking` |
| 6 | Check Ticket Status | ✅ DONE | `sabre-flights.js` | `POST /v1/trip/orders/checkFlightTickets` |
| 7 | Issue Ticket (AirTicketRQ) | ✅ DONE | `sabre-flights.js` | `POST /v1.3.0/air/ticket` |
| 8 | Cancel Booking | ✅ DONE | `sabre-flights.js` + `sabre-soap.js` | REST + SOAP fallback |
| 9 | Seat Map | ✅ DONE | `sabre-soap.js` + `sabre-flights.js` | SOAP `EnhancedSeatMapRQ v6` + REST |
| 10 | Assign Seats | ✅ DONE | `sabre-flights.js` | `POST /v2.4.0/passenger/records?mode=update` |
| 11 | Add Ancillary SSR | ✅ DONE | `sabre-flights.js` | `POST /v2.4.0/passenger/records?mode=update` |
| 12 | PNR Extraction Logic | ✅ DONE | `sabre-flights.js` | Internal |
| 13 | Airline PNR Deep Scan | ✅ DONE | `sabre-flights.js` + `flights.js` | Internal |
| 14 | SSR Reference Table | ✅ DONE | `sabre-flights.js` | Internal (CTCM/CTCE/VGML/WCHR/XBAG/FQTV/RQST) |
| 15 | Name & Title Rules | ✅ DONE | `sabre-flights.js` | Internal |
| 16 | DOCS Payload Rules | ✅ DONE | `sabre-flights.js` | Internal |
| **17** | **Get Ancillaries (Stateless REST)** | ⚠️ PARTIAL | `sabre-soap.js` → SOAP GAO only | Missing: REST `POST /v1/offers/getAncillaries` |
| **18** | **Add Ancillary + EMD** | ⚠️ PARTIAL | SSR-based add only | Missing: REST stateless add + EMD issuance |
| **19** | **Baggage Allowance** | ✅ DONE | `sabre-flights.js` | Via BFM `AncillaryFees` in search response |
| **20** | **Structured Fare Rules** | ❌ NOT DONE | — | Need: SOAP `StructureFareRulesRQ v3.0.1` |
| **21** | **Branded Fares / Fare Families** | ⚠️ PARTIAL | Brand data extracted from BFM | Missing: Dedicated `BargainFinderMax_BFRQ` |
| **22** | **Exchange / Reissue** | ❌ NOT DONE | — | Need: SOAP `ExchangeBookingRQ v1.1.0` |
| **23** | **Refund** | ❌ NOT DONE | — | Need: REST Stateless Refunds API |
| **24** | **Void** | ❌ NOT DONE | — | Need: REST Void Flight Tickets |
| **25** | **Flight Status (FLIFO)** | ❌ NOT DONE | — | Need: `GET /products/air/flight/status` |
| **26** | **Frequent Flyer Update** | ⚠️ PARTIAL | FQTV SSR in CreatePNR | Missing: Post-booking FF update via UpdatePNR |

---

## Detailed Gap Analysis

### ✅ Sections 1–16: Fully Implemented

All core booking lifecycle features are production-verified:
- **Auth**: OAuth v3 password grant with JV_BD shared secret
- **Search**: BFM v5 with 200 itineraries, NDC/ATPCO/LCC data sources enabled
- **Booking**: CreatePassengerNameRecordRQ v2.4.0 with 5-variant fallback chain
- **Ticketing**: AirTicketRQ v1.3.0 (auto-ticketing service available)
- **Cancel**: 3 REST variants + SOAP `OTA_CancelLLSRQ` fallback with session hardening
- **Seat Maps**: SOAP `EnhancedSeatMapRQ v6` (pre-booking) + REST GetSeats (post-booking)
- **Ancillaries**: SSR-based (VGML/WCHR/XBAG/RQST) via UpdatePNR
- **PNR Management**: Deep PNR extraction, airline PNR scan (DC* pattern), DOCS strict mode

### ⚠️ Section 17: Get Ancillaries — PARTIAL

**What we have:**
- SOAP `GetAncillaryOffersRQ v3.0.0` (stateful, requires PNR + session)
- Located in `sabre-soap.js` → `getAncillaryOffers()`
- Flow: SessionCreate → TravelItineraryRead → GAO → parse XML
- Returns meals, baggage, and other ancillaries categorized by group code

**What's missing:**
- **Stateless Ancillaries API** (`POST /v1/offers/getAncillaries`)
  - Does NOT require SOAP session or PNR (can use payload mode with segments/passengers)
  - Official endpoint: `https://api.platform.sabre.com/v1/offers/getAncillaries`
  - Supports: payload mode, PNR mode, offerId mode, loyalty points mode
  - Better for pre-booking ancillary shopping (no session management overhead)

**Impact:** Low — SOAP GAO works for post-booking. Pre-booking baggage comes from BFM search. Stateless API would improve pre-booking ancillary UX.

**Official Sabre sample request (payload mode):**
```json
{
  "clientContext": {
    "pseudoCityCode": "J4YL",
    "stationNumber": "31000104",
    "accountingCity": "J4YL"
  },
  "segments": [{
    "id": "SEG-1",
    "departureDateTime": "2026-04-27T14:30:00",
    "arrivalDateTime": "2026-04-27T18:45:00",
    "departureAirportCode": "DAC",
    "arrivalAirportCode": "DXB",
    "operatingAirlineCode": "BS",
    "bookingAirlineCode": "BS",
    "isElectronicTicket": true,
    "bookingFlightNumber": "141",
    "bookingClassCode": "Y",
    "operatingFlightNumber": "141",
    "operatingBookingClassCode": "Y",
    "sequence": 1
  }],
  "passengers": [{
    "id": "PAX-1",
    "nameNumber": "01.01",
    "givenName": "TEST MR",
    "surname": "SABRE",
    "typeCode": "ADT"
  }]
}
```

---

### ⚠️ Section 18: Add Ancillary + EMD — PARTIAL

**What we have:**
- SSR-based ancillary add via `addAncillarySSR()` in `sabre-flights.js`
- Uses `UpdatePassengerNameRecordRQ v2.4.0` with SSR codes (XBAG, VGML, etc.)
- Works for meal requests, wheelchair, extra baggage SSR
- Located at: `POST /api/flights/purchase-ancillary`

**What's missing:**

1. **Stateless Add Ancillary REST API**
   - Official endpoint: `POST /v1/offers/addAncillaries` (estimated)
   - Uses offer IDs from Get Ancillaries response
   - Attaches priced ancillary items to PNR with EMD-ready data
   - Better for paid ancillaries (baggage with specific pricing)

2. **EMD Issuance**
   - **AirTicketRQ v1.3.0** can issue both tickets AND EMDs in one call
   - **Fulfill Flight Tickets** REST API can issue multiple tickets + EMDs
   - Currently only ticket issuance is implemented, not EMD
   - EMD needed for: paid seat selection, extra baggage, lounge access, etc.

**Official Sabre Add Ancillary sample:**
```json
{
  "pnrLocator": "GCCVGK",
  "itinerary": { "id": "I-1", "itineraryPartReferenceIds": ["IP-1"] },
  "itineraryParts": [{ "id": "IP-1", "segmentReferenceIds": ["SEG-1"] }],
  "segments": [{
    "id": "SEG-1",
    "departureAirportCode": "DAC",
    "arrivalAirportCode": "DXB",
    "bookingAirlineCode": "BS",
    "bookingFlightNumber": "141",
    "sequence": 1
  }],
  "passengers": [{
    "id": "PAX-1",
    "nameNumber": "01.01",
    "givenName": "TEST MR",
    "surname": "SABRE",
    "typeCode": "ADT"
  }],
  "offers": [{
    "id": "offer-uuid",
    "items": [{
      "id": "offer-item-uuid",
      "segmentReferenceIds": ["SEG-1"],
      "passengerReferenceIds": ["PAX-1"],
      "details": {
        "type": "AncillaryOfferItem",
        "ancillaryReferenceId": "ancillary_2",
        "quantity": 1
      }
    }]
  }],
  "ancillaries": [{
    "id": "ancillary_2",
    "groupCode": "BG",
    "subCode": "0GO",
    "commercialName": "EXTRA CHECKED BAG 23KG",
    "airlineCode": "BS"
  }]
}
```

**Official Fulfill Flight Tickets (EMD issuance) sample:**
```json
{
  "confirmationId": "GCCVGK",
  "retainAccounting": false,
  "fulfillments": [{
    "ticketingQualifiers": {
      "priceWithTaxes": true,
      "priceQuoteRecordIds": ["1"],
      "isNetFareCommission": false
    },
    "payment": { "primaryFormOfPayment": 1 }
  }],
  "receivedFrom": "SEVEN TRIP API",
  "formsOfPayment": [{
    "type": "PAYMENTCARD",
    "cardTypeCode": "VI",
    "cardNumber": "4487971000000006",
    "expiryDate": "2025-07"
  }],
  "acceptPriceChanges": true
}
```

**Impact:** Medium — SSR-based ancillaries work for basic requests. EMD issuance needed for paid ancillaries to actually charge/confirm with airline.

---

### ✅ Section 19: Baggage Allowance — DONE

**What we have:**
- BFM search response includes `baggageAllowanceDescs` (grouped format) and `BaggageInformationList` (classic format)
- `normalizeGroupedResponse()` deep-dereferences `allowance.ref` → `baggageAllowanceDescs` lookup
- Handles both piece-based (`pieceCount`) and weight-based (`weight + unit`) formats
- Hand baggage detected via `provisionType: 'B'/'C'`
- Default 7KG hand baggage when not provided

**No additional implementation needed.** The BFM `AncillaryFees` block from the user's samples would only be needed if we wanted to request baggage-specific ancillary pricing during search (not currently required).

---

### ❌ Section 20: Structured Fare Rules — NOT IMPLEMENTED

**What's needed:**
- SOAP API: `StructureFareRulesRQ v3.0.1`
- Returns: exchange penalties, refund penalties, no-show fees, min/max stay, advance purchase
- Requires: fare basis code, flight segments, passenger type, booking date

**Use case:** Show detailed fare rules on booking confirmation page and in fare comparison UI. Currently we only show basic `refundable: true/false` and penalty amounts from BFM `penaltyInformation`.

**Official Sabre sample request:**
```xml
<StructureFareRulesRQ xmlns="http://webservices.sabre.com/sabreXML/2003/07" Version="3.0.1">
  <PriceRequestInformation BuyingDate="2026-03-14T17:00:00">
    <PassengerTypes>
      <PassengerType Code="ADT" Count="1"/>
    </PassengerTypes>
    <ReturnFareComponentPenalties Ind="true"/>
  </PriceRequestInformation>
  <AirItinerary>
    <OriginDestinationOptions>
      <OriginDestinationOption>
        <FlightSegment ArrivalDate="2026-04-27T18:45:00" DepartureDate="2026-04-27T14:30:00"
          FlightNumber="141" RealReservationStatus="HK" ResBookDesigCode="Y"
          SegmentNumber="1" SegmentType="A">
          <DepartureAirport LocationCode="DAC"/>
          <ArrivalAirport LocationCode="DXB"/>
          <MarketingAirline Code="BS"/>
          <OperatingAirline Code="BS"/>
        </FlightSegment>
        <SegmentInformation SegmentNumber="1"/>
        <PaxTypeInformation FareBasisCode="YNA0A0TG" FareComponentNumber="1" PassengerType="ADT"/>
      </OriginDestinationOption>
    </OriginDestinationOptions>
  </AirItinerary>
</StructureFareRulesRQ>
```

**Impact:** Medium — Improves transparency for customers. Currently we have basic refundability from BFM penalties.

**Implementation plan:**
1. Add SOAP call in `sabre-soap.js` → `getStructuredFareRules(params)`
2. Add route `GET /api/flights/fare-rules?fareBasis=...&origin=...&destination=...&airlineCode=...`
3. Frontend: Show fare rules modal on flight results/booking pages

---

### ⚠️ Section 21: Branded Fares / Fare Families — PARTIAL

**What we have:**
- BFM v5 search returns brand data: `brandName`, `brandCode` from `fareComponentDescs`
- `normalizeGroupedResponse()` extracts brand names and codes
- `fareDetails[]` array includes `brandName`, `brandCode` per pricing option
- Multiple pricing options per itinerary are preserved as `fareDetails[]`

**What's missing:**
- Dedicated `BargainFinderMax_BFRQ` call for explicit brand comparison
- Brand feature descriptions (WiFi, lounge, priority boarding, etc.)
- Brand tier comparison UI

**Impact:** Low — Current BFM already returns brand data. Dedicated BFRQ would give richer brand feature descriptions but is not required for core functionality.

---

### ❌ Section 22: Exchange / Reissue — NOT IMPLEMENTED

**What's needed:**
- SOAP API: `ExchangeBookingRQ v1.1.0`
- Flow: Cancel old segments → Book new segments → Price comparison → End transaction
- Supports: automatic exchange pricing, acceptable price increase/decrease tolerance
- Requires: original ticket number, new flight segments

**Use case:** Allow customers to change flights after booking without full cancel + rebook.

**Official Sabre sample request:**
```xml
<ExchangeBookingRQ xmlns="http://services.sabre.com/sp/exchange/booking/v1_1" version="1.1.0">
  <Itinerary id="GCCVGK">
    <SegmentPricing>
      <SegmentSelect number="1"/>
    </SegmentPricing>
  </Itinerary>
  <Cancel>
    <Segment Number="1"/>
  </Cancel>
  <AirBook>
    <HaltOnStatus Code="HL"/>
    <HaltOnStatus Code="NN"/>
    <OriginDestinationInformation>
      <FlightSegment DepartureDateTime="2026-05-01T14:30:00" ArrivalDateTime="2026-05-01T18:45:00"
        FlightNumber="143" NumberInParty="1" ResBookDesigCode="Y" Status="NN">
        <DestinationLocation LocationCode="DXB"/>
        <MarketingAirline Code="BS" FlightNumber="143"/>
        <OriginLocation LocationCode="DAC"/>
      </FlightSegment>
    </OriginDestinationInformation>
  </AirBook>
  <AutomatedExchanges>
    <ExchangeComparison OriginalTicketNumber="9972401234567">
      <PriceRequestInformation>
        <OptionalQualifiers>
          <PricingQualifiers>
            <NameSelect NameNumber="1.1"/>
          </PricingQualifiers>
        </OptionalQualifiers>
      </PriceRequestInformation>
    </ExchangeComparison>
    <PriceComparison amountSpecified="0">
      <AcceptablePriceIncrease haltOnNonAcceptablePrice="false">
        <Percent>10</Percent>
      </AcceptablePriceIncrease>
    </PriceComparison>
  </AutomatedExchanges>
  <PostProcessing returnPQRInfo="true">
    <EndTransaction>
      <Source ReceivedFrom="SEVEN TRIP EXCHANGE"/>
    </EndTransaction>
  </PostProcessing>
</ExchangeBookingRQ>
```

**Impact:** HIGH — Essential for date-change feature. Currently customers must cancel and rebook (losing fare protection).

**Implementation plan:**
1. Add SOAP call in `sabre-soap.js` → `exchangeBooking(params)`
2. Add route `POST /api/flights/exchange`
3. Frontend: "Change Flight" button on booking detail page
4. Requires: original ticket number from `checkTicketStatus`

---

### ❌ Section 23: Refund — NOT IMPLEMENTED

**What's needed:**
- REST API: **Stateless Refunds API** (`POST /v1/offers/refund/price` + `POST /v1/offers/refund/fulfill`)
- Two-step process: Price refund → Fulfill refund
- Supports: cancel fee override, multiple documents, credit card refund

**Use case:** Process ticket refunds through GDS instead of manual airline contact.

**Official Sabre Refund Pricing sample:**
```json
{
  "pnrLocator": "GCCVGK",
  "clientContext": {
    "pseudoCityCode": "J4YL",
    "stationNumber": "31000104",
    "accountingCity": "J4YL"
  },
  "passengers": [{
    "id": "PAX-1",
    "nameNumber": "01.01",
    "givenName": "TEST MR",
    "surname": "SABRE",
    "typeCode": "ADT"
  }],
  "refundDocuments": [{
    "passengerReferenceId": "PAX-1",
    "document": {
      "number": "9972401234567",
      "isFlightDocument": true
    }
  }]
}
```

**Official Sabre Refund Fulfill sample:**
```json
{
  "pnrLocator": "GCCVGK",
  "clientContext": {
    "pseudoCityCode": "J4YL",
    "stationNumber": "31000104",
    "accountingCity": "J4YL"
  },
  "passengers": [{
    "id": "PAX-1",
    "nameNumber": "01.01",
    "givenName": "TEST MR",
    "surname": "SABRE",
    "typeCode": "ADT"
  }],
  "formsOfRefund": [{
    "id": "FOR-1",
    "type": "CreditCard",
    "cardCode": "VI",
    "cardNumber": "XXXXXXXXXXXX1111"
  }],
  "refundDocuments": [{
    "passengerReferenceId": "PAX-1",
    "document": { "number": "9972401234567" },
    "refunds": [{
      "amount": { "amount": { "amount": "45000", "currencyCode": "BDT" } },
      "formOfRefundReferenceId": "FOR-1"
    }]
  }],
  "cancelItinerary": true
}
```

**Impact:** HIGH — Essential for customer refund processing. Currently refunds are manual.

**Implementation plan:**
1. Add `refundPrice()` and `refundFulfill()` in `sabre-flights.js`
2. Add route `POST /api/flights/refund/price` and `POST /api/flights/refund/fulfill`
3. Admin panel: "Process Refund" button on booking detail
4. Dashboard: Refund status tracking

---

### ❌ Section 24: Void — NOT IMPLEMENTED

**What's needed:**
- REST API: **Void Flight Tickets** (`POST /v1/trip/orders/voidFlightTickets`)
- Simpler than refund — voids ticket within airline void window (usually 24h)

**Use case:** Void same-day tickets when customer cancels within void window.

**Official Sabre Void samples:**

By ticket number:
```json
{ "tickets": ["9972401234567"] }
```

By booking:
```json
{ "confirmationId": "GCCVGK" }
```

**Impact:** HIGH — Void is much cheaper than refund. Most airlines allow void within 24 hours at no penalty.

**Implementation plan:**
1. Add `voidTickets()` in `sabre-flights.js`
2. Add route `POST /api/flights/void`
3. Auto-void logic: if cancel within 24h of ticketing, try void before refund
4. Admin panel: "Void Ticket" option

---

### ❌ Section 25: Flight Status (FLIFO) — NOT IMPLEMENTED

**What's needed:**
- REST API: `GET /products/air/flight/status` (query params, no body)
- Returns: scheduled, estimated, actual departure/arrival times, flight status

**Use case:** Real-time flight status tracking on booking detail page.

**Endpoints:**
```
GET /products/air/flight/status?departureDate=2026-04-27&airlineCode=BS&flightNumber=141
GET /products/air/flight/status?departureDate=2026-04-27&origin=DAC&destination=DXB
```

**Impact:** Medium — Nice-to-have for customer experience. Not critical for booking flow.

**Implementation plan:**
1. Add `getFlightStatus()` in `sabre-flights.js`
2. Add route `GET /api/flights/status?airlineCode=BS&flightNumber=141&date=2026-04-27`
3. Frontend: Flight status widget on booking detail page

---

### ⚠️ Section 26: Frequent Flyer Update — PARTIAL

**What we have:**
- FQTV SSR code supported in CreatePNR (section 14, SSR table)
- `ssrList` builder includes FF number during booking creation
- Format: `SSR_Code: 'FQTV'`, `Text: 'EK1234567890'`

**What's missing:**
- Post-booking FF update via `UpdatePassengerNameRecord`
- FF autoapplication after booking (Sabre handles this automatically for hosted carriers)
- Dashboard UI for adding/editing loyalty numbers after booking

**Impact:** Low — FQTV during booking works. Post-booking update is a minor UX improvement.

---

## Priority Implementation Order

### Phase 1 — Critical (Revenue Impact)
1. **Section 24: Void** — Saves money on same-day cancellations
2. **Section 23: Refund** — Automated refund processing
3. **Section 22: Exchange** — Date change without cancel+rebook

### Phase 2 — High Value (Customer Experience)
4. **Section 20: Fare Rules** — Transparency on penalties
5. **Section 25: FLIFO** — Real-time flight status

### Phase 3 — Enhancement
6. **Section 17: Stateless Ancillaries** — Better pre-booking ancillary shopping
7. **Section 18: EMD Issuance** — Paid ancillary confirmation
8. **Section 26: FF Update** — Post-booking loyalty number management
9. **Section 21: Branded Fares** — Dedicated brand comparison

---

## Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/routes/sabre-flights.js` | 2655 | REST API: search, booking, ticketing, cancel, seats, ancillary SSR |
| `backend/src/routes/sabre-soap.js` | 753 | SOAP API: session mgmt, seat maps, GAO, cancel |
| `backend/src/routes/flights.js` | 1612 | Unified flight routes: search, book, cancel |
| `backend/src/routes/ancillaries.js` | 444 | Ancillary/seat map endpoints |
| `SABRE_PAYLOADS.md` | 1018 | Working payload reference (sections 1–16) |

---

*Last updated: 2026-03-14 | v3.9.9.9*

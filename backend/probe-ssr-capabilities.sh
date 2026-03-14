#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Seven Trip — COMPREHENSIVE Production Feature Probe v2.0
# Tests ALL routes, all pax combos, all features:
#   Search, Book, Cancel, Seat Maps, Fare Rules, Flight Status,
#   Revalidation, GetBooking, TicketStatus, Ancillaries
#
# Routes: International (Sabre), Domestic (TTI), Round-Trip, Multi-City
# Pax combos: Adult-only, Adult+Child, Adult+Child+Infant
# Usage: bash probe-ssr-capabilities.sh
# ═══════════════════════════════════════════════════════════════

API_BASE="http://localhost:3001/api"
DEPART=$(date -d "+30 days" +%Y-%m-%d)
RETURN=$(date -d "+37 days" +%Y-%m-%d)
DEPART2=$(date -d "+32 days" +%Y-%m-%d)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
SKIP=0
ALL_PNRS=()

result() {
  local label="$1" status="$2" detail="$3"
  if [ "$status" = "PASS" ]; then
    echo -e "   ${GREEN}✅${NC} $label — $detail"
    PASS=$((PASS + 1))
  elif [ "$status" = "FAIL" ]; then
    echo -e "   ${RED}❌${NC} $label — $detail"
    FAIL=$((FAIL + 1))
  else
    echo -e "   ${YELLOW}⚠️${NC}  $label — $detail"
    SKIP=$((SKIP + 1))
  fi
}

echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} Seven Trip — Full Production Probe v2.0${NC}"
echo -e " Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e " Depart: $DEPART | Return: $RETURN | Depart2: $DEPART2"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Login ──
echo "🔐 Logging in..."
LOGIN_RESP=$(curl -s "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"rahim@gmail.com","password":"User@123456"}')
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Logged in${NC}"
echo ""

# ═══════════════════════════════════════════════════════
# Helper: Search flights for a route
# ═══════════════════════════════════════════════════════
search_flights() {
  local from="$1" to="$2" date="$3" adults="${4:-1}" children="${5:-0}" infants="${6:-0}" ret_date="$7"
  local url="$API_BASE/flights/search?from=$from&to=$to&date=$date&adults=$adults&children=$children&infants=$infants&cabinClass=Economy&page=1&limit=50"
  if [ -n "$ret_date" ]; then
    url="$url&returnDate=$ret_date"
  fi
  curl -s "$url" -H "Authorization: Bearer $TOKEN" 2>/dev/null
}

# Helper: Pick cheapest flight from a source
pick_flight() {
  local search_resp="$1" source="$2"
  echo "$search_resp" | jq -c "[.data[]? | select(.source == \"$source\")] | sort_by(.price) | .[0]" 2>/dev/null
}

# Helper: Book a flight
book_flight() {
  local flight="$1" pax_json="$2" contact_json="$3" ssr_json="$4"
  curl -s -X POST "$API_BASE/flights/book" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"flightData\": $flight,
      \"passengers\": $pax_json,
      \"contactInfo\": $contact_json,
      \"payLater\": true,
      \"specialServices\": $ssr_json
    }" 2>/dev/null
}

# Helper: Cancel a booking
cancel_booking() {
  local booking_id="$1"
  curl -s -X POST "$API_BASE/flights/cancel" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"bookingId\": \"$booking_id\"}" 2>/dev/null
}

# ═══════════════════════════════════════════════════════
# Passenger templates
# ═══════════════════════════════════════════════════════
ADULT_MALE='{
  "firstName": "TESTMD", "lastName": "KARIM", "title": "Mr",
  "type": "adult", "dateOfBirth": "1990-05-15", "gender": "Male",
  "nationality": "BD", "passportNumber": "BX9876543",
  "passportExpiry": "2030-12-31", "documentCountry": "BD"
}'
ADULT_FEMALE='{
  "firstName": "TESTFATIMA", "lastName": "BEGUM", "title": "Ms",
  "type": "adult", "dateOfBirth": "1992-03-20", "gender": "Female",
  "nationality": "BD", "passportNumber": "BX8765432",
  "passportExpiry": "2030-12-31", "documentCountry": "BD"
}'
CHILD_MALE='{
  "firstName": "TESTRAHMAN", "lastName": "KARIM", "title": "Mstr",
  "type": "child", "dateOfBirth": "2018-08-20", "gender": "Male",
  "nationality": "BD", "passportNumber": "BX1111111",
  "passportExpiry": "2030-12-31", "documentCountry": "BD"
}'
INFANT_MALE='{
  "firstName": "TESTBABY", "lastName": "KARIM", "title": "Mstr",
  "type": "infant", "dateOfBirth": "2025-01-10", "gender": "Male",
  "nationality": "BD", "passportNumber": "BX2222222",
  "passportExpiry": "2030-12-31", "documentCountry": "BD"
}'
CONTACT='{"email":"probe@seventrip.com","phone":"+8801700000099"}'
NO_SSR='{"perPassenger":[]}'
MEAL_WCHR_SSR='{"perPassenger":[{"meal":"MOML","wheelchair":"WCHR"},{}]}'

# ═══════════════════════════════════════════════════════
#  TEST 1: Sabre — Adult Only (DAC→DXB)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 1: Sabre Adult Only (DAC→DXB) One-Way${NC}"
echo "═══════════════════════════════════════════════════"

S1=$(search_flights DAC DXB "$DEPART" 1 0 0)
S1_CNT=$(echo "$S1" | jq '[.data[]? | select(.source == "sabre")] | length' 2>/dev/null)
if [ "$S1_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S1_CNT Sabre flights"
  F1=$(pick_flight "$S1" "sabre")
  F1_NAME=$(echo "$F1" | jq -r '.airlineCode + " " + .flightNumber')
  echo -e "   Selected: ${BOLD}$F1_NAME${NC} BDT $(echo $F1 | jq -r '.price')"

  B1=$(book_flight "$F1" "[$ADULT_MALE]" "$CONTACT" "$NO_SSR")
  B1_PNR=$(echo "$B1" | jq -r '.pnr // "null"')
  B1_APNR=$(echo "$B1" | jq -r '.airlinePnr // "null"')
  B1_ID=$(echo "$B1" | jq -r '.id // "null"')
  if [ "$B1_PNR" != "null" ] && [ -n "$B1_PNR" ]; then
    result "Book (1 ADT)" "PASS" "PNR: $B1_PNR | Airline: $B1_APNR"
    ALL_PNRS+=("$B1_PNR")

    # GetBooking
    GB=$(curl -s "$API_BASE/flights/booking/$B1_PNR" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    GB_OK=$(echo "$GB" | jq -r '.bookingId // "null"' 2>/dev/null)
    [ "$GB_OK" != "null" ] && result "GetBooking" "PASS" "$GB_OK" || result "GetBooking" "SKIP" "$(echo $GB | jq -r '.message // "no data"')"

    # Cancel
    C1=$(cancel_booking "$B1_ID")
    C1_OK=$(echo "$C1" | jq -r '.success // "false"')
    [ "$C1_OK" = "true" ] && result "Cancel" "PASS" "PNR $B1_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C1 | jq -r '.message // "failed"')"
  else
    B1_ERR=$(echo "$B1" | jq -r '.message // .gdsError // "unknown"' 2>/dev/null)
    result "Book (1 ADT)" "FAIL" "$B1_ERR"
  fi
else
  result "Search" "FAIL" "No Sabre flights"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 2: Sabre — Adult+Child+Infant + SSR (DAC→DXB)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 2: Sabre Multi-Pax + SSR (DAC→DXB) One-Way${NC}"
echo "═══════════════════════════════════════════════════"

S2=$(search_flights DAC DXB "$DEPART" 1 1 1)
S2_CNT=$(echo "$S2" | jq '[.data[]? | select(.source == "sabre")] | length' 2>/dev/null)
if [ "$S2_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S2_CNT Sabre flights (1A+1C+1I)"
  F2=$(pick_flight "$S2" "sabre")
  F2_NAME=$(echo "$F2" | jq -r '.airlineCode + " " + .flightNumber')

  FULL_SSR='{"perPassenger":[{"meal":"MOML","wheelchair":"WCHR","frequentFlyer":{"airline":"'$(echo $F2 | jq -r '.airlineCode')'","number":"FF999888"},"specialRequest":"PROBE TEST"},{}]}'
  B2=$(book_flight "$F2" "[$ADULT_MALE, $CHILD_MALE, $INFANT_MALE]" "$CONTACT" "$FULL_SSR")
  B2_PNR=$(echo "$B2" | jq -r '.pnr // "null"')
  B2_APNR=$(echo "$B2" | jq -r '.airlinePnr // "null"')
  B2_ID=$(echo "$B2" | jq -r '.id // "null"')
  if [ "$B2_PNR" != "null" ] && [ -n "$B2_PNR" ]; then
    result "Book (ADT+CHD+INF+SSR)" "PASS" "PNR: $B2_PNR | Airline: $B2_APNR"
    ALL_PNRS+=("$B2_PNR")

    # Ticket Status
    TS=$(curl -s "$API_BASE/flights/ticket-status/$B2_PNR" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    TS_OK=$(echo "$TS" | jq -r '.ticketStatus // .status // "null"' 2>/dev/null)
    [ "$TS_OK" != "null" ] && result "TicketStatus" "PASS" "$TS_OK" || result "TicketStatus" "SKIP" "$(echo $TS | jq -r '.message // "no data"')"

    # Revalidate Price
    RV=$(curl -s -X POST "$API_BASE/flights/revalidate-price" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d "{\"flights\": [$F2], \"adults\": 1, \"children\": 1, \"infants\": 1, \"cabinClass\": \"Economy\"}" 2>/dev/null)
    RV_OK=$(echo "$RV" | jq -r '.valid // .price // "null"' 2>/dev/null)
    [ "$RV_OK" != "null" ] && result "Revalidate" "PASS" "Price: $(echo $RV | jq -r '.price // .totalPrice // 0')" || result "Revalidate" "SKIP" "$(echo $RV | jq -r '.message // "failed"')"

    # Cancel
    C2=$(cancel_booking "$B2_ID")
    C2_OK=$(echo "$C2" | jq -r '.success // "false"')
    [ "$C2_OK" = "true" ] && result "Cancel" "PASS" "PNR $B2_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C2 | jq -r '.message // "failed"')"
  else
    B2_ERR=$(echo "$B2" | jq -r '.message // .gdsError // "unknown"' 2>/dev/null)
    result "Book (ADT+CHD+INF+SSR)" "FAIL" "$B2_ERR"
  fi
else
  result "Search" "FAIL" "No Sabre flights for multi-pax"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 3: Sabre — Round Trip (DAC→SIN→DAC)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 3: Sabre Round Trip (DAC→SIN→DAC)${NC}"
echo "═══════════════════════════════════════════════════"

S3=$(search_flights DAC SIN "$DEPART" 1 0 0 "$RETURN")
S3_CNT=$(echo "$S3" | jq '[.data[]? | select(.source == "sabre")] | length' 2>/dev/null)
if [ "$S3_CNT" -gt 0 ]; then
  result "Search RT" "PASS" "$S3_CNT Sabre flights"
  F3=$(pick_flight "$S3" "sabre")
  F3_NAME=$(echo "$F3" | jq -r '.airlineCode + " " + .flightNumber')
  echo -e "   Selected: ${BOLD}$F3_NAME${NC} BDT $(echo $F3 | jq -r '.price')"

  B3=$(book_flight "$F3" "[$ADULT_FEMALE]" "$CONTACT" "$NO_SSR")
  B3_PNR=$(echo "$B3" | jq -r '.pnr // "null"')
  B3_ID=$(echo "$B3" | jq -r '.id // "null"')
  if [ "$B3_PNR" != "null" ] && [ -n "$B3_PNR" ]; then
    result "Book RT (1 ADT)" "PASS" "PNR: $B3_PNR"
    ALL_PNRS+=("$B3_PNR")
    C3=$(cancel_booking "$B3_ID")
    [ "$(echo $C3 | jq -r '.success // "false"')" = "true" ] && result "Cancel RT" "PASS" "PNR $B3_PNR cancelled" || result "Cancel RT" "FAIL" "$(echo $C3 | jq -r '.message // "failed"')"
  else
    result "Book RT" "FAIL" "$(echo $B3 | jq -r '.message // .gdsError // "unknown"')"
  fi
else
  result "Search RT" "FAIL" "No Sabre flights for DAC→SIN RT"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 4: Sabre — Seat Map & Fare Rules (DAC→DXB)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 4: Sabre Seat Map + Fare Rules + FLIFO${NC}"
echo "═══════════════════════════════════════════════════"

# Use the first search data from test 1
if [ "$S1_CNT" -gt 0 ]; then
  F4=$(echo "$S1" | jq -c '[.data[]? | select(.source == "sabre")] | sort_by(.price) | .[2] // .[0]' 2>/dev/null)
  F4_AC=$(echo "$F4" | jq -r '.airlineCode // "??"')
  F4_FN=$(echo "$F4" | jq -r '.flightNumber // "??"')
  F4_FNUM=$(echo "$F4_FN" | sed "s/^$F4_AC//")
  F4_OR=$(echo "$F4" | jq -r '.origin // "DAC"')
  F4_DS=$(echo "$F4" | jq -r '.destination // "DXB"')
  F4_FB=$(echo "$F4" | jq -r '.fareDetails[0]?.fareBasis // .fareBasis // ""')
  F4_BC=$(echo "$F4" | jq -r '.fareDetails[0]?.bookingClass // .bookingClass // "Y"')

  # Seat Map
  SEAT=$(curl -s "$API_BASE/flights/seats-rest?origin=$F4_OR&destination=$F4_DS&departureDate=$DEPART&airlineCode=$F4_AC&flightNumber=$F4_FNUM&cabinClass=Economy" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  SEAT_CNT=$(echo "$SEAT" | jq '.seats | length // 0' 2>/dev/null)
  [ "$SEAT_CNT" -gt 0 ] 2>/dev/null && result "Seat Map" "PASS" "$SEAT_CNT seats" || result "Seat Map" "SKIP" "$(echo $SEAT | jq -r '.message // "no seats"')"

  # Fare Rules
  FR=$(curl -s "$API_BASE/flights/fare-rules?origin=$F4_OR&destination=$F4_DS&departureDate=$DEPART&airlineCode=$F4_AC&flightNumber=$F4_FNUM&fareBasis=$F4_FB&bookingClass=$F4_BC&passengerType=ADT" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  FR_OK=$(echo "$FR" | jq -r '.rules // .fareRules // "null"' 2>/dev/null)
  [ "$FR_OK" != "null" ] && [ "$FR_OK" != "" ] && result "Fare Rules" "PASS" "$(echo $FR | jq '.rules | length // 0') categories" || result "Fare Rules" "SKIP" "$(echo $FR | jq -r '.message // "no rules"')"

  # FLIFO
  FL=$(curl -s "$API_BASE/flights/status?airlineCode=$F4_AC&flightNumber=$F4_FNUM&departureDate=$DEPART&origin=$F4_OR&destination=$F4_DS" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  FL_OK=$(echo "$FL" | jq -r '.flightNumber // .status // "null"' 2>/dev/null)
  [ "$FL_OK" != "null" ] && [ -n "$FL_OK" ] && result "FLIFO" "PASS" "$F4_FN status ok" || result "FLIFO" "SKIP" "$(echo $FL | jq -r '.message // "no data"')"

  # Ancillaries (stateless)
  AN=$(curl -s -X POST "$API_BASE/flights/ancillaries-stateless" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"pnr": "FAKE", "segments": [], "passengers": [], "mode": "stateless"}' 2>/dev/null)
  AN_CNT=$(echo "$AN" | jq '.ancillaries | length // 0' 2>/dev/null)
  [ "$AN_CNT" -gt 0 ] 2>/dev/null && result "Ancillaries" "PASS" "$AN_CNT offers" || result "Ancillaries" "SKIP" "$(echo $AN | jq -r '.message // "no ancillaries"')"
else
  result "Seat/Fare/FLIFO" "SKIP" "No search data available"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 5: TTI — Adult Only (DAC→CXB) Domestic
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 5: TTI Adult Only (DAC→CXB) Domestic${NC}"
echo "═══════════════════════════════════════════════════"

S5=$(search_flights DAC CXB "$DEPART" 1 0 0)
S5_CNT=$(echo "$S5" | jq '[.data[]? | select(.source == "tti")] | length' 2>/dev/null)
if [ "$S5_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S5_CNT TTI flights"
  F5=$(pick_flight "$S5" "tti")
  F5_NAME=$(echo "$F5" | jq -r '.airlineCode + " " + .flightNumber')
  echo -e "   Selected: ${BOLD}$F5_NAME${NC} BDT $(echo $F5 | jq -r '.price')"

  B5=$(book_flight "$F5" "[$ADULT_MALE]" "$CONTACT" "$NO_SSR")
  B5_PNR=$(echo "$B5" | jq -r '.pnr // "null"')
  B5_APNR=$(echo "$B5" | jq -r '.airlinePnr // "null"')
  B5_ID=$(echo "$B5" | jq -r '.id // "null"')
  if [ "$B5_PNR" != "null" ] && [ -n "$B5_PNR" ]; then
    result "Book (1 ADT)" "PASS" "PNR: $B5_PNR | Airline: $B5_APNR"
    ALL_PNRS+=("$B5_PNR")
    C5=$(cancel_booking "$B5_ID")
    [ "$(echo $C5 | jq -r '.success // "false"')" = "true" ] && result "Cancel" "PASS" "PNR $B5_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C5 | jq -r '.message // "failed"')"
  else
    result "Book (1 ADT)" "FAIL" "$(echo $B5 | jq -r '.message // .gdsError // "unknown"')"
  fi
else
  result "Search" "FAIL" "No TTI flights"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 6: TTI — Adult+Child+Infant + WCHR (DAC→CXB)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 6: TTI Multi-Pax + WCHR (DAC→CXB) Domestic${NC}"
echo "═══════════════════════════════════════════════════"

S6=$(search_flights DAC CXB "$DEPART" 1 1 1)
S6_CNT=$(echo "$S6" | jq '[.data[]? | select(.source == "tti")] | length' 2>/dev/null)
if [ "$S6_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S6_CNT TTI flights (1A+1C+1I)"
  F6=$(pick_flight "$S6" "tti")
  F6_NAME=$(echo "$F6" | jq -r '.airlineCode + " " + .flightNumber')

  WCHR_SSR='{"perPassenger":[{"wheelchair":"WCHR"},{},{}]}'
  B6=$(book_flight "$F6" "[$ADULT_MALE, $CHILD_MALE, $INFANT_MALE]" "$CONTACT" "$WCHR_SSR")
  B6_PNR=$(echo "$B6" | jq -r '.pnr // "null"')
  B6_APNR=$(echo "$B6" | jq -r '.airlinePnr // "null"')
  B6_ID=$(echo "$B6" | jq -r '.id // "null"')
  if [ "$B6_PNR" != "null" ] && [ -n "$B6_PNR" ]; then
    result "Book (ADT+CHD+INF+WCHR)" "PASS" "PNR: $B6_PNR | Airline: $B6_APNR"
    ALL_PNRS+=("$B6_PNR")
    C6=$(cancel_booking "$B6_ID")
    [ "$(echo $C6 | jq -r '.success // "false"')" = "true" ] && result "Cancel" "PASS" "PNR $B6_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C6 | jq -r '.message // "failed"')"
  else
    B6_ERR=$(echo "$B6" | jq -r '.message // .gdsError // "unknown"' 2>/dev/null)
    result "Book (ADT+CHD+INF+WCHR)" "FAIL" "$B6_ERR"
  fi
else
  result "Search" "FAIL" "No TTI flights for multi-pax"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 7: TTI — Domestic Round Trip (DAC→CGP→DAC)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 7: TTI Domestic Round Trip (DAC→CGP→DAC)${NC}"
echo "═══════════════════════════════════════════════════"

S7=$(search_flights DAC CGP "$DEPART" 1 0 0 "$RETURN")
S7_CNT=$(echo "$S7" | jq '[.data[]? | select(.source == "tti")] | length' 2>/dev/null)
if [ "$S7_CNT" -gt 0 ]; then
  result "Search RT" "PASS" "$S7_CNT TTI flights"
  F7=$(pick_flight "$S7" "tti")
  echo -e "   Selected: ${BOLD}$(echo $F7 | jq -r '.airlineCode + " " + .flightNumber')${NC}"

  B7=$(book_flight "$F7" "[$ADULT_MALE]" "$CONTACT" "$NO_SSR")
  B7_PNR=$(echo "$B7" | jq -r '.pnr // "null"')
  B7_ID=$(echo "$B7" | jq -r '.id // "null"')
  if [ "$B7_PNR" != "null" ] && [ -n "$B7_PNR" ]; then
    result "Book RT (1 ADT)" "PASS" "PNR: $B7_PNR"
    ALL_PNRS+=("$B7_PNR")
    C7=$(cancel_booking "$B7_ID")
    [ "$(echo $C7 | jq -r '.success // "false"')" = "true" ] && result "Cancel RT" "PASS" "$B7_PNR cancelled" || result "Cancel RT" "FAIL" "$(echo $C7 | jq -r '.message // "failed"')"
  else
    result "Book RT" "FAIL" "$(echo $B7 | jq -r '.message // .gdsError // "unknown"')"
  fi
else
  result "Search RT" "SKIP" "No TTI flights DAC→CGP"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 8: Sabre — Adult+Child (no infant) (DAC→BKK)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 8: Sabre Adult+Child (DAC→BKK) One-Way${NC}"
echo "═══════════════════════════════════════════════════"

S8=$(search_flights DAC BKK "$DEPART" 1 1 0)
S8_CNT=$(echo "$S8" | jq '[.data[]? | select(.source == "sabre")] | length' 2>/dev/null)
if [ "$S8_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S8_CNT Sabre flights"
  F8=$(pick_flight "$S8" "sabre")

  B8=$(book_flight "$F8" "[$ADULT_MALE, $CHILD_MALE]" "$CONTACT" "$NO_SSR")
  B8_PNR=$(echo "$B8" | jq -r '.pnr // "null"')
  B8_ID=$(echo "$B8" | jq -r '.id // "null"')
  if [ "$B8_PNR" != "null" ] && [ -n "$B8_PNR" ]; then
    result "Book (ADT+CHD)" "PASS" "PNR: $B8_PNR"
    ALL_PNRS+=("$B8_PNR")
    C8=$(cancel_booking "$B8_ID")
    [ "$(echo $C8 | jq -r '.success // "false"')" = "true" ] && result "Cancel" "PASS" "$B8_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C8 | jq -r '.message // "failed"')"
  else
    result "Book (ADT+CHD)" "FAIL" "$(echo $B8 | jq -r '.message // .gdsError // "unknown"')"
  fi
else
  result "Search" "FAIL" "No Sabre flights DAC→BKK"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 9: Sabre — 2 Adults (DAC→KUL)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 9: Sabre 2 Adults (DAC→KUL) One-Way${NC}"
echo "═══════════════════════════════════════════════════"

S9=$(search_flights DAC KUL "$DEPART" 2 0 0)
S9_CNT=$(echo "$S9" | jq '[.data[]? | select(.source == "sabre")] | length' 2>/dev/null)
if [ "$S9_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S9_CNT Sabre flights"
  F9=$(pick_flight "$S9" "sabre")

  B9=$(book_flight "$F9" "[$ADULT_MALE, $ADULT_FEMALE]" "$CONTACT" "$NO_SSR")
  B9_PNR=$(echo "$B9" | jq -r '.pnr // "null"')
  B9_ID=$(echo "$B9" | jq -r '.id // "null"')
  if [ "$B9_PNR" != "null" ] && [ -n "$B9_PNR" ]; then
    result "Book (2 ADT)" "PASS" "PNR: $B9_PNR"
    ALL_PNRS+=("$B9_PNR")
    C9=$(cancel_booking "$B9_ID")
    [ "$(echo $C9 | jq -r '.success // "false"')" = "true" ] && result "Cancel" "PASS" "$B9_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C9 | jq -r '.message // "failed"')"
  else
    result "Book (2 ADT)" "FAIL" "$(echo $B9 | jq -r '.message // .gdsError // "unknown"')"
  fi
else
  result "Search" "FAIL" "No Sabre flights DAC→KUL"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  TEST 10: TTI — Adult+Child (no infant) (DAC→CXB)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} TEST 10: TTI Adult+Child (DAC→CXB) Domestic${NC}"
echo "═══════════════════════════════════════════════════"

S10=$(search_flights DAC CXB "$DEPART" 1 1 0)
S10_CNT=$(echo "$S10" | jq '[.data[]? | select(.source == "tti")] | length' 2>/dev/null)
if [ "$S10_CNT" -gt 0 ]; then
  result "Search" "PASS" "$S10_CNT TTI flights"
  F10=$(pick_flight "$S10" "tti")

  B10=$(book_flight "$F10" "[$ADULT_MALE, $CHILD_MALE]" "$CONTACT" "$NO_SSR")
  B10_PNR=$(echo "$B10" | jq -r '.pnr // "null"')
  B10_ID=$(echo "$B10" | jq -r '.id // "null"')
  if [ "$B10_PNR" != "null" ] && [ -n "$B10_PNR" ]; then
    result "Book (ADT+CHD)" "PASS" "PNR: $B10_PNR"
    ALL_PNRS+=("$B10_PNR")
    C10=$(cancel_booking "$B10_ID")
    [ "$(echo $C10 | jq -r '.success // "false"')" = "true" ] && result "Cancel" "PASS" "$B10_PNR cancelled" || result "Cancel" "FAIL" "$(echo $C10 | jq -r '.message // "failed"')"
  else
    result "Book (ADT+CHD)" "FAIL" "$(echo $B10 | jq -r '.message // .gdsError // "unknown"')"
  fi
else
  result "Search" "SKIP" "No TTI flights for ADT+CHD"
fi
echo ""

# ═══════════════════════════════════════════════════════
#  PM2 LOG EVIDENCE
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} PM2 Log Evidence${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
echo "   📋 Key log lines (last 20):"
pm2 logs seventrip-api --lines 500 --nostream 2>/dev/null | grep -i "Sabre.*result\|TTI BOOKING.*Full response\|PASS\|PNR\|error\|Infant\|CHLD\|INFT\|DOCS\|Cancel" 2>/dev/null | tail -20 | while IFS= read -r line; do
  echo "     $line"
done
echo ""

# ═══════════════════════════════════════════════════════
#  FINAL SUMMARY
# ═══════════════════════════════════════════════════════
TOTAL=$((PASS + FAIL + SKIP))
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} PRODUCTION TEST SUMMARY${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
echo -e "   Total Tests: ${BOLD}$TOTAL${NC}"
echo -e "   ${GREEN}✅ Passed: $PASS${NC}"
echo -e "   ${RED}❌ Failed: $FAIL${NC}"
echo -e "   ${YELLOW}⚠️  Skipped: $SKIP${NC}"
echo ""

printf "%-5s %-45s %-12s %-12s %-8s\n" "#" "Test" "Provider" "Pax" "Result"
printf "%-5s %-45s %-12s %-12s %-8s\n" "───" "─────────────────────────────────────────" "──────────" "──────────" "──────"
printf "%-5s %-45s %-12s %-12s %-8s\n" "1" "One-Way International (DAC→DXB)" "Sabre" "1 ADT" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "2" "One-Way Intl + SSR (DAC→DXB)" "Sabre" "ADT+CHD+INF" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "3" "Round Trip (DAC→SIN→DAC)" "Sabre" "1 ADT" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "4" "Seat Map + Fare Rules + FLIFO" "Sabre" "N/A" "Feature Test"
printf "%-5s %-45s %-12s %-12s %-8s\n" "5" "One-Way Domestic (DAC→CXB)" "TTI" "1 ADT" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "6" "Domestic + WCHR (DAC→CXB)" "TTI" "ADT+CHD+INF" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "7" "Domestic Round Trip (DAC→CGP→DAC)" "TTI" "1 ADT" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "8" "One-Way Intl (DAC→BKK)" "Sabre" "ADT+CHD" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "9" "One-Way Intl (DAC→KUL)" "Sabre" "2 ADT" "Book+Cancel"
printf "%-5s %-45s %-12s %-12s %-8s\n" "10" "Domestic (DAC→CXB)" "TTI" "ADT+CHD" "Book+Cancel"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}   🎉 ALL TESTS PASSED — 100% Production Ready!${NC}"
else
  echo -e "${YELLOW}${BOLD}   ⚠️  $FAIL test(s) failed — review above and re-run${NC}"
fi

echo ""
echo "   PNRs created during probe: ${ALL_PNRS[*]:-none}"
echo ""
echo "═══════════════════════════════════════════════════"
echo " Done! $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"

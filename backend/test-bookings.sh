#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Seven Trip — Comprehensive 30-Route Booking Test Suite
# SEARCHES REAL FLIGHTS FIRST, then books with actual GDS data
# Usage: bash backend/test-bookings.sh
# ═══════════════════════════════════════════════════════════════════

BASE="https://seven-trip.com/api"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
PASS=0; FAIL=0; TOTAL=0; SKIP=0
ALL_PNRS=()

echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SEVEN TRIP — 30-ROUTE BOOKING TEST SUITE (LIVE SEARCH)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}\n"

# ─── Login ───
echo -e "${CYAN}[AUTH] Logging in as rahim@gmail.com ...${NC}"
LOGIN=$(curl -s "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"rahim@gmail.com","password":"User@123456"}')
TOKEN=$(echo "$LOGIN" | jq -r '.accessToken // empty')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Login failed:${NC} $LOGIN"
  exit 1
fi
echo -e "${GREEN}✓ Login OK${NC}\n"

# ─── Passenger Templates ───
PAX_ADULT1='{"title":"Ms","firstName":"MST RAFIZA","lastName":"MOSTOFA","dob":"2003-03-26","gender":"Female","nationality":"Bangladeshi","passport":"A13888697","passportExpiry":"2029-03-10","documentCountry":"BD","email":"rahim@gmail.com","phone":"01724597352","type":"adult","dateOfBirth":"2003-03-26","passportNumber":"A13888697","passportCountry":"BD"}'
PAX_ADULT2='{"title":"Mr","firstName":"MD GOLAM","lastName":"MOSTOFA","dob":"1975-06-15","gender":"Male","nationality":"Bangladeshi","passport":"B98765432","passportExpiry":"2030-01-20","documentCountry":"BD","email":"rahim@gmail.com","phone":"01724597352","type":"adult","dateOfBirth":"1975-06-15","passportNumber":"B98765432","passportCountry":"BD"}'
PAX_CHILD='{"title":"Master","firstName":"AHMED","lastName":"MOSTOFA","dob":"2018-09-10","gender":"Male","nationality":"Bangladeshi","passport":"C11223344","passportExpiry":"2031-05-15","documentCountry":"BD","email":"","phone":"","type":"child","dateOfBirth":"2018-09-10","passportNumber":"C11223344","passportCountry":"BD"}'
PAX_INFANT='{"title":"Ms","firstName":"BABY","lastName":"MOSTOFA","dob":"2024-08-15","gender":"Female","nationality":"Bangladeshi","passport":"D55667788","passportExpiry":"2034-08-15","documentCountry":"BD","email":"","phone":"","type":"infant","dateOfBirth":"2024-08-15","passportNumber":"D55667788","passportCountry":"BD"}'
CONTACT='{"email":"rahim@gmail.com","phone":"01724597352"}'

SSR1='{"perPassenger":[{"meal":"MOML","wheelchair":"none","frequentFlyer":{}}]}'
SSR2='{"perPassenger":[{"meal":"MOML","wheelchair":"none","frequentFlyer":{}},{"meal":"VGML","wheelchair":"none","frequentFlyer":{}}]}'
SSR3='{"perPassenger":[{"meal":"MOML","wheelchair":"none","frequentFlyer":{}},{"meal":"VGML","wheelchair":"none","frequentFlyer":{}},{"meal":"CHML","wheelchair":"none","frequentFlyer":{}}]}'
SSR4='{"perPassenger":[{"meal":"MOML","wheelchair":"none","frequentFlyer":{}},{"meal":"VGML","wheelchair":"none","frequentFlyer":{}},{"meal":"CHML","wheelchair":"none","frequentFlyer":{}},{"meal":"BBML","wheelchair":"none","frequentFlyer":{}}]}'

# Calculate dates: 30-45 days from now
DEPART_DATE=$(date -d "+33 days" +%Y-%m-%d 2>/dev/null || date -v+33d +%Y-%m-%d)
RETURN_DATE=$(date -d "+40 days" +%Y-%m-%d 2>/dev/null || date -v+40d +%Y-%m-%d)
DEPART_DATE2=$(date -d "+35 days" +%Y-%m-%d 2>/dev/null || date -v+35d +%Y-%m-%d)
RETURN_DATE2=$(date -d "+42 days" +%Y-%m-%d 2>/dev/null || date -v+42d +%Y-%m-%d)

echo -e "${CYAN}[DATES] Departure: $DEPART_DATE | Return: $RETURN_DATE${NC}\n"

# ─── Search helper: find real flight from API ───
search_flight() {
  local FROM=$1 TO=$2 DATE=$3 ADULTS=${4:-1} CHILDREN=${5:-0} INFANTS=${6:-0} PREFERRED_SOURCE=${7:-""} RETURN_DATE_PARAM=${8:-""}
  
  local URL="$BASE/flights/search?from=$FROM&to=$TO&date=$DATE&adults=$ADULTS&children=$CHILDREN&infants=$INFANTS&cabinClass=Economy&page=1&limit=5"
  if [ -n "$RETURN_DATE_PARAM" ]; then
    URL="${URL}&returnDate=$RETURN_DATE_PARAM"
  fi
  
  local SEARCH_RESULT
  SEARCH_RESULT=$(curl -s --max-time 60 "$URL" -H "Authorization: Bearer $TOKEN")
  
  local FLIGHT_COUNT
  FLIGHT_COUNT=$(echo "$SEARCH_RESULT" | jq -r '.total // 0' 2>/dev/null)
  
  if [ "$FLIGHT_COUNT" = "0" ] || [ -z "$FLIGHT_COUNT" ]; then
    echo ""
    return 1
  fi
  
  # Pick first flight matching preferred source, or first flight
  local FLIGHT
  if [ -n "$PREFERRED_SOURCE" ]; then
    FLIGHT=$(echo "$SEARCH_RESULT" | jq -c --arg src "$PREFERRED_SOURCE" '[.flights[] | select(.source == $src)] | first // empty' 2>/dev/null)
  fi
  if [ -z "$FLIGHT" ] || [ "$FLIGHT" = "null" ]; then
    FLIGHT=$(echo "$SEARCH_RESULT" | jq -c '.flights[0] // empty' 2>/dev/null)
  fi
  
  echo "$FLIGHT"
}

# ─── Book with real search data ───
search_and_book() {
  local TEST_NUM=$1
  local LABEL=$2
  local FROM=$3
  local TO=$4
  local PAX_JSON=$5
  local SSR_JSON=$6
  local IS_ROUND=$7
  local IS_DOMESTIC=${8:-false}
  local PREFERRED_SOURCE=${9:-"sabre"}
  local ADULTS=${10:-1}
  local CHILDREN=${11:-0}
  local INFANTS=${12:-0}
  
  TOTAL=$((TOTAL + 1))
  echo -e "\n${BOLD}── TEST $TEST_NUM: $LABEL ──${NC}"
  
  # Search for a real flight
  local RETURN_DATE_ARG=""
  if [ "$IS_ROUND" = "true" ]; then
    RETURN_DATE_ARG="$RETURN_DATE"
  fi
  
  echo -e "  ${CYAN}Searching $FROM→$TO on $DEPART_DATE...${NC}"
  local FLIGHT
  FLIGHT=$(search_flight "$FROM" "$TO" "$DEPART_DATE" "$ADULTS" "$CHILDREN" "$INFANTS" "$PREFERRED_SOURCE" "$RETURN_DATE_ARG")
  
  if [ -z "$FLIGHT" ] || [ "$FLIGHT" = "null" ]; then
    echo -e "  ${YELLOW}⊘ SKIPPED${NC} — No flights found for $FROM→$TO on $DEPART_DATE"
    SKIP=$((SKIP + 1))
    FAIL=$((FAIL + 1))
    return
  fi
  
  local SRC AIRLINE FLIGHT_NO BOOK_CLASS
  SRC=$(echo "$FLIGHT" | jq -r '.source // "unknown"')
  AIRLINE=$(echo "$FLIGHT" | jq -r '.airline // "Unknown"')
  FLIGHT_NO=$(echo "$FLIGHT" | jq -r '.flightNumber // "?"')
  BOOK_CLASS=$(echo "$FLIGHT" | jq -r '.bookingClass // "Y"')
  echo -e "  ${GREEN}Found:${NC} $AIRLINE $FLIGHT_NO ($SRC) class=$BOOK_CLASS"
  
  # For Sabre, ensure _sabreSource flag
  if [ "$SRC" = "sabre" ]; then
    FLIGHT=$(echo "$FLIGHT" | jq -c '. + {"_sabreSource": true}')
  fi
  
  # Build booking payload
  local PAYLOAD
  if [ "$IS_ROUND" = "true" ]; then
    # Search for return flight
    echo -e "  ${CYAN}Searching return $TO→$FROM on $RETURN_DATE...${NC}"
    local RET_FLIGHT
    RET_FLIGHT=$(search_flight "$TO" "$FROM" "$RETURN_DATE" "$ADULTS" "$CHILDREN" "$INFANTS" "$PREFERRED_SOURCE")
    
    if [ -z "$RET_FLIGHT" ] || [ "$RET_FLIGHT" = "null" ]; then
      echo -e "  ${YELLOW}⊘ SKIPPED${NC} — No return flights found for $TO→$FROM on $RETURN_DATE"
      SKIP=$((SKIP + 1))
      FAIL=$((FAIL + 1))
      return
    fi
    
    local RET_SRC RET_AIRLINE RET_FLIGHT_NO
    RET_SRC=$(echo "$RET_FLIGHT" | jq -r '.source // "unknown"')
    RET_AIRLINE=$(echo "$RET_FLIGHT" | jq -r '.airline // "Unknown"')
    RET_FLIGHT_NO=$(echo "$RET_FLIGHT" | jq -r '.flightNumber // "?"')
    echo -e "  ${GREEN}Return:${NC} $RET_AIRLINE $RET_FLIGHT_NO ($RET_SRC)"
    
    if [ "$RET_SRC" = "sabre" ]; then
      RET_FLIGHT=$(echo "$RET_FLIGHT" | jq -c '. + {"_sabreSource": true}')
    fi
    
    local TOTAL_PRICE
    TOTAL_PRICE=$(echo "$FLIGHT" | jq -r '.totalRoundTripPrice // .price // 50000')
    local BASE_FARE
    BASE_FARE=$(echo "$FLIGHT" | jq -r '.baseFare // 40000')
    local TAXES
    TAXES=$(echo "$FLIGHT" | jq -r '.taxes // 10000')
    
    PAYLOAD=$(jq -n \
      --argjson flightData "$FLIGHT" \
      --argjson returnFlightData "$RET_FLIGHT" \
      --argjson passengers "[$PAX_JSON]" \
      --argjson contactInfo "$CONTACT" \
      --argjson specialServices "$SSR_JSON" \
      --argjson totalAmount "$TOTAL_PRICE" \
      --argjson baseFare "$BASE_FARE" \
      --argjson taxes "$TAXES" \
      '{
        flightData: $flightData,
        returnFlightData: $returnFlightData,
        passengers: $passengers,
        contactInfo: $contactInfo,
        isRoundTrip: true,
        isDomestic: false,
        payLater: true,
        totalAmount: $totalAmount,
        baseFare: $baseFare,
        taxes: $taxes,
        serviceCharge: 0,
        specialServices: $specialServices
      }')
  else
    local TOTAL_PRICE
    TOTAL_PRICE=$(echo "$FLIGHT" | jq -r '.price // 50000')
    local BASE_FARE
    BASE_FARE=$(echo "$FLIGHT" | jq -r '.baseFare // 40000')
    local TAXES
    TAXES=$(echo "$FLIGHT" | jq -r '.taxes // 10000')
    
    PAYLOAD=$(jq -n \
      --argjson flightData "$FLIGHT" \
      --argjson passengers "[$PAX_JSON]" \
      --argjson contactInfo "$CONTACT" \
      --argjson specialServices "$SSR_JSON" \
      --argjson totalAmount "$TOTAL_PRICE" \
      --argjson baseFare "$BASE_FARE" \
      --argjson taxes "$TAXES" \
      --argjson isDomestic "$IS_DOMESTIC" \
      '{
        flightData: $flightData,
        passengers: $passengers,
        contactInfo: $contactInfo,
        isRoundTrip: false,
        isDomestic: $isDomestic,
        payLater: true,
        totalAmount: $totalAmount,
        baseFare: $baseFare,
        taxes: $taxes,
        serviceCharge: 0,
        specialServices: $specialServices
      }')
  fi
  
  # Book
  RESULT=$(curl -s -w "\n%{http_code}" --max-time 90 "$BASE/flights/book" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD")

  HTTP_CODE=$(echo "$RESULT" | tail -1)
  BODY=$(echo "$RESULT" | sed '$d')

  PNR=$(echo "$BODY" | jq -r '.pnr // "null"' 2>/dev/null)
  AIRLINE_PNR=$(echo "$BODY" | jq -r '.airlinePnr // "null"' 2>/dev/null)
  GDS_BOOKED=$(echo "$BODY" | jq -r '.gdsBooked // false' 2>/dev/null)
  GDS_ERROR=$(echo "$BODY" | jq -r '.gdsError // "none"' 2>/dev/null)
  BREF=$(echo "$BODY" | jq -r '.bookingRef // "?"' 2>/dev/null)
  STATUS=$(echo "$BODY" | jq -r '.status // "?"' 2>/dev/null)

  if [ "$GDS_BOOKED" = "true" ] && [ "$PNR" != "null" ] && [ "$PNR" != "" ]; then
    local APNR_DISPLAY="$AIRLINE_PNR"
    if [ "$AIRLINE_PNR" = "null" ] || [ "$AIRLINE_PNR" = "$PNR" ]; then
      APNR_DISPLAY="(same as GDS or pending ticketing)"
    fi
    echo -e "  ${GREEN}✓ SUCCESS${NC} | GDS PNR: ${GREEN}$PNR${NC} | Airline PNR: ${CYAN}$APNR_DISPLAY${NC} | Ref: $BREF | Status: $STATUS"
    PASS=$((PASS + 1))
    ALL_PNRS+=("$PNR")
  else
    echo -e "  ${RED}✗ FAILED${NC} | HTTP: $HTTP_CODE | Source: $SRC | Ref: $BREF"
    echo -e "    GDS Error: ${RED}$GDS_ERROR${NC}"
    FAIL=$((FAIL + 1))
  fi
}

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 1: ONE-WAY INTERNATIONAL (Sabre)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Test 1: DAC→DXB 1 adult
search_and_book 1 "ONE-WAY DAC→DXB (1 adult)" "DAC" "DXB" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 2: DAC→SIN 1 adult
search_and_book 2 "ONE-WAY DAC→SIN (1 adult)" "DAC" "SIN" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 3: DAC→BKK 2 adults
search_and_book 3 "ONE-WAY DAC→BKK (2 adults)" "DAC" "BKK" "$PAX_ADULT1,$PAX_ADULT2" "$SSR2" "false" "false" "sabre" 2 0 0

# Test 4: DAC→KUL 1 adult + 1 child
search_and_book 4 "ONE-WAY DAC→KUL (1 adult + 1 child)" "DAC" "KUL" "$PAX_ADULT1,$PAX_CHILD" "$SSR2" "false" "false" "sabre" 1 1 0

# Test 5: DAC→DOH 1 adult
search_and_book 5 "ONE-WAY DAC→DOH (1 adult)" "DAC" "DOH" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 6: DAC→IST 1 adult
search_and_book 6 "ONE-WAY DAC→IST (1 adult)" "DAC" "IST" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 7: DAC→CCU 1 adult
search_and_book 7 "ONE-WAY DAC→CCU (1 adult)" "DAC" "CCU" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 8: DAC→LHR 2 adults + 1 child
search_and_book 8 "ONE-WAY DAC→LHR (2 adults + 1 child)" "DAC" "LHR" "$PAX_ADULT1,$PAX_ADULT2,$PAX_CHILD" "$SSR3" "false" "false" "sabre" 2 1 0

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 2: ROUND-TRIP INTERNATIONAL (Sabre)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Test 9: DAC↔DXB 1 adult
search_and_book 9 "ROUND-TRIP DAC↔DXB (1 adult)" "DAC" "DXB" "$PAX_ADULT1" "$SSR1" "true" "false" "sabre" 1 0 0

# Test 10: DAC↔SIN 2 adults
search_and_book 10 "ROUND-TRIP DAC↔SIN (2 adults)" "DAC" "SIN" "$PAX_ADULT1,$PAX_ADULT2" "$SSR2" "true" "false" "sabre" 2 0 0

# Test 11: DAC↔BKK 1 adult + 1 child
search_and_book 11 "ROUND-TRIP DAC↔BKK (1 adult + 1 child)" "DAC" "BKK" "$PAX_ADULT1,$PAX_CHILD" "$SSR2" "true" "false" "sabre" 1 1 0

# Test 12: DAC↔DOH 2 adults + 1 child + 1 infant
search_and_book 12 "ROUND-TRIP DAC↔DOH (2a+1c+1i)" "DAC" "DOH" "$PAX_ADULT1,$PAX_ADULT2,$PAX_CHILD,$PAX_INFANT" "$SSR4" "true" "false" "sabre" 2 1 1

# Test 13: DAC↔IST 1 adult
search_and_book 13 "ROUND-TRIP DAC↔IST (1 adult)" "DAC" "IST" "$PAX_ADULT1" "$SSR1" "true" "false" "sabre" 1 0 0

# Test 14: DAC↔KUL 2 adults
search_and_book 14 "ROUND-TRIP DAC↔KUL (2 adults)" "DAC" "KUL" "$PAX_ADULT1,$PAX_ADULT2" "$SSR2" "true" "false" "sabre" 2 0 0

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 3: MULTI-CITY INTERNATIONAL (Sabre)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Multi-city: search leg by leg, book one-way with merged legs
# Test 15: DAC→DXB (uses standard one-way, multi-city too complex for bash search)
search_and_book 15 "ONE-WAY DAC→DXB leg2 (multi-city proxy)" "DAC" "DXB" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 16: DAC→BKK 2 adults (multi-city proxy)
search_and_book 16 "ONE-WAY DAC→BKK (multi-city proxy, 2a)" "DAC" "BKK" "$PAX_ADULT1,$PAX_ADULT2" "$SSR2" "false" "false" "sabre" 2 0 0

# Test 17: DAC→SIN 1 adult + 1 child
search_and_book 17 "ONE-WAY DAC→SIN (1a+1c)" "DAC" "SIN" "$PAX_ADULT1,$PAX_CHILD" "$SSR2" "false" "false" "sabre" 1 1 0

# Test 18: DAC→CCU 2 adults + 1 child
search_and_book 18 "ONE-WAY DAC→CCU (2a+1c)" "DAC" "CCU" "$PAX_ADULT1,$PAX_ADULT2,$PAX_CHILD" "$SSR3" "false" "false" "sabre" 2 1 0

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 4: DOMESTIC FLIGHTS (TTI / Air Astra)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Test 19: DAC→CXB 1 adult
search_and_book 19 "ONE-WAY DAC→CXB (Air Astra, 1 adult)" "DAC" "CXB" "$PAX_ADULT1" "$SSR1" "false" "true" "tti" 1 0 0

# Test 20: DAC↔CXB 2 adults (round-trip)
search_and_book 20 "ROUND-TRIP DAC↔CXB (Air Astra, 2 adults)" "DAC" "CXB" "$PAX_ADULT1,$PAX_ADULT2" "$SSR2" "true" "true" "tti" 2 0 0

# Test 21: DAC→CGP 1 adult + 1 child
search_and_book 21 "ONE-WAY DAC→CGP (Air Astra, 1a+1c)" "DAC" "CGP" "$PAX_ADULT1,$PAX_CHILD" "$SSR2" "false" "true" "tti" 1 1 0

# Test 22: DAC→ZYL 1 adult
search_and_book 22 "ONE-WAY DAC→ZYL (Air Astra, 1 adult)" "DAC" "ZYL" "$PAX_ADULT1" "$SSR1" "false" "true" "tti" 1 0 0

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 5: ADDITIONAL ROUTES & EDGE CASES${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Test 23: DAC→JED 1 adult
search_and_book 23 "ONE-WAY DAC→JED (1 adult)" "DAC" "JED" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 24: DAC→CMB 1 adult
search_and_book 24 "ONE-WAY DAC→CMB (1 adult)" "DAC" "CMB" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 25: DAC↔MCT 1 adult
search_and_book 25 "ROUND-TRIP DAC↔MCT (1 adult)" "DAC" "MCT" "$PAX_ADULT1" "$SSR1" "true" "false" "sabre" 1 0 0

# Test 26: DAC↔BAH 2 adults + 1 infant
search_and_book 26 "ROUND-TRIP DAC↔BAH (2a+1i)" "DAC" "BAH" "$PAX_ADULT1,$PAX_ADULT2,$PAX_INFANT" "$SSR3" "true" "false" "sabre" 2 0 1

# Test 27: DAC→DEL 1 adult
search_and_book 27 "ONE-WAY DAC→DEL (1 adult)" "DAC" "DEL" "$PAX_ADULT1" "$SSR1" "false" "false" "sabre" 1 0 0

# Test 28: DAC↔CGP 1 adult + 1 child + 1 infant (domestic round-trip)
search_and_book 28 "ROUND-TRIP DAC↔CGP (1a+1c+1i)" "DAC" "CGP" "$PAX_ADULT1,$PAX_CHILD,$PAX_INFANT" "$SSR3" "true" "true" "tti" 1 1 1

# Test 29: DAC→BKK 1 adult + 1 infant
search_and_book 29 "ONE-WAY DAC→BKK (1a+1i)" "DAC" "BKK" "$PAX_ADULT1,$PAX_INFANT" "$SSR2" "false" "false" "sabre" 1 0 1

# Test 30: DAC↔DOH 1 adult
search_and_book 30 "ROUND-TRIP DAC↔DOH (1 adult)" "DAC" "DOH" "$PAX_ADULT1" "$SSR1" "true" "false" "sabre" 1 0 0

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 6: SEAT MAP & ANCILLARIES${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

# Pre-booking seat map (use first PNR if available)
echo -e "\n${BOLD}── SEAT MAP: Pre-booking (SOAP) ──${NC}"
SEAT_RESULT=$(curl -s --max-time 30 "$BASE/flights/sabre-soap-diagnostic?flight=SQ447&airline=SQ&from=DAC&to=SIN&date=$DEPART_DATE" \
  -H "Authorization: Bearer $TOKEN")
SM_SOURCE=$(echo "$SEAT_RESULT" | jq -r '.seatMap.source // "none"' 2>/dev/null)
SM_ROWS=$(echo "$SEAT_RESULT" | jq -r '.seatMap.rows // 0' 2>/dev/null)
if [ "$SM_SOURCE" != "none" ] && [ "$SM_SOURCE" != "null" ]; then
  echo -e "  ${GREEN}✓${NC} | Source: $SM_SOURCE | Rows: $SM_ROWS"
else
  echo -e "  ${RED}✗ Seat Map FAILED${NC} | Source: $SM_SOURCE"
fi

# Post-booking seat map with first PNR
if [ ${#ALL_PNRS[@]} -gt 0 ]; then
  FIRST_PNR="${ALL_PNRS[0]}"
  echo -e "\n${BOLD}── SEAT MAP: Post-booking PNR $FIRST_PNR ──${NC}"
  SEAT_POST=$(curl -s --max-time 30 "$BASE/flights/seats-rest?pnr=$FIRST_PNR" \
    -H "Authorization: Bearer $TOKEN")
  SP_SOURCE=$(echo "$SEAT_POST" | jq -r '.source // "none"' 2>/dev/null)
  if [ "$SP_SOURCE" != "none" ] && [ "$SP_SOURCE" != "null" ]; then
    echo -e "  ${GREEN}✓${NC} | Source: $SP_SOURCE"
  else
    echo -e "  ${RED}✗ Post-booking seat map FAILED${NC}"
  fi
fi

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SECTION 7: PNR VERIFICATION (GetBooking)${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"

for PNR_CHECK in "${ALL_PNRS[@]}"; do
  echo -e "\n${BOLD}── GetBooking: $PNR_CHECK ──${NC}"
  GB_RESULT=$(curl -s --max-time 15 "$BASE/flights/booking/$PNR_CHECK" \
    -H "Authorization: Bearer $TOKEN")
  GB_SUCCESS=$(echo "$GB_RESULT" | jq -r '.success // false' 2>/dev/null)
  GB_FLIGHTS=$(echo "$GB_RESULT" | jq -r '.flights // 0' 2>/dev/null)
  GB_PAX=$(echo "$GB_RESULT" | jq -r '.passengers // 0' 2>/dev/null)
  echo -e "  Success: ${GB_SUCCESS} | Flights: $GB_FLIGHTS | Passengers: $GB_PAX"
done

# ═══════════════════════════════════════════════════════════
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}   FINAL SUMMARY${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Total Tests:  $TOTAL"
echo -e "  ${GREEN}Passed:       $PASS${NC}"
echo -e "  ${RED}Failed:       $FAIL${NC}"
echo -e "  ${YELLOW}Skipped:      $SKIP${NC} (no flights found on route)"
if [ $TOTAL -gt 0 ]; then
  RATE=$((PASS * 100 / TOTAL))
  echo -e "  Success Rate: ${RATE}%"
fi

echo ""
echo -e "  PNRs Created: ${#ALL_PNRS[@]}"
for P in "${ALL_PNRS[@]}"; do
  echo -e "    → $P"
done

echo ""
echo -e "PM2 logs for debugging:"
echo -e "  pm2 logs seventrip-api --lines 200 | grep -E 'CreatePNR|PNR created|REJECTED|CHECK FLIGHT|TTI BOOKING|InvalidData'"
echo -e "\n${BOLD}═══════════════════════════════════════════════════════════${NC}"

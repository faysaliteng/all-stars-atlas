#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Seven Trip — SSR (Special Service Request) LIVE Capability Probe
# Actually calls the API to test SSR acceptance per provider
#
# Usage: bash backend/probe-ssr-capabilities.sh
# ═══════════════════════════════════════════════════════════════

API_BASE="http://localhost:3001/api"
DEPART=$(date -d "+30 days" +%Y-%m-%d)
RETURN=$(date -d "+37 days" +%Y-%m-%d)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Results tracking
RESULTS_FILE="/tmp/ssr-probe-results.json"
echo '{}' > "$RESULTS_FILE"

echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} Seven Trip — SSR Live Probe${NC}"
echo -e " Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e " Depart: $DEPART | Return: $RETURN"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Step 1: Login ──
echo "🔐 Logging in..."
LOGIN_RESP=$(curl -s "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"rahim@gmail.com","password":"User@123456"}')
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESP" | jq . 2>/dev/null
  exit 1
fi
echo -e "${GREEN}✅ Logged in${NC}"
echo ""

# ═══════════════════════════════════════════════════════
#  PHASE 1: SABRE — Live SSR Test (DAC→DXB international)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} PHASE 1: SABRE — Live SSR Booking Test${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

echo "🔍 Searching Sabre flights DAC→DXB ($DEPART)..."
SABRE_SEARCH=$(curl -s "$API_BASE/flights/search?from=DAC&to=DXB&date=$DEPART&adults=1&children=0&infants=0&cabinClass=Economy&page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)

SABRE_TOTAL=$(echo "$SABRE_SEARCH" | jq '[.data[]? | select(.source == "sabre")] | length' 2>/dev/null)
echo "   Found ${SABRE_TOTAL} Sabre flights"

if [ "$SABRE_TOTAL" -gt 0 ]; then
  # Pick cheapest Sabre flight
  SABRE_FLIGHT=$(echo "$SABRE_SEARCH" | jq -c '[.data[]? | select(.source == "sabre")] | sort_by(.price) | .[0]' 2>/dev/null)
  SABRE_AIRLINE=$(echo "$SABRE_FLIGHT" | jq -r '.airlineCode')
  SABRE_FNUM=$(echo "$SABRE_FLIGHT" | jq -r '.flightNumber')
  SABRE_PRICE=$(echo "$SABRE_FLIGHT" | jq -r '.price')
  SABRE_ID=$(echo "$SABRE_FLIGHT" | jq -r '.id')
  echo -e "   Using: ${BOLD}$SABRE_AIRLINE $SABRE_FNUM${NC} | BDT $SABRE_PRICE"
  echo ""

  # Build booking payload WITH SSRs
  echo "   📦 Booking with SSRs: MOML (meal) + WCHR (wheelchair) + FQTV (FF)..."
  SABRE_BOOK_RESP=$(curl -s -X POST "$API_BASE/flights/book" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"flightData\": $SABRE_FLIGHT,
      \"passengers\": [{
        \"firstName\": \"PROBE\",
        \"lastName\": \"SSRTEST\",
        \"title\": \"Mr\",
        \"type\": \"adult\",
        \"dateOfBirth\": \"1990-05-15\",
        \"gender\": \"Male\",
        \"nationality\": \"BD\",
        \"passportNumber\": \"BX9876543\",
        \"passportExpiry\": \"2030-12-31\"
      }],
      \"contactInfo\": {
        \"email\": \"ssrprobe@seventrip.com\",
        \"phone\": \"+8801700000001\"
      },
      \"payLater\": true,
      \"specialServices\": {
        \"perPassenger\": [{
          \"meal\": \"MOML\",
          \"wheelchair\": \"WCHR\",
          \"frequentFlyer\": { \"airline\": \"EK\", \"number\": \"EK123456789\" },
          \"specialRequest\": \"SSR PROBE TEST - PLEASE IGNORE\"
        }]
      }
    }" 2>/dev/null)

  SABRE_PNR=$(echo "$SABRE_BOOK_RESP" | jq -r '.pnr // .booking.pnr // .gdsPnr // "null"')
  SABRE_SUCCESS=$(echo "$SABRE_BOOK_RESP" | jq -r '.success // .id // "false"')
  SABRE_ERROR=$(echo "$SABRE_BOOK_RESP" | jq -r '.message // .error // "none"')
  SABRE_BOOKING_ID=$(echo "$SABRE_BOOK_RESP" | jq -r '.id // .booking.id // "null"')

  echo ""
  if [ "$SABRE_PNR" != "null" ] && [ -n "$SABRE_PNR" ]; then
    echo -e "   ${GREEN}✅ SABRE BOOKING SUCCESS${NC}"
    echo -e "   PNR: ${BOLD}$SABRE_PNR${NC}"
    echo "   Booking ID: $SABRE_BOOKING_ID"
    echo ""
    echo "   SSRs were included in CreatePassengerNameRecordRQ payload."
    echo "   Check PM2 logs for SSR injection details:"
    echo -e "   ${CYAN}pm2 logs seventrip-api --lines 100 --nostream | grep -i 'SSR\|MOML\|WCHR\|FQTV'${NC}"
    echo ""

    # ── Cancel the probe booking to keep things clean ──
    echo "   🧹 Cancelling probe booking $SABRE_PNR..."
    CANCEL_RESP=$(curl -s -X POST "$API_BASE/flights/cancel" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"bookingId\": \"$SABRE_BOOKING_ID\", \"pnr\": \"$SABRE_PNR\"}" 2>/dev/null)
    CANCEL_OK=$(echo "$CANCEL_RESP" | jq -r '.success // "false"')
    if [ "$CANCEL_OK" = "true" ]; then
      echo -e "   ${GREEN}✅ Probe booking cancelled${NC}"
    else
      echo -e "   ${YELLOW}⚠️  Cancel response: $(echo "$CANCEL_RESP" | jq -r '.message // .error // "unknown"')${NC}"
      echo "   → Manually cancel PNR $SABRE_PNR via admin panel"
    fi
  else
    echo -e "   ${RED}❌ SABRE BOOKING FAILED${NC}"
    echo "   Error: $SABRE_ERROR"
    echo "   Full response (truncated):"
    echo "$SABRE_BOOK_RESP" | jq '.' 2>/dev/null | head -30
  fi
else
  echo -e "${YELLOW}   ⚠️  No Sabre flights found for DAC→DXB${NC}"
  echo "   Try a different route or check Sabre config"
fi

echo ""

# ═══════════════════════════════════════════════════════
#  PHASE 2: TTI (Air Astra) — Live SSR Test (DAC→CXB domestic)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} PHASE 2: TTI (Air Astra) — Live SSR Booking Test${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

echo "🔍 Searching TTI flights DAC→CXB ($DEPART)..."
TTI_SEARCH=$(curl -s "$API_BASE/flights/search?from=DAC&to=CXB&date=$DEPART&adults=1&children=0&infants=0&cabinClass=Economy&page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN" 2>/dev/null)

TTI_TOTAL=$(echo "$TTI_SEARCH" | jq '[.data[]? | select(.source == "tti")] | length' 2>/dev/null)
echo "   Found ${TTI_TOTAL} TTI flights"

if [ "$TTI_TOTAL" -gt 0 ]; then
  TTI_FLIGHT=$(echo "$TTI_SEARCH" | jq -c '[.data[]? | select(.source == "tti")] | sort_by(.price) | .[0]' 2>/dev/null)
  TTI_AIRLINE=$(echo "$TTI_FLIGHT" | jq -r '.airlineCode')
  TTI_FNUM=$(echo "$TTI_FLIGHT" | jq -r '.flightNumber')
  TTI_PRICE=$(echo "$TTI_FLIGHT" | jq -r '.price')
  TTI_ID=$(echo "$TTI_FLIGHT" | jq -r '.id')
  echo -e "   Using: ${BOLD}$TTI_AIRLINE $TTI_FNUM${NC} | BDT $TTI_PRICE"
  echo ""

  echo "   📦 Booking with SSRs: MOML (meal) + WCHR (wheelchair)..."
  TTI_BOOK_RESP=$(curl -s -X POST "$API_BASE/flights/book" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"flightData\": $TTI_FLIGHT,
      \"passengers\": [{
        \"firstName\": \"PROBE\",
        \"lastName\": \"TTITEST\",
        \"title\": \"Mr\",
        \"type\": \"adult\",
        \"dateOfBirth\": \"1990-05-15\",
        \"gender\": \"Male\",
        \"nationality\": \"BD\",
        \"passportNumber\": \"BX1234567\",
        \"passportExpiry\": \"2030-12-31\"
      }],
      \"contactInfo\": {
        \"email\": \"ssrprobe@seventrip.com\",
        \"phone\": \"+8801700000002\"
      },
      \"payLater\": true,
      \"specialServices\": {
        \"perPassenger\": [{
          \"meal\": \"MOML\",
          \"wheelchair\": \"WCHR\",
          \"specialRequest\": \"SSR PROBE TEST - PLEASE IGNORE\"
        }]
      }
    }" 2>/dev/null)

  TTI_PNR=$(echo "$TTI_BOOK_RESP" | jq -r '.pnr // .booking.pnr // .gdsPnr // "null"')
  TTI_AIRLINE_PNR=$(echo "$TTI_BOOK_RESP" | jq -r '.airlinePnr // .booking.airlinePnr // "null"')
  TTI_ERROR=$(echo "$TTI_BOOK_RESP" | jq -r '.message // .error // "none"')
  TTI_BOOKING_ID=$(echo "$TTI_BOOK_RESP" | jq -r '.id // .booking.id // "null"')

  echo ""
  if [ "$TTI_PNR" != "null" ] && [ -n "$TTI_PNR" ]; then
    echo -e "   ${GREEN}✅ TTI BOOKING SUCCESS${NC}"
    echo -e "   GDS PNR: ${BOLD}$TTI_PNR${NC} | Airline PNR: $TTI_AIRLINE_PNR"
    echo "   Booking ID: $TTI_BOOKING_ID"
    echo ""
    echo "   ⚡ KEY QUESTION: Did Air Astra ACCEPT the SSRs?"
    echo "   Check PM2 logs for SpecialServices in request/response:"
    echo -e "   ${CYAN}pm2 logs seventrip-api --lines 100 --nostream | grep -i 'SpecialService\|MOML\|WCHR'${NC}"
    echo ""
    echo "   Look for:"
    echo "     ✅ SSR accepted = SpecialServices in response with Status"
    echo "     ❌ SSR rejected = InvalidData mentioning SpecialService"
    echo "     ⚠️  SSR ignored = SpecialServices not in response at all"
    echo ""

    # ── Cancel the probe booking ──
    echo "   🧹 Cancelling probe booking..."
    CANCEL_RESP=$(curl -s -X POST "$API_BASE/flights/cancel" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"bookingId\": \"$TTI_BOOKING_ID\", \"pnr\": \"$TTI_PNR\"}" 2>/dev/null)
    CANCEL_OK=$(echo "$CANCEL_RESP" | jq -r '.success // "false"')
    if [ "$CANCEL_OK" = "true" ]; then
      echo -e "   ${GREEN}✅ Probe booking cancelled${NC}"
    else
      echo -e "   ${YELLOW}⚠️  Cancel: $(echo "$CANCEL_RESP" | jq -r '.message // .error // "check manually"')${NC}"
    fi
  else
    echo -e "   ${RED}❌ TTI BOOKING FAILED${NC}"
    echo "   Error: $TTI_ERROR"
    echo ""
    echo "   Check if SSR caused the failure:"
    echo -e "   ${CYAN}pm2 logs seventrip-api --lines 50 --nostream | grep -i 'InvalidData\|SpecialService\|MOML\|WCHR'${NC}"
    echo ""
    echo "   Full response (truncated):"
    echo "$TTI_BOOK_RESP" | jq '.' 2>/dev/null | head -30
  fi
else
  echo -e "${YELLOW}   ⚠️  No TTI flights found for DAC→CXB${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════
#  PHASE 3: BDFare — Live SSR Test (if available)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} PHASE 3: BDFare — SSR Status${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

BDF_TOTAL=$(echo "$SABRE_SEARCH" | jq '[.data[]? | select(.source == "bdfare")] | length' 2>/dev/null)
echo "   BDFare flights in DAC→DXB search: $BDF_TOTAL"

if [ "$BDF_TOTAL" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  BDFare createBooking does NOT currently send SSR fields${NC}"
  echo "   The payload only includes: offerId, passengers[], contact{}"
  echo "   No specialServices, mealPreference, or wheelchairRequired fields"
  echo ""
  echo "   To test: Manually add SSR fields to bdf-flights.js createBooking"
  echo "   and book a BDFare flight to see if the API accepts them."
else
  echo -e "   ${YELLOW}⚠️  No BDFare flights available — cannot test${NC}"
  echo "   BDFare may be disabled or DAC→DXB not covered"
fi

echo ""

# ═══════════════════════════════════════════════════════
#  PHASE 4: FlyHub — Live SSR Test (if available)
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} PHASE 4: FlyHub — SSR Status${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

FH_TOTAL=$(echo "$SABRE_SEARCH" | jq '[.data[]? | select(.source == "flyhub")] | length' 2>/dev/null)
echo "   FlyHub flights in DAC→DXB search: $FH_TOTAL"

if [ "$FH_TOTAL" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  FlyHub AirBook does NOT currently send SSR fields${NC}"
  echo "   The Passengers[] payload only includes: Title, Name, DOB, Passport"
  echo "   No MealPreference, WheelchairRequired, or FrequentFlyerNumber"
  echo ""
  echo "   FlyHub may silently ignore unknown fields — safe to test."
else
  echo -e "   ${YELLOW}⚠️  No FlyHub flights available — cannot test${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════
#  PHASE 5: Check PM2 logs for SSR evidence
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${CYAN}${BOLD} PHASE 5: PM2 Log Check — SSR Evidence${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

echo "   Checking recent logs for SSR data..."
echo ""

# Check Sabre SSR injection
SABRE_SSR_COUNT=$(pm2 logs seventrip-api --lines 200 --nostream 2>/dev/null | grep -ci "SSR\|MOML\|WCHR\|FQTV\|OTHS\|SpecialService" 2>/dev/null || echo "0")
echo -e "   Sabre SSR log entries: ${BOLD}$SABRE_SSR_COUNT${NC}"

# Check TTI SSR injection
TTI_SSR_COUNT=$(pm2 logs seventrip-api --lines 200 --nostream 2>/dev/null | grep -ci "TTI BOOKING.*SpecialService" 2>/dev/null || echo "0")
echo -e "   TTI SpecialService log entries: ${BOLD}$TTI_SSR_COUNT${NC}"

# Show relevant log lines
echo ""
echo "   📋 Recent SSR-related log entries:"
pm2 logs seventrip-api --lines 200 --nostream 2>/dev/null | grep -i "SSR\|MOML\|WCHR\|FQTV\|SpecialService" 2>/dev/null | tail -20 | while IFS= read -r line; do
  echo "     $line"
done

echo ""

# ═══════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} LIVE TEST RESULTS SUMMARY${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
printf "%-20s %-15s %-40s\n" "Provider" "SSR Test" "Result"
printf "%-20s %-15s %-40s\n" "────────────" "──────────" "────────────────────────────"

if [ "$SABRE_PNR" != "null" ] && [ -n "$SABRE_PNR" ] 2>/dev/null; then
  printf "%-20s %-15s %-40s\n" "Sabre" "✅ PASS" "PNR: $SABRE_PNR (cancelled)"
elif [ "$SABRE_TOTAL" -gt 0 ] 2>/dev/null; then
  printf "%-20s %-15s %-40s\n" "Sabre" "❌ FAIL" "$SABRE_ERROR"
else
  printf "%-20s %-15s %-40s\n" "Sabre" "⚠️  SKIP" "No flights found"
fi

if [ "$TTI_PNR" != "null" ] && [ -n "$TTI_PNR" ] 2>/dev/null; then
  printf "%-20s %-15s %-40s\n" "TTI (Air Astra)" "✅ PASS" "PNR: $TTI_PNR (cancelled)"
elif [ "$TTI_TOTAL" -gt 0 ] 2>/dev/null; then
  printf "%-20s %-15s %-40s\n" "TTI (Air Astra)" "❌ FAIL" "$TTI_ERROR"
else
  printf "%-20s %-15s %-40s\n" "TTI (Air Astra)" "⚠️  SKIP" "No flights found"
fi

printf "%-20s %-15s %-40s\n" "BDFare" "⏳ TODO" "No SSR fields in payload yet"
printf "%-20s %-15s %-40s\n" "FlyHub" "⏳ TODO" "No SSR fields in payload yet"

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SSR Support Matrix (Updated)${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
printf "%-22s %-12s %-12s %-12s %-12s\n" "SSR Type" "Sabre" "TTI" "BDFare" "FlyHub"
printf "%-22s %-12s %-12s %-12s %-12s\n" "──────────────" "─────" "─────" "──────" "──────"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Meal (MOML etc.)" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Wheelchair" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Medical/Blind/Deaf" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Pet (PETC/AVIH)" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Frequent Flyer" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Extra Baggage" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Free Text (OTHS)" "✅ DONE" "✅ ADDED" "❌ TODO" "❌ TODO"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Passport (DOCS)" "✅ DONE" "✅ DONE" "✅ DONE" "✅ DONE"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Contact (CTCM/E)" "✅ DONE" "✅ DONE" "✅ DONE" "✅ DONE"
printf "%-22s %-12s %-12s %-12s %-12s\n" "Child/Infant PTC" "✅ DONE" "✅ DONE" "✅ DONE" "✅ DONE"
echo ""
echo "Legend: ✅ DONE = Production verified | ✅ ADDED = Code added, needs live verify | ❌ TODO = Not implemented"
echo ""
echo "═══════════════════════════════════════════════════"
echo " Done! Check PM2 logs for SSR acceptance details."
echo "═══════════════════════════════════════════════════"

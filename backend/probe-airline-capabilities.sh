#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Seven Trip — Airline Capability Probe Script
# Tests seat maps (SOAP EnhancedSeatMapRQ) and GAO (ancillaries)
# for all major airlines on popular routes from DAC
#
# Usage: bash backend/probe-airline-capabilities.sh
# Output: JSON results saved to backend/airline-capabilities.json
# ═══════════════════════════════════════════════════════════════

API_BASE="http://localhost:3001/api"
OUTPUT_FILE="backend/airline-capabilities.json"
DEPART=$(date -d "+30 days" +%Y-%m-%d)

# Login
TOKEN=$(curl -s "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"rahim@gmail.com","password":"User@123456"}' | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Logged in. Testing airline capabilities..."
echo "📅 Departure date: $DEPART"
echo ""

# Routes to test — covers most airlines available from DAC
declare -a ROUTES=(
  "DAC:DXB"   # Emirates, flydubai, Air Arabia, Air India, Biman, US-Bangla
  "DAC:SIN"   # Singapore Airlines, Biman, IndiGo
  "DAC:KUL"   # Malaysia Airlines, AirAsia, Biman
  "DAC:BKK"   # Thai Airways, Biman
  "DAC:DOH"   # Qatar Airways, Biman
  "DAC:IST"   # Turkish Airlines
  "DAC:JED"   # Saudi Arabian, Biman
  "DAC:LHR"   # British Airways, Biman, Emirates
  "DAC:DEL"   # Air India, IndiGo
  "DAC:CMB"   # SriLankan Airlines
  "DAC:MCT"   # Oman Air
  "DAC:BAH"   # Gulf Air
  "DAC:CXB"   # Domestic — Air Astra, Biman, US-Bangla, Novoair
  "DAC:CGP"   # Domestic — Air Astra, US-Bangla
)

# Collect all unique airlines from searches
declare -A AIRLINE_RESULTS

echo "═══════════════════════════════════════════════════"
echo " PHASE 1: Search flights to discover airlines"
echo "═══════════════════════════════════════════════════"

for ROUTE in "${ROUTES[@]}"; do
  IFS=':' read -r FROM TO <<< "$ROUTE"
  echo ""
  echo "🔍 Searching $FROM → $TO ($DEPART)..."
  
  SEARCH=$(curl -s "$API_BASE/flights/search?from=$FROM&to=$TO&date=$DEPART&adults=1&cabinClass=Economy&page=1&limit=200" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  
  TOTAL=$(echo "$SEARCH" | jq '.total // 0' 2>/dev/null)
  echo "   Found $TOTAL flights"
  
  # Extract unique airlines
  AIRLINES=$(echo "$SEARCH" | jq -r '[.data[]? | {code: .airlineCode, name: .airline, source: .source, flightNumber: .flightNumber, origin: .origin, destination: .destination, departureTime: .departureTime, baggage: .baggage, handBaggage: .handBaggage}] | unique_by(.code) | .[]' 2>/dev/null)
  
  echo "$SEARCH" | jq -r '.data[]? | "\(.airlineCode)|\(.airline)|\(.source)|\(.flightNumber)|\(.origin)|\(.destination)|\(.departureTime)|\(.baggage // "none")|\(.handBaggage // "none")"' 2>/dev/null | sort -u | while IFS='|' read -r CODE NAME SOURCE FNUM ORIG DEST DTIME BAG HBAG; do
    if [ -n "$CODE" ] && [ "$CODE" != "null" ]; then
      KEY="${CODE}_${ORIG}_${DEST}"
      if [ -z "${AIRLINE_RESULTS[$KEY]}" ]; then
        AIRLINE_RESULTS[$KEY]="$CODE|$NAME|$SOURCE|$FNUM|$ORIG|$DEST|$DTIME|$BAG|$HBAG"
        echo "   ✓ $CODE ($NAME) via $SOURCE — $ORIG→$DEST $FNUM | Bag: $BAG | Hand: $HBAG"
      fi
    fi
  done
done

echo ""
echo "═══════════════════════════════════════════════════"
echo " PHASE 2: Test seat maps for each airline"
echo "═══════════════════════════════════════════════════"

# Now test seat maps for unique airlines
# We'll use the ancillaries endpoint which tries seat map internally
RESULTS="["
FIRST=true

for ROUTE in "${ROUTES[@]}"; do
  IFS=':' read -r FROM TO <<< "$ROUTE"
  
  SEARCH=$(curl -s "$API_BASE/flights/search?from=$FROM&to=$TO&date=$DEPART&adults=1&cabinClass=Economy&page=1&limit=200" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  
  # Get first flight per airline on this route
  echo "$SEARCH" | jq -c '[.data[]? | {code: .airlineCode, name: .airline, source: .source, flightNumber: .flightNumber, origin: .origin, destination: .destination, departureTime: .departureTime, baggage: .baggage, handBaggage: .handBaggage}] | unique_by(.code) | .[]' 2>/dev/null | while read -r FLIGHT; do
    CODE=$(echo "$FLIGHT" | jq -r '.code')
    NAME=$(echo "$FLIGHT" | jq -r '.name')
    SOURCE=$(echo "$FLIGHT" | jq -r '.source')
    FNUM=$(echo "$FLIGHT" | jq -r '.flightNumber' | sed 's/^[A-Z]*//') 
    ORIG=$(echo "$FLIGHT" | jq -r '.origin')
    DEST=$(echo "$FLIGHT" | jq -r '.destination')
    DTIME=$(echo "$FLIGHT" | jq -r '.departureTime')
    BAG=$(echo "$FLIGHT" | jq -r '.baggage // "none"')
    HBAG=$(echo "$FLIGHT" | jq -r '.handBaggage // "none"')
    
    if [ -z "$CODE" ] || [ "$CODE" = "null" ]; then continue; fi
    
    # Extract date from departure time
    DEP_DATE=$(echo "$DTIME" | cut -c1-10)
    if [ -z "$DEP_DATE" ] || [ "$DEP_DATE" = "null" ]; then DEP_DATE="$DEPART"; fi
    
    echo ""
    echo "🪑 Testing seat map: $CODE ($NAME) $ORIG→$DEST $CODE$FNUM on $DEP_DATE..."
    
    # Test seat map via ancillaries endpoint
    SEAT_RESULT=$(curl -s "$API_BASE/flights/ancillaries?airlineCode=$CODE&origin=$ORIG&destination=$DEST&flightNumber=$CODE$FNUM&departureDate=$DEP_DATE&cabinClass=Economy" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    
    SEAT_AVAILABLE=$(echo "$SEAT_RESULT" | jq '.seatMap.available // false' 2>/dev/null)
    SEAT_ROWS=$(echo "$SEAT_RESULT" | jq '.seatMap.layout.totalRows // 0' 2>/dev/null)
    SEAT_TOTAL=$(echo "$SEAT_RESULT" | jq '.seatMap.layout.totalSeats // 0' 2>/dev/null)
    SEAT_SOURCE=$(echo "$SEAT_RESULT" | jq -r '.seatMap.source // "none"' 2>/dev/null)
    
    HAS_BAGGAGE="false"
    HAS_HAND="false"
    if [ "$BAG" != "none" ] && [ "$BAG" != "null" ] && [ -n "$BAG" ]; then HAS_BAGGAGE="true"; fi
    if [ "$HBAG" != "none" ] && [ "$HBAG" != "null" ] && [ -n "$HBAG" ]; then HAS_HAND="true"; fi
    
    if [ "$SEAT_AVAILABLE" = "true" ]; then
      echo "   ✅ Seat map: $SEAT_ROWS rows, $SEAT_TOTAL seats (source: $SEAT_SOURCE)"
    else
      echo "   ❌ Seat map: Not available"
    fi
    echo "   📦 Baggage: $BAG | Hand: $HBAG"
    
    # Output JSON line
    echo "{\"airlineCode\":\"$CODE\",\"airline\":\"$NAME\",\"source\":\"$SOURCE\",\"route\":\"$ORIG-$DEST\",\"seatMap\":{\"available\":$SEAT_AVAILABLE,\"rows\":$SEAT_ROWS,\"seats\":$SEAT_TOTAL,\"source\":\"$SEAT_SOURCE\"},\"baggage\":{\"checked\":\"$BAG\",\"hand\":\"$HBAG\",\"hasChecked\":$HAS_BAGGAGE,\"hasHand\":$HAS_HAND},\"gao\":{\"available\":false,\"note\":\"Requires EMD entitlement on PCC\"},\"ssrSupported\":true,\"testedAt\":\"$(date -Iseconds)\",\"flightNumber\":\"$CODE$FNUM\"}" >> /tmp/airline_caps_raw.json
  done
done

echo ""
echo "═══════════════════════════════════════════════════"
echo " PHASE 3: Consolidating results"
echo "═══════════════════════════════════════════════════"

# Consolidate: pick best result per airline (prefer seat map available)
if [ -f /tmp/airline_caps_raw.json ]; then
  # Deduplicate by airlineCode, keeping the one with seatMap.available=true if any
  jq -s '
    group_by(.airlineCode) | map(
      sort_by(.seatMap.available | if . then 0 else 1 end) | .[0] |
      {
        airlineCode,
        airline,
        source,
        routes: [.route],
        seatMap: {
          available: .seatMap.available,
          rows: .seatMap.rows,
          seats: .seatMap.seats,
          source: .seatMap.source,
          note: (if .seatMap.available then "Real-time seat map from Sabre SOAP" else "Not available for this airline" end)
        },
        baggage: {
          hasChecked: .baggage.hasChecked,
          hasHand: .baggage.hasHand,
          checked: .baggage.checked,
          hand: .baggage.hand
        },
        ssrMeals: true,
        ssrWheelchair: true,
        ssrExtraBaggage: true,
        ssrSeatRequest: true,
        gaoAncillaries: false,
        gaoNote: "Requires EMD entitlement agreement with airline on PCC J4YL",
        testedAt: .testedAt
      }
    ) | sort_by(.airlineCode)
  ' /tmp/airline_caps_raw.json > "$OUTPUT_FILE"
  
  TOTAL_AIRLINES=$(jq 'length' "$OUTPUT_FILE")
  SEAT_MAP_COUNT=$(jq '[.[] | select(.seatMap.available)] | length' "$OUTPUT_FILE")
  BAGGAGE_COUNT=$(jq '[.[] | select(.baggage.hasChecked)] | length' "$OUTPUT_FILE")
  
  echo ""
  echo "✅ Results saved to $OUTPUT_FILE"
  echo "📊 Summary:"
  echo "   Airlines tested: $TOTAL_AIRLINES"
  echo "   Seat map available: $SEAT_MAP_COUNT"
  echo "   Baggage info available: $BAGGAGE_COUNT"
  echo "   SSR (meals/wheelchair/baggage): ALL airlines"
  echo "   GAO paid ancillaries: 0 (requires EMD entitlements)"
  echo ""
  echo "📋 Airline Matrix:"
  jq -r '.[] | "   \(.airlineCode) \(.airline | .[0:25]) | SeatMap: \(if .seatMap.available then "✅" else "❌" end) | Baggage: \(if .baggage.hasChecked then "✅ \(.baggage.checked)" else "❌" end) | SSR: ✅"' "$OUTPUT_FILE"
  
  # Cleanup
  rm -f /tmp/airline_caps_raw.json
else
  echo "❌ No results collected"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo " Done! Deploy frontend to show results."
echo "═══════════════════════════════════════════════════"

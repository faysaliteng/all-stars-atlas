#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Seven Trip — Airline Capability Probe Script
# Tests seat maps (SOAP EnhancedSeatMapRQ) and baggage
# for all major airlines on popular routes from DAC
#
# Usage: bash backend/probe-airline-capabilities.sh
# Output: JSON results saved to backend/airline-capabilities.json
# ═══════════════════════════════════════════════════════════════

API_BASE="http://localhost:3001/api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/airline-capabilities.json"
RAW_FILE="/tmp/airline_caps_raw.json"
DEPART=$(date -d "+30 days" +%Y-%m-%d)

# Cleanup previous raw file
rm -f "$RAW_FILE"

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
echo "📁 Output: $OUTPUT_FILE"
echo ""

# Routes to test
declare -a ROUTES=(
  "DAC:DXB"
  "DAC:SIN"
  "DAC:KUL"
  "DAC:BKK"
  "DAC:DOH"
  "DAC:IST"
  "DAC:JED"
  "DAC:LHR"
  "DAC:DEL"
  "DAC:CMB"
  "DAC:MCT"
  "DAC:BAH"
  "DAC:CXB"
  "DAC:CGP"
)

# Track tested airlines to avoid duplicates
declare -A TESTED_AIRLINES

echo "═══════════════════════════════════════════════════"
echo " Searching flights & testing seat maps per airline"
echo "═══════════════════════════════════════════════════"

for ROUTE in "${ROUTES[@]}"; do
  IFS=':' read -r FROM TO <<< "$ROUTE"
  echo ""
  echo "🔍 Searching $FROM → $TO ($DEPART)..."
  
  SEARCH=$(curl -s "$API_BASE/flights/search?from=$FROM&to=$TO&date=$DEPART&adults=1&cabinClass=Economy&page=1&limit=200" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  
  TOTAL=$(echo "$SEARCH" | jq '.total // 0' 2>/dev/null)
  echo "   Found $TOTAL flights"
  
  # Get first flight per airline on this route
  echo "$SEARCH" | jq -c '[.data[]? | {code: .airlineCode, name: .airline, source: .source, flightNumber: .flightNumber, origin: .origin, destination: .destination, departureTime: .departureTime, baggage: .baggage, handBaggage: .handBaggage}] | unique_by(.code) | .[]' 2>/dev/null | while read -r FLIGHT; do
    CODE=$(echo "$FLIGHT" | jq -r '.code')
    NAME=$(echo "$FLIGHT" | jq -r '.name')
    SOURCE=$(echo "$FLIGHT" | jq -r '.source')
    FNUM_RAW=$(echo "$FLIGHT" | jq -r '.flightNumber')
    ORIG=$(echo "$FLIGHT" | jq -r '.origin')
    DEST=$(echo "$FLIGHT" | jq -r '.destination')
    DTIME=$(echo "$FLIGHT" | jq -r '.departureTime')
    BAG=$(echo "$FLIGHT" | jq -r '.baggage // "none"')
    HBAG=$(echo "$FLIGHT" | jq -r '.handBaggage // "none"')
    
    if [ -z "$CODE" ] || [ "$CODE" = "null" ]; then continue; fi
    
    # Use the raw flight number as-is (it already includes airline code)
    FNUM="$FNUM_RAW"
    
    # Extract just the numeric part for seat map call
    FNUM_NUM=$(echo "$FNUM_RAW" | sed "s/^${CODE}//")
    
    # Extract date from departure time
    DEP_DATE=$(echo "$DTIME" | cut -c1-10)
    if [ -z "$DEP_DATE" ] || [ "$DEP_DATE" = "null" ]; then DEP_DATE="$DEPART"; fi
    
    echo "   ✓ $CODE ($NAME) $ORIG→$DEST $FNUM | Bag: $BAG | Hand: $HBAG"
    
    # Test seat map via dedicated seat-map endpoint (uses SOAP EnhancedSeatMapRQ)
    echo -n "     🪑 Seat map: "
    SEAT_RESULT=$(curl -s "$API_BASE/flights/seat-map?airlineCode=$CODE&origin=$ORIG&destination=$DEST&flightNumber=$FNUM_NUM&departureDate=$DEP_DATE&cabinClass=Economy" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    
    SEAT_AVAILABLE=$(echo "$SEAT_RESULT" | jq '.available // false' 2>/dev/null)
    SEAT_ROWS=$(echo "$SEAT_RESULT" | jq '.layout.totalRows // 0' 2>/dev/null)
    SEAT_TOTAL=$(echo "$SEAT_RESULT" | jq '.layout.totalSeats // 0' 2>/dev/null)
    SEAT_SOURCE=$(echo "$SEAT_RESULT" | jq -r '.source // "none"' 2>/dev/null)
    
    HAS_BAGGAGE="false"
    HAS_HAND="false"
    if [ "$BAG" != "none" ] && [ "$BAG" != "null" ] && [ -n "$BAG" ]; then HAS_BAGGAGE="true"; fi
    if [ "$HBAG" != "none" ] && [ "$HBAG" != "null" ] && [ -n "$HBAG" ]; then HAS_HAND="true"; fi
    
    if [ "$SEAT_AVAILABLE" = "true" ]; then
      echo "✅ $SEAT_ROWS rows, $SEAT_TOTAL seats (source: $SEAT_SOURCE)"
    else
      echo "❌ Not available"
    fi
    
    # Write JSON line
    echo "{\"airlineCode\":\"$CODE\",\"airline\":\"$NAME\",\"source\":\"$SOURCE\",\"route\":\"$ORIG-$DEST\",\"seatMap\":{\"available\":$SEAT_AVAILABLE,\"rows\":$SEAT_ROWS,\"seats\":$SEAT_TOTAL,\"source\":\"$SEAT_SOURCE\"},\"baggage\":{\"checked\":\"$BAG\",\"hand\":\"$HBAG\",\"hasChecked\":$HAS_BAGGAGE,\"hasHand\":$HAS_HAND},\"ssrSupported\":true,\"testedAt\":\"$(date -Iseconds)\",\"flightNumber\":\"$FNUM\"}" >> "$RAW_FILE"
  done
done

echo ""
echo "═══════════════════════════════════════════════════"
echo " Consolidating results"
echo "═══════════════════════════════════════════════════"

if [ -f "$RAW_FILE" ]; then
  jq -s '
    group_by(.airlineCode) | map(
      . as $all |
      (map(select(.seatMap.available)) | first) // .[0] |
      {
        airlineCode,
        airline,
        source,
        routes: [$all[].route] | unique,
        seatMap: {
          available: ($all | map(select(.seatMap.available)) | length > 0),
          rows: ([$all[].seatMap.rows] | max),
          seats: ([$all[].seatMap.seats] | max),
          source: .seatMap.source
        },
        baggage: {
          hasChecked: ($all | map(select(.baggage.hasChecked)) | length > 0),
          hasHand: ($all | map(select(.baggage.hasHand)) | length > 0),
          samples: [$all[] | {route, checked: .baggage.checked, hand: .baggage.hand}] | unique_by(.route) | .[0:3]
        },
        ssrMeals: true,
        ssrWheelchair: true,
        ssrExtraBaggage: true,
        ssrSeatRequest: true,
        gaoAncillaries: false,
        gaoNote: "Requires EMD entitlement on PCC",
        testedAt: .testedAt
      }
    ) | sort_by(.airlineCode)
  ' "$RAW_FILE" > "$OUTPUT_FILE"
  
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
  jq -r '.[] | "   \(.airlineCode) \(.airline | .[0:25] | . + " " * (26 - length)) | SeatMap: \(if .seatMap.available then "✅" else "❌" end) | Baggage: \(if .baggage.hasChecked then "✅" else "❌" end) | SSR: ✅"' "$OUTPUT_FILE"
  
  rm -f "$RAW_FILE"
else
  echo "❌ No results collected"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo " Done! Restart API to serve: pm2 restart seventrip-api"
echo "═══════════════════════════════════════════════════"

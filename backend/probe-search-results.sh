#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Seven Trip — Search Results Diagnostic Probe v1.0
# Tests flight search across multiple routes, dates, and trip types.
# Detects BDT 0 prices, missing airlines, and fare extraction issues.
# Compares airline counts and pricing data quality.
#
# Usage: bash probe-search-results.sh
# ═══════════════════════════════════════════════════════════════

API_BASE="http://localhost:3001/api"

# Dates: spread across 2-6 weeks out
D1=$(date -d "+14 days" +%Y-%m-%d)
D2=$(date -d "+21 days" +%Y-%m-%d)
D3=$(date -d "+30 days" +%Y-%m-%d)
D4=$(date -d "+45 days" +%Y-%m-%d)
R1=$(date -d "+21 days" +%Y-%m-%d)
R2=$(date -d "+28 days" +%Y-%m-%d)
R3=$(date -d "+37 days" +%Y-%m-%d)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
WARN=0
TOTAL_FLIGHTS=0
ZERO_PRICE_FLIGHTS=0
TOTAL_SEARCHES=0

declare -A AIRLINE_PRICES
declare -A ZERO_AIRLINES

# ─── Helper ───────────────────────────────────────────────────

search_flights() {
  local from="$1" to="$2" date="$3" ret="$4" adults="${5:-1}" cabin="${6:-economy}"
  local url="$API_BASE/flights/search?from=$from&to=$to&date=$date&adults=$adults&cabinClass=$cabin"
  [ -n "$ret" ] && url="$url&return=$ret"
  curl -s --max-time 120 "$url" 2>/dev/null
}

count_flights() {
  echo "$1" | jq -r '(.data // .flights // []) | length' 2>/dev/null || echo "0"
}

# Extract per-airline price breakdown from search results
analyze_prices() {
  local json="$1" label="$2" test_num="$3"
  local count=$(echo "$json" | jq -r '.flights | length' 2>/dev/null)
  [ "$count" = "null" ] && count=0

  if [ "$count" -eq 0 ]; then
    echo -e "   ${RED}❌${NC} $label — No flights returned"
    FAIL=$((FAIL + 1))
    return
  fi

  TOTAL_SEARCHES=$((TOTAL_SEARCHES + 1))
  TOTAL_FLIGHTS=$((TOTAL_FLIGHTS + count))

  # Count zero-price flights
  local zero_count=$(echo "$json" | jq '[.flights[] | select(
    (.totalPrice == 0 or .totalPrice == null or .totalPrice == "0") and
    (.price == 0 or .price == null or .price == "0") and
    (.grossPrice == 0 or .grossPrice == null or .grossPrice == "0") and
    (.amount == 0 or .amount == null or .amount == "0")
  )] | length' 2>/dev/null)
  [ "$zero_count" = "null" ] && zero_count=0

  local sources=$(echo "$json" | jq -r '[.flights[].source // "unknown"] | unique | join(", ")' 2>/dev/null)

  if [ "$zero_count" -gt 0 ]; then
    echo -e "   ${RED}❌${NC} $label — ${BOLD}$count flights${NC} ($sources) | ${RED}$zero_count with BDT 0${NC}"
    FAIL=$((FAIL + 1))
    ZERO_PRICE_FLIGHTS=$((ZERO_PRICE_FLIGHTS + zero_count))

    # Show which airlines have zero prices
    echo "$json" | jq -r '.flights[] | select(
      (.totalPrice == 0 or .totalPrice == null or .totalPrice == "0") and
      (.price == 0 or .price == null or .price == "0") and
      (.grossPrice == 0 or .grossPrice == null or .grossPrice == "0") and
      (.amount == 0 or .amount == null or .amount == "0")
    ) | "      ⛔ \(.airlineCode // "??") \(.airline // "Unknown") | flight: \(.flightNumber // "?") | price=\(.price // 0) totalPrice=\(.totalPrice // 0) grossPrice=\(.grossPrice // 0) amount=\(.amount // 0) total=\(.total // 0) publishedFare=\(.publishedFare // 0)"' 2>/dev/null | head -10
  else
    echo -e "   ${GREEN}✅${NC} $label — ${BOLD}$count flights${NC} ($sources) | All have valid prices"
    PASS=$((PASS + 1))
  fi

  # Per-airline summary
  echo "$json" | jq -r '
    .flights | group_by(.airlineCode) | map({
      airline: .[0].airlineCode,
      name: .[0].airline,
      count: length,
      source: ([.[].source] | unique | join("/")),
      prices: [.[].totalPrice // .[].price // .[].grossPrice // 0],
      min_price: ([.[].totalPrice // .[].price // .[].grossPrice // 0] | map(select(. > 0)) | if length > 0 then min else 0 end),
      max_price: ([.[].totalPrice // .[].price // .[].grossPrice // 0] | map(select(. > 0)) | if length > 0 then max else 0 end),
      zero_count: ([.[].totalPrice // .[].price // .[].grossPrice // 0] | map(select(. == 0 or . == null)) | length)
    }) | sort_by(-.count) | .[] |
    "      \(.airline) \(.name // "?")\t| \(.count) flights | \(.source) | BDT \(.min_price)-\(.max_price)\(if .zero_count > 0 then " | ⛔\(.zero_count) ZERO" else "" end)"
  ' 2>/dev/null
}

# Analyze fare field coverage (which price fields are populated)
analyze_fare_fields() {
  local json="$1"
  echo -e "   ${DIM}Fare field coverage:${NC}"
  echo "$json" | jq -r '
    def countNonZero(arr): [arr[] | select(. != null and . != 0 and . != "0")] | length;
    {
      total: (.flights | length),
      has_price: countNonZero([.flights[].price]),
      has_totalPrice: countNonZero([.flights[].totalPrice]),
      has_grossPrice: countNonZero([.flights[].grossPrice]),
      has_amount: countNonZero([.flights[].amount]),
      has_total: countNonZero([.flights[].total]),
      has_publishedFare: countNonZero([.flights[].publishedFare]),
      has_baseFare: countNonZero([.flights[].baseFare]),
      has_taxes: countNonZero([.flights[].taxes]),
      has_fareDetails: ([.flights[] | select(.fareDetails != null and (.fareDetails | length) > 0)] | length),
      has_paxPricing: ([.flights[] | select(.paxPricing != null and (.paxPricing | length) > 0)] | length)
    } |
    "      price:\(.has_price)/\(.total) | totalPrice:\(.has_totalPrice)/\(.total) | grossPrice:\(.has_grossPrice)/\(.total) | amount:\(.has_amount)/\(.total) | total:\(.has_total)/\(.total) | publishedFare:\(.has_publishedFare)/\(.total) | baseFare:\(.has_baseFare)/\(.total) | taxes:\(.has_taxes)/\(.total) | fareDetails:\(.has_fareDetails)/\(.total) | paxPricing:\(.has_paxPricing)/\(.total)"
  ' 2>/dev/null
}

echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} Seven Trip — Search Results Diagnostic Probe v1.0${NC}"
echo -e " Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e " Dates: D1=$D1 D2=$D2 D3=$D3 D4=$D4"
echo -e " Returns: R1=$R1 R2=$R2 R3=$R3"
echo "═══════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════
# SECTION 1: ONE-WAY INTERNATIONAL (Various destinations)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SECTION 1: ONE-WAY INTERNATIONAL${NC}"
echo "═══════════════════════════════════════════════════"

echo -e "\n${CYAN}── Test 1: DAC → DXB (Dubai) — $D1${NC}"
R=$(search_flights DAC DXB "$D1")
analyze_prices "$R" "DAC→DXB One-Way" 1
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 2: DAC → SIN (Singapore) — $D2${NC}"
R=$(search_flights DAC SIN "$D2")
analyze_prices "$R" "DAC→SIN One-Way" 2
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 3: DAC → KUL (Kuala Lumpur) — $D1${NC}"
R=$(search_flights DAC KUL "$D1")
analyze_prices "$R" "DAC→KUL One-Way" 3
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 4: DAC → BKK (Bangkok) — $D3${NC}"
R=$(search_flights DAC BKK "$D3")
analyze_prices "$R" "DAC→BKK One-Way" 4
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 5: DAC → WAW (Warsaw) — $D2${NC}"
R=$(search_flights DAC WAW "$D2")
analyze_prices "$R" "DAC→WAW One-Way" 5
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 6: DAC → LHR (London) — $D3${NC}"
R=$(search_flights DAC LHR "$D3")
analyze_prices "$R" "DAC→LHR One-Way" 6
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 7: DAC → JFK (New York) — $D4${NC}"
R=$(search_flights DAC JFK "$D4")
analyze_prices "$R" "DAC→JFK One-Way" 7
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 8: DAC → DEL (Delhi) — $D1${NC}"
R=$(search_flights DAC DEL "$D1")
analyze_prices "$R" "DAC→DEL One-Way" 8
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 9: DAC → CMB (Colombo) — $D2${NC}"
R=$(search_flights DAC CMB "$D2")
analyze_prices "$R" "DAC→CMB One-Way" 9
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 10: DAC → DOH (Doha) — $D3${NC}"
R=$(search_flights DAC DOH "$D3")
analyze_prices "$R" "DAC→DOH One-Way" 10
analyze_fare_fields "$R"

# ═══════════════════════════════════════════════════════════════
# SECTION 2: ROUND-TRIP INTERNATIONAL
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SECTION 2: ROUND-TRIP INTERNATIONAL${NC}"
echo "═══════════════════════════════════════════════════"

echo -e "\n${CYAN}── Test 11: DAC ↔ DXB — $D1/$R1${NC}"
R=$(search_flights DAC DXB "$D1" "$R1")
analyze_prices "$R" "DAC↔DXB Round-Trip" 11
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 12: DAC ↔ SIN — $D2/$R2${NC}"
R=$(search_flights DAC SIN "$D2" "$R2")
analyze_prices "$R" "DAC↔SIN Round-Trip" 12
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 13: DAC ↔ WAW — $D2/$R2${NC}"
R=$(search_flights DAC WAW "$D2" "$R2")
analyze_prices "$R" "DAC↔WAW Round-Trip" 13
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 14: DAC ↔ BKK — $D3/$R3${NC}"
R=$(search_flights DAC BKK "$D3" "$R3")
analyze_prices "$R" "DAC↔BKK Round-Trip" 14
analyze_fare_fields "$R"

echo -e "\n${CYAN}── Test 15: DAC ↔ KUL — $D1/$R1${NC}"
R=$(search_flights DAC KUL "$D1" "$R1")
analyze_prices "$R" "DAC↔KUL Round-Trip" 15
analyze_fare_fields "$R"

# ═══════════════════════════════════════════════════════════════
# SECTION 3: DOMESTIC ROUTES (TTI / Air Astra)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SECTION 3: DOMESTIC ROUTES${NC}"
echo "═══════════════════════════════════════════════════"

echo -e "\n${CYAN}── Test 16: DAC → CXB (Cox's Bazar) — $D1${NC}"
R=$(search_flights DAC CXB "$D1")
analyze_prices "$R" "DAC→CXB Domestic One-Way" 16

echo -e "\n${CYAN}── Test 17: DAC → CGP (Chittagong) — $D2${NC}"
R=$(search_flights DAC CGP "$D2")
analyze_prices "$R" "DAC→CGP Domestic One-Way" 17

echo -e "\n${CYAN}── Test 18: DAC ↔ CXB — $D1/$R1${NC}"
R=$(search_flights DAC CXB "$D1" "$R1")
analyze_prices "$R" "DAC↔CXB Domestic Round-Trip" 18

# ═══════════════════════════════════════════════════════════════
# SECTION 4: DIFFERENT PAX COUNTS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SECTION 4: MULTI-PAX SEARCHES${NC}"
echo "═══════════════════════════════════════════════════"

echo -e "\n${CYAN}── Test 19: DAC → DXB (2 Adults) — $D1${NC}"
R=$(search_flights DAC DXB "$D1" "" 2)
analyze_prices "$R" "DAC→DXB 2-ADT One-Way" 19

echo -e "\n${CYAN}── Test 20: DAC → SIN (3 Adults) — $D2${NC}"
R=$(search_flights DAC SIN "$D2" "" 3)
analyze_prices "$R" "DAC→SIN 3-ADT One-Way" 20

# ═══════════════════════════════════════════════════════════════
# SECTION 5: DEEP PRICE FIELD AUDIT (pick one route, dump all fields)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SECTION 5: DEEP FARE AUDIT (DAC→DXB)${NC}"
echo "═══════════════════════════════════════════════════"

echo -e "\n${CYAN}── Deep audit: Every flight's raw price fields${NC}"
R=$(search_flights DAC DXB "$D3")
echo "$R" | jq -r '
  .flights[] |
  "\(.airlineCode)\t\(.flightNumber // "?")\t\(.source // "?")\tprice=\(.price // "null")\ttotalPrice=\(.totalPrice // "null")\tgrossPrice=\(.grossPrice // "null")\tamount=\(.amount // "null")\ttotal=\(.total // "null")\tpublishedFare=\(.publishedFare // "null")\tbaseFare=\(.baseFare // "null")\ttaxes=\(.taxes // "null")"
' 2>/dev/null | sort | head -50

# ═══════════════════════════════════════════════════════════════
# SECTION 6: SAMPLE FLIGHT DETAIL DUMP (first zero-price flight)
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SECTION 6: ZERO-PRICE FLIGHT DETAIL DUMP${NC}"
echo "═══════════════════════════════════════════════════"

echo -e "\n${CYAN}── Dumping first 3 zero-price flights (all fields)${NC}"
echo "$R" | jq -r '[.flights[] | select(
  (.totalPrice == 0 or .totalPrice == null or .totalPrice == "0") and
  (.price == 0 or .price == null or .price == "0") and
  (.grossPrice == 0 or .grossPrice == null or .grossPrice == "0") and
  (.amount == 0 or .amount == null or .amount == "0")
)] | .[0:3][] | {
  airline: .airline,
  airlineCode: .airlineCode,
  flightNumber: .flightNumber,
  source: .source,
  price: .price,
  totalPrice: .totalPrice,
  grossPrice: .grossPrice,
  amount: .amount,
  total: .total,
  publishedFare: .publishedFare,
  baseFare: .baseFare,
  taxes: .taxes,
  fareDetails: (.fareDetails // [] | length),
  paxPricing: (.paxPricing // [] | length),
  totalFare: .totalFare,
  passengerInfo: .passengerInfo,
  segments_price: [.segments[]? | {price: .price, fare: .fare, baseFare: .baseFare}]
}' 2>/dev/null

# If no zero-price flights found, show a sample
ZERO_CT=$(echo "$R" | jq '[.flights[] | select(
  (.totalPrice == 0 or .totalPrice == null or .totalPrice == "0") and
  (.price == 0 or .price == null or .price == "0") and
  (.grossPrice == 0 or .grossPrice == null or .grossPrice == "0")
)] | length' 2>/dev/null)

if [ "$ZERO_CT" = "0" ] || [ "$ZERO_CT" = "null" ]; then
  echo -e "   ${GREEN}No zero-price flights found in deep audit! ✅${NC}"
  echo -e "\n${CYAN}── Sample of lowest-priced flights:${NC}"
  echo "$R" | jq -r '
    [.flights[] | {
      airline: "\(.airlineCode) \(.airline // "?")",
      flight: .flightNumber,
      source: .source,
      price: (.totalPrice // .price // .grossPrice // 0)
    }] | sort_by(.price) | .[0:5][] |
    "      \(.airline) \(.flight) (\(.source)) — BDT \(.price)"
  ' 2>/dev/null
fi

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${BOLD} SEARCH RESULTS DIAGNOSTIC SUMMARY${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
echo -e "   Total Searches:        $TOTAL_SEARCHES"
echo -e "   Total Flights Found:   $TOTAL_FLIGHTS"
echo -e "   ${GREEN}✅ Passed:${NC}             $PASS"
echo -e "   ${RED}❌ Failed:${NC}             $FAIL"
echo -e "   ${RED}Zero-Price Flights:${NC}    $ZERO_PRICE_FLIGHTS"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$ZERO_PRICE_FLIGHTS" -eq 0 ]; then
  echo -e "   ${GREEN}🎉 ALL SEARCHES HAVE VALID PRICES — No BDT 0 detected!${NC}"
elif [ "$ZERO_PRICE_FLIGHTS" -gt 0 ]; then
  echo -e "   ${RED}⚠️  $ZERO_PRICE_FLIGHTS flights returned BDT 0 — CHECK NORMALIZER${NC}"
  echo -e "   ${DIM}Look at Section 6 dump for raw field analysis${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo -e " Done! $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════"

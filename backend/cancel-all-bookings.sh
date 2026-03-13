#!/bin/bash
# ═══════════════════════════════════════════════════════════
#   SEVEN TRIP — BULK CANCEL ALL RESERVED BOOKINGS
#   Cancels all on_hold (Reserved) bookings via GDS APIs
# ═══════════════════════════════════════════════════════════

set -euo pipefail

API_BASE="${API_BASE:-https://seven-trip.com/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@seventrip.com.bd}"
ADMIN_PASS="${ADMIN_PASS:-Admin@123456}"
FILTER="${1:-reserved}"  # reserved | all_with_pnr

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   SEVEN TRIP — BULK CANCEL BOOKINGS (filter: $FILTER)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Login
echo "[AUTH] Logging in as $ADMIN_EMAIL ..."
LOGIN_RESP=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  echo "✗ Login failed: $(echo "$LOGIN_RESP" | jq -r '.message // "Unknown error"')"
  exit 1
fi
echo "✓ Login OK"
echo ""

# First, show what will be cancelled
echo "[INFO] Fetching bookings to cancel..."
BOOKINGS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/admin/bookings?limit=500")
TOTAL=$(echo "$BOOKINGS" | jq '.total // 0')

if [ "$FILTER" = "reserved" ]; then
  COUNT=$(echo "$BOOKINGS" | jq '[.data[] | select(.status == "on_hold" and .pnr != null and .pnr != "")] | length')
  echo "  Total bookings: $TOTAL"
  echo "  Reserved with PNR (to cancel): $COUNT"
elif [ "$FILTER" = "all_with_pnr" ]; then
  COUNT=$(echo "$BOOKINGS" | jq '[.data[] | select(.pnr != null and .pnr != "" and .status != "cancelled" and .status != "void" and .status != "failed")] | length')
  echo "  Total bookings: $TOTAL"
  echo "  All active with PNR (to cancel): $COUNT"
fi

echo ""

# List PNRs that will be cancelled
echo "[PNRs to cancel]:"
if [ "$FILTER" = "reserved" ]; then
  echo "$BOOKINGS" | jq -r '.data[] | select(.status == "on_hold" and .pnr != null and .pnr != "") | "  \(.bookingRef) | PNR: \(.pnr) | Route: \(.details.outbound.origin // "?")→\(.details.outbound.destination // "?") | Source: \(.details.outbound.source // "unknown")"'
else
  echo "$BOOKINGS" | jq -r '.data[] | select(.pnr != null and .pnr != "" and .status != "cancelled" and .status != "void" and .status != "failed") | "  \(.bookingRef) | PNR: \(.pnr) | Status: \(.status) | Source: \(.details.outbound.source // "unknown")"'
fi

echo ""
read -p "Proceed with cancellation? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "[CANCELLING] Sending bulk cancel request..."
RESULT=$(curl -s -X POST "$API_BASE/admin/bookings/bulk-cancel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"filter\":\"$FILTER\"}")

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "   BULK CANCEL RESULTS"
echo "═══════════════════════════════════════════════════════════"
echo ""

CANCELLED=$(echo "$RESULT" | jq '.summary.cancelled // 0')
FAILED=$(echo "$RESULT" | jq '.summary.failed // 0')
SKIPPED=$(echo "$RESULT" | jq '.summary.skipped // 0')
TOTAL_PROCESSED=$(echo "$RESULT" | jq '.summary.total // 0')

echo "  Total Processed: $TOTAL_PROCESSED"
echo "  ✓ Cancelled:     $CANCELLED"
echo "  ✗ Failed:        $FAILED"
echo "  ⊘ Skipped:       $SKIPPED"
echo ""

# Show detailed results
echo "[DETAILED RESULTS]:"
echo "$RESULT" | jq -r '.results[] | "  \(.bookingRef) | PNR: \(.pnr // "-") | \(.status) \(if .reason then "— " + .reason else "" end)"'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Done. Check admin panel: https://seven-trip.com/admin/bookings"
echo "═══════════════════════════════════════════════════════════"

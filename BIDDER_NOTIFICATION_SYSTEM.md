# Bidder Notification System

## Overview
Sistem notifikasi untuk mengingatkan bidder agar melakukan reveal sebelum auction closing time. Kombinasi dari dashboard alerts, notification center, dan countdown timers.

## Features Implemented

### 1. Notification Center (Bell Icon)
**Location:** Header (top right)

**Features:**
- Bell icon dengan badge merah menampilkan jumlah unrevealed bids
- Dropdown panel dengan list semua unrevealed bids
- Urgency levels:
  - `expired`: Auction sudah closed (merah)
  - `critical`: < 2 hours remaining (orange)
  - `high`: < 24 hours remaining (amber)
  - `normal`: > 24 hours remaining (biru)
- Countdown timer untuk setiap auction
- Quick action: "Reveal Now" button
- Dismiss notification functionality

**Files:**
- `shadowbid-marketplace/src/components/notifications/NotificationCenter.jsx`
- `shadowbid-marketplace/src/hooks/useUnrevealedBids.js`

### 2. Dashboard Alert Card
**Location:** Dashboard page (below hero section)

**Features:**
- Prominent alert card showing most urgent unrevealed bid
- Countdown timer dengan color coding
- Shows total unrevealed bids count
- Direct link to Reveal Bid page
- Auto-hide when no unrevealed bids

**Files:**
- `shadowbid-marketplace/src/components/notifications/UnrevealedBidsAlert.jsx`

### 3. Sidebar Badge
**Location:** Sidebar - "Reveal Bid" menu item

**Features:**
- Red badge showing unrevealed bids count
- Visible in both expanded and collapsed sidebar states
- Updates in real-time

**Files:**
- `shadowbid-marketplace/src/components/layout/Sidebar.jsx`

### 4. Unrevealed Bids List
**Location:** Reveal Bid page (top section)

**Features:**
- Card list showing all unrevealed bids
- Individual countdown timer for each auction
- Color-coded urgency (red/orange/amber)
- Quick "Reveal" button for each auction
- Shows "All Bids Revealed!" when empty

**Files:**
- `shadowbid-marketplace/src/components/bid/UnrevealedBidsList.jsx`
- `shadowbid-marketplace/src/pages/RevealBidPageV2.jsx`

## How It Works

### Data Flow
1. **useUnrevealedBids Hook** checks localStorage for unrevealed bids
2. Compares with auction closing dates from `useLocalAuctions`
3. Calculates time remaining and urgency level
4. Updates every 60 seconds automatically
5. Components subscribe to this hook for real-time updates

### Urgency Calculation
```javascript
if (timeRemaining < 0) {
  urgency = 'expired';
} else if (hoursRemaining < 2) {
  urgency = 'critical';
} else if (hoursRemaining < 24) {
  urgency = 'high';
} else {
  urgency = 'normal';
}
```

### Storage Structure
Bids are stored in localStorage:
```javascript
localStorage.getItem(`auction_${auctionId}_bids`)
// Returns: [{ revealed: false, amount: 1000000, ... }, ...]
```

## User Experience Flow

1. **Bidder commits bid** → Bid stored in localStorage with `revealed: false`
2. **Dashboard shows alert** → "You have X unrevealed bids"
3. **Bell icon shows badge** → Red badge with count
4. **Sidebar shows badge** → On "Reveal Bid" menu
5. **Countdown updates** → Every minute, urgency increases as time passes
6. **Bidder clicks reveal** → Navigates to Reveal Bid page
7. **List shows all unrevealed** → With individual countdowns
8. **Bidder reveals bid** → Bid marked as revealed, notifications disappear

## Color Coding

| Urgency | Time Remaining | Border Color | Background | Icon Color |
|---------|---------------|--------------|------------|------------|
| Expired | < 0 | Red | Red/30 | Red |
| Critical | < 2 hours | Orange | Orange/30 | Orange |
| High | < 24 hours | Amber | Amber/30 | Amber |
| Normal | > 24 hours | Blue | Blue/30 | Blue |

## Testing Checklist

- [ ] Commit bid → Check badge appears
- [ ] Check dashboard alert shows
- [ ] Check notification center shows bid
- [ ] Check sidebar badge count
- [ ] Wait 1 minute → Check countdown updates
- [ ] Reveal bid → Check all notifications disappear
- [ ] Multiple auctions → Check all show in list
- [ ] Auction closes → Check urgency changes to "expired"
- [ ] Dismiss notification → Check it disappears
- [ ] Collapsed sidebar → Check badge still visible

## Future Enhancements

### Phase 2 (Optional)
- Browser push notifications (requires permission)
- Email notifications (requires backend)
- Sound alerts for critical urgency
- Persistent notification dismissal (localStorage)
- Notification history/archive

### Phase 3 (Advanced)
- WebSocket real-time updates
- Multi-wallet support
- Notification preferences/settings
- Snooze functionality
- Batch reveal multiple bids

## Technical Notes

- **Performance:** Hook updates every 60 seconds, minimal re-renders
- **Storage:** Uses localStorage, no backend required
- **Real-time:** Countdown updates automatically
- **Responsive:** Works on mobile and desktop
- **Accessibility:** Proper ARIA labels and keyboard navigation

## Files Modified

### New Files
1. `shadowbid-marketplace/src/components/notifications/NotificationCenter.jsx`
2. `shadowbid-marketplace/src/hooks/useUnrevealedBids.js`
3. `shadowbid-marketplace/src/components/notifications/UnrevealedBidsAlert.jsx`
4. `shadowbid-marketplace/src/components/bid/UnrevealedBidsList.jsx`

### Modified Files
1. `shadowbid-marketplace/src/components/layout/HeaderBar.jsx` - Added NotificationCenter
2. `shadowbid-marketplace/src/components/layout/Sidebar.jsx` - Added badge to Reveal Bid
3. `shadowbid-marketplace/src/pages/DashboardPage.jsx` - Added UnrevealedBidsAlert
4. `shadowbid-marketplace/src/pages/RevealBidPageV2.jsx` - Added UnrevealedBidsList
5. `shadowbid-marketplace/src/components/settlement/SettlementWizard.jsx` - Added unrevealed bids handling

## Summary

Sistem notifikasi bidder sudah lengkap dengan:
- ✅ Notification Center dengan bell icon
- ✅ Dashboard alert card
- ✅ Sidebar badge
- ✅ Countdown timer untuk setiap bid
- ✅ Color-coded urgency levels
- ✅ Real-time updates (every 60 seconds)
- ✅ Responsive design
- ✅ No backend required (localStorage only)

Bidder sekarang akan mendapat reminder yang jelas untuk reveal bids mereka sebelum auction closes!

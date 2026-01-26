# Driver Confirmation Flow - Test Documentation

## Overview

Phase 12 adds multi-party call coordination where the dispatcher confirms with the driver before finalizing a warehouse agreement.

## Prerequisites

1. **VAPI Configuration**
   - `NEXT_PUBLIC_VAPI_PUBLIC_KEY` - VAPI public key
   - `NEXT_PUBLIC_VAPI_ASSISTANT_ID` - Warehouse assistant ID
   - `NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID` - Driver assistant ID (enables feature)

2. **Google Sheets** (for save verification)
   - `GOOGLE_SHEETS_SPREADSHEET_ID` or `GOOGLE_SHEETS_SCHEDULE_NAME`

## Test Scenarios

### Test 1: Happy Path - Driver Confirms

**Setup:**
1. Start app with driver confirmation toggle visible (driver assistant ID configured)
2. Enable "Confirm with Driver" in setup form
3. Use voice mode

**Steps:**
1. Fill in delay details and click "Start Voice Call"
2. Negotiate with warehouse until time and dock are confirmed
3. Observe: "Warehouse On Hold" UI appears
4. Driver call connects automatically
5. When driver assistant asks about the time, respond with "yes" or "sounds good"

**Expected Results:**
- [ ] Warehouse put on hold (mic muted, assistant muted)
- [ ] Driver confirmation UI shows with tentative time/dock
- [ ] Driver call status shows "Connecting..." then "Speaking with driver..."
- [ ] After driver confirms, status shows "Confirmed!"
- [ ] Warehouse call resumes (unmuted)
- [ ] Agreement saved to Google Sheets with status `DRIVER_CONFIRMED`
- [ ] Call ends naturally with final confirmation

---

### Test 2: Failure Path - Driver Rejects

**Setup:**
Same as Test 1

**Steps:**
1. Negotiate with warehouse until agreement reached
2. Wait for driver call to connect
3. When driver assistant asks, respond with "no" or "can't make it"

**Expected Results:**
- [ ] Warehouse put on hold
- [ ] Driver call connects
- [ ] After driver rejects, driver call ends
- [ ] Warehouse call resumes briefly
- [ ] Status shows "Rejected"
- [ ] Agreement saved to Google Sheets with status `DRIVER_UNAVAILABLE`
- [ ] Warehouse call ends gracefully

---

### Test 3: Edge Case - Driver Call Timeout

**Setup:**
Same as Test 1

**Steps:**
1. Negotiate with warehouse until agreement reached
2. Wait for driver call to connect
3. Don't respond to driver assistant (stay silent)
4. Wait 60 seconds

**Expected Results:**
- [ ] Warehouse put on hold
- [ ] Driver call connects
- [ ] 60-second timeout expires
- [ ] Driver call status shows "Timed out"
- [ ] Warehouse call resumes
- [ ] Agreement saved with status `DRIVER_UNAVAILABLE`
- [ ] Warehouse call ends gracefully

---

### Test 4: Edge Case - Driver Call Fails to Connect

**Setup:**
1. Configure invalid driver assistant ID (or disconnect network during driver call)
2. Enable driver confirmation

**Steps:**
1. Negotiate with warehouse until agreement reached
2. Driver call attempts to connect but fails

**Expected Results:**
- [ ] Warehouse put on hold
- [ ] Driver call shows "Connecting..."
- [ ] Error detected, status shows "Failed"
- [ ] Warehouse call resumes
- [ ] Agreement saved with status `DRIVER_UNAVAILABLE`
- [ ] Warehouse call ends gracefully

---

### Test 5: Edge Case - User Manually Ends Call During Hold

**Note:** The End Call button is hidden during hold to prevent this, but user could close browser.

**Setup:**
Same as Test 1

**Steps:**
1. Negotiate with warehouse until agreement reached
2. Warehouse on hold, driver call in progress
3. Close browser or navigate away

**Expected Results:**
- [ ] Both calls terminated
- [ ] No agreement saved (incomplete)
- [ ] Cleanup timers cleared

---

### Test 6: Feature Disabled - Toggle Off

**Setup:**
1. Driver assistant ID configured
2. "Confirm with Driver" toggle disabled

**Steps:**
1. Start voice call
2. Negotiate until agreement reached

**Expected Results:**
- [ ] No driver confirmation UI appears
- [ ] No warehouse hold
- [ ] Agreement finalized immediately
- [ ] Saved with status `CONFIRMED` (not `DRIVER_CONFIRMED`)

---

### Test 7: Feature Unavailable - No Driver Assistant ID

**Setup:**
1. Remove or leave empty `NEXT_PUBLIC_VAPI_DRIVER_ASSISTANT_ID`

**Steps:**
1. Check setup form

**Expected Results:**
- [ ] "Confirm with Driver" toggle is disabled
- [ ] Help text explains: "Driver assistant not configured"
- [ ] Negotiation proceeds without driver confirmation

---

## UI State Verification

### Setup Form
- [ ] Toggle only visible in voice mode
- [ ] Toggle disabled when driver assistant not configured
- [ ] Green accent color distinguishes from HOS toggle

### Chat Interface Header (During Hold)
- [ ] Shows "Warehouse: ON HOLD" with pause icon
- [ ] Shows "MUTED" badge with pulse animation
- [ ] Shows driver call status badge

### Chat Interface Active Call (During Hold)
- [ ] Shows amber "WAREHOUSE ON HOLD" panel
- [ ] Shows driver call status within panel
- [ ] End Call button hidden
- [ ] Shows message: "Warehouse manager cannot hear"

### Progressive Disclosure Panel
- [ ] "Warehouse On Hold" section appears
- [ ] Shows tentative time and dock
- [ ] Shows driver call status with real-time updates

---

## Conversation Phase Flow

```
Normal Negotiation Phases:
greeting → awaiting_name → explaining → negotiating_time → awaiting_dock → confirming → done

With Driver Confirmation:
... → confirming → putting_on_hold → warehouse_on_hold → driver_call_connecting →
    driver_call_active → returning_to_warehouse → final_confirmation → done

On Driver Rejection:
... → returning_to_warehouse → done (with failure)
```

---

## Google Sheets Status Values

| Status | Meaning |
|--------|---------|
| `CONFIRMED` | Agreement finalized without driver confirmation |
| `DRIVER_CONFIRMED` | Driver confirmed availability |
| `DRIVER_UNAVAILABLE` | Driver rejected, timed out, or call failed |
| `FAILED` | Other failure |

---

## Known Limitations

1. **Simulated Hold**: VAPI doesn't support native hold, so we use mute controls. Warehouse hears complete silence (no hold music).

2. **Single Mic**: Browser microphone can only feed one call at a time. Works because warehouse mic is muted during driver call.

3. **No Renegotiation**: If driver rejects, workflow ends with failure. No loop back to warehouse to try different time.

4. **60-Second Timeout**: Fixed timeout for driver call. Not configurable via UI.

---

## Debug Logging

All Phase 12 logs are prefixed with `[Phase12]`:

```
[Phase12] Initiating driver confirmation flow
[Phase12] 🟢 Driver call started
[Phase12] 📨 Driver Message: transcript {...}
[Phase12] ✅ Driver confirmed
[Phase12] Resuming warehouse call from hold
```

To view logs:
1. Open browser DevTools (F12)
2. Filter console by "Phase12"

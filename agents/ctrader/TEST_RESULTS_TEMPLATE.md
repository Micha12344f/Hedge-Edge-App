# Hedge Edge cTrader cBot - Test Results

**Test Date:** 2026-02-01  
**Tester:** _________________  
**cTrader Version:** _________________  
**Broker:** _________________  
**Account Type:** Demo / Live  

---

## Pre-Test Checklist

- [ ] cTrader Desktop installed and updated
- [ ] Valid Hedge Edge license key available
- [ ] Hedge Edge desktop app installed
- [ ] Internet connection stable
- [ ] Source file `HedgeEdgeLicense.cs` available (717 lines)

---

## Test 1: Compilation

### 1.1 Create cBot Project
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Right-click cBots > New cBot | Dialog appears | | |
| Name: HedgeEdgeLicense | Project created | | |

### 1.2 Paste Source Code
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Paste 717 lines of code | Code appears in editor | | |
| No paste errors | Complete code visible | | |

### 1.3 Build cBot
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Click Build (Ctrl+B) | Build starts | | |
| Build completes | "Build Succeeded" message | | |
| Error count | 0 errors | | |
| Warning count | 0 warnings (optional OK) | | |

**Build Output:**
```
[Paste build output here]
```

**Screenshot:** [Attach screenshot of successful build]

---

## Test 2: License Validation

### 2.1 Attach to Chart
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Open any symbol chart | Chart opens | | |
| Double-click HedgeEdgeLicense | Parameter dialog appears | | |

### 2.2 Configure Parameters
| Parameter | Value Used | Notes |
|-----------|------------|-------|
| License Key | | |
| Device ID | (auto) | |
| API Endpoint | Default | |
| Poll Interval | 600 | |
| Status Channel | HedgeEdgeCTrader | |

### 2.3 Start cBot
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Click OK to start | cBot initializes | | |
| Chart status text | Green "Licensed - Active" | | |
| Log: "License validated" | Message appears | | |

**License Validation Log:**
```
[Paste relevant log entries here]
```

**Screenshot:** [Attach screenshot showing green status text]

---

## Test 3: Named Pipe Data Streaming

### 3.1 Start Desktop App
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Open Hedge Edge desktop app | App launches | | |
| Navigate to Accounts | Accounts panel visible | | |

### 3.2 Verify Connection
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| cTrader account appears | Listed in app | | |
| Connection status | "Connected" | | |
| Log: "App connected to data pipe" | Message in cTrader log | | |

### 3.3 Verify Data Streaming
| Data Point | cTrader Value | Desktop App Value | Match? |
|------------|---------------|-------------------|--------|
| Balance | | | |
| Equity | | | |
| Free Margin | | | |
| Margin Level | | | |
| Currency | | | |

**Screenshot:** [Attach screenshot of desktop app showing account data]

---

## Test 4: Position Streaming

### 4.1 Open Test Position
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Open a position in cTrader | Trade executes | | |
| Position appears in desktop app | Within 1-2 seconds | | |

### 4.2 Position Data Accuracy
| Data Point | cTrader Value | Desktop App Value | Match? |
|------------|---------------|-------------------|--------|
| Symbol | | | |
| Volume (Lots) | | | |
| Direction (Buy/Sell) | | | |
| Entry Price | | | |
| Current Price | | | |
| Stop Loss | | | |
| Take Profit | | | |
| Profit/Loss | | | |
| Pips | | | |

### 4.3 Close Test Position
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Close position in cTrader | Trade closes | | |
| Position removed from desktop app | Within 1-2 seconds | | |

---

## Test 5: Remote Commands

### 5.1 PAUSE Command
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Send PAUSE from desktop app | Command sent | | |
| cBot status changes | "Licensed - Paused" (Orange) | | |
| Log shows "Trading paused" | Message appears | | |

### 5.2 RESUME Command
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Send RESUME from desktop app | Command sent | | |
| cBot status changes | "Licensed - Active" (Green) | | |
| Log shows "Trading resumed" | Message appears | | |

### 5.3 STATUS Command
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Send STATUS from desktop app | Command sent | | |
| Response received | JSON with status info | | |

**STATUS Response:**
```json
[Paste STATUS response here]
```

### 5.4 CLOSE_ALL Command (Optional - Use with caution)
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Open multiple positions | Positions exist | | |
| Send CLOSE_ALL command | All positions closed | | |
| Response shows closed count | Correct count returned | | |

---

## Test 6: Error Handling

### 6.1 Invalid License Key
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Enter invalid license key | | | |
| Status text | Red "License Invalid" | | |
| cBot behavior | Stops after failure | | |

### 6.2 Network Disconnection (Optional)
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Disable network temporarily | | | |
| cBot retries with backoff | Up to 5 retries | | |
| Re-enable network | Reconnects successfully | | |

### 6.3 API Endpoint Unreachable (Optional)
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Change API endpoint to invalid | | | |
| Error handling | Graceful failure message | | |

---

## Test 7: License Revalidation

### 7.1 Poll Interval Test
| Step | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Set Poll Interval to 60 seconds | | | |
| Wait 60+ seconds | | | |
| Log shows revalidation | "License validated" message | | |
| Token expiry updated | New expiry time in log | | |

---

## Performance Notes

| Metric | Value |
|--------|-------|
| Memory usage (approximate) | MB |
| CPU usage (idle) | % |
| Data emit latency | ms |
| Startup time | seconds |

---

## Issues Found

### Issue 1
- **Description:** 
- **Severity:** Critical / High / Medium / Low
- **Steps to Reproduce:** 
- **Expected Behavior:** 
- **Actual Behavior:** 
- **Workaround:** 

### Issue 2
- **Description:** 
- **Severity:** 
- **Steps to Reproduce:** 
- **Expected Behavior:** 
- **Actual Behavior:** 
- **Workaround:** 

---

## Summary

| Test Category | Pass | Fail | N/A |
|---------------|------|------|-----|
| Compilation | | | |
| License Validation | | | |
| Named Pipe Connection | | | |
| Position Streaming | | | |
| Remote Commands | | | |
| Error Handling | | | |
| License Revalidation | | | |

### Overall Result: ☐ PASS ☐ FAIL

---

## Tester Sign-off

**Tester Name:** _________________  
**Date:** _________________  
**Signature:** _________________  

---

## Attachments

1. [ ] Screenshot: Successful build
2. [ ] Screenshot: Licensed - Active status
3. [ ] Screenshot: Desktop app with account connected
4. [ ] Screenshot: Position data in desktop app
5. [ ] Build log output
6. [ ] Any error screenshots

---

*Template Version: 1.0.0 | Last Updated: 2026-02-01*

# Hedge Edge Agent Deployment Tasks

## Phase 3: Agent Deployment & License Integration

This folder contains structured task assignments for deploying trading agents to MT4/MT5/cTrader platforms and establishing license validation with the desktop app.

---

## 📋 Task Overview

| Task ID | Title | Assigned To | Priority | Status |
|---------|-------|-------------|----------|--------|
| **BE-001** | Deploy Production License API | Backend Developer | 🔴 CRITICAL | ⬜ Not Started |
| **EL-001** | WebRequest License Handler | Electron Developer | 🔴 CRITICAL | ⬜ Not Started |
| **MT5-001** | Compile & Deploy MT5 EA | MT5 Specialist | 🟠 HIGH | ⬜ Not Started |
| **CT-001** | Compile & Deploy cTrader cBot | cTrader Specialist | 🟠 HIGH | ⬜ Not Started |
| **EL-002** | Named Pipe Support for cTrader | Electron Developer | 🟠 HIGH | ⬜ Not Started |
| **MT4-001** | Develop MT4 Agent (32-bit) | MT4 Specialist | 🟡 MEDIUM | ⬜ Not Started |
| **QA-001** | End-to-End Integration Testing | QA Engineer | 🟠 HIGH | ⬜ Not Started |

---

## 🚀 Parallel Execution Plan

```
Day 1 (Wave 1): Infrastructure
├── BE-001: Backend Developer → License API
└── EL-001: Electron Developer → License Handler
           ↓
Day 2 (Wave 2): Platform Deployment (parallel)
├── MT5-001: MT5 Specialist → EA + DLL
├── CT-001: cTrader Specialist → cBot
└── EL-002: Electron Developer → Named Pipes
           ↓
Day 3 (Wave 3): Testing
└── QA-001: QA Engineer → Integration Tests
           ↓
Week 1 (Wave 4): MT4 (parallel with testing)
└── MT4-001: MT4 Specialist → 32-bit EA + DLL
```

---

## 👥 Developer Assignments

### Backend Developer
- **Tasks:** BE-001
- **Hours:** 4
- **Skills:** Python/Flask, PostgreSQL, API Design, SSL/TLS

### Electron Developer  
- **Tasks:** EL-001, EL-002
- **Hours:** 7
- **Skills:** TypeScript, Electron, Node.js, IPC, Named Pipes

### MT5 Specialist
- **Tasks:** MT5-001
- **Hours:** 3
- **Skills:** MQL5, C++ (x64), DLL Development, MetaTrader 5

### cTrader Specialist
- **Tasks:** CT-001
- **Hours:** 2
- **Skills:** C#, cAlgo API, cTrader Automate

### MT4 Specialist
- **Tasks:** MT4-001
- **Hours:** 8
- **Skills:** MQL4, C++ (x86/32-bit), MetaTrader 4

### QA Engineer
- **Tasks:** QA-001
- **Hours:** 6
- **Skills:** Testing methodologies, MT5, cTrader, Bug Reporting

---

## 📁 Task Files

Each task has a detailed JSON specification:

- [BE-001-license-api-deployment.json](BE-001-license-api-deployment.json) - License API backend
- [EL-001-webrequest-license-handler.json](EL-001-webrequest-license-handler.json) - Desktop app license integration
- [MT5-001-compile-deploy-ea.json](MT5-001-compile-deploy-ea.json) - MT5 EA compilation
- [CT-001-compile-deploy-cbot.json](CT-001-compile-deploy-cbot.json) - cTrader cBot compilation
- [EL-002-named-pipe-support.json](EL-002-named-pipe-support.json) - Named Pipe client
- [MT4-001-develop-mt4-agent.json](MT4-001-develop-mt4-agent.json) - MT4 EA development
- [QA-001-integration-testing.json](QA-001-integration-testing.json) - Testing suite

---

## 🎯 Key Milestones

| Milestone | Target | Criteria |
|-----------|--------|----------|
| **M1** Infrastructure Ready | Day 1 | API deployed, app validates licenses |
| **M2** MT5 & cTrader Deployed | Day 2 | Both platforms connect to app |
| **M3** Testing Complete | Day 3 | All critical tests pass |
| **M4** MT4 Support | Week 1 | All platforms fully supported |

---

## 🔗 Dependencies Graph

```
BE-001 (License API)
   ├──→ MT5-001 (MT5 EA)
   │       └──→ MT4-001 (MT4 EA)
   └──→ CT-001 (cTrader cBot)

EL-001 (License Handler)
   └──→ EL-002 (Named Pipes)

[MT5-001, CT-001, EL-001, EL-002] ──→ QA-001 (Testing)
```

---

## 📝 How to Update Task Status

1. Open the task JSON file
2. Change `"status"` field to one of:
   - `"NOT_STARTED"`
   - `"IN_PROGRESS"`
   - `"BLOCKED"` (add `"blocked_by"` field)
   - `"COMPLETED"`
3. Update `MASTER-TASK-TRACKER.json` status summary

---

## 🧪 Test License Keys

Test license keys have been removed. Create real license keys via the admin API or Supabase dashboard.

Start mock server: `python bin/license_api_server.py`

---

## 📞 Contact

For blocking issues or questions, create a GitHub issue with the `agent-deployment` label.

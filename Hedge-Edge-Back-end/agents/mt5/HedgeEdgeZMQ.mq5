//+------------------------------------------------------------------+
//|                                              HedgeEdgeZMQ.mq5    |
//|                                   Copyright 2026, Hedge Edge     |
//|                                     https://www.hedge-edge.com   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Hedge Edge"
#property link      "https://www.hedge-edge.com"
#property version   "2.00"
#property description "Hedge Edge ZeroMQ EA - High-performance license validation and data streaming"
#property strict

//--- Include ZMQ wrapper
#include "ZMQ.mqh"

//--- DLL imports for license validation
#import "HedgeEdgeLicense.dll"
   int  ValidateLicense(string key, string account, string broker, string deviceId, 
                        string endpointUrl, char &outToken[], char &outError[]);
   int  GetCachedToken(char &outToken[], int tokenLen);
   int  IsTokenValid();
   int  GetTokenTTL();
   void SetEndpoint(string url);
   void ClearCache();
   int  InitializeLibrary();
   void ShutdownLibrary();
#import

//+------------------------------------------------------------------+
//| Input Parameters                                                  |
//+------------------------------------------------------------------+
input group "=== License Settings ==="
input string InpLicenseKey = "";                    // License Key (required)
input string InpDeviceId = "";                      // Device ID (from app, or auto-generate)
input string InpEndpointUrl = "https://api.hedge-edge.com/v1/license/validate"; // API Endpoint
input int    InpPollIntervalSeconds = 600;          // License Check Interval (seconds)
input bool   InpDevMode = true;                     // DEV MODE (bypass license check)

input group "=== ZeroMQ Settings ==="
input string InpZmqDataEndpoint = "tcp://*:51810";  // ZMQ Data Endpoint (PUB socket)
input string InpZmqCommandEndpoint = "tcp://*:51811"; // ZMQ Command Endpoint (REP socket)
input int    InpPublishIntervalMs = 100;            // Publish Interval (milliseconds)
input bool   InpEnableCommands = true;              // Enable Remote Commands

input group "=== Display Settings ==="
input color  InpActiveColor = clrLime;              // Active License Color
input color  InpPausedColor = clrOrange;            // Paused Color  
input color  InpErrorColor = clrRed;                // Error Color

//+------------------------------------------------------------------+
//| Global Variables                                                  |
//+------------------------------------------------------------------+
bool g_isLicenseValid = false;
bool g_isPaused = false;
bool g_dllLoaded = false;
bool g_zmqInitialized = false;
string g_lastError = "";
string g_statusMessage = "Initializing...";
datetime g_lastLicenseCheck = 0;
ulong g_lastPublishTime = 0;
datetime g_tokenExpiry = 0;
string g_deviceId = "";
ulong g_snapshotIndex = 0;
ulong g_totalPublishTimeUs = 0;
ulong g_publishCount = 0;

// ZeroMQ objects
CZmqContext g_zmqContext;
CZmqPublisher g_publisher;
CZmqReplier g_replier;

// Position tracking
struct PositionInfo
{
   ulong  ticket;
   string symbol;
   double volume;
   int    type;
   double entryPrice;
   double currentPrice;
   double stopLoss;
   double takeProfit;
   double profit;
   double swap;
   double commission;
   datetime openTime;
   string comment;
};

PositionInfo g_positions[];

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("═══════════════════════════════════════════════════════════");
   Print("  Hedge Edge ZMQ EA v2.0 - Starting...");
   Print("═══════════════════════════════════════════════════════════");
   
   //--- Initialize ZeroMQ first
   if(!InitializeZMQ())
   {
      g_statusMessage = "ERROR: Failed to initialize ZeroMQ";
      UpdateComment();
      Print(g_statusMessage);
      return INIT_FAILED;
   }
   
   //--- DEV MODE - bypass license check for testing
   if(InpDevMode)
   {
      Print("*** DEV MODE ENABLED - License check bypassed ***");
      g_isLicenseValid = true;
      g_statusMessage = "DEV MODE - Active (ZMQ)";
      g_deviceId = (StringLen(InpDeviceId) > 0) ? InpDeviceId : GenerateDeviceId();
      UpdateComment();
      
      //--- Publish initial snapshot
      PublishSnapshot();
      
      Print("Hedge Edge ZMQ EA initialized successfully in DEV MODE");
      Print("  Data endpoint: ", InpZmqDataEndpoint);
      Print("  Command endpoint: ", InpZmqCommandEndpoint);
      Print("  Publish interval: ", InpPublishIntervalMs, "ms");
      Print("═══════════════════════════════════════════════════════════");
      return INIT_SUCCEEDED;
   }
   
   //--- Validate license key (production mode)
   if(StringLen(InpLicenseKey) == 0)
   {
      g_statusMessage = "ERROR: License Key is required";
      UpdateComment();
      Print(g_statusMessage);
      return INIT_PARAMETERS_INCORRECT;
   }
   
   //--- Initialize DLL
   if(!InitializeDLL())
   {
      g_statusMessage = "ERROR: Failed to load HedgeEdgeLicense.dll";
      UpdateComment();
      Print(g_statusMessage);
      return INIT_FAILED;
   }
   
   //--- Generate or use provided device ID
   g_deviceId = (StringLen(InpDeviceId) > 0) ? InpDeviceId : GenerateDeviceId();
   
   //--- Set API endpoint
   SetEndpoint(InpEndpointUrl);
   
   //--- Initial license validation
   if(!ValidateLicenseWithDLL())
   {
      g_statusMessage = "License validation failed: " + g_lastError;
      UpdateComment();
      Print(g_statusMessage);
      // Don't fail init - allow retry
   }
   else
   {
      g_statusMessage = "Licensed - Active (ZMQ)";
      g_isLicenseValid = true;
   }
   
   UpdateComment();
   
   Print("Hedge Edge ZMQ EA initialized successfully");
   Print("  Data endpoint: ", InpZmqDataEndpoint);
   Print("  Command endpoint: ", InpZmqCommandEndpoint);
   Print("═══════════════════════════════════════════════════════════");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("═══════════════════════════════════════════════════════════");
   Print("  Hedge Edge ZMQ EA - Shutting down...");
   Print("═══════════════════════════════════════════════════════════");
   
   //--- Publish GOODBYE message
   if(g_zmqInitialized)
   {
      PublishGoodbye();
      Sleep(100); // Allow message to be sent
   }
   
   //--- Shutdown ZMQ
   ShutdownZMQ();
   
   //--- Shutdown DLL
   if(g_dllLoaded)
   {
      ClearCache();
      ShutdownLibrary();
      g_dllLoaded = false;
   }
   
   //--- Clear comment
   Comment("");
   ObjectDelete(0, "HedgeEdgeStatus");
   
   Print("Hedge Edge ZMQ EA stopped. Reason: ", reason);
   Print("═══════════════════════════════════════════════════════════");
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Check if enough time has passed for publish
   ulong currentTimeMs = GetTickCount64();
   
   if(currentTimeMs - g_lastPublishTime >= (ulong)InpPublishIntervalMs)
   {
      //--- Process any pending commands
      if(InpEnableCommands && g_zmqInitialized)
      {
         ProcessCommands();
      }
      
      //--- Publish snapshot if not paused
      if(!g_isPaused && g_isLicenseValid && g_zmqInitialized)
      {
         PublishSnapshot();
      }
      
      g_lastPublishTime = currentTimeMs;
   }
   
   //--- Periodic license check (not on every tick)
   if(!InpDevMode && TimeCurrent() - g_lastLicenseCheck >= InpPollIntervalSeconds)
   {
      ValidateLicenseWithDLL();
   }
}

//+------------------------------------------------------------------+
//| Timer function (backup for publish when no ticks)                  |
//+------------------------------------------------------------------+
void OnTimer()
{
   OnTick(); // Reuse tick logic
}

//+------------------------------------------------------------------+
//| Trade transaction handler                                          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   //--- Immediately publish on position changes
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD ||
      trans.type == TRADE_TRANSACTION_POSITION ||
      trans.type == TRADE_TRANSACTION_ORDER_DELETE)
   {
      if(g_zmqInitialized && !g_isPaused && g_isLicenseValid)
      {
         PublishSnapshot();
      }
   }
}

//+------------------------------------------------------------------+
//| Initialize ZeroMQ                                                  |
//+------------------------------------------------------------------+
bool InitializeZMQ()
{
   Print("Initializing ZeroMQ...");
   Print("  ZMQ Version: ", ZmqVersion());
   
   //--- Create context
   if(!g_zmqContext.Initialize())
   {
      Print("ERROR: Failed to create ZMQ context");
      return false;
   }
   
   //--- Create PUB socket for data streaming
   if(!g_publisher.Initialize(g_zmqContext, InpZmqDataEndpoint))
   {
      Print("ERROR: Failed to create PUB socket on ", InpZmqDataEndpoint);
      g_zmqContext.Shutdown();
      return false;
   }
   Print("  PUB socket bound to ", InpZmqDataEndpoint);
   
   //--- Create REP socket for commands
   if(InpEnableCommands)
   {
      if(!g_replier.Initialize(g_zmqContext, InpZmqCommandEndpoint))
      {
         Print("ERROR: Failed to create REP socket on ", InpZmqCommandEndpoint);
         g_publisher.Shutdown();
         g_zmqContext.Shutdown();
         return false;
      }
      Print("  REP socket bound to ", InpZmqCommandEndpoint);
   }
   
   //--- Set up timer as backup (in case no ticks)
   EventSetMillisecondTimer(InpPublishIntervalMs);
   
   g_zmqInitialized = true;
   Print("ZeroMQ initialized successfully");
   return true;
}

//+------------------------------------------------------------------+
//| Shutdown ZeroMQ                                                    |
//+------------------------------------------------------------------+
void ShutdownZMQ()
{
   if(!g_zmqInitialized)
      return;
   
   Print("Shutting down ZeroMQ...");
   
   EventKillTimer();
   
   g_replier.Shutdown();
   g_publisher.Shutdown();
   g_zmqContext.Shutdown();
   
   g_zmqInitialized = false;
   Print("ZeroMQ shutdown complete");
}

//+------------------------------------------------------------------+
//| Publish account snapshot via ZMQ                                   |
//+------------------------------------------------------------------+
void PublishSnapshot()
{
   if(!g_zmqInitialized)
      return;
   
   ulong startTime = GetMicrosecondCount();
   
   //--- Gather position data
   GatherPositions();
   
   //--- Build JSON
   string json = BuildSnapshotJson("SNAPSHOT");
   
   //--- Publish via ZMQ
   int sent = g_publisher.PublishJson(json);
   
   if(sent < 0)
   {
      Print("WARNING: Failed to publish snapshot, error: ", ZmqLastError());
      return;
   }
   
   //--- Update stats
   g_snapshotIndex++;
   ulong elapsed = GetMicrosecondCount() - startTime;
   g_totalPublishTimeUs += elapsed;
   g_publishCount++;
}

//+------------------------------------------------------------------+
//| Publish GOODBYE message                                            |
//+------------------------------------------------------------------+
void PublishGoodbye()
{
   if(!g_zmqInitialized)
      return;
   
   string json = BuildSnapshotJson("GOODBYE");
   g_publisher.PublishJson(json);
   Print("Published GOODBYE message");
}

//+------------------------------------------------------------------+
//| Process incoming commands via ZMQ                                  |
//+------------------------------------------------------------------+
void ProcessCommands()
{
   if(!g_zmqInitialized || !InpEnableCommands)
      return;
   
   string request = "";
   
   //--- Non-blocking poll for commands
   if(!g_replier.Poll(request))
      return; // No command waiting
   
   Print("Received command: ", request);
   
   //--- Parse command (simple JSON parsing)
   string action = ExtractJsonValue(request, "action");
   string response = "";
   
   if(action == "PAUSE")
   {
      g_isPaused = true;
      g_statusMessage = "Licensed - Paused (ZMQ)";
      UpdateComment();
      response = "{\"success\":true,\"action\":\"PAUSE\",\"message\":\"Trading paused\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   }
   else if(action == "RESUME")
   {
      if(g_isLicenseValid || InpDevMode)
      {
         g_isPaused = false;
         g_statusMessage = InpDevMode ? "DEV MODE - Active (ZMQ)" : "Licensed - Active (ZMQ)";
         UpdateComment();
         response = "{\"success\":true,\"action\":\"RESUME\",\"message\":\"Trading resumed\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
      }
      else
      {
         response = "{\"success\":false,\"action\":\"RESUME\",\"error\":\"Cannot resume: license invalid\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
      }
   }
   else if(action == "CLOSE_ALL")
   {
      response = CloseAllPositions();
   }
   else if(action == "CLOSE_POSITION")
   {
      string positionId = ExtractJsonValue(request, "positionId");
      response = ClosePositionById(positionId);
   }
   else if(action == "STATUS")
   {
      //--- Return full snapshot as STATUS response
      GatherPositions();
      response = BuildSnapshotJson("STATUS_RESPONSE");
   }
   else if(action == "PING")
   {
      response = "{\"success\":true,\"action\":\"PING\",\"pong\":true,\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   }
   else if(action == "CONFIG")
   {
      response = StringFormat(
         "{\"success\":true,\"action\":\"CONFIG\",\"config\":{\"zmqEnabled\":true,\"dataPort\":51810,\"commandPort\":51811,\"publishIntervalMs\":%d,\"licenseCheckIntervalSec\":%d},\"timestamp\":\"%s\"}",
         InpPublishIntervalMs,
         InpPollIntervalSeconds,
         TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
      );
   }
   else
   {
      response = "{\"success\":false,\"action\":\"UNKNOWN\",\"error\":\"Unknown command: " + action + "\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   }
   
   //--- Send response
   if(!g_replier.Reply(response))
   {
      Print("WARNING: Failed to send command response");
   }
   
   Print("Sent response for command: ", action);
}

//+------------------------------------------------------------------+
//| Gather open positions                                              |
//+------------------------------------------------------------------+
void GatherPositions()
{
   int totalPositions = PositionsTotal();
   ArrayResize(g_positions, totalPositions);
   
   for(int i = 0; i < totalPositions; i++)
   {
      if(PositionSelectByTicket(PositionGetTicket(i)))
      {
         g_positions[i].ticket = PositionGetInteger(POSITION_TICKET);
         g_positions[i].symbol = PositionGetString(POSITION_SYMBOL);
         g_positions[i].volume = PositionGetDouble(POSITION_VOLUME);
         g_positions[i].type = (int)PositionGetInteger(POSITION_TYPE);
         g_positions[i].entryPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         g_positions[i].stopLoss = PositionGetDouble(POSITION_SL);
         g_positions[i].takeProfit = PositionGetDouble(POSITION_TP);
         g_positions[i].profit = PositionGetDouble(POSITION_PROFIT);
         g_positions[i].swap = PositionGetDouble(POSITION_SWAP);
         g_positions[i].commission = PositionGetDouble(POSITION_COMMISSION);
         g_positions[i].openTime = (datetime)PositionGetInteger(POSITION_TIME);
         g_positions[i].comment = PositionGetString(POSITION_COMMENT);
         
         //--- Get current price
         string symbol = g_positions[i].symbol;
         if(g_positions[i].type == POSITION_TYPE_BUY)
            g_positions[i].currentPrice = SymbolInfoDouble(symbol, SYMBOL_BID);
         else
            g_positions[i].currentPrice = SymbolInfoDouble(symbol, SYMBOL_ASK);
      }
   }
}

//+------------------------------------------------------------------+
//| Build snapshot JSON                                                |
//+------------------------------------------------------------------+
string BuildSnapshotJson(string messageType)
{
   //--- Calculate average latency
   double avgLatencyUs = (g_publishCount > 0) ? (double)g_totalPublishTimeUs / g_publishCount : 0;
   
   string json = "{";
   
   //--- Message type
   json += "\"type\":\"" + messageType + "\",";
   
   //--- Timestamp (ISO 8601 format)
   json += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\",";
   
   //--- Platform info
   json += "\"platform\":\"MT5\",";
   json += "\"accountId\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"broker\":\"" + EscapeJson(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   json += "\"server\":\"" + EscapeJson(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   
   //--- Account metrics
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
   json += "\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
   
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   if(marginLevel > 0)
      json += "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ",";
   else
      json += "\"marginLevel\":null,";
   
   json += "\"floatingPnL\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
   json += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
   json += "\"leverage\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
   
   //--- Status
   json += "\"status\":\"" + EscapeJson(g_statusMessage) + "\",";
   json += "\"isLicenseValid\":" + (g_isLicenseValid ? "true" : "false") + ",";
   json += "\"isPaused\":" + (g_isPaused ? "true" : "false") + ",";
   json += "\"lastError\":" + (StringLen(g_lastError) > 0 ? "\"" + EscapeJson(g_lastError) + "\"" : "null") + ",";
   
   //--- ZMQ-specific fields
   json += "\"zmqMode\":true,";
   json += "\"snapshotIndex\":" + IntegerToString(g_snapshotIndex) + ",";
   json += "\"avgLatencyUs\":" + DoubleToString(avgLatencyUs, 2) + ",";
   
   //--- Positions array
   json += "\"positions\":[";
   
   for(int i = 0; i < ArraySize(g_positions); i++)
   {
      if(i > 0) json += ",";
      
      json += "{";
      json += "\"id\":\"" + IntegerToString(g_positions[i].ticket) + "\",";
      json += "\"symbol\":\"" + g_positions[i].symbol + "\",";
      json += "\"volume\":" + DoubleToString(g_positions[i].volume * 100000, 0) + ","; // Volume in units
      json += "\"volumeLots\":" + DoubleToString(g_positions[i].volume, 2) + ",";
      json += "\"side\":\"" + (g_positions[i].type == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
      json += "\"entryPrice\":" + DoubleToString(g_positions[i].entryPrice, 5) + ",";
      json += "\"currentPrice\":" + DoubleToString(g_positions[i].currentPrice, 5) + ",";
      json += "\"stopLoss\":" + (g_positions[i].stopLoss > 0 ? DoubleToString(g_positions[i].stopLoss, 5) : "null") + ",";
      json += "\"takeProfit\":" + (g_positions[i].takeProfit > 0 ? DoubleToString(g_positions[i].takeProfit, 5) : "null") + ",";
      json += "\"profit\":" + DoubleToString(g_positions[i].profit, 2) + ",";
      json += "\"swap\":" + DoubleToString(g_positions[i].swap, 2) + ",";
      json += "\"commission\":" + DoubleToString(g_positions[i].commission, 2) + ",";
      json += "\"openTime\":\"" + TimeToString(g_positions[i].openTime, TIME_DATE|TIME_SECONDS) + "\",";
      json += "\"comment\":\"" + EscapeJson(g_positions[i].comment) + "\"";
      json += "}";
   }
   
   json += "]}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Initialize DLL                                                     |
//+------------------------------------------------------------------+
bool InitializeDLL()
{
   int result = InitializeLibrary();
   
   if(result == 0)
   {
      g_dllLoaded = true;
      Print("HedgeEdgeLicense.dll loaded successfully");
      return true;
   }
   
   g_lastError = "DLL initialization failed with code: " + IntegerToString(result);
   Print(g_lastError);
   return false;
}

//+------------------------------------------------------------------+
//| Validate license using DLL                                         |
//+------------------------------------------------------------------+
bool ValidateLicenseWithDLL()
{
   if(!g_dllLoaded)
   {
      g_lastError = "DLL not loaded";
      return false;
   }
   
   char tokenBuffer[512];
   char errorBuffer[256];
   
   ArrayInitialize(tokenBuffer, 0);
   ArrayInitialize(errorBuffer, 0);
   
   string accountId = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   
   int result = ValidateLicense(
      InpLicenseKey,
      accountId,
      broker,
      g_deviceId,
      InpEndpointUrl,
      tokenBuffer,
      errorBuffer
   );
   
   g_lastLicenseCheck = TimeCurrent();
   
   if(result == 0)
   {
      g_isLicenseValid = true;
      g_lastError = "";
      
      int ttl = GetTokenTTL();
      if(ttl > 0)
         g_tokenExpiry = TimeCurrent() + ttl;
      
      g_statusMessage = "Licensed - Active (ZMQ)";
      UpdateComment();
      Print("License validated successfully. TTL: ", ttl, " seconds");
      return true;
   }
   else
   {
      g_isLicenseValid = false;
      g_lastError = CharArrayToString(errorBuffer);
      
      if(StringLen(g_lastError) == 0)
         g_lastError = "Validation failed with code: " + IntegerToString(result);
      
      g_statusMessage = "License Invalid: " + g_lastError;
      UpdateComment();
      Print("License validation failed: ", g_lastError);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Generate device ID                                                 |
//+------------------------------------------------------------------+
string GenerateDeviceId()
{
   string rawId = TerminalInfoString(TERMINAL_NAME) + 
                  TerminalInfoString(TERMINAL_PATH) +
                  IntegerToString(TerminalInfoInteger(TERMINAL_BUILD)) +
                  AccountInfoString(ACCOUNT_SERVER);
   
   ulong hash = 0;
   for(int i = 0; i < StringLen(rawId); i++)
   {
      hash = hash * 31 + StringGetCharacter(rawId, i);
   }
   
   return StringFormat("%016llX", hash);
}

//+------------------------------------------------------------------+
//| Escape JSON string                                                 |
//+------------------------------------------------------------------+
string EscapeJson(string text)
{
   StringReplace(text, "\\", "\\\\");
   StringReplace(text, "\"", "\\\"");
   StringReplace(text, "\n", "\\n");
   StringReplace(text, "\r", "\\r");
   StringReplace(text, "\t", "\\t");
   return text;
}

//+------------------------------------------------------------------+
//| Extract JSON value (simple parser)                                 |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key)
{
   string searchKey = "\"" + key + "\":";
   int keyPos = StringFind(json, searchKey);
   
   if(keyPos < 0)
      return "";
   
   int valueStart = keyPos + StringLen(searchKey);
   
   while(valueStart < StringLen(json) && StringGetCharacter(json, valueStart) == ' ')
      valueStart++;
   
   if(valueStart >= StringLen(json))
      return "";
   
   ushort firstChar = StringGetCharacter(json, valueStart);
   
   if(firstChar == '"')
   {
      valueStart++;
      int valueEnd = StringFind(json, "\"", valueStart);
      if(valueEnd < 0) return "";
      return StringSubstr(json, valueStart, valueEnd - valueStart);
   }
   else
   {
      int valueEnd = valueStart;
      while(valueEnd < StringLen(json))
      {
         ushort ch = StringGetCharacter(json, valueEnd);
         if(ch == ',' || ch == '}' || ch == ']' || ch == ' ')
            break;
         valueEnd++;
      }
      return StringSubstr(json, valueStart, valueEnd - valueStart);
   }
}

//+------------------------------------------------------------------+
//| Close all positions                                                |
//+------------------------------------------------------------------+
string CloseAllPositions()
{
   if(!g_isLicenseValid && !InpDevMode)
      return "{\"success\":false,\"action\":\"CLOSE_ALL\",\"error\":\"License invalid\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   
   int closedCount = 0;
   string errors = "";
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         if(ClosePositionByTicket(ticket))
            closedCount++;
         else
         {
            if(StringLen(errors) > 0) errors += ", ";
            errors += IntegerToString(ticket) + ": " + IntegerToString(GetLastError());
         }
      }
   }
   
   Print("Close all: ", closedCount, " positions closed");
   
   return StringFormat(
      "{\"success\":%s,\"action\":\"CLOSE_ALL\",\"closedCount\":%d,\"errors\":\"%s\",\"timestamp\":\"%s\"}",
      (StringLen(errors) == 0 ? "true" : "false"),
      closedCount,
      EscapeJson(errors),
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );
}

//+------------------------------------------------------------------+
//| Close position by ID                                               |
//+------------------------------------------------------------------+
string ClosePositionById(string positionId)
{
   ulong ticket = (ulong)StringToInteger(positionId);
   
   if(ticket == 0)
      return "{\"success\":false,\"action\":\"CLOSE_POSITION\",\"error\":\"Invalid position ID\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   
   if(ClosePositionByTicket(ticket))
      return "{\"success\":true,\"action\":\"CLOSE_POSITION\",\"positionId\":\"" + positionId + "\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   else
      return "{\"success\":false,\"action\":\"CLOSE_POSITION\",\"error\":\"Close failed: " + IntegerToString(GetLastError()) + "\",\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
}

//+------------------------------------------------------------------+
//| Close position by ticket                                           |
//+------------------------------------------------------------------+
bool ClosePositionByTicket(ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
      return false;
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.position = ticket;
   request.symbol = PositionGetString(POSITION_SYMBOL);
   request.volume = PositionGetDouble(POSITION_VOLUME);
   request.deviation = 10;
   request.magic = 0;
   
   if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
   {
      request.type = ORDER_TYPE_SELL;
      request.price = SymbolInfoDouble(request.symbol, SYMBOL_BID);
   }
   else
   {
      request.type = ORDER_TYPE_BUY;
      request.price = SymbolInfoDouble(request.symbol, SYMBOL_ASK);
   }
   
   if(!OrderSend(request, result))
   {
      Print("Close position failed: ", result.retcode, " - ", result.comment);
      return false;
   }
   
   return result.retcode == TRADE_RETCODE_DONE;
}

//+------------------------------------------------------------------+
//| Update chart comment                                               |
//+------------------------------------------------------------------+
void UpdateComment()
{
   color textColor;
   
   if(!g_isLicenseValid && !InpDevMode)
      textColor = InpErrorColor;
   else if(g_isPaused)
      textColor = InpPausedColor;
   else
      textColor = InpActiveColor;
   
   string commentText = "🔗 Hedge Edge (ZMQ): " + g_statusMessage;
   
   Comment(commentText);
   
   string objName = "HedgeEdgeStatus";
   
   if(ObjectFind(0, objName) < 0)
   {
      ObjectCreate(0, objName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, objName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, 20);
      ObjectSetInteger(0, objName, OBJPROP_FONTSIZE, 10);
      ObjectSetString(0, objName, OBJPROP_FONT, "Arial Bold");
   }
   
   ObjectSetString(0, objName, OBJPROP_TEXT, commentText);
   ObjectSetInteger(0, objName, OBJPROP_COLOR, textColor);
   
   ChartRedraw(0);
}
//+------------------------------------------------------------------+

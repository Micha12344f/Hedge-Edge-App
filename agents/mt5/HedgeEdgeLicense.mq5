//+------------------------------------------------------------------+
//|                                           HedgeEdgeLicense.mq5   |
//|                                   Copyright 2026, Hedge Edge     |
//|                                     https://www.hedge-edge.com   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Hedge Edge"
#property link      "https://www.hedge-edge.com"
#property version   "1.00"
#property description "Hedge Edge License EA - Validates subscription and streams account data"
#property strict

//--- DLL imports
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

input group "=== Communication Settings ==="
input string InpStatusChannel = "HedgeEdgeMT5";     // Status Channel (pipe/file name)
input int    InpDataEmitInterval = 1;               // Data Emit Interval (seconds)
input bool   InpEnableCommands = true;              // Enable Remote Commands

input group "=== Display Settings ==="
input color  InpActiveColor = clrLime;              // Active License Color
input color  InpPausedColor = clrOrange;            // Paused Color  
input color  InpErrorColor = clrRed;                // Error Color
input int    InpCommentLine = 0;                    // Comment Line Position

//+------------------------------------------------------------------+
//| Global Variables                                                  |
//+------------------------------------------------------------------+
bool g_isLicenseValid = false;
bool g_isPaused = false;
bool g_dllLoaded = false;
string g_lastError = "";
string g_statusMessage = "Initializing...";
datetime g_lastLicenseCheck = 0;
datetime g_lastDataEmit = 0;
datetime g_tokenExpiry = 0;

int g_pipeHandle = INVALID_HANDLE;
int g_commandPipeHandle = INVALID_HANDLE;
string g_deviceId = "";

// Position tracking
struct PositionInfo
{
   ulong  ticket;
   string symbol;
   double volume;
   int    type;      // POSITION_TYPE_BUY or POSITION_TYPE_SELL
   double entryPrice;
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
   Print("Hedge Edge License EA initializing...");
   
   //--- Validate license key
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
   if(StringLen(InpDeviceId) > 0)
   {
      g_deviceId = InpDeviceId;
   }
   else
   {
      g_deviceId = GenerateDeviceId();
   }
   
   //--- Set API endpoint
   SetEndpoint(InpEndpointUrl);
   
   //--- Initial license validation
   if(!ValidateLicenseWithDLL())
   {
      g_statusMessage = "License validation failed: " + g_lastError;
      UpdateComment();
      Print(g_statusMessage);
      return INIT_FAILED;
   }
   
   //--- Open status channel (named pipe)
   if(!OpenStatusChannel())
   {
      Print("Warning: Could not open status channel. Data streaming disabled.");
   }
   
   //--- Set timer for periodic checks
   int timerInterval = MathMin(InpDataEmitInterval, InpPollIntervalSeconds);
   EventSetTimer(timerInterval);
   
   g_statusMessage = "Licensed - Active";
   g_isLicenseValid = true;
   UpdateComment();
   
   Print("Hedge Edge License EA initialized successfully");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("Hedge Edge License EA shutting down...");
   
   //--- Kill timer
   EventKillTimer();
   
   //--- Close channels
   CloseStatusChannel();
   
   //--- Shutdown DLL
   if(g_dllLoaded)
   {
      ClearCache();
      ShutdownLibrary();
      g_dllLoaded = false;
   }
   
   //--- Clear comment
   Comment("");
   
   Print("Hedge Edge License EA stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   //--- Check if paused
   if(g_isPaused)
      return;
   
   //--- Check license validity
   if(!g_isLicenseValid)
   {
      // Attempt to revalidate if enough time has passed
      if(TimeCurrent() - g_lastLicenseCheck >= InpPollIntervalSeconds)
      {
         ValidateLicenseWithDLL();
      }
      return;
   }
   
   //--- Normal trading operations would go here
   // (This EA is for license management, not trading logic)
}

//+------------------------------------------------------------------+
//| Timer function                                                     |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime currentTime = TimeCurrent();
   
   //--- Periodic license check
   if(currentTime - g_lastLicenseCheck >= InpPollIntervalSeconds)
   {
      Print("Performing periodic license check...");
      
      if(!ValidateLicenseWithDLL())
      {
         g_isLicenseValid = false;
         g_statusMessage = "License expired/invalid: " + g_lastError;
         UpdateComment();
         Alert("Hedge Edge: License validation failed - ", g_lastError);
      }
   }
   
   //--- Check token expiry (refresh 60 seconds before)
   if(g_tokenExpiry > 0 && currentTime >= g_tokenExpiry - 60)
   {
      Print("Token expiring soon, refreshing...");
      ValidateLicenseWithDLL();
   }
   
   //--- Emit data
   if(currentTime - g_lastDataEmit >= InpDataEmitInterval)
   {
      EmitAccountData();
      g_lastDataEmit = currentTime;
   }
   
   //--- Check for commands
   if(InpEnableCommands)
   {
      ProcessCommands();
   }
}

//+------------------------------------------------------------------+
//| Trade transaction handler                                          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   //--- Emit data on position changes
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD ||
      trans.type == TRADE_TRANSACTION_POSITION ||
      trans.type == TRADE_TRANSACTION_ORDER_DELETE)
   {
      EmitAccountData();
   }
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
      
      // Get token TTL to set expiry
      int ttl = GetTokenTTL();
      if(ttl > 0)
      {
         g_tokenExpiry = TimeCurrent() + ttl;
      }
      
      g_statusMessage = "Licensed - Active";
      UpdateComment();
      Print("License validated successfully. TTL: ", ttl, " seconds");
      return true;
   }
   else
   {
      g_isLicenseValid = false;
      g_lastError = CharArrayToString(errorBuffer);
      
      if(StringLen(g_lastError) == 0)
      {
         g_lastError = "Validation failed with code: " + IntegerToString(result);
      }
      
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
   // Combine terminal info to create unique device ID
   string rawId = TerminalInfoString(TERMINAL_NAME) + 
                  TerminalInfoString(TERMINAL_PATH) +
                  IntegerToString(TerminalInfoInteger(TERMINAL_BUILD)) +
                  AccountInfoString(ACCOUNT_SERVER);
   
   // Simple hash (in production, use proper hashing)
   ulong hash = 0;
   for(int i = 0; i < StringLen(rawId); i++)
   {
      hash = hash * 31 + StringGetCharacter(rawId, i);
   }
   
   return StringFormat("%016llX", hash);
}

//+------------------------------------------------------------------+
//| Open status channel                                                |
//+------------------------------------------------------------------+
bool OpenStatusChannel()
{
   string pipePath = "\\\\.\\pipe\\" + InpStatusChannel;
   
   // For file-based fallback if pipe fails
   string filePath = TerminalInfoString(TERMINAL_DATA_PATH) + 
                     "\\MQL5\\Files\\" + InpStatusChannel + ".json";
   
   // Try named pipe first (Windows)
   g_pipeHandle = FileOpen(pipePath, FILE_WRITE|FILE_BIN|FILE_SHARE_READ);
   
   if(g_pipeHandle == INVALID_HANDLE)
   {
      // Fallback to file-based communication
      g_pipeHandle = FileOpen(InpStatusChannel + ".json", FILE_WRITE|FILE_TXT|FILE_SHARE_READ);
      
      if(g_pipeHandle == INVALID_HANDLE)
      {
         Print("Error opening status channel: ", GetLastError());
         return false;
      }
      
      Print("Status channel opened (file mode): ", filePath);
   }
   else
   {
      Print("Status channel opened (pipe mode): ", pipePath);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Close status channel                                               |
//+------------------------------------------------------------------+
void CloseStatusChannel()
{
   if(g_pipeHandle != INVALID_HANDLE)
   {
      FileClose(g_pipeHandle);
      g_pipeHandle = INVALID_HANDLE;
   }
   
   if(g_commandPipeHandle != INVALID_HANDLE)
   {
      FileClose(g_commandPipeHandle);
      g_commandPipeHandle = INVALID_HANDLE;
   }
}

//+------------------------------------------------------------------+
//| Emit account data                                                  |
//+------------------------------------------------------------------+
void EmitAccountData()
{
   if(g_pipeHandle == INVALID_HANDLE)
   {
      // Try to reopen
      if(!OpenStatusChannel())
         return;
   }
   
   //--- Gather position data
   GatherPositions();
   
   //--- Build JSON
   string json = BuildAccountJson();
   
   //--- Write to channel
   FileSeek(g_pipeHandle, 0, SEEK_SET);
   
   uint bytesWritten = FileWriteString(g_pipeHandle, json);
   
   if(bytesWritten == 0)
   {
      Print("Error writing to status channel: ", GetLastError());
      FileClose(g_pipeHandle);
      g_pipeHandle = INVALID_HANDLE;
   }
   
   FileFlush(g_pipeHandle);
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
      }
   }
}

//+------------------------------------------------------------------+
//| Build account JSON                                                 |
//+------------------------------------------------------------------+
string BuildAccountJson()
{
   string json = "{";
   
   //--- Timestamp
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
   json += "\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2) + ",";
   json += "\"floatingPnL\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
   json += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
   json += "\"leverage\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
   
   //--- Status
   json += "\"status\":\"" + EscapeJson(g_statusMessage) + "\",";
   json += "\"isLicenseValid\":" + (g_isLicenseValid ? "true" : "false") + ",";
   json += "\"isPaused\":" + (g_isPaused ? "true" : "false") + ",";
   json += "\"lastError\":" + (StringLen(g_lastError) > 0 ? "\"" + EscapeJson(g_lastError) + "\"" : "null") + ",";
   
   //--- Positions array
   json += "\"positions\":[";
   
   for(int i = 0; i < ArraySize(g_positions); i++)
   {
      if(i > 0) json += ",";
      
      json += "{";
      json += "\"id\":\"" + IntegerToString(g_positions[i].ticket) + "\",";
      json += "\"symbol\":\"" + g_positions[i].symbol + "\",";
      json += "\"volume\":" + DoubleToString(g_positions[i].volume, 2) + ",";
      json += "\"volumeLots\":" + DoubleToString(g_positions[i].volume, 2) + ",";
      json += "\"side\":\"" + (g_positions[i].type == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
      json += "\"entryPrice\":" + DoubleToString(g_positions[i].entryPrice, 5) + ",";
      json += "\"currentPrice\":" + DoubleToString(SymbolInfoDouble(g_positions[i].symbol, 
               g_positions[i].type == POSITION_TYPE_BUY ? SYMBOL_BID : SYMBOL_ASK), 5) + ",";
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
//| Process commands from app                                          |
//+------------------------------------------------------------------+
void ProcessCommands()
{
   string commandFile = InpStatusChannel + "_cmd.json";
   
   // Check if command file exists
   if(!FileIsExist(commandFile))
      return;
   
   int cmdHandle = FileOpen(commandFile, FILE_READ|FILE_TXT);
   if(cmdHandle == INVALID_HANDLE)
      return;
   
   string cmdJson = FileReadString(cmdHandle);
   FileClose(cmdHandle);
   
   // Delete command file after reading
   FileDelete(commandFile);
   
   if(StringLen(cmdJson) == 0)
      return;
   
   Print("Received command: ", cmdJson);
   
   // Parse command (simple parsing)
   string action = ExtractJsonValue(cmdJson, "action");
   string response = "";
   
   if(action == "PAUSE")
   {
      g_isPaused = true;
      g_statusMessage = "Licensed - Paused";
      UpdateComment();
      response = "{\"success\":true,\"message\":\"Trading paused\"}";
   }
   else if(action == "RESUME")
   {
      if(g_isLicenseValid)
      {
         g_isPaused = false;
         g_statusMessage = "Licensed - Active";
         UpdateComment();
         response = "{\"success\":true,\"message\":\"Trading resumed\"}";
      }
      else
      {
         response = "{\"success\":false,\"error\":\"Cannot resume: license invalid\"}";
      }
   }
   else if(action == "CLOSE_ALL")
   {
      response = CloseAllPositions();
   }
   else if(action == "CLOSE_POSITION")
   {
      string positionId = ExtractJsonValue(cmdJson, "positionId");
      response = ClosePositionById(positionId);
   }
   else if(action == "STATUS")
   {
      response = StringFormat(
         "{\"success\":true,\"isLicenseValid\":%s,\"isPaused\":%s,\"status\":\"%s\",\"openPositions\":%d}",
         g_isLicenseValid ? "true" : "false",
         g_isPaused ? "true" : "false",
         EscapeJson(g_statusMessage),
         PositionsTotal()
      );
   }
   else
   {
      response = "{\"success\":false,\"error\":\"Unknown command: " + action + "\"}";
   }
   
   // Write response
   WriteCommandResponse(response);
}

//+------------------------------------------------------------------+
//| Write command response                                             |
//+------------------------------------------------------------------+
void WriteCommandResponse(string response)
{
   string responseFile = InpStatusChannel + "_resp.json";
   
   int respHandle = FileOpen(responseFile, FILE_WRITE|FILE_TXT);
   if(respHandle != INVALID_HANDLE)
   {
      FileWriteString(respHandle, response);
      FileClose(respHandle);
   }
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
   
   // Skip whitespace
   while(valueStart < StringLen(json) && StringGetCharacter(json, valueStart) == ' ')
      valueStart++;
   
   if(valueStart >= StringLen(json))
      return "";
   
   ushort firstChar = StringGetCharacter(json, valueStart);
   
   if(firstChar == '"')
   {
      // String value
      valueStart++;
      int valueEnd = StringFind(json, "\"", valueStart);
      if(valueEnd < 0) return "";
      return StringSubstr(json, valueStart, valueEnd - valueStart);
   }
   else
   {
      // Non-string value (number, boolean, null)
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
   if(!g_isLicenseValid)
   {
      return "{\"success\":false,\"error\":\"License invalid\"}";
   }
   
   int closedCount = 0;
   string errors = "";
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         if(ClosePositionByTicket(ticket))
         {
            closedCount++;
         }
         else
         {
            if(StringLen(errors) > 0) errors += ", ";
            errors += IntegerToString(ticket) + ": " + IntegerToString(GetLastError());
         }
      }
   }
   
   Print("Close all: ", closedCount, " positions closed");
   
   if(StringLen(errors) == 0)
   {
      return StringFormat("{\"success\":true,\"closedCount\":%d,\"errors\":[]}", closedCount);
   }
   else
   {
      return StringFormat("{\"success\":false,\"closedCount\":%d,\"errors\":[\"%s\"]}", closedCount, EscapeJson(errors));
   }
}

//+------------------------------------------------------------------+
//| Close position by ID                                               |
//+------------------------------------------------------------------+
string ClosePositionById(string positionId)
{
   ulong ticket = (ulong)StringToInteger(positionId);
   
   if(ticket == 0)
   {
      return "{\"success\":false,\"error\":\"Invalid position ID\"}";
   }
   
   if(ClosePositionByTicket(ticket))
   {
      return "{\"success\":true}";
   }
   else
   {
      return "{\"success\":false,\"error\":\"Close failed: " + IntegerToString(GetLastError()) + "\"}";
   }
}

//+------------------------------------------------------------------+
//| Close position by ticket                                           |
//+------------------------------------------------------------------+
bool ClosePositionByTicket(ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
   {
      return false;
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.position = ticket;
   request.symbol = PositionGetString(POSITION_SYMBOL);
   request.volume = PositionGetDouble(POSITION_VOLUME);
   request.deviation = 10;
   request.magic = 0;
   
   // Determine close direction
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
   
   if(!g_isLicenseValid)
   {
      textColor = InpErrorColor;
   }
   else if(g_isPaused)
   {
      textColor = InpPausedColor;
   }
   else
   {
      textColor = InpActiveColor;
   }
   
   string commentText = "Hedge Edge: " + g_statusMessage;
   
   // Use chart comment
   Comment(commentText);
   
   // Also create chart label for color
   string objName = "HedgeEdgeStatus";
   
   if(ObjectFind(0, objName) < 0)
   {
      ObjectCreate(0, objName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, objName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, 10);
      ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, 20 + InpCommentLine * 20);
      ObjectSetInteger(0, objName, OBJPROP_FONTSIZE, 10);
      ObjectSetString(0, objName, OBJPROP_FONT, "Arial Bold");
   }
   
   ObjectSetString(0, objName, OBJPROP_TEXT, commentText);
   ObjectSetInteger(0, objName, OBJPROP_COLOR, textColor);
   
   ChartRedraw(0);
}
//+------------------------------------------------------------------+

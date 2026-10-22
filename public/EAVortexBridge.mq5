// EA VORTEX Bridge — compile in MetaEditor, then attach to ONE chart per bot.
// Tools > Options > Expert Advisors: allow WebRequest for your website origin.
// Inputs: published HTTPS BridgeURL, private BridgeToken, ExpectedLogin, ExpectedServer.
// Demo hedging accounts only by default. This connector executes queued orders;
// it does not generate signals. Keep MT5 and Algo Trading running (PC or VPS).
// Start/Pause/Stop control NEW orders, not existing positions. Never share tokens.
// Execution intent is flushed before broker submission. Uncertain submissions are
// reconciled from history, never retried. Keep the journal files after restarts.
// Server delivery has no lease: a lost poll response can leave an order 'sent'.
// Review such orders in MT5 before manually replacing them. No profit guarantees.
#property strict
#property version "1.00"
#property description "EA VORTEX authenticated queued-order connector. Demo hedging first."
#include <Trade/Trade.mqh>

input string BridgeURL = "https://vertextest.lovable.app/api/public/bridge/mt5";
input string BridgeToken = "";
input long ExpectedLogin = 0;
input string ExpectedServer = "";
input bool DemoOnly = true;
input double MaxLot = 0.10;
input int MaxOpenPositions = 3;
input int MaxSpreadPoints = 50;
input int DeviationPoints = 10;
input int PollSeconds = 5;
input int RequestTimeoutMs = 10000;
input ulong MagicNumber = 26052201;

struct Record {
   string id, symbol, side, phase, error;
   double volume, sl, tp, price, profit;
   ulong ticket, position;
   datetime submitted;
   bool reported;
};
Record records[];
CTrade trade;
int journal = INVALID_HANDLE, lockFile = INVALID_HANDLE;
bool busy = false, storageOK = true;
string journalName;

string Encode(string value) {
   uchar bytes[];
   int n = StringToCharArray(value, bytes, 0, WHOLE_ARRAY, CP_UTF8);
   string out = "";
   for(int i=0; i<n-1; i++) {
      int c = bytes[i];
      if((c>=65 && c<=90) || (c>=97 && c<=122) || (c>=48 && c<=57) || c==45 || c==46 || c==95 || c==126)
         out += CharToString((uchar)c);
      else out += StringFormat("%%%02X", c);
   }
   return out;
}
string Clean(string value) {
   StringReplace(value, "|", " "); StringReplace(value, "\r", " "); StringReplace(value, "\n", " ");
   return StringSubstr(value, 0, 180);
}
string Tag(string id) { StringReplace(id, "-", ""); return "EVX" + StringSubstr(id, 0, 28); }
int Find(string id) { for(int i=0; i<ArraySize(records); i++) if(records[i].id==id) return i; return -1; }
bool ValidID(string id) {
   if(StringLen(id)!=36) return false;
   for(int i=0; i<36; i++) {
      ushort c=StringGetCharacter(id,i);
      if(i==8 || i==13 || i==18 || i==23) { if(c!=45) return false; }
      else if(!((c>=48 && c<=57) || (c>=97 && c<=102))) return false;
   }
   return true;
}
bool NumberText(string value) {
   if(StringLen(value)==0) return false;
   int dots=0, digits=0;
   for(int i=0; i<StringLen(value); i++) {
      ushort c=StringGetCharacter(value,i);
      if(c==46) { dots++; if(dots>1) return false; }
      else if(c>=48 && c<=57) digits++;
      else return false;
   }
   return digits>0;
}
bool Save(int i) {
   if(!storageOK || journal==INVALID_HANDLE) return false;
   Record r=records[i];
   ResetLastError();
   FileSeek(journal,0,SEEK_END);
   uint wrote=FileWrite(journal,r.id,r.symbol,r.side,DoubleToString(r.volume,8),DoubleToString(r.sl,8),DoubleToString(r.tp,8),r.phase,
      (string)r.ticket,(string)r.position,DoubleToString(r.price,8),DoubleToString(r.profit,8),Clean(r.error),(string)(long)r.submitted,r.reported ? "1" : "0");
   FileFlush(journal);
   if(wrote==0 || GetLastError()!=0) { storageOK=false; Print("Bridge journal error; new execution disabled. Check disk and restart after repair."); return false; }
   return true;
}
bool LoadJournal() {
   FileSeek(journal,0,SEEK_SET);
   while(!FileIsEnding(journal)) {
      string id=FileReadString(journal);
      if(id=="" && FileIsEnding(journal)) break;
      Record r;
      r.id=id; r.symbol=FileReadString(journal); r.side=FileReadString(journal);
      r.volume=StringToDouble(FileReadString(journal)); r.sl=StringToDouble(FileReadString(journal)); r.tp=StringToDouble(FileReadString(journal));
      r.phase=FileReadString(journal); r.ticket=(ulong)StringToInteger(FileReadString(journal)); r.position=(ulong)StringToInteger(FileReadString(journal));
      r.price=StringToDouble(FileReadString(journal)); r.profit=StringToDouble(FileReadString(journal)); r.error=FileReadString(journal);
      r.submitted=(datetime)StringToInteger(FileReadString(journal)); r.reported=FileReadString(journal)=="1";
      if(!ValidID(id) || (r.phase!="intent" && r.phase!="filled" && r.phase!="rejected" && r.phase!="closed") || !FileIsLineEnding(journal)) {
         Print("Bridge journal is incomplete; execution disabled. Preserve the file and reconcile MT5 history before repair."); return false;
      }
      int i=Find(id); if(i<0) { i=ArraySize(records); ArrayResize(records,i+1); } records[i]=r;
   }
   return true;
}
bool AccountOK() {
   return AccountInfoInteger(ACCOUNT_LOGIN)==ExpectedLogin && AccountInfoString(ACCOUNT_SERVER)==ExpectedServer &&
      (!DemoOnly || AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_DEMO);
}
int Post(string body,string &response) {
   response="";
   if(!AccountOK()) return -1;
   char payload[], result[];
   int n=StringToCharArray(body,payload,0,WHOLE_ARRAY,CP_UTF8);
   ArrayResize(payload,n-1); // WebRequest must not receive the UTF-8 terminal NUL.
   string headers="Content-Type: application/x-www-form-urlencoded\r\nx-bridge-token: "+BridgeToken+"\r\n";
   string responseHeaders;
   ResetLastError();
   int status=WebRequest("POST",BridgeURL,headers,RequestTimeoutMs,payload,result,responseHeaders);
   if(status==200) response=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
   else if(status==-1) PrintFormat("Bridge request unavailable (MT5 error %d). Check connection and WebRequest allow-list.",GetLastError());
   else PrintFormat("Bridge HTTP %d; no new orders executed from this response.",status);
   // Never log tokens, request headers, or response bodies.
   return status;
}
string Heartbeat(string action) {
   return "action="+action+"&login="+(string)ExpectedLogin+"&server="+Encode(ExpectedServer)+
      "&demo="+(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_DEMO ? "1" : "0")+
      "&balance="+DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)+"&equity="+DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)+
      "&currency="+Encode(AccountInfoString(ACCOUNT_CURRENCY))+"&open="+(string)PositionsTotal();
}
bool Unresolved() { for(int i=0;i<ArraySize(records);i++) if(records[i].phase=="intent" || !records[i].reported) return true; return false; }
bool TradingOK() {
   return AccountOK() && storageOK && TerminalInfoInteger(TERMINAL_CONNECTED) && TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) &&
      MQLInfoInteger(MQL_TRADE_ALLOWED) && AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) && AccountInfoInteger(ACCOUNT_TRADE_EXPERT) &&
      AccountInfoInteger(ACCOUNT_MARGIN_MODE)==ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}
void Reject(int i,string reason) { records[i].phase="rejected"; records[i].error=Clean(reason); records[i].reported=false; Save(i); }
void Report(int i) {
   if(records[i].phase=="intent" || records[i].reported) return;
   Record r=records[i];
   string body="action=report&id="+Encode(r.id)+"&result="+r.phase+"&ticket="+(string)r.ticket+"&price="+DoubleToString(r.price,8);
   if(r.phase=="closed") body+="&profit="+DoubleToString(r.profit,8);
   if(r.phase=="rejected") body+="&error="+Encode(r.error);
   string response;
   if(Post(body,response)==200 && response=="OK") { records[i].reported=true; Save(i); }
}
// Recover submissions from broker history, including after a terminal crash.
// The order is NEVER resubmitted when its outcome is uncertain.
void Reconcile(int i) {
   if(records[i].phase!="intent") return;
   if(!HistorySelect(records[i].submitted-120,TimeCurrent()+60)) return;
   for(int d=0;d<HistoryDealsTotal();d++) {
      ulong deal=HistoryDealGetTicket(d);
      if((ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)!=MagicNumber || HistoryDealGetString(deal,DEAL_COMMENT)!=Tag(records[i].id)) continue;
      if(HistoryDealGetInteger(deal,DEAL_ENTRY)!=DEAL_ENTRY_IN) continue;
      records[i].ticket=(ulong)HistoryDealGetInteger(deal,DEAL_ORDER);
      records[i].position=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
      records[i].price=HistoryDealGetDouble(deal,DEAL_PRICE);
      records[i].phase="filled"; records[i].reported=false; Save(i); return;
   }
}
void CheckClosed(int i) {
   if(records[i].phase!="filled" || !records[i].reported || records[i].position==0) return;
   for(int p=0;p<PositionsTotal();p++) {
      ulong ticket=PositionGetTicket(p);
      if(ticket>0 && (ulong)PositionGetInteger(POSITION_IDENTIFIER)==records[i].position) return;
   }
   if(!HistorySelectByPosition(records[i].position)) return;
   double net=0, price=0; bool exitFound=false;
   for(int d=0;d<HistoryDealsTotal();d++) {
      ulong deal=HistoryDealGetTicket(d);
      net+=HistoryDealGetDouble(deal,DEAL_PROFIT)+HistoryDealGetDouble(deal,DEAL_SWAP)+HistoryDealGetDouble(deal,DEAL_COMMISSION)+HistoryDealGetDouble(deal,DEAL_FEE);
      long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY) { exitFound=true; price=HistoryDealGetDouble(deal,DEAL_PRICE); }
   }
   if(!exitFound) return;
   records[i].phase="closed"; records[i].price=price; records[i].profit=net; records[i].reported=false; Save(i);
}
void ProcessLine(string line) {
   StringReplace(line,"\r","");
   string f[];
   if(StringSplit(line,'|',f)!=7 || f[0]!="SIG" || !ValidID(f[1])) { Print("Bridge ignored malformed signal."); return; }
   int previous=Find(f[1]); if(previous>=0) { Reconcile(previous); Report(previous); return; }
   // Recheck cloud state for each delivered order. Stop cannot retract a broker submission.
   string state;
   bool allowed=TradingOK() && !Unresolved() && Post(Heartbeat("heartbeat"),state)==200 && state=="OK|running";
   int i=ArraySize(records); ArrayResize(records,i+1);
   Record r; ZeroMemory(r);
   r.id=f[1]; r.symbol=f[2]; r.side=f[3]; r.volume=StringToDouble(f[4]); r.sl=StringToDouble(f[5]); r.tp=StringToDouble(f[6]);
   r.phase="intent"; r.submitted=TimeCurrent(); records[i]=r;
   if(!Save(i)) return;
   if(!allowed) { Reject(i,"Terminal safety checks failed or bot is no longer running; not submitted"); Report(i); return; }
   if((r.side!="buy" && r.side!="sell") || !NumberText(f[4]) || !NumberText(f[5]) || !NumberText(f[6]) || r.volume<=0 || r.volume>MaxLot ||
      r.symbol=="" || StringLen(r.symbol)>20) { Reject(i,"Invalid signal or terminal maximum lot exceeded"); Report(i); return; }
   if(PositionsTotal()>=MaxOpenPositions) { Reject(i,"Terminal maximum open positions reached"); Report(i); return; }
   if(!SymbolSelect(r.symbol,true)) { Reject(i,"Exact broker symbol is unavailable"); Report(i); return; }
   MqlTick tick;
   if(!SymbolInfoTick(r.symbol,tick) || tick.bid<=0 || tick.ask<=0 || tick.time<TimeCurrent()-60) { Reject(i,"Fresh broker quote unavailable"); Report(i); return; }
   double point=SymbolInfoDouble(r.symbol,SYMBOL_POINT), step=SymbolInfoDouble(r.symbol,SYMBOL_VOLUME_STEP);
   double tickSize=SymbolInfoDouble(r.symbol,SYMBOL_TRADE_TICK_SIZE);
   double minVol=SymbolInfoDouble(r.symbol,SYMBOL_VOLUME_MIN), maxVol=SymbolInfoDouble(r.symbol,SYMBOL_VOLUME_MAX);
   if(point<=0 || step<=0 || tickSize<=0 || r.volume<minVol || r.volume>maxVol || MathAbs(r.volume/step-MathRound(r.volume/step))>0.000001) {
      Reject(i,"Volume does not match broker minimum, maximum or step"); Report(i); return;
   }
   if((tick.ask-tick.bid)/point>MaxSpreadPoints) { Reject(i,"Broker spread exceeds terminal limit"); Report(i); return; }
   double distance=(double)SymbolInfoInteger(r.symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
   double base=r.side=="buy" ? tick.bid : tick.ask;
   bool badSL=r.sl>0 && (r.side=="buy" ? r.sl>=base || base-r.sl<distance : r.sl<=base || r.sl-base<distance);
   bool badTP=r.tp>0 && (r.side=="buy" ? r.tp<=base || r.tp-base<distance : r.tp>=base || base-r.tp<distance);
   if(badSL || badTP || (r.sl>0 && MathAbs(r.sl/tickSize-MathRound(r.sl/tickSize))>0.000001) ||
      (r.tp>0 && MathAbs(r.tp/tickSize-MathRound(r.tp/tickSize))>0.000001)) { Reject(i,"Stop prices violate broker direction, distance or tick size"); Report(i); return; }
   if(!trade.SetTypeFillingBySymbol(r.symbol)) { Reject(i,"Broker filling mode unavailable"); Report(i); return; }
   bool submitted=r.side=="buy" ? trade.Buy(r.volume,r.symbol,0,r.sl,r.tp,Tag(r.id)) : trade.Sell(r.volume,r.symbol,0,r.sl,r.tp,Tag(r.id));
   uint code=trade.ResultRetcode();
   if(code==TRADE_RETCODE_DONE || code==TRADE_RETCODE_DONE_PARTIAL) {
      ulong deal=trade.ResultDeal();
      if(deal>0 && HistoryDealSelect(deal)) {
         records[i].ticket=trade.ResultOrder(); records[i].position=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
         records[i].price=HistoryDealGetDouble(deal,DEAL_PRICE); records[i].phase="filled"; Save(i);
      } else Reconcile(i);
      if(code==TRADE_RETCODE_DONE_PARTIAL) Print("Bridge partial fill: review actual volume in MT5. Unfilled volume is not resubmitted.");
   } else if(code==TRADE_RETCODE_TIMEOUT || code==TRADE_RETCODE_CONNECTION || code==TRADE_RETCODE_PLACED || code==TRADE_RETCODE_ERROR || code==0) {
      Print("Bridge submission uncertain; checking broker history. No retry or new orders until reconciled."); Reconcile(i);
   } else {
      Reject(i,"MT5 retcode "+(string)code+": "+trade.ResultRetcodeDescription());
   }
   Report(i);
}
int OnInit() {
   if(StringFind(BridgeURL,"https://")!=0 || StringFind(BridgeURL,"/api/public/bridge/mt5")<8 || StringFind(BridgeURL,"?")>=0 || StringFind(BridgeURL,"#")>=0 ||
      StringFind(BridgeURL,"@")>=0 || StringLen(BridgeToken)!=52 || StringSubstr(BridgeToken,0,4)!="evx_" || ExpectedLogin<=0 || ExpectedServer=="" ||
      MaxLot<=0 || MaxOpenPositions<1 || MaxSpreadPoints<1 || DeviationPoints<0 || PollSeconds<2 || RequestTimeoutMs<1000 || RequestTimeoutMs>30000 || MagicNumber==0) {
      Print("Bridge inputs invalid. Supply HTTPS endpoint, token, exact account login/server and positive safety limits."); return INIT_PARAMETERS_INCORRECT;
   }
   for(int i=4;i<52;i++) { ushort c=StringGetCharacter(BridgeToken,i); if(!((c>=48 && c<=57) || (c>=97 && c<=102))) return INIT_PARAMETERS_INCORRECT; }
   if(!AccountOK() || AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) {
      Print("Bridge requires the configured account and a hedging terminal; demo-only is enabled by default."); return INIT_FAILED;
   }
   // Account-wide exclusive lock (no FILE_SHARE flags) prevents duplicate chart instances.
   // Different terminals/VPS installations must NOT connect the same bot simultaneously.
   string safeServer=ExpectedServer; StringReplace(safeServer,"/","_"); StringReplace(safeServer,"\\","_"); StringReplace(safeServer,":","_");
   string base="EVX_"+safeServer+"_"+(string)ExpectedLogin;
   lockFile=FileOpen(base+".lock",FILE_READ|FILE_WRITE|FILE_BIN|FILE_COMMON);
   if(lockFile==INVALID_HANDLE) { Print("Another Bridge holds this account lock; use only one chart per account."); return INIT_FAILED; }
   journalName=base+"_"+(string)MagicNumber+".csv";
   journal=FileOpen(journalName,FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,'|',CP_UTF8);
   if(journal==INVALID_HANDLE || !LoadJournal()) { if(journal!=INVALID_HANDLE) FileClose(journal); FileClose(lockFile); journal=INVALID_HANDLE; lockFile=INVALID_HANDLE; return INIT_FAILED; }
   trade.SetExpertMagicNumber(MagicNumber); trade.SetDeviationInPoints(DeviationPoints); trade.SetAsyncMode(false);
   if(!EventSetTimer(PollSeconds)) { FileClose(journal); FileClose(lockFile); journal=INVALID_HANDLE; lockFile=INVALID_HANDLE; return INIT_FAILED; }
   Print("EA VORTEX Bridge ready. Keep MT5 open; this EA executes queued signals, not an autonomous strategy.");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) {
   EventKillTimer();
   if(journal!=INVALID_HANDLE) FileClose(journal);
   if(lockFile!=INVALID_HANDLE) FileClose(lockFile);
}
void OnTimer() {
   if(busy || !AccountOK() || !storageOK) return;
   busy=true;
   for(int i=0;i<ArraySize(records);i++) { Reconcile(i); Report(i); CheckClosed(i); Report(i); }
   string response;
   // Continue heartbeat/reporting while paused, stopped or Algo Trading disabled.
   string action=TradingOK() && !Unresolved() && PositionsTotal()<MaxOpenPositions ? "poll" : "heartbeat";
   if(Post(Heartbeat(action),response)==200 && action=="poll" && StringFind(response,"SIG|")==0) {
      string lines[]; int n=StringSplit(response,'\n',lines);
      for(int i=0;i<n;i++) ProcessLine(lines[i]);
   }
   busy=false;
}

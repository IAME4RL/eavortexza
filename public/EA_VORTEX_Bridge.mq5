// EA_VORTEX_Bridge.mq5 — EA VORTEX MetaTrader 5 bridge (source). Compile in MetaEditor (F7).
// Tools > Options > Expert Advisors: enable Algo Trading and allow WebRequest for your EA VORTEX website origin.
// Attach to ONE chart per bot. The chart symbol/timeframe is what the EA VORTEX Strategy Engine evaluates.
// Inputs: published HTTPS BridgeURL, private BridgeToken (from your dashboard), ExpectedLogin, ExpectedServer.
// DEMO accounts trade only when the bot is in demo mode. REAL accounts trade only when BOTH the dashboard
// has confirmed live mode AND AllowLiveTrading=true here. Contest/unknown account types never trade.
// STOP blocks new orders; it never closes positions. Emergency close runs only on a separately confirmed request.
// Every order requires a stop loss so risk per trade can be verified. The EA never bypasses broker rules.
// Execution intent is journaled before submission; uncertain submissions are reconciled from history, never retried.
// Never share your token. Trading carries risk; no profit is guaranteed.
#property strict
#property version "2.00"
#property description "EA VORTEX Bridge — authenticated demo/live connector with strategy engine, risk limits and emergency close."
#include <Trade/Trade.mqh>

input string BridgeURL = "https://YOUR-SITE/api/public/bridge/mt5";
input string BridgeToken = "";
input long ExpectedLogin = 0;
input string ExpectedServer = "";
input bool AllowLiveTrading = false;      // second, terminal-side permission for REAL accounts
input double MaxLot = 0.10;               // terminal cap (effective = min with dashboard)
input int MaxOpenPositions = 3;           // terminal cap
input double MaxRiskPercent = 1.0;        // terminal cap on loss-at-stop as % of balance
input double MaxDailyLoss = 50.0;         // terminal cap in account currency
input int MaxSpreadPoints = 50;
input int DeviationPoints = 10;
input int PollSeconds = 5;
input int RequestTimeoutMs = 10000;
input int StrategyBars = 120;
input ulong MagicNumber = 26052201;

#define BRIDGE_VERSION "2.0.0"

struct Record {
   string id, symbol, side, phase, error;
   double volume, sl, tp, price, profit;
   ulong ticket, position;
   datetime submitted;
   bool reported;
};
struct Config {
   bool valid; string status, mode, strategy, hold; bool liveConfirmed;
   double maxLot, riskPct, maxDailyLoss; int maxOpen;
};
Record records[];
Config cfg;
CTrade trade;
int journal = INVALID_HANDLE, lockFile = INVALID_HANDLE;
bool busy = false, storageOK = true;
string journalName, emergencyDone = "", emergencyPending = "";
int emergencyClosed = 0, emergencyFailed = 0;

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
   StringReplace(value, ";", " "); StringReplace(value, ",", " ");
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
// ---------- account identity & type (never guessed) ----------
string AccountType() {
   long m=AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(m==ACCOUNT_TRADE_MODE_DEMO) return "demo";
   if(m==ACCOUNT_TRADE_MODE_REAL) return "real";
   return "contest";
}
bool IdentityOK() { return AccountInfoInteger(ACCOUNT_LOGIN)==ExpectedLogin && AccountInfoString(ACCOUNT_SERVER)==ExpectedServer; }
// Demo/live separation, enforced on the terminal side as well as the backend.
bool ModeOK() {
   if(!cfg.valid) return false;
   string t=AccountType();
   if(t=="demo") return cfg.mode=="demo";
   if(t=="real") return cfg.mode=="live" && cfg.liveConfirmed && AllowLiveTrading;
   return false;
}
// ---------- journal ----------
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
// ---------- HTTP ----------
int Post(string body,string &response) {
   response="";
   if(!IdentityOK()) return -1;
   char payload[], result[];
   int n=StringToCharArray(body,payload,0,WHOLE_ARRAY,CP_UTF8);
   ArrayResize(payload,n-1); // WebRequest must not receive the UTF-8 terminal NUL.
   string headers="Content-Type: application/x-www-form-urlencoded\r\nx-bridge-token: "+BridgeToken+"\r\n";
   string responseHeaders;
   ResetLastError();
   int status=WebRequest("POST",BridgeURL,headers,RequestTimeoutMs,payload,result,responseHeaders);
   if(status==200) response=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
   else if(status==-1) PrintFormat("Bridge connection unavailable (MT5 error %d). Check internet and the WebRequest allow-list. No orders placed.",GetLastError());
   else if(status==401) Print("Bridge authentication failed (HTTP 401). Create a new token in the dashboard. No orders placed.");
   else PrintFormat("Bridge HTTP %d; no new orders executed from this response.",status);
   // Never log tokens, request headers, or response bodies.
   return status;
}
double DayPL() {
   MqlDateTime d; TimeToStruct(TimeCurrent(),d); d.hour=0; d.min=0; d.sec=0;
   double pl=0;
   if(HistorySelect(StructToTime(d),TimeCurrent()+60))
      for(int i=0;i<HistoryDealsTotal();i++) {
         ulong deal=HistoryDealGetTicket(i);
         if((ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)!=MagicNumber) continue;
         pl+=HistoryDealGetDouble(deal,DEAL_PROFIT)+HistoryDealGetDouble(deal,DEAL_SWAP)+HistoryDealGetDouble(deal,DEAL_COMMISSION)+HistoryDealGetDouble(deal,DEAL_FEE);
      }
   for(int p=0;p<PositionsTotal();p++) {
      ulong t=PositionGetTicket(p);
      if(t>0 && (ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber) pl+=PositionGetDouble(POSITION_PROFIT)+PositionGetDouble(POSITION_SWAP);
   }
   return pl;
}
int BotPositions() {
   int n=0;
   for(int p=0;p<PositionsTotal();p++) { ulong t=PositionGetTicket(p); if(t>0 && (ulong)PositionGetInteger(POSITION_MAGIC)==MagicNumber) n++; }
   return n;
}
string PositionsText() {
   string out="";
   for(int p=0;p<PositionsTotal() && p<50;p++) {
      ulong t=PositionGetTicket(p);
      if(t==0) continue;
      string s=PositionGetString(POSITION_SYMBOL);
      int dg=(int)SymbolInfoInteger(s,SYMBOL_DIGITS);
      if(out!="") out+=";";
      out+=(string)t+","+Clean(s)+","+(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? "buy" : "sell")+","+
         DoubleToString(PositionGetDouble(POSITION_VOLUME),2)+","+DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN),dg)+","+
         DoubleToString(PositionGetDouble(POSITION_PROFIT),2);
   }
   return out;
}
string BarsText() {
   MqlRates rates[];
   int n=CopyRates(_Symbol,_Period,1,StrategyBars,rates); // start at 1: CLOSED bars only
   if(n<=0) return "";
   string out="";
   for(int i=0;i<n;i++) {
      if(i>0) out+=";";
      out+=(string)(long)rates[i].time+","+DoubleToString(rates[i].open,_Digits)+","+DoubleToString(rates[i].high,_Digits)+","+
         DoubleToString(rates[i].low,_Digits)+","+DoubleToString(rates[i].close,_Digits);
   }
   return out;
}
string Heartbeat(string action) {
   string tf=EnumToString(_Period); StringReplace(tf,"PERIOD_","");
   string body="action="+action+"&version="+BRIDGE_VERSION+"&login="+(string)ExpectedLogin+"&server="+Encode(ExpectedServer)+
      "&type="+AccountType()+"&balance="+DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)+"&equity="+DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)+
      "&currency="+Encode(AccountInfoString(ACCOUNT_CURRENCY))+"&open="+(string)BotPositions()+"&daypl="+DoubleToString(DayPL(),2)+
      "&positions="+Encode(PositionsText())+"&symbol="+Encode(_Symbol)+"&tf="+tf+"&digits="+(string)_Digits;
   if(action=="poll") body+="&bars="+Encode(BarsText());
   return body;
}
bool ParseConfig(string line) {
   string f[];
   cfg.valid=false;
   if(StringSplit(line,'|',f)!=10 || f[0]!="CFG") return false;
   cfg.status=f[1]; cfg.mode=f[2]; cfg.liveConfirmed=f[3]=="1";
   cfg.maxLot=StringToDouble(f[4]); cfg.maxOpen=(int)StringToInteger(f[5]); cfg.riskPct=StringToDouble(f[6]);
   cfg.maxDailyLoss=StringToDouble(f[7]); cfg.strategy=f[8]; cfg.hold=f[9];
   if((cfg.mode!="demo" && cfg.mode!="live") || cfg.maxLot<=0 || cfg.maxOpen<1 || cfg.riskPct<=0 || cfg.maxDailyLoss<=0) return false;
   cfg.valid=true;
   return true;
}
bool Unresolved() { for(int i=0;i<ArraySize(records);i++) if(records[i].phase=="intent" || !records[i].reported) return true; return false; }
bool TradingOK() {
   return IdentityOK() && storageOK && TerminalInfoInteger(TERMINAL_CONNECTED) && TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) &&
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
   int code=Post(body,response);
   if(code==200 && response=="OK") { records[i].reported=true; Save(i); }
   else if(code==409 || code==404) { records[i].reported=true; Save(i); Print("Bridge report not accepted by backend; marked reviewed. Check MT5 history."); }
}
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
   // No deal after 10 minutes: the broker never accepted it. Report rejection (never resubmit).
   if(TimeCurrent()-records[i].submitted>600) Reject(i,"No broker deal found after submission; not retried");
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
double Snap(double v,double tickSize,int digits) { return v<=0 ? 0 : NormalizeDouble(MathRound(v/tickSize)*tickSize,digits); }
void ProcessSignal(string line) {
   string f[];
   if(StringSplit(line,'|',f)!=7 || f[0]!="SIG" || !ValidID(f[1])) { Print("Bridge ignored malformed signal."); return; }
   int previous=Find(f[1]); if(previous>=0) { Reconcile(previous); Report(previous); return; } // duplicate delivery: never re-execute
   int i=ArraySize(records); ArrayResize(records,i+1);
   Record r; ZeroMemory(r);
   r.id=f[1]; r.symbol=f[2]; r.side=f[3]; r.volume=StringToDouble(f[4]); r.sl=StringToDouble(f[5]); r.tp=StringToDouble(f[6]);
   r.phase="intent"; r.submitted=TimeCurrent(); records[i]=r;
   if(!Save(i)) return;
   double effMaxLot=MathMin(MaxLot,cfg.maxLot), effRisk=MathMin(MaxRiskPercent,cfg.riskPct), effDaily=MathMin(MaxDailyLoss,cfg.maxDailyLoss);
   int effOpen=(int)MathMin(MaxOpenPositions,cfg.maxOpen);
   if(!TradingOK() || !cfg.valid || cfg.status!="running" || cfg.hold!="NONE") { Reject(i,"Bot not running or terminal permissions unavailable; not submitted"); Report(i); return; }
   if(!ModeOK()) { Reject(i,"Account type "+AccountType()+" does not match bot mode "+cfg.mode+(AccountType()=="real" && !AllowLiveTrading ? " (AllowLiveTrading is off)" : "")); Report(i); return; }
   if((r.side!="buy" && r.side!="sell") || !NumberText(f[4]) || !NumberText(f[5]) || !NumberText(f[6]) || r.volume<=0 || r.volume>effMaxLot ||
      r.symbol=="" || StringLen(r.symbol)>30) { Reject(i,"Invalid signal or maximum lot exceeded"); Report(i); return; }
   if(r.sl<=0) { Reject(i,"Stop loss required so risk per trade can be verified"); Report(i); return; }
   if(BotPositions()>=effOpen) { Reject(i,"Maximum open positions reached"); Report(i); return; }
   if(DayPL()<=-effDaily) { Reject(i,"Daily loss limit reached"); Report(i); return; }
   if(!SymbolSelect(r.symbol,true)) { Reject(i,"Exact broker symbol is unavailable"); Report(i); return; }
   MqlTick tick;
   if(!SymbolInfoTick(r.symbol,tick) || tick.bid<=0 || tick.ask<=0 || tick.time<TimeCurrent()-60) { Reject(i,"Fresh broker quote unavailable"); Report(i); return; }
   double point=SymbolInfoDouble(r.symbol,SYMBOL_POINT), step=SymbolInfoDouble(r.symbol,SYMBOL_VOLUME_STEP);
   double tickSize=SymbolInfoDouble(r.symbol,SYMBOL_TRADE_TICK_SIZE); int digits=(int)SymbolInfoInteger(r.symbol,SYMBOL_DIGITS);
   double minVol=SymbolInfoDouble(r.symbol,SYMBOL_VOLUME_MIN), maxVol=SymbolInfoDouble(r.symbol,SYMBOL_VOLUME_MAX);
   if(point<=0 || step<=0 || tickSize<=0 || r.volume<minVol || r.volume>maxVol || MathAbs(r.volume/step-MathRound(r.volume/step))>0.000001) {
      Reject(i,"Volume does not match broker minimum, maximum or step"); Report(i); return;
   }
   if((tick.ask-tick.bid)/point>MaxSpreadPoints) { Reject(i,"Broker spread exceeds terminal limit"); Report(i); return; }
   r.sl=Snap(r.sl,tickSize,digits); r.tp=Snap(r.tp,tickSize,digits); records[i].sl=r.sl; records[i].tp=r.tp;
   double distance=(double)SymbolInfoInteger(r.symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
   double entry=r.side=="buy" ? tick.ask : tick.bid, base=r.side=="buy" ? tick.bid : tick.ask;
   bool badSL=r.side=="buy" ? r.sl>=base || base-r.sl<distance : r.sl<=base || r.sl-base<distance;
   bool badTP=r.tp>0 && (r.side=="buy" ? r.tp<=base || r.tp-base<distance : r.tp>=base || base-r.tp<distance);
   if(badSL || badTP) { Reject(i,"Stop prices violate broker direction or minimum distance"); Report(i); return; }
   double lossAtStop=0;
   if(!OrderCalcProfit(r.side=="buy" ? ORDER_TYPE_BUY : ORDER_TYPE_SELL,r.symbol,r.volume,entry,r.sl,lossAtStop)) { Reject(i,"Could not calculate risk at stop loss"); Report(i); return; }
   double balance=AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance<=0 || -lossAtStop>balance*effRisk/100.0) { Reject(i,StringFormat("Risk at stop %.2f exceeds %.2f%% of balance",-lossAtStop,effRisk)); Report(i); return; }
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
// Emergency close: only this EA's positions (MagicNumber), executed under broker rules; failures are reported, not hidden.
void EmergencyClose(string requested) {
   if(requested==emergencyDone) return;
   if(requested!=emergencyPending) {
      emergencyClosed=0; emergencyFailed=0;
      for(int p=PositionsTotal()-1;p>=0;p--) {
         ulong t=PositionGetTicket(p);
         if(t==0 || (ulong)PositionGetInteger(POSITION_MAGIC)!=MagicNumber) continue;
         if(trade.PositionClose(t,DeviationPoints) && trade.ResultRetcode()==TRADE_RETCODE_DONE) emergencyClosed++; else emergencyFailed++;
      }
      emergencyPending=requested;
      PrintFormat("Bridge emergency close: closed %d, failed %d.",emergencyClosed,emergencyFailed);
   }
   string response;
   if(Post("action=emergency&requested="+Encode(requested)+"&closed="+(string)emergencyClosed+"&failed="+(string)emergencyFailed,response)==200) emergencyDone=requested;
}
int OnInit() {
   if(StringFind(BridgeURL,"https://")!=0 || StringFind(BridgeURL,"/api/public/bridge/mt5")<8 || StringFind(BridgeURL,"?")>=0 || StringFind(BridgeURL,"#")>=0 ||
      StringFind(BridgeURL,"@")>=0 || StringLen(BridgeToken)!=52 || StringSubstr(BridgeToken,0,4)!="evx_" || ExpectedLogin<=0 || ExpectedServer=="" ||
      MaxLot<=0 || MaxOpenPositions<1 || MaxRiskPercent<=0 || MaxRiskPercent>5 || MaxDailyLoss<=0 || MaxSpreadPoints<1 || DeviationPoints<0 ||
      PollSeconds<2 || RequestTimeoutMs<1000 || RequestTimeoutMs>30000 || StrategyBars<60 || StrategyBars>300 || MagicNumber==0) {
      Print("Bridge inputs invalid. Supply HTTPS endpoint, token, exact account login/server and positive safety limits."); return INIT_PARAMETERS_INCORRECT;
   }
   for(int i=4;i<52;i++) { ushort c=StringGetCharacter(BridgeToken,i); if(!((c>=48 && c<=57) || (c>=97 && c<=102))) return INIT_PARAMETERS_INCORRECT; }
   if(!IdentityOK()) { Print("Bridge: terminal login/server do not match ExpectedLogin/ExpectedServer. Not connecting."); return INIT_FAILED; }
   if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING) { Print("Bridge requires a hedging account."); return INIT_FAILED; }
   PrintFormat("Bridge: connected account type is %s.",AccountType());
   string safeServer=ExpectedServer; StringReplace(safeServer,"/","_"); StringReplace(safeServer,"\\","_"); StringReplace(safeServer,":","_");
   string base="EVX_"+safeServer+"_"+(string)ExpectedLogin;
   lockFile=FileOpen(base+".lock",FILE_READ|FILE_WRITE|FILE_BIN|FILE_COMMON);
   if(lockFile==INVALID_HANDLE) { Print("Another Bridge holds this account lock; use only one chart per account."); return INIT_FAILED; }
   journalName=base+"_"+(string)MagicNumber+".csv";
   journal=FileOpen(journalName,FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,'|',CP_UTF8);
   if(journal==INVALID_HANDLE || !LoadJournal()) { if(journal!=INVALID_HANDLE) FileClose(journal); FileClose(lockFile); journal=INVALID_HANDLE; lockFile=INVALID_HANDLE; return INIT_FAILED; }
   trade.SetExpertMagicNumber(MagicNumber); trade.SetDeviationInPoints(DeviationPoints); trade.SetAsyncMode(false);
   cfg.valid=false;
   if(!EventSetTimer(PollSeconds)) { FileClose(journal); FileClose(lockFile); journal=INVALID_HANDLE; lockFile=INVALID_HANDLE; return INIT_FAILED; }
   Print("EA VORTEX Bridge ready. Keep MT5 open and Algo Trading enabled.");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) {
   EventKillTimer();
   if(journal!=INVALID_HANDLE) FileClose(journal);
   if(lockFile!=INVALID_HANDLE) FileClose(lockFile);
}
void OnTimer() {
   if(busy || !storageOK) return;
   if(!IdentityOK()) { cfg.valid=false; Print("Bridge: account changed in terminal; paused until ExpectedLogin/ExpectedServer match."); return; }
   busy=true;
   for(int i=0;i<ArraySize(records);i++) { Reconcile(i); Report(i); CheckClosed(i); Report(i); }
   string response;
   string action=TradingOK() && !Unresolved() && ModeOK() ? "poll" : "heartbeat";
   int code=Post(Heartbeat(action),response);
   if(code!=200) { cfg.valid=false; busy=false; return; } // connection loss / auth failure: no orders
   string lines[]; int n=StringSplit(response,'\n',lines);
   if(n<1) { cfg.valid=false; busy=false; return; }
   StringReplace(lines[0],"\r","");
   if(!ParseConfig(lines[0])) { Print("Bridge: configuration could not be verified; no orders."); busy=false; return; }
   for(int i=1;i<n;i++) {
      string l=lines[i]; StringReplace(l,"\r","");
      if(StringFind(l,"CLOSEALL|")==0) EmergencyClose(StringSubstr(l,9));
      else if(StringFind(l,"SIG|")==0 && action=="poll") ProcessSignal(l);
   }
   busy=false;
}

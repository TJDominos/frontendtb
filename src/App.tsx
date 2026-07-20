// WLT Execution Engine - Main Dashboard Component
import React, { useEffect } from 'react';
import { 
  Activity, Wallet, RefreshCw, TrendingUp, TrendingDown, 
  Settings, Users, Clock, Calendar, CheckSquare, 
  Square, Trash2, Plus, Code, Lock, Search, FileText, Key, Eye, EyeOff, Shield, ChevronLeft, ChevronRight, Server, Archive
} from 'lucide-react';
import { useStore } from './store';

const CONTRACT_ADDRESS = "";
const TOTAL_WLT_SUPPLY = 1000000000; // 1 Billion

const workerAlgorithmTemplate = `// --- SERVERLESS TRADING ENGINE (Cloudflare Worker) ---
// Triggered by Helius Webhooks on contract activity.
// 0 idle compute costs. Executes only when a relevant Tx happens.

import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    
    // 1. Parse Helius Webhook Payload (Enriched Transactions)
    const txs = await request.json();

    for (const tx of txs) {
      console.log(\`Analyzing Tx: \${tx.signature}\`);
      
      // 2. Look for large Outsider Swaps (Whale Detection)
      const isLargeBuy = tx.events?.swap?.nativeInput?.amount > 1_000_000_000; // >1000 USDC
      
      if (isLargeBuy) {
        // 3. Trigger Pullback Strategy
        ctx.waitUntil(executePullback(env, 0.02)); // Run asynchronously in background
      }
      
      // 4. Check Volatility Bounds
      // ... logic to query pool price and compare to MA ...
    }

    // Acknowledge receipt to Helius super fast (under 200ms)
    return new Response('OK', { status: 200 });
  }
};

async function executePullback(env, percentage) {
  const connection = new Connection(env.RPC_URL);
  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(env.BOT_SECRET_KEY)));
  
  console.log(\`Executing \${percentage * 100}% pull back...\`);
  // Build swap transaction, sign with bot wallet, and send via RPC
  // ...
}
`;

// --- FORMATTERS ---
const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNum = (val) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);

// --- REUSABLE COMPONENTS ---
const DateRangePicker = ({ dateRange, setDateRange, hasDateRange, children }: any) => (
  <div className="flex flex-wrap gap-6 items-end bg-slate-900/50 p-5 rounded-xl border border-slate-800 shadow-sm w-full">
    <div className="flex flex-wrap gap-4 items-end">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">From Date</label>
        <input 
          type="date" 
          value={dateRange.from}
          className="h-10 w-[160px] rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 [&::-webkit-calendar-picker-indicator]:invert-[0.8] [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 cursor-pointer" 
          onChange={(e) => setDateRange({...dateRange, from: e.target.value})} 
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">To Date</label>
        <input 
          type="date" 
          value={dateRange.to}
          className="h-10 w-[160px] rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 [&::-webkit-calendar-picker-indicator]:invert-[0.8] [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 cursor-pointer" 
          onChange={(e) => setDateRange({...dateRange, to: e.target.value})} 
        />
      </div>
      {hasDateRange && (
        <div className="h-10 flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 rounded-md border border-emerald-500/20">
          <CheckSquare size={14} className="mr-1.5" /> Difference metrics active
        </div>
      )}
    </div>
    {children && (
      <div className="flex-1 flex justify-end min-w-[300px]">
        {children}
      </div>
    )}
  </div>
);

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }: any) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;
  
  const indexOfFirstLog = (currentPage - 1) * itemsPerPage;
  const indexOfLastLog = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="p-3 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center text-sm">
      <span className="text-slate-500 text-xs">
        Showing {indexOfFirstLog + 1} to {indexOfLastLog} of {totalItems} entries
      </span>
      <div className="flex gap-1">
        <button 
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="px-3 py-1 text-slate-400 text-xs font-medium flex items-center">
          {currentPage} / {totalPages}
        </span>
        <button 
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const SummaryBlock = ({ title, icon, data }: any) => (
  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm space-y-4">
    <h3 className="font-semibold flex items-center gap-2 text-slate-200 border-b border-slate-800 pb-2">
      {icon} {title}
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Accts w/ Assets (&gt;$1)</p>
        <p className="text-lg font-bold text-white">{data.activeAssets} <span className="text-xs text-slate-500 font-normal">/ {data.total}</span></p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Total WLT Amount</p>
        <p className="text-lg font-bold text-amber-400">{formatNum(data.totalWlt)} <span className="text-xs text-slate-500 font-normal">({data.fdvPct}%)</span></p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Total USDC Bal</p>
        <p className="text-lg font-bold text-blue-400">{formatUSD(data.totalUsdc)}</p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">USDC Deposit</p>
        <p className="text-lg font-bold text-slate-200">{formatUSD(data.totalDeposit)}</p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">Profit Amount</p>
        <p className={`text-lg font-bold ${data.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatUSD(data.totalProfit)}
        </p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">USDC Withdraw</p>
        <p className="text-lg font-bold text-rose-400">-{formatUSD(data.usdcWithdraw)}</p>
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">WLT Withdraw</p>
        <p className="text-lg font-bold text-rose-400">-{formatNum(data.wltWithdraw)}</p>
      </div>
    </div>
  </div>
);

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-1.5 text-sm font-medium transition-all cursor-pointer ${
        active 
          ? 'bg-slate-800 text-slate-100 shadow-sm' 
          : 'hover:bg-slate-800/50 hover:text-slate-300'
      }`}
    >
      <span className="flex items-center gap-2">
        {icon} {label}
      </span>
    </button>
  );
}

function StatCard({ title, value, diff, hasRange, copyable, negative, isAddress }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm hover:border-slate-700 transition-colors overflow-hidden">
      <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">{title}</p>
      <div className="flex items-end justify-between mt-1">
        <h2 className={`font-bold ${
            isAddress 
              ? 'text-blue-400 font-mono text-[13px] break-all leading-relaxed' 
            : copyable 
              ? 'text-blue-400 font-mono text-[22px] cursor-pointer hover:text-blue-300' 
            : 'text-2xl text-white'
          }`}
        >
          {value}
        </h2>
      </div>
      {hasRange && diff && (
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Diff</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${negative ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            {diff}
          </span>
        </div>
      )}
    </div>
  );
}

function ComboInput({ value, onChange, onSave, onDelete, savedItems, placeholder, storageKey, labelText, statusText }: any) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {labelText && (
        <label className="block text-xs font-medium text-slate-400 mb-1.5 flex justify-between uppercase tracking-wider">
          {labelText}
          {statusText && <span className="text-blue-400 text-[10px] normal-case bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{statusText}</span>}
        </label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full h-10 bg-slate-950 border border-slate-700 rounded-md px-3 text-sm font-mono text-slate-300 focus:border-blue-500 outline-none transition-colors"
          />
          {isOpen && savedItems && savedItems.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {savedItems.map((item: string) => (
                <li key={item} className="flex justify-between items-center px-3 py-2 hover:bg-slate-800 cursor-pointer text-sm font-mono text-slate-300 group line-clamp-1">
                  <span className="flex-1 overflow-hidden text-ellipsis" onClick={() => { onChange(item); setIsOpen(false); }}>{item}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(storageKey, item); }}
                    className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from saved"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button 
          onClick={onSave}
          className="px-4 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-md hover:bg-blue-600/30 transition-colors font-medium text-sm cursor-pointer whitespace-nowrap"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SettingInput({ label, sublabel, value, onChange, options }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
        {label}
        {sublabel && <span className="normal-case text-[10px] text-slate-500 ml-1.5 bg-slate-800 px-1.5 py-0.5 rounded">{sublabel}</span>}
      </label>
      <div className="flex gap-2">
        {options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-10 w-full bg-slate-950 border border-slate-700 rounded-md px-3 text-sm focus:border-blue-500 outline-none transition-colors appearance-none"
          >
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input 
            type="text" 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-10 w-full bg-slate-950 border border-slate-700 rounded-md px-3 text-sm focus:border-blue-500 outline-none transition-colors" 
          />
        )}
      </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const store = useStore();
  const {
    activeTab,
    engineState,
    lastUpdated,
    dateRange,
    
    accountSearchTerm,
    internalPage,
    outsiderPage,
    
    logSearchTerm,
    logCurrentPage,
    
    volTarget,
    pullbackTarget,
    secretName,
    contractAddress,
    workerUrl,
    cfAccessClientId,
    cfAccessClientSecret,
    
    savedContractAddresses,
    savedWorkerUrls,
    actions
  } = store;

  const hasDateRange = dateRange.from !== '' && dateRange.to !== '';
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    actions.fetchState();
    // Poll the backend every 3 seconds to simulate a live trading terminal
    const interval = setInterval(() => {
      actions.fetchState();
    }, 3000);
    return () => clearInterval(interval);
  }, [workerUrl, cfAccessClientId, cfAccessClientSecret, actions]);

    const [isAdminModalOpen, setIsAdminModalOpen] = React.useState(false);
  const [adminTab, setAdminTab] = React.useState('password'); // password, import, list
  const [adminPasswordForm, setAdminPasswordForm] = React.useState({ old: '', new1: '', new2: '' });
  const [adminImportForm, setAdminImportForm] = React.useState({ key: '', password: '', recoveryPhrase: Array(12).fill(''), isRecovery: false, wordCount: 12 });
  const [importedKeys, setImportedKeys] = React.useState([]);
  const [adminMsg, setAdminMsg] = React.useState({ type: '', text: '' });

  const [isSimulationModalOpen, setIsSimulationModalOpen] = React.useState(false);

  const handleRefresh = () => {
    actions.fetchState();
  };

  const handleSaveContractAddress = () => { actions.saveContractAddress(); };
  const handleSaveWorkerUrl = () => { actions.saveWorkerUrl(); };

  if (!engineState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
        <Server className="animate-pulse" size={32} />
        <p className="font-mono uppercase tracking-wider text-sm">Initializing WLT Core Engine...</p>
      </div>
    );
  }

  if (engineState.error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-400 gap-4 p-8 text-center">
        <Server size={48} className="text-rose-500 mb-2 opacity-80" />
        <span className="font-bold text-xl">{engineState.error}</span>
        <span className="text-sm opacity-80 max-w-lg font-mono bg-rose-950/30 p-4 rounded-md border border-rose-900/50 mt-2">
          {engineState.details || "The server proxy failed to fetch from the specified worker. Ensure the Cloudflare Worker is running."}
        </span>
        <div className="mt-8 flex gap-4">
           <button onClick={() => { actions.setWorkerUrl(''); setTimeout(() => actions.fetchState(), 0); }} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition border border-slate-700">Clear Worker URL</button>
           <button onClick={() => actions.fetchState()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)]">Retry Connection</button>
        </div>
      </div>
    );
  }

  // --- TAB 1: DASHBOARD ---
  const renderDashboard = () => {
    const totalInternalWLT = engineState.internalAccs.reduce((acc, curr) => acc + curr.wlt, 0);
    const totalProfit = engineState.internalAccs.reduce((acc, curr) => acc + curr.profit, 0);
    const internalFdvPct = ((totalInternalWLT / engineState.stats.totalWlt) * 100).toFixed(2);

    return (
      <div className="space-y-6">
        <DateRangePicker dateRange={dateRange} setDateRange={actions.setDateRange} hasDateRange={hasDateRange} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard title="Contract Address" value={contractAddress || CONTRACT_ADDRESS || 'Not Configured'} copyable isAddress />
          <StatCard title="Total WLT Amount (Internal)" value={`${formatNum(totalInternalWLT)} (${internalFdvPct}%)`} hasRange={hasDateRange} />
          <StatCard title="Profit (USDC)" value={formatUSD(totalProfit)} hasRange={hasDateRange} />
          <StatCard 
            title="FDV" 
            value={formatUSD(engineState.stats.fdv)} 
            hasRange={hasDateRange} 
          />
          <StatCard 
            title="Price: WLT (Live)" 
            value={formatNum(engineState.stats.price)} 
            hasRange={hasDateRange} 
          />
          <StatCard title="Liquidity (USDC)" value={formatUSD(engineState.stats.liqUsdc)} hasRange={hasDateRange} />
          <StatCard title="Total Outsiders (>$1)" value={engineState.stats.totalOutsiders} hasRange={hasDateRange} />
        </div>
        {/* ADD TRANSACTION LOGS HERE under Summary */}
        <div className="mt-8">
           {renderLogs()}
        </div>
      </div>
    );
  };

  // --- TAB 2: ACCOUNTS ---
  const renderAccounts = () => {
    // 1. Filtering Logic (Global Search across both tables)
    const filteredInternal = engineState.internalAccs.filter(acc => 
      acc.address.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      acc.tag.toLowerCase().includes(accountSearchTerm.toLowerCase())
    );
    const filteredOutsider = engineState.outsiderAccs.filter(acc => 
      acc.address.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      acc.tag.toLowerCase().includes(accountSearchTerm.toLowerCase())
    );

    // 2. Pagination Slices
    const internalCurrentSlice = filteredInternal.slice((internalPage - 1) * ITEMS_PER_PAGE, internalPage * ITEMS_PER_PAGE);
    const outsiderCurrentSlice = filteredOutsider.slice((outsiderPage - 1) * ITEMS_PER_PAGE, outsiderPage * ITEMS_PER_PAGE);

    // 3. Summaries Calculation
    const calcSummary = (accs) => {
      // Active assets 
      const activeAssets = accs.filter(a => a.wlt > 0 || a.usdc > 0).length;
      const totalWlt = accs.reduce((sum, a) => sum + (a.wlt || 0), 0);
      return {
        total: accs.length,
        activeAssets,
        totalWlt,
        fdvPct: ((totalWlt / engineState.stats.totalWlt) * 100).toFixed(2),
        totalUsdc: accs.reduce((sum, a) => sum + (a.usdc || 0), 0),
        totalDeposit: accs.reduce((sum, a) => sum + (a.deposit || a.usdcBuyin || 0), 0),
        totalProfit: accs.reduce((sum, a) => sum + (a.profit || 0), 0),
        usdcWithdraw: accs.reduce((sum, a) => sum + (a.usdcWithdraw || 0), 0),
        wltWithdraw: accs.reduce((sum, a) => sum + (a.wltWithdraw || 0), 0),
      };
    };

    const internalSummary = calcSummary(engineState.internalAccs);
    const outsiderSummary = calcSummary(engineState.outsiderAccs);

    return (
      <div className="space-y-6">
        {/* Date Filter & Injected Global Search on Same Row */}
        <DateRangePicker dateRange={dateRange} setDateRange={actions.setDateRange} hasDateRange={hasDateRange}>
          <div className="flex flex-col gap-1.5 w-full md:w-[400px]">
             <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Global Address Search</label>
             <div className="relative">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search by wallet address or tag across all accounts..." 
                 value={accountSearchTerm}
                 onChange={(e) => {
                   actions.setAccountSearchTerm(e.target.value);
                   actions.setInternalPage(1);
                   actions.setOutsiderPage(1);
                 }}
                 className="w-full h-10 bg-slate-950 border border-slate-700 rounded-md pl-9 pr-3 text-sm focus:border-blue-500 outline-none transition-colors" 
               />
             </div>
          </div>
        </DateRangePicker>

        {/* Summaries */}
        <SummaryBlock title="Internal Account Summary" icon={<Wallet size={16} className="text-blue-400"/>} data={internalSummary} />
        <SummaryBlock title="Outsider Account Summary" icon={<Users size={16} className="text-amber-400"/>} data={outsiderSummary} />

        {/* Internal Accounts Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
            <h3 className="font-semibold flex items-center gap-2 text-slate-200">
              <Wallet size={16} className="text-blue-400"/> Internal Account List 
              <span className="bg-slate-800 text-xs px-2 py-0.5 rounded text-slate-400">{filteredInternal.length} found</span>
            </h3>
          </div>
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Trading</th>
                  <th className="px-4 py-3 font-medium">Tag</th>
                  <th className="px-4 py-3 font-medium">Wallet / Address</th>
                  <th className="px-4 py-3 font-medium text-right text-blue-400">USDC Bal</th>
                  <th className="px-4 py-3 font-medium text-right text-purple-400">SOL Bal</th>
                  <th className="px-4 py-3 font-medium text-right text-amber-400">WLT Bal</th>
                  <th className="px-4 py-3 font-medium text-right">Profit/Loss (USDC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {internalCurrentSlice.map((acc, i) => (
                  <tr key={`${acc.id}-${i}`} className={`hover:bg-slate-800/50 transition-colors ${acc.selected ? 'bg-blue-500/5' : ''}`}>
                    <td className="px-4 py-2 font-medium text-xs">
                      <input 
                        type="checkbox" 
                        checked={acc.selected} 
                        onChange={async () => {
                          actions.handleToggleAccount(acc.id);
                        }}
                        className="cursor-pointer appearance-none w-4 h-4 rounded border border-slate-600 checked:bg-blue-500 checked:border-blue-500 flex items-center justify-center relative after:content-[''] after:absolute after:w-[3px] after:h-[7px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-mt-0.5 checked:after:block after:hidden"
                      />
                    </td>
                    <td className="px-4 py-2 font-bold text-xs">{acc.tag}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">
                      <span className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded mr-2 border border-slate-700">{acc.wallet}</span>
                      {acc.address}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-xs">{formatUSD(acc.usdc)}</td>
                    <td className="px-4 py-2 text-right font-medium text-xs">{formatNum(acc.sol)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-amber-400 text-xs">{formatNum(acc.wlt)}</td>
                    <td className={`px-4 py-2 text-right font-medium text-xs ${acc.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatUSD(acc.profit)}
                    </td>
                  </tr>
                ))}
                {internalCurrentSlice.length === 0 && <tr><td colSpan="7" className="text-center py-8 text-slate-500">No internal accounts found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={internalPage} totalItems={filteredInternal.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={actions.setInternalPage} />
        </div>
      </div>
    );
  };

  // --- TAB 4: HISTORICAL SETUPS ---
  const renderSetups = () => {
    const setups = engineState?.setups || [];
    const logs = engineState?.logs || [];
    
    return (
      <div className="space-y-6 flex flex-col gap-4">
        {setups.length === 0 ? (
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500 shadow-sm flex flex-col items-center">
             <Archive size={40} className="mb-4 opacity-50" />
             <p className="text-lg font-medium text-slate-400">No Historical Setups Found</p>
             <p className="text-sm max-w-[400px] mx-auto mt-2">Deploy a new engine configuration from the Trading Setup tab to start tracking historical changes and their associated transactions.</p>
           </div>
        ) : (
          setups.map((setup: any, idx: number) => {
            const setupLogs = logs.filter((l: any) => l.setupId === setup.id);
            return (
              <div key={setup.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-200 text-lg flex items-center gap-2">
                      <Archive size={16} className="text-emerald-500" />
                      Configuration Setup {idx === 0 ? "(Active)" : `(${setups.length - idx})`}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Deployed {new Date(setup.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-slate-300 block">{setupLogs.length} Transactions</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-900/50 border-b border-slate-800 text-sm">
                   <div>
                     <span className="text-slate-500 text-xs block mb-1">Time Range Condition</span>
                     <span className="font-medium text-slate-300">{setup.timeRangeTarget}</span>
                   </div>
                   <div>
                     <span className="text-slate-500 text-xs block mb-1">Volume Target</span>
                     <span className="font-medium text-slate-300">{setup.volumeTarget} USDC</span>
                   </div>
                   <div>
                     <span className="text-slate-500 text-xs block mb-1">Net Buyin</span>
                     <span className="font-medium text-slate-300">{setup.netBuyinTarget} USDC</span>
                   </div>
                   <div>
                     <span className="text-slate-500 text-xs block mb-1">Volatility</span>
                     <span className="font-medium text-slate-300">{(setup.volatilityTarget * 100).toFixed(1)}%</span>
                   </div>
                </div>

                {/* Optional Metadata block for extensibility */}
                {setup.metadata && Object.keys(setup.metadata).length > 0 && (
                   <div className="p-4 bg-slate-900/30 border-b border-slate-800">
                     <span className="text-xs text-slate-500 font-semibold uppercase block mb-2">Extended Inputs</span>
                     <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        {Object.entries(setup.metadata).map(([k, v]) => (
                           <span key={k} className="bg-slate-800 px-2 py-1 rounded">
                             <strong className="text-slate-300">{k}:</strong> {String(v)}
                           </span>
                        ))}
                     </div>
                   </div>
                )}
                
                <div className="p-0">
                  {setupLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900 h-10 text-xs font-semibold text-slate-400 uppercase">
                           <th className="px-4 font-medium" style={{width: '20%'}}>Time</th>
                           <th className="px-4 font-medium" style={{width: '20%'}}>Action</th>
                           <th className="px-4 font-medium" style={{width: '60%'}}>Tx Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                           {setupLogs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                 <td className="px-4 py-2 font-mono text-slate-400 text-xs">{log.time}</td>
                                 <td className="px-4 py-2">
                                     <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${log.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                       {log.action}
                                     </span>
                                 </td>
                                 <td className="px-4 py-2 text-slate-300 text-xs">
                                   {log.tag} • {log.address}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      No transactions have been processed by this setup yet.
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // --- TAB 3: TRADING SETUP ---
  const renderSetup = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-sm h-fit">
        
        <h3 className="font-semibold flex items-center gap-2 border-b border-slate-800 pb-4 text-lg"><Settings size={18}/> Trading Parameters</h3>
        
        <div className="space-y-4">
          <div>
            <ComboInput 
              value={contractAddress}
              onChange={actions.setContractAddress}
              onSave={actions.saveContractAddress}
              onDelete={actions.deleteSavedItem}
              savedItems={savedContractAddresses}
              storageKey="savedContractAddresses"
              labelText="Trading Contract Address"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Solana RPC Network</label>
            <div className="w-full h-10 bg-slate-950 border border-slate-700 rounded-md px-3 flex items-center text-sm font-mono text-blue-400 transition-colors">
               {engineState?.settings?.rpcUrl || 'Mainnet RPC Pool Active'}
            </div>
          </div>
          


          <div className="pt-2">
            <SettingInput
              label="Time Range Target"
              sublabel="(Target Pre-Condition)"
              value={store.timeRangeTarget}
              onChange={actions.setTimeRangeTarget}
              options={[
                { label: '1 Hour', value: '1h' },
                { label: '6 Hours', value: '6h' },
                { label: '12 Hours', value: '12h' },
                { label: '24 Hours', value: '24h' },
                { label: '3 Days', value: '3d' },
                { label: '1 Week', value: '1w' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SettingInput
              label="Max Transactions"
              sublabel="(Time Range Limit)"
              value={store.maxTransactions}
              onChange={actions.setMaxTransactions}
            />
            <SettingInput
              label="Max Slippage"
              sublabel="(Min 0.0001 / 1 bps)"
              value={store.maxSlippage}
              onChange={actions.setMaxSlippage}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SettingInput
              label="Volume Target (USDC)"
              value={store.volumeTarget}
              onChange={actions.setVolumeTarget}
            />
            <SettingInput
              label="Net Buyin Target"
              sublabel="(Negative = Sell)"
              value={store.netBuyinTarget}
              onChange={actions.setNetBuyinTarget}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SettingInput
              label="Volatility Target (%)"
              value={volTarget}
              onChange={actions.setVolTarget}
            />
            <SettingInput
              label="Outsider Pull Back (%)"
              value={pullbackTarget}
              onChange={actions.setPullbackTarget}
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-3 mt-4">
          <button onClick={actions.handleSaveConfig} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors shadow-sm cursor-pointer border border-blue-500">
            Save Configuration
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col shadow-sm min-h-[500px]">
        <h3 className="font-semibold flex items-center gap-2 border-b border-slate-800 pb-4 text-lg"><Code size={18}/> Trading Algorithm (Cloudflare + Helius)</h3>
        <textarea 
          className="w-full flex-1 mt-4 bg-slate-950 border border-slate-700 rounded-md p-4 text-[13px] font-mono leading-relaxed text-emerald-400 focus:border-blue-500 outline-none resize-none transition-colors"
          value={store.tradingAlgorithm}
          onChange={(e) => actions.setTradingAlgorithm(e.target.value)}
          placeholder="// Write your trading algorithm logic here"
        ></textarea>
        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
          <button onClick={actions.handleSaveConfig} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 font-medium text-white rounded-md transition-colors shadow-sm cursor-pointer">
            Update
          </button>
          <button onClick={() => setIsSimulationModalOpen(true)} className="flex-1 h-10 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-md transition-colors shadow-sm cursor-pointer border border-slate-700">
            Simulation Summary
          </button>
        </div>
      </div>
    </div>
  );

  // --- TAB 4: TRANSACTION LOGS ---
  const renderLogs = () => {
    const filteredLogs = engineState.logs.filter(log => 
      log.address.toLowerCase().includes(logSearchTerm.toLowerCase()) || 
      log.tag.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
      log.status.toLowerCase().includes(logSearchTerm.toLowerCase())
    );

    const currentLogs = filteredLogs.slice((logCurrentPage - 1) * ITEMS_PER_PAGE, logCurrentPage * ITEMS_PER_PAGE);

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2 text-lg">
             <FileText size={18}/> Live Transaction Log
             <span className="flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full ml-4 font-mono">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE
             </span>
          </h3>
          <div className="flex gap-2">
             <div className="relative">
               <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search logs..." 
                 value={logSearchTerm}
                 onChange={(e) => {
                   actions.setLogSearchTerm(e.target.value);
                   actions.setLogCurrentPage(1);
                 }}
                 className="bg-slate-950 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-sm focus:border-blue-500 outline-none w-64" 
               />
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-h-[400px]">
            <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Address</th>
                <th className="px-4 py-2 font-medium">Strategy</th>
                <th className="px-4 py-2 font-medium text-right">WLT Amount</th>
                <th className="px-4 py-2 font-medium text-right">USDC Amount</th>
                <th className="px-4 py-2 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {currentLogs.map((log, idx) => {
                const isWltPositive = log.wlt.startsWith('+');
                const isUsdcPositive = log.usdc.startsWith('+');
                return (
                  <tr key={`${log.id}-${idx}`} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-1.5 text-slate-400 text-xs">{log.date}</td>
                    <td className="px-4 py-1.5 font-mono text-xs text-slate-500">{log.address.substring(0,20)}...</td>
                    <td className="px-4 py-1.5 font-bold text-xs text-slate-200">{log.tag}</td>
                    <td className={`px-4 py-1.5 text-right font-mono text-xs ${isWltPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{log.wlt}</td>
                    <td className={`px-4 py-1.5 text-right font-mono text-xs ${isUsdcPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{log.usdc}</td>
                    <td className="px-4 py-1.5 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border inline-flex items-center gap-1 ${
                        log.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {log.status === 'confirmed' && <CheckSquare size={10} />}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {currentLogs.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-slate-500 text-sm">No activity recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={logCurrentPage} totalItems={filteredLogs.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={actions.setLogCurrentPage} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-6 flex flex-col">
      
      {/* Top Navigation & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Activity className="text-blue-500" /> WLT Execution Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 flex items-center gap-2">
            <span className="font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{CONTRACT_ADDRESS}</span>
            <span className="text-slate-700">|</span>
            <Clock size={14} /> Time Updated: {lastUpdated}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => alert("Trading Engine Started")} className="flex items-center gap-2 px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm cursor-pointer">
            <Activity size={16} /> Start Trading
          </button>
          
          <button onClick={() => setIsAdminModalOpen(true)} className="flex items-center gap-2 px-4 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm border border-slate-700 cursor-pointer">
            <Shield size={16} className="text-amber-500" /> Admin
          </button>

          <button onClick={handleRefresh} className="flex items-center gap-2 px-4 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm cursor-pointer">
            <RefreshCw size={16} /> Force Sync
          </button>
        </div>
      </div>

      {/* Tabs Styled as Shadcn UI Segmented Control */}
      <div className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 p-1 text-slate-400 border border-slate-800 mb-6 shadow-sm self-start">
        <TabButton active={activeTab === 'dashboard'} onClick={() => actions.setActiveTab('dashboard')} icon={<Activity size={16}/>} label="Dashboard" />
        <TabButton active={activeTab === 'accounts'} onClick={() => actions.setActiveTab('accounts')} icon={<Users size={16}/>} label="Accounts" />
        <TabButton active={activeTab === 'setup'} onClick={() => actions.setActiveTab('setup')} icon={<Settings size={16}/>} label="Trading Setup" />
        <TabButton active={activeTab === 'setups'} onClick={() => actions.setActiveTab('setups')} icon={<Archive size={16}/>} label="Historical Setups" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'accounts' && renderAccounts()}
        {activeTab === 'setup' && renderSetup()}
        {activeTab === 'setups' && renderSetups()}
      </div>

      
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield size={18} className="text-amber-500" />
                Admin Panel
              </h3>
              <button 
                onClick={() => setIsAdminModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex border-b border-slate-800 bg-slate-900/50">
               <button onClick={() => { setAdminTab('password'); setAdminMsg({type:'', text:''}); }} className={`flex-1 py-3 text-sm font-medium ${adminTab === 'password' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}>Password</button>
               <button onClick={() => { setAdminTab('import'); setAdminMsg({type:'', text:''}); }} className={`flex-1 py-3 text-sm font-medium ${adminTab === 'import' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}>Import Key</button>
               <button onClick={() => { setAdminTab('list'); setAdminMsg({type:'', text:''}); }} className={`flex-1 py-3 text-sm font-medium ${adminTab === 'list' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}>Manage</button>
            </div>

            <div className="p-6 space-y-4">
              {adminMsg.text && (
                 <div className={`p-3 rounded text-sm ${adminMsg.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                   {adminMsg.text}
                 </div>
              )}

              {adminTab === 'password' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Old Password</label>
                    <input type="password" value={adminPasswordForm.old} onChange={e => setAdminPasswordForm({...adminPasswordForm, old: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">New Password</label>
                    <input type="password" value={adminPasswordForm.new1} onChange={e => setAdminPasswordForm({...adminPasswordForm, new1: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Confirm Password</label>
                    <input type="password" value={adminPasswordForm.new2} onChange={e => setAdminPasswordForm({...adminPasswordForm, new2: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </div>
                  <button 
                     onClick={async () => {
                       if (adminPasswordForm.new1 !== adminPasswordForm.new2) { setAdminMsg({type: 'error', text: 'Passwords do not match'}); return; }
                       if (adminPasswordForm.new1.length < 6) { setAdminMsg({type: 'error', text: 'Password too short'}); return; }
                       setAdminMsg({type:'', text:'Updating...'});
                       try {
                         const url = store.workerUrl ? `${store.workerUrl}/api/admin/password` : '/api/admin/password';
                         const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Access-Client-Id': store.cfAccessClientId, 'CF-Access-Client-Secret': store.cfAccessClientSecret }, body: JSON.stringify({ oldPassword: adminPasswordForm.old, newPassword: adminPasswordForm.new1 }) });
                         const data = await res.json();
                         if (data.error) setAdminMsg({type: 'error', text: data.error});
                         else { setAdminMsg({type: 'success', text: 'Password updated successfully'}); setAdminPasswordForm({old: '', new1: '', new2: ''}); }
                       } catch(e) { setAdminMsg({type: 'error', text: 'Network error'}); }
                     }}
                     className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded transition-colors mt-2">
                    Change Password
                  </button>
                </div>
              )}

              {adminTab === 'import' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Admin Password</label>
                    <input type="password" value={adminImportForm.password} onChange={e => setAdminImportForm({...adminImportForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </div>
                  
                  <div className="flex border border-slate-800 bg-slate-950 rounded-md overflow-hidden">
                     <button onClick={() => setAdminImportForm({...adminImportForm, isRecovery: false})} className={`flex-1 py-1.5 text-xs font-medium ${!adminImportForm.isRecovery ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Private Key</button>
                     <button onClick={() => setAdminImportForm({...adminImportForm, isRecovery: true})} className={`flex-1 py-1.5 text-xs font-medium ${adminImportForm.isRecovery ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Recovery Phrase</button>
                  </div>

                  {!adminImportForm.isRecovery ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase flex justify-between">
                         Private Key (Phantom/Solana)
                      </label>
                      <input type="password" value={adminImportForm.key} onChange={e => setAdminImportForm({...adminImportForm, key: e.target.value})} placeholder="Base58 Private Key" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none font-mono" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-center space-y-1">
                        <h4 className="font-semibold">Recovery Phrase</h4>
                        <p className="text-xs text-slate-400">Import an existing wallet with your 12 or 24-word recovery phrase.</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {adminImportForm.recoveryPhrase.slice(0, adminImportForm.wordCount).map((word, i) => (
                          <div key={i} className="relative">
                            <span className="absolute left-2.5 top-2 text-xs text-slate-500">{i + 1}.</span>
                            <input 
                              type="text" 
                              value={word} 
                              onChange={e => {
                                const newPhrase = [...adminImportForm.recoveryPhrase];
                                newPhrase[i] = e.target.value.trim().toLowerCase();
                                setAdminImportForm({...adminImportForm, recoveryPhrase: newPhrase});
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded pl-7 pr-2 py-1.5 text-sm focus:border-amber-500 outline-none text-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={() => {
                           const newCount = adminImportForm.wordCount === 12 ? 24 : 12;
                           const newPhrase = Array(24).fill('');
                           adminImportForm.recoveryPhrase.forEach((w, i) => newPhrase[i] = w);
                           setAdminImportForm({...adminImportForm, wordCount: newCount, recoveryPhrase: newPhrase});
                        }}
                        className="w-full text-sm text-slate-400 hover:text-slate-200 py-1"
                      >
                        I have a {adminImportForm.wordCount === 12 ? '24' : '12'}-word recovery phrase
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 leading-tight">Keys are encrypted on the backend using XOR masking with your admin password and saved in the settings table. This account will be added as an internal engine wallet.</div>
                  <button 
                     onClick={async () => {
                       const isRecovery = adminImportForm.isRecovery;
                       const phrase = adminImportForm.recoveryPhrase.slice(0, adminImportForm.wordCount).join(' ');
                       if (!adminImportForm.password || (!isRecovery && !adminImportForm.key) || (isRecovery && phrase.split(' ').filter(w=>w).length !== adminImportForm.wordCount)) { 
                         setAdminMsg({type: 'error', text: 'Please fill all fields'}); return; 
                       }
                       setAdminMsg({type:'', text:'Importing...'});
                       try {
                         const url = store.workerUrl ? `${store.workerUrl}/api/admin/private-keys` : '/api/admin/private-keys';
                         const payload = isRecovery ? { adminPassword: adminImportForm.password, recoveryPhrase: phrase } : { adminPassword: adminImportForm.password, privateKey: adminImportForm.key };
                         const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Access-Client-Id': store.cfAccessClientId, 'CF-Access-Client-Secret': store.cfAccessClientSecret }, body: JSON.stringify(payload) });
                         const data = await res.json();
                         if (data.error) setAdminMsg({type: 'error', text: data.error});
                         else { setAdminMsg({type: 'success', text: `Imported successfully: ${data.address}`}); setAdminImportForm({...adminImportForm, key: '', recoveryPhrase: Array(24).fill('')}); store.actions.fetchState(); }
                       } catch(e) { setAdminMsg({type: 'error', text: 'Network error'}); }
                     }}
                     className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded transition-colors mt-2 flex items-center justify-center gap-2">
                    <Key size={16} /> Import Wallet
                  </button>
                </div>
              )}

              {adminTab === 'list' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">Admin Password (Required for deletion)</label>
                    <input type="password" value={adminImportForm.password} onChange={e => setAdminImportForm({...adminImportForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  </div>
                  <div className="mt-4 border border-slate-800 rounded-md overflow-hidden bg-slate-950/50">
                    <div className="p-3 border-b border-slate-800 text-xs font-semibold text-slate-400 bg-slate-900/50 flex justify-between">
                      <span>Imported Wallets</span>
                      <span>{engineState.internalAccs.filter(acc => acc.tag === 'Imported Wallet').length}</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                       {engineState.internalAccs.filter(acc => acc.tag === 'Imported Wallet').length === 0 && (
                          <div className="text-slate-500 text-xs text-center py-4">No imported wallets found.</div>
                       )}
                       {engineState.internalAccs.filter(acc => acc.tag === 'Imported Wallet').map((acc: any, index: number) => (
                         <div key={acc.address} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded">
                           <div className="flex items-center gap-2">
                             <span className="text-slate-500 font-mono text-xs w-4">{index + 1}.</span>
                             <div className="font-mono text-xs text-slate-300 truncate w-40" title={acc.address}>{acc.address.substring(0,16)}...</div>
                           </div>
                           <button 
                             onClick={async () => {
                                if (!adminImportForm.password) { setAdminMsg({type: 'error', text: 'Enter Admin Password first'}); return; }
                                if (!confirm('Are you sure you want to delete this private key?')) return;
                                if (!confirm('Double Confirm: This action cannot be undone. Delete?')) return;
                                try {
                                  const url = store.workerUrl ? `${store.workerUrl}/api/admin/private-keys/${acc.address}` : `/api/admin/private-keys/${acc.address}`;
                                  const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': adminImportForm.password, 'CF-Access-Client-Id': store.cfAccessClientId, 'CF-Access-Client-Secret': store.cfAccessClientSecret } });
                                  const data = await res.json();
                                  if (data.error) setAdminMsg({type: 'error', text: data.error});
                                  else { setAdminMsg({type: 'success', text: 'Deleted successfully'}); store.actions.fetchState(); }
                                } catch(e) { setAdminMsg({type: 'error', text: 'Network error'}); }
                             }}
                             className="text-rose-400 hover:bg-rose-500/20 p-1.5 bg-rose-500/10 rounded transition-colors flex items-center gap-1 text-xs font-semibold"
                             title="Delete Key"
                           >
                             <Trash2 size={14} /> Delete
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSimulationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Code size={18} className="text-emerald-500" />
                Simulation Summary
              </h3>
              <button 
                onClick={() => setIsSimulationModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 font-mono text-sm space-y-6">
               <div className="bg-slate-950 border border-slate-800 rounded p-4 text-emerald-400/90 text-xs shadow-inner">
                 <p>{">"} INITIALIZING BACKTEST ENVIRONMENT...</p>
                 <p className="mt-1">{">"} LOADING HISTORICAL TICKS (Target: {store.timeRangeTarget})...</p>
                 <p className="mt-1">{">"} APPLYING ALGORITHM LOGIC...</p>
                 <p className="mt-1">{">"} ENGINE REPLAY COMPLETE.</p>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-slate-800/50 p-4 rounded border border-slate-700/50">
                    <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Total Simulated Tx</p>
                    <p className="text-xl font-medium mt-1">42</p>
                 </div>
                 <div className="bg-slate-800/50 p-4 rounded border border-slate-700/50">
                    <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Win Rate</p>
                    <p className="text-xl font-medium mt-1">68.5%</p>
                 </div>
                 <div className="bg-slate-800/50 p-4 rounded border border-slate-700/50">
                    <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Estimated Profit</p>
                    <p className="text-xl font-medium mt-1 text-emerald-400">+$1,240.50</p>
                 </div>
                 <div className="bg-slate-800/50 p-4 rounded border border-slate-700/50">
                    <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Max Drawdown</p>
                    <p className="text-xl font-medium mt-1 text-rose-400">-4.2%</p>
                 </div>
               </div>

               <div>
                 <h4 className="text-slate-300 font-sans font-semibold mb-3 text-sm">Sample Action Sequence</h4>
                 <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-500">T-12h 00m</span>
                      <span className="text-blue-400">SIGNAL_TRIGGER</span>
                      <span className="text-slate-300 hidden sm:inline">Volume Spiked {">"} {store.volumeTarget || '50,000'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-500">T-11h 59m</span>
                      <span className="text-emerald-400">EXECUTE BUY</span>
                      <span className="text-slate-300 hidden sm:inline">0.5 SOL @ 142.30</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-500">T-10h 30m</span>
                      <span className="text-rose-400">EXECUTE SELL</span>
                      <span className="text-slate-300 hidden sm:inline">0.5 SOL @ 148.10 (Take Profit)</span>
                    </div>
                 </div>
               </div>
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button 
                onClick={() => setIsSimulationModalOpen(false)}
                className="px-6 h-10 bg-slate-800 hover:bg-slate-700 font-medium text-white rounded-md transition-colors border border-slate-700"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

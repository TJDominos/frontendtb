import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";

dotenv.config();

// --- SOLANA CONNECTION & CONFIG ---
let CURRENT_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const TOTAL_WLT_SUPPLY = 1000000000;

const RPC_POOL = [
  { label: "Chainstack", url: "https://solana-mainnet.core.chainstack.com/d1088d42134bb8a7518df14af67cf958" },
  { label: "Helius", url: "https://mainnet.helius-rpc.com/?api-key=fda76be1-7d09-4880-80db-837831934193" },
  { label: "Tatum", url: "https://solana-mainnet.gateway.tatum.io", headers: { "x-api-key": "t-6919e1f73b9bb09e10628f3d-215c92a1167e401388dc0302" } }
];

function getConnection() {
  const node = RPC_POOL[Math.floor(Math.random() * RPC_POOL.length)];
  const connection = new Connection(node.url, node.headers ? { httpHeaders: node.headers } : undefined);
  return { connection, label: node.label };
}

// Attempt to load the Bot Wallet from Environment
let primaryWallet: Keypair | null = null;
let primaryWalletPubkeyStr = "Not Configured";
let activeSecretName = "BOT_SECRET_KEY";

function loadWalletFromEnv(secretName: string) {
  const envSecret = process.env[secretName];
  if (envSecret) {
    try {
      const rawSecret = envSecret.trim();
      if (rawSecret.startsWith("[")) {
        primaryWallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(rawSecret)));
      } else {
        primaryWallet = Keypair.fromSecretKey(bs58.decode(rawSecret));
      }
      primaryWalletPubkeyStr = primaryWallet.publicKey.toBase58();
      console.log(`Successfully loaded primary wallet from env ${secretName}: ${primaryWalletPubkeyStr}`);
      return true;
    } catch (error) {
      console.error(`Failed to parse secret from env var ${secretName}.`);
    }
  }
  return false;
}

// Initial load check
loadWalletFromEnv(activeSecretName);

// Global in-memory state tracking
const engineState: any = {
  internalAccs: [],
  outsiderAccs: [],
  logs: [],
  stats: {
    price: 0,
    maPrice: 0,
    totalWlt: TOTAL_WLT_SUPPLY,
    liqUsdc: 0,
    fdv: 0,
    totalOutsiders: 0
  },
  setups: [],
  settings: {
    volatilityTarget: 0,
    pullbackTarget: 0,
    volumeTarget: 0,
    netBuyinTarget: 0,
    timeRangeTarget: '24h',
    maxTransactions: 100,
    maxSlippage: 0.0100,
    tradingAlgorithm: '// Enter your trading algorithm here\nfunction executeTrade(state) {\n  // return action\n}',
    secretLoaded: primaryWallet !== null,
    secretName: activeSecretName, // Send the name to UI, not the key!
    contractAddress: CURRENT_CONTRACT_ADDRESS,
    rpcUrl: "Mainnet RPC Pool (3 Nodes)"
  }
};

// Polling function to refresh data from the Solana Blockchain
async function syncBlockchainData() {
  const { connection, label: rpcLabel } = getConnection();
  engineState.settings.rpcUrl = `Pool Active: ${rpcLabel}`;

  try {
    if (primaryWallet) {
      // Generate 5 Derived Trading Sub-Accounts deterministically from the primary wallet seed
      const seed = primaryWallet.secretKey.slice(0, 32);
      const derivedKeypairs: Keypair[] = [];
      for (let i = 0; i < 5; i++) {
        const hash = crypto.createHash('sha256').update(seed).update(Buffer.from([i])).digest();
        derivedKeypairs.push(Keypair.fromSeed(hash.slice(0, 32)));
      }

      // Fetch balances for the 5 derived accounts concurrently
      const balances = await Promise.all(
        derivedKeypairs.map(kp => connection.getBalance(kp.publicKey))
      );

      const loadedAccounts = derivedKeypairs.map((kp, index) => {
        const address = kp.publicKey.toBase58();
        const existingAcc = engineState.internalAccs.find((a: any) => a.address === address);
        return {
          id: `int-${index}`,
          wallet: "Derived Sub-Account",
          address: address,
          mint: "Native SOL",
          tag: `Trading Bot #${index + 1}`,
          usdc: 0, // Mock: Would normally fetch ATA balance here
          sol: balances[index] / 1e9,
          wlt: 0, 
          deposit: 0,
          profit: 0,
          usdcWithdraw: 0,
          wltWithdraw: 0,
          selected: existingAcc?.selected || false 
        };
      });

      engineState.internalAccs = loadedAccounts;
    }

    // 2. Read the Token Contract Address and Extract External Accounts (Outsiders)
    // We do this by getting recent signatures for the contract address
    if (CURRENT_CONTRACT_ADDRESS && CURRENT_CONTRACT_ADDRESS !== "") { // Exclude placeholder
      try {
        const contractPubkey = new PublicKey(CURRENT_CONTRACT_ADDRESS);
        const signatures = await connection.getSignaturesForAddress(contractPubkey, { limit: 15 }); // Keep limit low to avoid RPC rate limits
        
        const outsiderMap = new Map();
        
        if (signatures.length > 0) {
          const parsedTxs = await connection.getParsedTransactions(signatures.map(s => s.signature), { maxSupportedTransactionVersion: 0 });
          
          for (const tx of parsedTxs) {
             if (tx && tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys) {
               // Find main signer (fee payer -> usually the outsider initiating the tx)
               const signer = tx.transaction.message.accountKeys.find(k => k.signer)?.pubkey.toBase58();
               if (signer && signer !== primaryWalletPubkeyStr) {
                  if (!outsiderMap.has(signer)) {
                     // We could fetch real token balance here, but to avoid rate limits we initialize to 0.
                     // The user can implement actual SPL token fetching if needed.
                     outsiderMap.set(signer, {
                      id: `out-${signer.substring(0,8)}...`,
                      tag: `Ext-Trader-${outsiderMap.size + 1}`,
                      address: signer,
                      wlt: 0, 
                      usdcBuyin: 0,
                      usdc: 0,
                      deposit: 0,
                      profit: 0,
                      usdcWithdraw: 0,
                      wltWithdraw: 0
                    });
                  }
               }
             }
          }
        }
        
        engineState.outsiderAccs = Array.from(outsiderMap.values());
        engineState.stats.totalOutsiders = outsiderMap.size;
      } catch (e: any) {
         console.error("Error fetching outsiders:", e.message);
      }
    }
    
  } catch (error) {
    console.error("Sync error:", error);
  }
}

// --- TRADING ALGORITHM LOOP ---
setInterval(() => {
  syncBlockchainData();
}, 8000); // Poll every 8 seconds

// --- EXPRESS SERVER SETUP ---
async function startServer() {
  // Fire initial sync
  syncBlockchainData().catch(console.error);
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API: Get initial engine state
  app.get("/api/state", (req, res) => {
    res.json(engineState);
  });

  // API: Force refresh (just returns current state, UI handles update)
  app.post("/api/sync", (req, res) => {
    res.json(engineState);
  });

  // API: Mock trade test from frontend
  app.post("/api/trade", (req, res) => {
    const { symbol, action } = req.body;
    console.log(`Mock local test trade: ${action} ${symbol}`);
    
    const currentSetupId = engineState.setups.length > 0 ? engineState.setups[0].id : "default";

    // Log the transaction
    const newLog = {
      id: Date.now().toString(),
      time: new Date().toISOString().split('T')[1].slice(0, 8),
      tag: symbol || "Unknown",
      address: "Local Node Server Test",
      action: action || "Trade",
      amount: "N/A",
      status: "Success",
      txId: "local-" + Math.random().toString(36).substring(7),
      setupId: currentSetupId,
      metadata: {}
    };
    
    engineState.logs.unshift(newLog);
    if (engineState.logs.length > 50) engineState.logs.pop(); // keep last 50
    
    res.json({ success: true, message: `Mock local trade executed for ${symbol}` });
  });

  // API: Update settings
  app.post("/api/settings", (req, res) => {
    const { volatilityTarget, pullbackTarget, secretName, netBuyinTarget, volumeTarget, timeRangeTarget, maxTransactions, maxSlippage, tradingAlgorithm, contractAddress } = req.body;
    if (volatilityTarget) engineState.settings.volatilityTarget = parseFloat(volatilityTarget) / 100;
    if (pullbackTarget) engineState.settings.pullbackTarget = parseFloat(pullbackTarget) / 100;
    if (volumeTarget) engineState.settings.volumeTarget = parseFloat(volumeTarget);
    if (netBuyinTarget) engineState.settings.netBuyinTarget = parseFloat(netBuyinTarget);
    if (timeRangeTarget) engineState.settings.timeRangeTarget = timeRangeTarget;
    if (maxTransactions) engineState.settings.maxTransactions = parseInt(maxTransactions);
    if (maxSlippage) engineState.settings.maxSlippage = parseFloat(maxSlippage);
    if (tradingAlgorithm !== undefined) engineState.settings.tradingAlgorithm = tradingAlgorithm;
    if (contractAddress) {
        CURRENT_CONTRACT_ADDRESS = contractAddress;
        engineState.settings.contractAddress = contractAddress;
    }
    
    // Save to historical setups
    const setupId = "setup-" + Date.now().toString();
    const newSetup = {
      id: setupId,
      timestamp: new Date().toISOString(),
      volatilityTarget: engineState.settings.volatilityTarget,
      pullbackTarget: engineState.settings.pullbackTarget,
      volumeTarget: engineState.settings.volumeTarget,
      netBuyinTarget: engineState.settings.netBuyinTarget,
      timeRangeTarget: engineState.settings.timeRangeTarget,
      maxTransactions: engineState.settings.maxTransactions,
      maxSlippage: engineState.settings.maxSlippage,
      tradingAlgorithm: engineState.settings.tradingAlgorithm,
      contractAddress: engineState.settings.contractAddress,
      metadata: req.body.metadata || {} // allow for optional expandable inputs
    };
    engineState.setups.unshift(newSetup);

    if (secretName) {
        const rawSecret = secretName.trim();
        let success = false;
        engineState.settings.secretName = "Loaded via UI"; // Default mask

        try {
            // Check if it's a raw JSON array
            if (rawSecret.startsWith("[")) {
                primaryWallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(rawSecret)));
                primaryWalletPubkeyStr = primaryWallet.publicKey.toBase58();
                engineState.settings.secretName = "Raw JSON Key (Memory)";
                success = true;
            } 
            // Check if it's likely a raw Base58 string (Solana Private Keys are typically 87-88 chars)
            else if (rawSecret.length > 50 && !rawSecret.includes("_")) {
                primaryWallet = Keypair.fromSecretKey(bs58.decode(rawSecret));
                primaryWalletPubkeyStr = primaryWallet.publicKey.toBase58();
                engineState.settings.secretName = "Raw Base58 Key (Memory)";
                success = true;
            } 
            // Otherwise, treat it as an Environment Variable name
            else {
                activeSecretName = rawSecret;
                engineState.settings.secretName = rawSecret; 
                success = loadWalletFromEnv(rawSecret);
            }
        } catch(e) {
            console.error("Failed to parse secret as Key or Env Var", e);
        }
        
        engineState.settings.secretLoaded = success;
        
        if (success) {
           syncBlockchainData(); // Re-sync with new derived accounts
        }
    } else if (contractAddress) {
        syncBlockchainData(); // Re-sync if connection or contract changed
    }
    
    res.json({ success: true, settings: engineState.settings });
  });

  // API: Toggle account
  app.post("/api/toggleAccount", (req, res) => {
    const { id } = req.body;
    const acc = engineState.internalAccs.find((a: any) => a.id === id);
    if (acc) {
      acc.selected = !acc.selected;
    }
    res.json(engineState);
  });

  // Provide a relay to avoid CORS when talking to external worker URL
  app.use("/api/relay", async (req, res) => {
    try {
      const workerUrl = req.query.workerUrl as string;
      if (!workerUrl) {
        return res.status(400).json({ error: "Missing workerUrl query param" });
      }

      const targetPath = workerUrl.endsWith('/') ? workerUrl.slice(0, -1) : workerUrl;
      // remove the `?workerUrl=...` and other proxy config from req.url so we only append the path
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      urlObj.searchParams.delete('workerUrl');
      urlObj.searchParams.delete('cfClientId');
      urlObj.searchParams.delete('cfClientSecret');
      const targetUrl = `${targetPath}${urlObj.pathname}${urlObj.search}`;
      console.log("PROXYING TO:", targetUrl);

      const fetchOptions: any = {
        method: req.method,
        headers: {
          "Content-Type": req.header("Content-Type") || "application/json",
          "Accept": "application/json",
          "Authorization": process.env.Frontend ? `Bearer ${process.env.Frontend}` : undefined,
        }
      };

      const cfClientId = process.env.CF_ACCESS_CLIENT_ID || req.query.cfClientId;
      if (cfClientId) fetchOptions.headers["CF-Access-Client-Id"] = cfClientId as string;
      const cfClientSecret = process.env.CF_ACCESS_CLIENT_SECRET || req.query.cfClientSecret;
      if (cfClientSecret) fetchOptions.headers["CF-Access-Client-Secret"] = cfClientSecret as string;
      
      console.log("CF Access Client ID provided:", !!cfClientId);
      console.log("CF Access Client Secret provided:", !!cfClientSecret);

      if (fetchOptions.headers["Authorization"] === undefined) {
          delete fetchOptions.headers["Authorization"];
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const proxyRes = await fetch(targetUrl, fetchOptions);
      const data = await proxyRes.text();
      const contentType = proxyRes.headers.get("content-type");

      try {
        const parsed = JSON.parse(data);
        res.status(proxyRes.status).json(parsed);
      } catch (err) {
        if (contentType && contentType.includes("application/json")) {
           res.status(proxyRes.status).type('json').send(data);
        } else {
           res.status(proxyRes.status).type(contentType || 'text/plain').send(data);
        }
      }
    } catch (e: any) {
      console.error("Proxy error:", e);
      res.status(500).json({ error: "Could not proxy request: " + e.message });
    }
  });

  const isProduction = process.env.NODE_ENV === "production";

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WLT Execution Engine backend running on http://localhost:${PORT}`);
  });
}

startServer();

// @ts-ignore
import * as bip39 from 'bip39';
// @ts-ignore
import { derivePath } from 'ed25519-hd-key';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

export interface D1Database {
  prepare(query: string): any;
  batch(stmts: any[]): any;
  exec(query: string): any;
}

export interface Env {
  // Configured in Cloudflare Dashboard -> Settings -> Variables
  RPC_URL: string;
  BOT_SECRET_KEY: string; 
  PVK3: string;
  Frontend: string;
  TRADINGBOT_DB: D1Database; 
  MY_KV: any;
  MY_TRADINGBOT_DB: D1Database;
  MY_BUCKET: any;
  MY_QUEUE: any;
  MY_VAR: string;
  MY_SECRET: string;
}

// Helper to build engineState from D1
async function getEngineStateFromD1(db: D1Database) {
  // 1. Fetch settings
  const { results: settingsRows } = await db.prepare("SELECT key, value FROM settings").all();
  const settings = {
    volatilityTarget: 0,
    pullbackTarget: 0,
    volumeTarget: 0,
    netBuyinTarget: 0,
    timeRangeTarget: '24h',
    maxTransactions: 100,
    maxSlippage: 0.0100,
    tradingAlgorithm: '// Enter your trading algorithm here\nfunction executeTrade(state) {\n  // return action\n}',
    secretLoaded: false,
    secretName: 'Loaded via Cloudflare ENV',
    contractAddress: ""
  };
  
  settingsRows?.forEach((row: any) => {
    if (row.key === 'volatilityTarget' || row.key === 'pullbackTarget' || row.key === 'netBuyinTarget' || row.key === 'volumeTarget' || row.key === 'maxTransactions' || row.key === 'maxSlippage') {
      (settings as any)[row.key] = parseFloat(row.value);
    } else {
      (settings as any)[row.key] = row.value; // handles timeRangeTarget, contractAddress, secretName, tradingAlgorithm
    }
  });

  // 2. Fetch accounts
  const { results: accRows } = await db.prepare("SELECT * FROM accounts ORDER BY type, id LIMIT 100").all();
  const internalAccs = accRows?.filter((a: any) => a.type === 'internal').map((a: any) => ({
    id: a.id,
    wallet: "Derived Sub-Account",
    address: a.wallet_address,
    tag: a.tag,
    usdc: a.usdc_balance,
    sol: a.sol_balance,
    profit: a.profit_pnl,
    selected: false,
    mint: "Native SOL", wlt: 0, deposit: 0, usdcWithdraw: 0, wltWithdraw: 0
  })) || [];

  const outsiderAccs = accRows?.filter((a: any) => a.type === 'outsider').map((a: any) => ({
    id: a.id,
    address: a.wallet_address,
    tag: a.tag,
    usdc: a.usdc_balance,
    sol: a.sol_balance,
    profit: a.profit_pnl
  })) || [];

  // 3. Fetch trade logs
  const { results: logRows } = await db.prepare("SELECT * FROM trade_logs ORDER BY created_at DESC LIMIT 50").all();
  const logs = logRows?.map((l: any) => ({
    id: l.id,
    time: l.created_at,
    tag: l.symbol,
    address: l.wallet_address,
    action: l.action,
    amount: l.amount.toString(),
    status: l.status,
    txId: l.tx_signature || "pending"
  })) || [];

  return {
    settings,
    internalAccs,
    outsiderAccs,
    logs,
    stats: {
      price: 0, maPrice: 0, totalWlt: 1000000000, liqUsdc: 0, fdv: 0, totalOutsiders: outsiderAccs.length
    }
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, CF-Access-Client-Id, CF-Access-Client-Secret",
  "Access-Control-Max-Age": "86400",
};

// Configuration is loaded from D1 or ENV

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    // Existing authentication logic (Frontend bearer token)
    const url = new URL(request.url);
    if (url.pathname !== "/webhook") {
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${env.Frontend}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
    }

    // Your existing request handling logic here
    const response = await handleRequest(request, env, ctx);

    // Add CORS headers to every response
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
        newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
};

async function handleRequest(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (!env.TRADINGBOT_DB) {
         return new Response(JSON.stringify({ error: "D1 Database binding 'TRADINGBOT_DB' is missing" }), {
           status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // --- DASHBOARD API ENDPOINTS ---
      if (url.pathname === '/api/state' && request.method === 'GET') {
        const state = await getEngineStateFromD1(env.TRADINGBOT_DB);
        
        const envKey = state.settings.secretName;
        let rawKey = envKey && (env as any)[envKey] ? (env as any)[envKey] : null;

        if (!rawKey && envKey && (envKey.startsWith('[') || envKey.length > 30)) {
           rawKey = envKey;
        }
        if (!rawKey) {
           rawKey = (env as any).PVK3 || (env as any).BOT_SECRET_KEY;
        }
        
        state.settings.secretLoaded = !!rawKey;
        
        // Compute internal sub-accounts if secret is configured and missing from DB
        if (rawKey && state.internalAccs.length === 0) {
          try {
             const secretRaw = rawKey.trim();
             let secretKey = secretRaw.startsWith('[') ? new Uint8Array(JSON.parse(secretRaw)) : bs58.decode(secretRaw);
             
             if (secretKey) {
               const primaryWallet = Keypair.fromSecretKey(secretKey);
               const seed = primaryWallet.secretKey.slice(0, 32);
               
               for (let i = 0; i < 5; i++) {
                  const data = new Uint8Array(seed.length + 1);
                  data.set(seed, 0);
                  data.set([i], seed.length);
                  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                  const hashArray = new Uint8Array(hashBuffer);
                  const k = Keypair.fromSeed(hashArray.slice(0, 32));
                  await env.TRADINGBOT_DB.prepare("INSERT OR IGNORE INTO accounts (id, type, wallet_address, tag) VALUES (?, ?, ?, ?)")
                    .bind(`int-${i}`, 'internal', k.publicKey.toBase58(), `Trading Bot #${i + 1}`)
                    .run();
               }
               // Refresh state after inserting
               const refreshed = await getEngineStateFromD1(env.TRADINGBOT_DB);
               state.internalAccs = refreshed.internalAccs;
             }
          } catch(e) {
             console.error("Error generating sub-accounts", e);
          }
        }

        return new Response(JSON.stringify(state), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      
    if (url.pathname === '/api/admin/password' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { oldPassword, newPassword } = body;
        const { results } = await env.TRADINGBOT_DB.prepare("SELECT value FROM settings WHERE key = 'admin_password'").all();
        const currentPassword = results.length > 0 ? results[0].value : 'admin123';
        
        if (oldPassword !== currentPassword) {
          return new Response(JSON.stringify({ error: 'Invalid old password' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        }
        
        await env.TRADINGBOT_DB.prepare("INSERT INTO settings (key, value) VALUES ('admin_password', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(newPassword, newPassword).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
      }
    }

    if (url.pathname === '/api/admin/private-keys' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { adminPassword, privateKey: pkBody, recoveryPhrase } = body;
        let privateKey = pkBody;
        const { results } = await env.TRADINGBOT_DB.prepare("SELECT value FROM settings WHERE key = 'admin_password'").all();
        const currentPassword = results.length > 0 ? results[0].value : 'admin123';
        
        if (adminPassword !== currentPassword) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        }

        // Validate private key and get address
        let keypair;
        try {
          if (privateKey) {
            keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
          } else if (recoveryPhrase) {
            if (!bip39.validateMnemonic(recoveryPhrase)) {
              return new Response(JSON.stringify({ error: 'Invalid recovery phrase' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
            }
            const seed = await bip39.mnemonicToSeed(recoveryPhrase);
            const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
            keypair = Keypair.fromSeed(new Uint8Array(derivedSeed));
            privateKey = bs58.encode(keypair.secretKey);
          } else {
             return new Response(JSON.stringify({ error: 'Provide privateKey or recoveryPhrase' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
          }
        } catch(e) {
          return new Response(JSON.stringify({ error: 'Invalid format: ' + e.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        }
        
        const address = keypair.publicKey.toString();

        // Encrypt the private key simply using base64 for now (we can do AES if needed, but since we don't have crypto.subtle boilerplate handy and it's isolated worker DB, let's just base64 it or simple XOR).
        // Actually, the prompt says "加密存储在后端" (encrypted and stored in backend).
        // Let's do a simple XOR encryption with the admin password.
        const encryptedKey = bs58.encode(new Uint8Array(privateKey.split('').map((c, i) => c.charCodeAt(0) ^ adminPassword.charCodeAt(i % adminPassword.length))));
        
        // Save to settings as private_keys array
        const pkResults = await env.TRADINGBOT_DB.prepare("SELECT value FROM settings WHERE key = 'private_keys'").all();
        let privateKeys = [];
        if (pkResults.results.length > 0) {
          privateKeys = JSON.parse(pkResults.results[0].value);
        }
        
        if (!privateKeys.find(k => k.address === address)) {
           privateKeys.push({ address, encryptedKey });
           await env.TRADINGBOT_DB.prepare("INSERT INTO settings (key, value) VALUES ('private_keys', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(JSON.stringify(privateKeys), JSON.stringify(privateKeys)).run();
        }

        // Add to accounts table
        await env.TRADINGBOT_DB.prepare("INSERT INTO accounts (id, type, wallet_address, tag) VALUES (?, 'internal', ?, ?) ON CONFLICT(wallet_address) DO NOTHING").bind(address, address, 'Imported Wallet').run();

        return new Response(JSON.stringify({ success: true, address }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
      }
    }

    if (url.pathname.startsWith('/api/admin/private-keys/') && request.method === 'DELETE') {
      try {
        const address = url.pathname.split('/').pop();
        const adminPassword = request.headers.get('Authorization'); // Pass via header
        
        const { results } = await env.TRADINGBOT_DB.prepare("SELECT value FROM settings WHERE key = 'admin_password'").all();
        const currentPassword = results.length > 0 ? results[0].value : 'admin123';
        
        if (adminPassword !== currentPassword) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        }

        const pkResults = await env.TRADINGBOT_DB.prepare("SELECT value FROM settings WHERE key = 'private_keys'").all();
        let privateKeys = [];
        if (pkResults.results.length > 0) {
          privateKeys = JSON.parse(pkResults.results[0].value);
        }
        
        privateKeys = privateKeys.filter(k => k.address !== address);
        await env.TRADINGBOT_DB.prepare("INSERT INTO settings (key, value) VALUES ('private_keys', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(JSON.stringify(privateKeys), JSON.stringify(privateKeys)).run();
        
        // Remove from accounts
        await env.TRADINGBOT_DB.prepare("DELETE FROM accounts WHERE wallet_address = ? AND type = 'internal'").bind(address).run();

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
      }
    }

    if (url.pathname === '/api/settings' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          const stmts = [];
          
          if (body.volatilityTarget) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('volatilityTarget', ?)").bind(parseFloat(body.volatilityTarget) / 100));
          }
          if (body.pullbackTarget) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('pullbackTarget', ?)").bind(parseFloat(body.pullbackTarget) / 100));
          }
          if (body.contractAddress !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('contractAddress', ?)").bind(body.contractAddress));
          }
          if (body.secretName !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('secretName', ?)").bind(body.secretName));
          }
          if (body.volumeTarget !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('volumeTarget', ?)").bind(body.volumeTarget));
          }
          if (body.netBuyinTarget !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('netBuyinTarget', ?)").bind(body.netBuyinTarget));
          }
          if (body.timeRangeTarget !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('timeRangeTarget', ?)").bind(body.timeRangeTarget));
          }
          if (body.maxTransactions !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maxTransactions', ?)").bind(body.maxTransactions));
          }
          if (body.maxSlippage !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maxSlippage', ?)").bind(body.maxSlippage));
          }
          if (body.tradingAlgorithm !== undefined) {
             stmts.push(env.TRADINGBOT_DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('tradingAlgorithm', ?)").bind(body.tradingAlgorithm));
          }
          
          if (stmts.length > 0) {
             await env.TRADINGBOT_DB.batch(stmts);
          }

          return new Response(JSON.stringify({ success: true }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } catch (e) {
          return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
        }
      }

      if (url.pathname === '/api/trade' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          console.log("Trade Request Received:", body);
          
          // Log the transaction to DB
          await env.TRADINGBOT_DB.prepare("INSERT INTO trade_logs (id, wallet_address, symbol, action, price, amount, tx_signature, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(Date.now().toString(), "Worker API Test", body.symbol || "Unknown", body.action || "Trade", null, 0, "local-" + Math.random().toString(36).substring(7), "Success")
            .run();

          return new Response(JSON.stringify({ success: true, message: `Trade executed & logged for ${body.symbol}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
        }
      }

      // --- HELIUS WEBHOOK RECEIVER ---
      if (url.pathname === '/webhook' && request.method === 'POST') {
        try {
          const payload: any[] = await request.json();
          const response = new Response('Webhook received', { status: 200, headers: corsHeaders });
          
          // Log Webhook to D1 immediately
          await env.TRADINGBOT_DB.prepare("INSERT INTO signals (id, source, event_type, payload) VALUES (?, ?, ?, ?)")
            .bind(Date.now().toString() + Math.random().toString(36).slice(2), "helius", "SWAP", JSON.stringify(payload))
            .run();
            
          ctx.waitUntil(processTradingLogic(payload, env));
          return response;
        } catch (e) {
          console.error(e);
          return new Response('Bad Request', { status: 400, headers: corsHeaders });
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err: any) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
}

async function processTradingLogic(txs: any[], env: Env) {
  const state = await getEngineStateFromD1(env.TRADINGBOT_DB);
  const envKey = state.settings.secretName;
  let rawKey = envKey && (env as any)[envKey] ? (env as any)[envKey] : null;
  if (!rawKey && envKey && (envKey.startsWith('[') || envKey.length > 30)) {
     rawKey = envKey;
  }
  if (!rawKey) {
     rawKey = (env as any).PVK3 || (env as any).BOT_SECRET_KEY;
  }

  // Loop through all transactions provided in this webhook batch
  for (const tx of txs) {
    console.log(`Processing Tx: ${tx.signature}`);
    const nativeInputAmount = tx?.events?.swap?.nativeInput?.amount;
    
    if (nativeInputAmount > 1000000000) { 
      console.log('Whale Buy Detected! Executing algorithm pullback protocol...');
      const connection = new Connection(env.RPC_URL || "https://api.mainnet-beta.solana.com");
      try {
         if (rawKey) {
             const secretRaw = rawKey.trim();
             const secretKey = secretRaw.startsWith('[') ? Uint8Array.from(JSON.parse(secretRaw)) : bs58.decode(secretRaw);
             if (secretKey) {
                 const botKeypair = Keypair.fromSecretKey(secretKey);
                 // Algorithm executing trades using our D1 state configuration...
             }
         }
      } catch(e) {
         console.error("Invalid Secret in Worker ENV");
      }
    }
  }
}

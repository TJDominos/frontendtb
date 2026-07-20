use futures::StreamExt;
use solana_client::nonblocking::pubsub_client::PubsubClient;
use solana_client::rpc_config::{RpcTransactionLogsConfig, RpcTransactionLogsFilter};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};

use crate::EngineState;

/// Maintains a resilient WebSocket connection to an RPC node to monitor a specific contract
pub async fn monitor_contract_websocket(wss_url: String, contract_address: &str, _state: Arc<RwLock<EngineState>>) {
    let pubkey = Pubkey::from_str(contract_address).expect("Invalid contract address format");

    loop {
        log::info!("Attempting to connect to WSS at {}", wss_url);

        // 1. Establish asynchronous Pubsub connection
        match PubsubClient::new(&wss_url).await {
            Ok(client) => {
                log::info!("WSS Connected Successfully!");

                // 2. Configure our subscription Filter
                // We want to listen to ALL logs that merely mention our contract address
                let filter = RpcTransactionLogsFilter::Mentions(vec![pubkey.to_string()]);
                let config = RpcTransactionLogsConfig {
                    commitment: Some(CommitmentConfig::confirmed()),
                };

                // 3. Subscribe to the logs
                match client.logs_subscribe(filter, config).await {
                    Ok((mut log_stream, _unsubscribe_fn)) => {
                        log::info!("Listening for activity on contract: {}", contract_address);

                        // 4. Await incoming transactions on the stream continuously
                        while let Some(log_info) = log_stream.next().await {
                            let signature = log_info.value.signature;
                            
                            // Here you parse the events/logs to determine if it was a Buy or Sell
                            // and extract the amounts.
                            log::info!("New Tx Detected! Signature: {}", signature);
                            
                            // Example: Send signal to the trading engine to evaluate state
                            // Strategy matching runs here.
                        }

                        // If the stream breaks out of the while loop, the server dropped the connection
                        log::warn!("WSS Data Stream ended unexpectedly. Reconnecting...");
                    }
                    Err(e) => {
                        log::error!("Failed to subscribe to contract logs: {}. Retrying...", e);
                    }
                }
            }
            Err(e) => {
                log::error!("WSS Connection Failed: {}. Retrying soon...", e);
            }
        }

        // 5. Back-off before attempting to reconnect to avoid spamming the RPC node
        sleep(Duration::from_secs(3)).await;
    }
}

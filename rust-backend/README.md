# WLT Trading Engine - Rust Backend
This is the Rust implementation of the WLT smart trading algorithms and API backend. 

* **`main.rs`** - Holds the initialization of the `tokio` asynchronous runtime, establishes the Solana `RPC` connection, starts the active web server (`warp`), and drops the trading algorithms into background tasks.
* **`strategy.rs`** - Manages the primary active strategies you configured: **Volatility Target Rebalancing** and **Outsider Pull Backs**. Simulates mem-pool scanning and performs automated logic to pull trading strings.
* **`models.rs`** - Structures formatting out to your local trading dashboard.

## Requirements
* `cargo` and `rustc` installed on your host machine.

## How to run locally
Because the AI Studio live preview uses an isolated Node.js container to serve your live visuals on the web, this Rust engine code has been decoupled into its own directory so you can interact with it independently. 

1. Export this project to your machine (via the Settings Menu -> Export to GitHub / ZIP).
2. Open your terminal and walk to `cd rust-backend`
3. Run `cargo build`
4. Run `cargo run`

To serve the React Dashboard, open a second terminal from the root folder directory and run:
`npm install && npm run dev`.

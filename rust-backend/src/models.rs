use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use warp::reply::Json;
use warp::Reply;
use serde::{Serialize, Deserialize};

use crate::EngineState;

// DTO for JSON conversion
#[derive(Serialize)]
pub struct EngineStateDto {
    pub stats: StatsDto,
}

#[derive(Serialize)]
pub struct StatsDto {
    pub price: f64,
    pub ma_price: f64,
}

pub async fn handle_get_state(state: Arc<RwLock<EngineState>>) -> Result<impl Reply, Infallible> {
    let s = state.read().await;
    let dto = EngineStateDto {
        stats: StatsDto {
            price: s.current_price,
            ma_price: s.ma_price,
        }
    };
    
    Ok(warp::reply::json(&dto))
}

export interface EngineState {
  error?: string;
  details?: string;
  internalAccs: any[];
  outsiderAccs: any[];
  logs: any[];
  stats: {
    price: number;
    maPrice: number;
    totalWlt: number;
    liqUsdc: number;
    fdv: number;
    totalOutsiders: number;
  };
  setups?: any[];
  settings?: any;
}

export interface AppState {
  activeTab: string;
  engineState: EngineState | null;
  lastUpdated: string;
  dateRange: { from: string; to: string };
  accountSearchTerm: string;
  internalPage: number;
  outsiderPage: number;
  logSearchTerm: string;
  logCurrentPage: number;
  volTarget: string;
  pullbackTarget: string;
  volumeTarget: string;
  netBuyinTarget: string;
  timeRangeTarget: string;
  maxTransactions: string;
  maxSlippage: string;
  tradingAlgorithm: string;
  secretName: string;
  contractAddress: string;
  workerUrl: string;
  cfAccessClientId: string;
  cfAccessClientSecret: string;
  savedContractAddresses: string[];
  savedWorkerUrls: string[];
  savedSecretNames: string[];
}

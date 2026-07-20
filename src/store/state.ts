import { AppState } from '../types';

const getSavedArr = (key: string) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

export const initialState: AppState = {
  activeTab: 'dashboard',
  engineState: null,
  lastUpdated: new Date().toLocaleTimeString(),
  
  dateRange: { from: '', to: '' },
  
  accountSearchTerm: '',
  internalPage: 1,
  outsiderPage: 1,
  
  logSearchTerm: '',
  logCurrentPage: 1,
  
  volTarget: '',
  pullbackTarget: '',
  volumeTarget: '',
  netBuyinTarget: '',
  timeRangeTarget: '24h',
  maxTransactions: '100',
  maxSlippage: '0.0100',
  tradingAlgorithm: '// Enter your trading algorithm here\nfunction executeTrade(state) {\n  // return action\n}',
  secretName: '',
  contractAddress: '',
  workerUrl: '',
  cfAccessClientId: '',
  cfAccessClientSecret: '',
  
  savedContractAddresses: getSavedArr('savedContractAddresses'),
  savedWorkerUrls: getSavedArr('savedWorkerUrls'),
  savedSecretNames: getSavedArr('savedSecretNames'),
};

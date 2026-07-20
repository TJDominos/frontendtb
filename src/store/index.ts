import { create } from 'zustand';
import { AppState } from '../types';
import { initialState } from './state';
import { createActions } from './actions';

export type StoreType = AppState & {
  actions: ReturnType<typeof createActions>
};

export const useStore = create<StoreType>((set, get) => ({
  ...initialState,
  actions: createActions(set, get)
}));

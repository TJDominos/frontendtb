import { StoreType } from './index';

export const selectState = (state: StoreType) => state;
export const selectActions = (state: StoreType) => state.actions;
export const selectEngineState = (state: StoreType) => state.engineState;

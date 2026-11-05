import { createContext, useContext } from 'react';

export const TraySpace = createContext(0);

export function useTraySpace(): number {
  return useContext(TraySpace);
}

import { createContext, useContext, ReactNode } from 'react';
import { useUploadzx, UseUploadzxOptions } from '../hooks/useUploadzx';

type UploadzxContextValue = ReturnType<typeof useUploadzx>;

const UploadzxContext = createContext<UploadzxContextValue | null>(null);

interface UploadzxProviderProps {
  children: ReactNode;
  options: UseUploadzxOptions;
}

export function UploadzxProvider({ children, options }: UploadzxProviderProps) {
  const uploadzxValue = useUploadzx(options);

  return (
    <UploadzxContext.Provider value={uploadzxValue}>
      {children}
    </UploadzxContext.Provider>
  );
}

export function useUploadzxContext() {
  const context = useContext(UploadzxContext);
  if (!context) {
    throw new Error('useUploadzxContext must be used within UploadzxProvider');
  }
  return context;
} 
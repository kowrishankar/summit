import React, { createContext, useContext, useState, useCallback } from 'react';

export type AddPreferredType = 'invoice' | 'sale' | null;

interface AddPreferredContextValue {
  preferredAddType: AddPreferredType;
  setPreferredAddType: (type: AddPreferredType) => void;
}

const AddPreferredContext = createContext<AddPreferredContextValue | null>(null);

export function AddPreferredProvider({ children }: { children: React.ReactNode }) {
  const [preferredAddType, setPreferredAddType] = useState<AddPreferredType>(null);
  const value: AddPreferredContextValue = {
    preferredAddType,
    setPreferredAddType: useCallback((type: AddPreferredType) => setPreferredAddType(type), []),
  };
  return (
    <AddPreferredContext.Provider value={value}>
      {children}
    </AddPreferredContext.Provider>
  );
}

export function useAddPreferred() {
  const ctx = useContext(AddPreferredContext);
  if (!ctx) throw new Error('useAddPreferred must be used within AddPreferredProvider');
  return ctx;
}

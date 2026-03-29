import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ExtractedInvoiceData } from '../types';
import type { ReceiptImageAsset } from '../services/receiptExtractionRunner';

export type PendingExtractionStatus = 'extracting' | 'ready' | 'error';

export interface PendingExtractionItem {
  id: string;
  kind: 'invoice' | 'sale';
  status: PendingExtractionStatus;
  fileName: string;
  isPdf: boolean;
  documentUri: string | null;
  imageAssets: ReceiptImageAsset[];
  extracted?: ExtractedInvoiceData;
  errorMessage?: string;
  createdAt: number;
}

type PendingExtractionInput = Omit<PendingExtractionItem, 'status' | 'extracted' | 'errorMessage' | 'createdAt'>;

interface PendingExtractionContextValue {
  items: PendingExtractionItem[];
  addPendingExtracting: (input: PendingExtractionInput) => void;
  updatePending: (id: string, patch: Partial<Pick<PendingExtractionItem, 'status' | 'extracted' | 'errorMessage'>>) => void;
  removePending: (id: string) => void;
  getPending: (id: string) => PendingExtractionItem | undefined;
}

const PendingExtractionContext = createContext<PendingExtractionContextValue | null>(null);

export function PendingExtractionProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<PendingExtractionItem[]>([]);

  const addPendingExtracting = useCallback(
    (input: PendingExtractionInput) => {
      const row: PendingExtractionItem = {
        ...input,
        status: 'extracting',
        createdAt: Date.now(),
      };
      setItems((prev) => [...prev.filter((p) => p.id !== input.id), row]);
    },
    []
  );

  const updatePending = useCallback((id: string, patch: Partial<Pick<PendingExtractionItem, 'status' | 'extracted' | 'errorMessage'>>) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }, []);

  const removePending = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const getPending = useCallback(
    (id: string) => items.find((p) => p.id === id),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addPendingExtracting,
      updatePending,
      removePending,
      getPending,
    }),
    [items, addPendingExtracting, updatePending, removePending, getPending]
  );

  return (
    <PendingExtractionContext.Provider value={value}>{children}</PendingExtractionContext.Provider>
  );
}

export function usePendingExtraction() {
  const ctx = useContext(PendingExtractionContext);
  if (!ctx) throw new Error('usePendingExtraction must be used within PendingExtractionProvider');
  return ctx;
}

export function createPendingExtractionId(): string {
  return uuidv4();
}

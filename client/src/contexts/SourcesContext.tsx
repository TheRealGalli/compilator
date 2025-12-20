import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { getApiUrl } from '@/lib/api-config';

export interface Source {
    id: string;
    name: string;
    selected: boolean;
    type: string;
    size: number;
    url?: string; // Optional GCS URL (for backward compatibility or compiler)
    base64?: string; // Client-side base64 content
    isPinned?: boolean; // Single master document for graphic structure
}

interface SourcesContextType {
    sources: Source[];
    addSource: (file: File) => Promise<'success' | 'limit_reached' | 'duplicate' | 'file_too_large' | 'error'>;
    removeSource: (id: string) => void;
    toggleSource: (id: string) => void;
    togglePin: (id: string) => void;
    selectedSources: Source[];
    pinnedSource: Source | null;
    maxSources: number;
}

const SourcesContext = createContext<SourcesContextType | undefined>(undefined);

const MAX_SOURCES = 10;
const MAX_FILE_SIZE_MB = 30; // Technical limit for Cloud Run JSON payload (32MB) with base64 overhead

export function SourcesProvider({ children }: { children: ReactNode }) {
    const [sources, setSources] = useState<Source[]>([]);

    const addSource = useCallback(async (file: File): Promise<'success' | 'limit_reached' | 'duplicate' | 'file_too_large' | 'error'> => {
        if (sources.length >= MAX_SOURCES) {
            return 'limit_reached';
        }

        // Check if file with same name already exists
        if (sources.some(s => s.name === file.name)) {
            return 'duplicate';
        }

        // Check file size (client-side check for Cloud Run limits)
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            console.warn(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            return 'file_too_large';
        }

        try {
            // Read file as Base64 client-side
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data URL prefix (e.g., "data:application/pdf;base64,")
                    const base64Content = result.split(',')[1];
                    resolve(base64Content);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const newSource: Source = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                selected: true,
                type: file.type,
                size: file.size,
                base64: base64, // Store base64 directly
                isPinned: false,
            };

            setSources(prev => [...prev, newSource]);
            return 'success';
        } catch (error) {
            console.error('Error reading file:', error);
            return 'error';
        }
    }, [sources]);

    const removeSource = useCallback((id: string) => {
        setSources(prev => prev.filter(s => s.id !== id));
    }, []);

    const toggleSource = useCallback((id: string) => {
        setSources(prev =>
            prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s))
        );
    }, []);

    const togglePin = useCallback((id: string) => {
        setSources(prev =>
            prev.map(s => {
                if (s.id === id) {
                    return { ...s, isPinned: !s.isPinned };
                }
                // Unpin others
                return { ...s, isPinned: false };
            })
        );
    }, []);

    const selectedSources = sources.filter(s => s.selected);

    return (
        <SourcesContext.Provider
            value={{
                sources,
                addSource,
                removeSource,
                toggleSource,
                togglePin,
                selectedSources,
                pinnedSource: sources.find(s => s.isPinned) || null,
                maxSources: MAX_SOURCES,
            }}
        >
            {children}
        </SourcesContext.Provider>
    );
}

export function useSources() {
    const context = useContext(SourcesContext);
    if (!context) {
        throw new Error('useSources must be used within a SourcesProvider');
    }
    return context;
}

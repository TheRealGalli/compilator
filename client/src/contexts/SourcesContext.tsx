import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Source {
    id: string;
    name: string;
    file: File;
    selected: boolean;
    type: string;
    size: number;
}

interface SourcesContextType {
    sources: Source[];
    addSource: (file: File) => boolean;
    removeSource: (id: string) => void;
    toggleSource: (id: string) => void;
    selectedSources: Source[];
    maxSources: number;
}

const SourcesContext = createContext<SourcesContextType | undefined>(undefined);

const MAX_SOURCES = 10;

export function SourcesProvider({ children }: { children: ReactNode }) {
    const [sources, setSources] = useState<Source[]>([]);

    const addSource = useCallback((file: File): boolean => {
        if (sources.length >= MAX_SOURCES) {
            return false; // Max limit reached
        }

        // Check if file with same name already exists
        if (sources.some(s => s.name === file.name)) {
            return false; // Duplicate name
        }

        const newSource: Source = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            file,
            selected: true, // Auto-select new sources
            type: file.type,
            size: file.size,
        };

        setSources(prev => [...prev, newSource]);
        return true;
    }, [sources]);

    const removeSource = useCallback((id: string) => {
        setSources(prev => prev.filter(s => s.id !== id));
    }, []);

    const toggleSource = useCallback((id: string) => {
        setSources(prev =>
            prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s))
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
                selectedSources,
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

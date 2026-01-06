import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Source {
    id: string;
    name: string;
    selected: boolean;
    type: string;
    size: number;
    url?: string;
    base64?: string;
    isMemory?: boolean;
    isMaster?: boolean; // Master source for formatting (Blue Check)
}

interface SourcesContextType {
    sources: Source[];
    addSource: (file: File, options?: { isMemory?: boolean }) => Promise<'success' | 'limit_reached' | 'duplicate' | 'file_too_large' | 'invalid_format' | 'error'>;
    removeSource: (id: string) => void;
    toggleSource: (id: string) => void;
    toggleMaster: (id: string) => void; // New: Master Source Toggle
    selectedSources: Source[];
    masterSource: Source | undefined; // New: Master Source Reference
    maxSources: number;
}

const SourcesContext = createContext<SourcesContextType | undefined>(undefined);

const MAX_SOURCES = 10;
const MAX_FILE_SIZE_MB = 30;

const ALLOWED_EXTENSIONS = [
    'pdf', 'docx', 'doc', 'txt', 'csv', 'rtf', 'md', 'json', 'xml', 'html',
    'jpg', 'jpeg', 'png', 'webp', 'heic',
    'mp3', 'wav', 'm4a'
];

export function SourcesProvider({ children }: { children: ReactNode }) {
    const [sources, setSources] = useState<Source[]>([]);

    const addSource = useCallback(async (file: File, options?: { isMemory?: boolean }): Promise<'success' | 'limit_reached' | 'duplicate' | 'file_too_large' | 'invalid_format' | 'error'> => {
        if (!options?.isMemory) {
            const userSources = sources.filter(s => !s.isMemory);
            if (userSources.length >= MAX_SOURCES) {
                return 'limit_reached';
            }
        }

        if (sources.some(s => s.name === file.name)) {
            return 'duplicate';
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            console.warn(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            return 'file_too_large';
        }

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
            console.warn(`Invalid file format: ${file.name}`);
            return 'invalid_format';
        }

        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
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
                base64: base64,
                isMemory: options?.isMemory
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

    const toggleMaster = useCallback((id: string) => {
        setSources(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, isMaster: !s.isMaster };
            }
            return { ...s, isMaster: false }; // Ensure only one master source at a time
        }));
    }, []);

    const selectedSources = sources.filter(s => s.selected);
    const masterSource = sources.find(s => s.isMaster);

    return (
        <SourcesContext.Provider
            value={{
                sources,
                addSource,
                removeSource,
                toggleSource,
                toggleMaster,
                selectedSources,
                masterSource,
                maxSources: MAX_SOURCES
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

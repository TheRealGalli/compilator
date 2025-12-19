import React, { createContext, useContext, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    iconLink?: string;
    thumbnailLink?: string;
}

export type DriveCategory = 'all' | 'folders' | 'docs' | 'sheets' | 'pdfs';

interface GoogleDriveContextType {
    files: DriveFile[];
    isFetchingFiles: boolean;
    nextPageToken: string | null;
    currentCategory: DriveCategory;
    searchQuery: string;
    setCategory: (category: DriveCategory) => void;
    setSearchQuery: (query: string) => void;
    fetchFiles: (pageToken?: string) => Promise<void>;
    importFile: (fileId: string, name: string) => Promise<{ name: string, mimeType: string, base64: string, size: number } | null>;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: React.ReactNode }) {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isFetchingFiles, setIsFetchingFiles] = useState(false);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [currentCategory, setCurrentCategory] = useState<DriveCategory>('all');
    const [searchQuery, setSearchQueryState] = useState('');
    const { toast } = useToast();

    // Re-use tokens from session storage (shared with Gmail)
    const getGoogleHeaders = useCallback((): Record<string, string> => {
        const saved = sessionStorage.getItem('gmail_tokens');
        return saved ? { 'x-gmail-tokens': saved } : {};
    }, []);

    const fetchFiles = useCallback(async (pageToken?: string) => {
        setIsFetchingFiles(true);
        try {
            const params = new URLSearchParams();
            if (pageToken) params.append('pageToken', pageToken);
            if (currentCategory !== 'all') params.append('category', currentCategory);
            if (searchQuery) params.append('q', searchQuery);

            const res = await apiRequest('GET', `/api/drive/files?${params.toString()}`, undefined, getGoogleHeaders());
            if (res.ok) {
                const data = await res.json();
                if (pageToken) {
                    setFiles(prev => [...prev, ...(data.files || [])]);
                } else {
                    setFiles(data.files || []);
                }
                setNextPageToken(data.nextPageToken || null);
            }
        } catch (error) {
            console.error("Fetch Drive files error:", error);
            toast({
                title: "Errore Drive",
                description: "Impossibile caricare i file da Google Drive.",
                variant: "destructive",
            });
        } finally {
            setIsFetchingFiles(false);
        }
    }, [getGoogleHeaders, currentCategory, searchQuery, toast]);

    const importFile = async (fileId: string, name: string) => {
        try {
            const res = await apiRequest('GET', `/api/drive/export/${fileId}`, undefined, getGoogleHeaders());
            if (res.ok) {
                return await res.json();
            }
        } catch (error) {
            console.error("Import Drive file error:", error);
            toast({
                title: "Errore Importazione",
                description: `Impossibile importare il file: ${name}`,
                variant: "destructive",
            });
        }
        return null;
    };

    const setCategory = useCallback((category: DriveCategory) => {
        if (category === currentCategory) return;
        setCurrentCategory(category);
        setFiles([]);
        setNextPageToken(null);
    }, [currentCategory]);

    const setSearchQuery = useCallback((query: string) => {
        if (query === searchQuery) return;
        setSearchQueryState(query);
        setFiles([]);
        setNextPageToken(null);
    }, [searchQuery]);

    return (
        <GoogleDriveContext.Provider value={{
            files,
            isFetchingFiles,
            nextPageToken,
            currentCategory,
            searchQuery,
            setCategory,
            setSearchQuery,
            fetchFiles,
            importFile
        }}>
            {children}
        </GoogleDriveContext.Provider>
    );
}

export function useGoogleDrive() {
    const context = useContext(GoogleDriveContext);
    if (context === undefined) {
        throw new Error("useGoogleDrive must be used within a GoogleDriveProvider");
    }
    return context;
}

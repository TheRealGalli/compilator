import React, { createContext, useContext, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSources } from "./SourcesContext";

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    iconLink?: string;
    thumbnailLink?: string;
}

interface FolderInfo {
    id: string;
    name: string;
}

export type DriveCategory = 'all' | 'folders' | 'docs' | 'sheets' | 'pdfs';

interface GoogleDriveContextType {
    files: DriveFile[];
    isFetchingFiles: boolean;
    nextPageToken: string | null;
    currentCategory: DriveCategory;
    searchQuery: string;
    currentFolderId: string | null;
    folderPath: FolderInfo[];
    setCategory: (category: DriveCategory) => void;
    setSearchQuery: (query: string) => void;
    fetchFiles: (pageToken?: string, reset?: boolean) => Promise<void>;
    importFile: (fileId: string, name: string) => Promise<{ name: string, mimeType: string, base64: string, size: number } | null>;
    navigateToFolder: (folderId: string, folderName: string) => void;
    goToParentFolder: () => void;
    resetNavigation: () => void;
    userIdentity: { name: string, initial: string } | null;
    isConnected: boolean;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: React.ReactNode }) {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isFetchingFiles, setIsFetchingFiles] = useState(false);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [currentCategory, setCurrentCategory] = useState<DriveCategory>('all');
    const [searchQuery, setSearchQueryState] = useState('');
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [folderPath, setFolderPath] = useState<FolderInfo[]>([]);
    const { toast } = useToast();

    // Re-use tokens from session storage (shared with Gmail)
    const getGoogleHeaders = useCallback((): Record<string, string> => {
        const saved = sessionStorage.getItem('gmail_tokens');
        return saved ? { 'x-gmail-tokens': saved } : {};
    }, []);

    const fetchFiles = useCallback(async (pageToken?: string, reset: boolean = false) => {
        setIsFetchingFiles(true);
        if (reset) {
            setFiles([]);
            setNextPageToken(null);
        }

        try {
            const params = new URLSearchParams();
            if (pageToken) params.append('pageToken', pageToken);

            // If we are in "Cartelle" category, we only show folders
            // If we are in any other category and have a folderId, we show content of that folder
            if (currentCategory !== 'all') {
                params.append('category', currentCategory);
            } else if (currentFolderId) {
                // If "All files" but inside a folder, we show content of the folder
                // (Backend will need to handle folderId + all category)
            }

            if (currentFolderId) params.append('folderId', currentFolderId);
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
    }, [getGoogleHeaders, currentCategory, currentFolderId, searchQuery, toast]);

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
        setCurrentCategory(category);
        if (category === 'folders') {
            // Cartelle tab should show root folders
            setCurrentFolderId(null);
            setFolderPath([]);
        }
        // Force reset and fetch will be handled by the caller or useEffect
    }, []);

    const setSearchQuery = useCallback((query: string) => {
        setSearchQueryState(query);
    }, []);



    // NEW: Check for Gromit Memory File
    const { addSource, sources } = useSources();

    const [userIdentity, setUserIdentity] = useState<{ name: string, initial: string } | null>(null);

    // ... imports ...

    const checkMemoryFile = useCallback(async () => {
        // Avoid duplicate checking if already present
        if (sources.some(s => s.isMemory)) return;

        try {
            // Backend treats 'q' as "name contains 'q'", so we just send the filename
            const searchName = "Gromit-Memory.pdf";
            const res = await apiRequest('GET', `/api/drive/files?q=${encodeURIComponent(searchName)}`, undefined, getGoogleHeaders());

            if (res.ok) {
                const data = await res.json();
                if (data.files && data.files.length > 0) {
                    // Find exact match (backend uses "contains")
                    const memoryFile = data.files.find((f: any) => f.name === searchName && !f.trashed);

                    if (memoryFile) {
                        console.log("[Drive] Found Memory File:", memoryFile.name);

                        // Import content
                        const imported = await importFile(memoryFile.id, memoryFile.name);
                        if (imported && imported.base64) {

                            // 1. Add to Sources
                            const byteCharacters = atob(imported.base64);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: imported.mimeType });
                            const file = new File([blob], imported.name, { type: imported.mimeType });

                            await addSource(file, { isMemory: true });

                            // 2. Extract Identity
                            console.log("[Drive] Extracting Identity...");
                            try {
                                const idRes = await apiRequest('POST', '/api/extract-identity', {
                                    fileData: imported.base64,
                                    mimeType: imported.mimeType
                                });
                                if (idRes.ok) {
                                    const idData = await idRes.json();
                                    if (idData.identity) {
                                        setUserIdentity(idData.identity);
                                        toast({
                                            title: `Benvenuto, ${idData.identity.name}`,
                                            description: "Identità estratta dalla memoria.",
                                        });
                                    }
                                }
                            } catch (err) {
                                console.error("Identity extraction failed", err);
                            }

                            toast({
                                title: "Memoria Connessa",
                                description: "Gromit-Memory.pdf caricato come memoria di sistema.",
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error("[Drive] Error checking memory file:", error);
        }
    }, [getGoogleHeaders, importFile, addSource, sources, toast]);

    // Auto-fetch on dependencies change
    React.useEffect(() => {
        const tokens = sessionStorage.getItem('gmail_tokens');
        if (tokens) {
            fetchFiles(undefined, true);
        }
    }, [currentCategory, currentFolderId, searchQuery, fetchFiles]);

    // Check memory file on load/connection
    const hasCheckedMemory = React.useRef(false);

    React.useEffect(() => {
        const tokens = sessionStorage.getItem('gmail_tokens');
        if (tokens && !hasCheckedMemory.current) {
            hasCheckedMemory.current = true;
            checkMemoryFile();
        }
    }, [checkMemoryFile]);

    const navigateToFolder = useCallback((folderId: string, folderName: string) => {
        setCurrentFolderId(folderId);
        setFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
        // When navigating to a folder, we should show "all" files in it
        setCurrentCategory('all');
    }, []);

    const goToParentFolder = useCallback(() => {
        setFolderPath(prev => {
            const newPath = [...prev];
            newPath.pop();
            const parent = newPath[newPath.length - 1];
            setCurrentFolderId(parent ? parent.id : null);
            return newPath;
        });
    }, []);

    const resetNavigation = useCallback(() => {
        setCurrentFolderId(null);
        setFolderPath([]);
        setCurrentCategory('all');
    }, []);

    return (
        <GoogleDriveContext.Provider value={{
            files,
            isFetchingFiles,
            nextPageToken,
            currentCategory,
            searchQuery,
            currentFolderId,
            folderPath,
            setCategory,
            setSearchQuery,
            fetchFiles,
            importFile,
            navigateToFolder,
            goToParentFolder,
            resetNavigation,
            userIdentity,
            isConnected: !!sessionStorage.getItem('gmail_tokens')
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

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SessionState {
    templateContent: string;
    compiledContent: string;
    messages: any[];
    frozenColor: string | null;
    mentionRegistry: any[];
    activeGuardrails: string[];
    guardrailVault: Record<string, string>;
}

interface CompilerState {
    templateContent: string;
    compiledContent: string;
    isRefiningMode: boolean;
    isReviewing: boolean;
    pendingContent: string | null;
    lastCompileContext: any;
    notes: string;
    temperature: number;
    webResearch: boolean;
    detailedAnalysis: boolean;
    formalTone: boolean;
    pinnedSourceId: string | null;
    isLocked: boolean;
    currentMode: 'standard' | 'fillable';
    messages: any[];
    mentions: any[];
    mentionRegistry: any[];
    frozenColor: string | null;
    activeGuardrails: string[];
    guardrailVault: Record<string, string>;
    standardSnapshot: SessionState | null;
    masterSnapshots: Record<string, SessionState>;
}

interface CompilerContextType extends CompilerState {
    setTemplateContent: (val: string) => void;
    setCompiledContent: (val: string) => void;
    setIsRefiningMode: (val: boolean) => void;
    setIsReviewing: (val: boolean) => void;
    setPendingContent: (val: string | null) => void;
    setLastCompileContext: (val: any) => void;
    setNotes: (val: string) => void;
    setTemperature: (val: number) => void;
    setWebResearch: (val: boolean) => void;
    setDetailedAnalysis: (val: boolean) => void;
    setFormalTone: (val: boolean) => void;
    setPinnedSourceId: (val: string | null) => void;
    setIsLocked: (val: boolean) => void;
    setCurrentMode: (val: 'standard' | 'fillable') => void;
    setMessages: (val: any[] | ((prev: any[]) => any[])) => void;
    setMentions: (val: any[] | ((prev: any[]) => any[])) => void;
    setMentionRegistry: (val: any[] | ((prev: any[]) => any[])) => void;
    setFrozenColor: (val: string | null) => void;
    setGuardrailVault: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
    toggleGuardrail: (id: string) => void;
    takeStandardSnapshot: () => void;
    restoreStandardSnapshot: () => void;
    takeMasterSnapshot: (sourceId: string) => void;
    restoreMasterSnapshot: (sourceId: string) => boolean;
    resetSession: () => void;
}

const CompilerContext = createContext<CompilerContextType | undefined>(undefined);

export function CompilerProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<CompilerState>({
        templateContent: '',
        compiledContent: '',
        isRefiningMode: false,
        isReviewing: false,
        pendingContent: null,
        lastCompileContext: null,
        notes: '',
        temperature: 0.7,
        webResearch: false,
        detailedAnalysis: true,
        formalTone: true,
        pinnedSourceId: null,
        isLocked: false,
        currentMode: 'standard',
        messages: [],
        mentions: [],
        mentionRegistry: [],
        frozenColor: null,
        activeGuardrails: [],
        guardrailVault: {},
        standardSnapshot: null,
        masterSnapshots: {},
    });

    const setTemplateContent = (val: string) => setState(prev => ({ ...prev, templateContent: val }));
    const setCompiledContent = (val: string) => setState(prev => {
        const isNowRefining = val.trim() !== '';
        return { ...prev, compiledContent: val, isRefiningMode: isNowRefining };
    });
    const setIsRefiningMode = (val: boolean) => setState(prev => ({ ...prev, isRefiningMode: val }));
    const setIsReviewing = (val: boolean) => setState(prev => ({ ...prev, isReviewing: val }));
    const setPendingContent = (val: string | null) => setState(prev => ({ ...prev, pendingContent: val }));
    const setLastCompileContext = (val: any) => setState(prev => ({ ...prev, lastCompileContext: val }));
    const setNotes = (val: string) => setState(prev => ({ ...prev, notes: val }));
    const setTemperature = (val: number) => setState(prev => ({ ...prev, temperature: val }));
    const setWebResearch = (val: boolean) => setState(prev => ({ ...prev, webResearch: val }));
    const setDetailedAnalysis = (val: boolean) => setState(prev => ({ ...prev, detailedAnalysis: val }));
    const setFormalTone = (val: boolean) => setState(prev => ({ ...prev, formalTone: val }));
    const setPinnedSourceId = (val: string | null) => setState(prev => ({ ...prev, pinnedSourceId: val }));
    const setIsLocked = (val: boolean) => setState(prev => ({ ...prev, isLocked: val }));
    const setCurrentMode = (val: 'standard' | 'fillable') => setState(prev => ({ ...prev, currentMode: val }));
    const setFrozenColor = (val: string | null) => setState(prev => ({ ...prev, frozenColor: val }));

    const setGuardrailVault = useCallback((val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
        setState(prev => ({
            ...prev,
            guardrailVault: typeof val === 'function' ? val(prev.guardrailVault) : val
        }));
    }, []);

    const toggleGuardrail = useCallback((id: string) => {
        setState(prev => {
            const isActive = prev.activeGuardrails.includes(id);
            return {
                ...prev,
                activeGuardrails: isActive
                    ? prev.activeGuardrails.filter(g => g !== id)
                    : [...prev.activeGuardrails, id]
            };
        });
    }, []);

    const setMessages = useCallback((val: any[] | ((prev: any[]) => any[])) => {
        setState(prev => ({
            ...prev,
            messages: typeof val === 'function' ? val(prev.messages) : val
        }));
    }, []);

    const setMentions = useCallback((val: any[] | ((prev: any[]) => any[])) => {
        setState(prev => ({
            ...prev,
            mentions: typeof val === 'function' ? val(prev.mentions) : val
        }));
    }, []);

    const setMentionRegistry = useCallback((val: any[] | ((prev: any[]) => any[])) => {
        setState(prev => ({
            ...prev,
            mentionRegistry: typeof val === 'function' ? val(prev.mentionRegistry) : val
        }));
    }, []);

    const takeStandardSnapshot = useCallback(() => {
        setState(prev => ({
            ...prev,
            standardSnapshot: {
                templateContent: prev.templateContent,
                compiledContent: prev.compiledContent,
                messages: [...prev.messages],
                frozenColor: null,
                mentionRegistry: [...prev.mentionRegistry],
                activeGuardrails: [...prev.activeGuardrails],
                guardrailVault: { ...prev.guardrailVault },
            }
        }));
    }, []);

    const restoreStandardSnapshot = useCallback(() => {
        setState(prev => {
            const newSnapshots = { ...prev.masterSnapshots };

            // If we're unpinning, save the current work to that source's snapshot first
            if (prev.pinnedSourceId && prev.isLocked) {
                newSnapshots[prev.pinnedSourceId] = {
                    templateContent: prev.templateContent,
                    compiledContent: prev.compiledContent,
                    messages: [...prev.messages],
                    frozenColor: prev.frozenColor,
                    mentionRegistry: [...prev.mentionRegistry],
                    activeGuardrails: [...prev.activeGuardrails],
                    guardrailVault: { ...prev.guardrailVault }
                };
            }

            if (!prev.standardSnapshot) {
                return {
                    ...prev,
                    masterSnapshots: newSnapshots,
                    templateContent: '',
                    compiledContent: '',
                    messages: [],
                    isLocked: false,
                    frozenColor: null,
                    isRefiningMode: false,
                    pinnedSourceId: null // Clear pinned ID
                };
            }
            return {
                ...prev,
                masterSnapshots: newSnapshots,
                templateContent: prev.standardSnapshot.templateContent,
                compiledContent: prev.standardSnapshot.compiledContent,
                messages: prev.standardSnapshot.messages,
                mentionRegistry: prev.standardSnapshot.mentionRegistry,
                activeGuardrails: prev.standardSnapshot.activeGuardrails,
                guardrailVault: prev.standardSnapshot.guardrailVault,
                isLocked: false,
                frozenColor: null,
                isRefiningMode: prev.standardSnapshot.compiledContent !== '',
                pinnedSourceId: null // Clear pinned ID
            };
        });
    }, []);

    const takeMasterSnapshot = useCallback((sourceId: string) => {
        setState(prev => ({
            ...prev,
            masterSnapshots: {
                ...prev.masterSnapshots,
                [sourceId]: {
                    templateContent: prev.templateContent,
                    compiledContent: prev.compiledContent,
                    messages: [...prev.messages],
                    frozenColor: prev.frozenColor,
                    mentionRegistry: [...prev.mentionRegistry],
                    activeGuardrails: [...prev.activeGuardrails],
                    guardrailVault: { ...prev.guardrailVault }
                }
            }
        }));
    }, []);

    const restoreMasterSnapshot = useCallback((sourceId: string) => {
        let restored = false;
        setState(prev => {
            const snapshot = prev.masterSnapshots[sourceId];
            if (!snapshot) {
                // If it's a new pin, reset compiled content and messages
                return {
                    ...prev,
                    templateContent: '',
                    compiledContent: '',
                    messages: [],
                    mentionRegistry: [],
                    frozenColor: null,
                    isRefiningMode: false,
                    isLocked: true,
                    pinnedSourceId: sourceId
                };
            }
            restored = true;
            return {
                ...prev,
                templateContent: snapshot.templateContent,
                compiledContent: snapshot.compiledContent,
                messages: snapshot.messages,
                mentionRegistry: snapshot.mentionRegistry || [],
                activeGuardrails: snapshot.activeGuardrails || [],
                guardrailVault: snapshot.guardrailVault || {},
                frozenColor: snapshot.frozenColor,
                isRefiningMode: snapshot.compiledContent !== '',
                isLocked: true,
                pinnedSourceId: sourceId,
            };
        });
        return restored;
    }, []);

    const resetSession = useCallback(() => {
        setState({
            templateContent: '',
            compiledContent: '',
            isRefiningMode: false,
            isReviewing: false,
            pendingContent: null,
            lastCompileContext: null,
            notes: '',
            temperature: 0.7,
            webResearch: false,
            detailedAnalysis: true,
            formalTone: true,
            pinnedSourceId: null,
            isLocked: false,
            currentMode: 'standard',
            messages: [],
            mentions: [],
            mentionRegistry: [],
            frozenColor: null,
            activeGuardrails: [],
            guardrailVault: {},
            standardSnapshot: null,
            masterSnapshots: {},
        });
    }, []);

    return (
        <CompilerContext.Provider value={{
            ...state,
            setTemplateContent,
            setCompiledContent,
            setIsRefiningMode,
            setIsReviewing,
            setPendingContent,
            setLastCompileContext,
            setNotes,
            setTemperature,
            setWebResearch,
            setDetailedAnalysis,
            setFormalTone,
            setPinnedSourceId,
            setIsLocked,
            setCurrentMode,
            setMessages,
            setMentions,
            setMentionRegistry,
            setFrozenColor,
            setGuardrailVault,
            toggleGuardrail,
            takeStandardSnapshot,
            restoreStandardSnapshot,
            takeMasterSnapshot,
            restoreMasterSnapshot,
            resetSession,
        }}>
            {children}
        </CompilerContext.Provider>
    );
}

export function useCompiler() {
    const context = useContext(CompilerContext);
    if (context === undefined) {
        throw new Error('useCompiler must be used within a CompilerProvider');
    }
    return context;
}

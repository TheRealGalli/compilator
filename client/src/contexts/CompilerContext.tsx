import React, { createContext, useContext, useState, useCallback } from 'react';

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
    isLocked: boolean; // For Master Pin "frozen" state
    currentMode: 'standard' | 'fillable';
    messages: any[];
    mentions: any[];
    frozenColor: string | null; // Stores the color of the master icon when locked
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
    setFrozenColor: (val: string | null) => void;
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
        frozenColor: null,
    });

    const setTemplateContent = (val: string) => setState(prev => ({ ...prev, templateContent: val }));
    const setCompiledContent = (val: string) => setState(prev => ({ ...prev, compiledContent: val }));
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

    const resetSession = useCallback(() => {
        const initialState: CompilerState = {
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
            frozenColor: null,
        };
        setState(initialState);
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
            setFrozenColor,
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

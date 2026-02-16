import React, { useRef, useEffect } from 'react';
import { X, Languages, ArrowRightLeft, Sparkles } from 'lucide-react';
import { TranscriptionItem, Language, TranslationMode } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface TranslationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptions: TranscriptionItem[];
  myLanguage: Language;
  setMyLanguage: (lang: Language) => void;
  partnerLanguage: Language;
  setPartnerLanguage: (lang: Language) => void;
  mode: TranslationMode;
  setMode: (mode: TranslationMode) => void;
}

export const TranslationSidebar: React.FC<TranslationSidebarProps> = ({
  isOpen,
  onClose,
  transcriptions,
  myLanguage,
  setMyLanguage,
  partnerLanguage,
  setPartnerLanguage,
  mode,
  setMode
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="w-[360px] bg-white text-[#202124] flex flex-col h-full shadow-xl rounded-l-2xl overflow-hidden transition-all animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600">
             <Languages size={20} />
          </div>
          <h2 className="text-lg font-google font-medium">Translation</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <X size={20} />
        </button>
      </div>

      {/* Settings Area */}
      <div className="p-4 bg-gray-50 space-y-4 border-b border-gray-200">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Simulated Partner Language</h3>
             <select 
                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={partnerLanguage.code}
                onChange={(e) => {
                    const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                    if (lang) setPartnerLanguage(lang);
                }}
             >
                 {SUPPORTED_LANGUAGES.map(lang => (
                     <option key={lang.code} value={lang.code}>{lang.name}</option>
                 ))}
             </select>
             <p className="text-xs text-gray-400 mt-2">The AI will speak and translate to this language.</p>
          </div>

          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mode</h3>
             <div className="flex gap-2">
                 <button 
                    onClick={() => setMode(TranslationMode.CONVERSATION)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${mode === TranslationMode.CONVERSATION ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                 >
                    Conversation
                 </button>
                 <button 
                    onClick={() => setMode(TranslationMode.TRANSLATOR)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${mode === TranslationMode.TRANSLATOR ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                 >
                    Translator
                 </button>
             </div>
          </div>
      </div>

      {/* Transcription Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white" ref={scrollRef}>
          {transcriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center space-y-2">
                  <ArrowRightLeft size={32} className="opacity-20" />
                  <p className="text-sm">Start speaking to see translations appear here.</p>
              </div>
          ) : (
              transcriptions.map((item) => (
                  <div key={item.id} className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`text-xs mb-1 px-1 ${item.sender === 'user' ? 'text-blue-600' : 'text-purple-600'}`}>
                          {item.sender === 'user' ? 'You' : (mode === TranslationMode.TRANSLATOR ? 'Translator' : 'Camilla (AI)')}
                      </div>
                      <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${
                          item.sender === 'user' 
                          ? 'bg-blue-50 text-gray-800 rounded-tr-none' 
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                      }`}>
                          {item.text}
                      </div>
                      <div className="text-[10px] text-gray-300 mt-1 px-1">
                          {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                      </div>
                  </div>
              ))
          )}
      </div>
      
      <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
        <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Sparkles size={12} /> Powered by Gemini
        </span>
      </div>
    </div>
  );
};
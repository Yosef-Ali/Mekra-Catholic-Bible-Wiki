import React, { useState, useEffect, useRef } from 'react';
import { booksApi, chaptersApi } from '../services/apiClient';
import { BibleBook } from '../types';
import {
  Save, RefreshCw, Eye, EyeOff, Wand2, Upload, Image,
  CheckCircle2, AlertCircle, Sparkles, FileText, Layers,
  ChevronDown, ChevronUp, X, Search, Zap, Copy, Check,
  MessageCircle, Send, Bot, User
} from 'lucide-react';

// Types
interface ProofreadSuggestion {
  original: string;
  suggested: string;
  reason: string;
  type: 'spelling' | 'grammar' | 'formatting' | 'verse';
}

interface BulkEditMatch {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  matchedText: string;
  lineNumber: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type EditMode = 'single' | 'bulk' | 'image';

export const AdminEditMode: React.FC = () => {
  // Core State
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [editMode, setEditMode] = useState<EditMode>('single');
  const [activeTab, setActiveTab] = useState<'editor' | 'ai' | 'bulk' | 'chat'>('editor');

  // AI Proofreading State
  const [isProofreading, setIsProofreading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProofreadSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());

  // Image OCR State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [ocrResult, setOcrResult] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk Edit State
  const [searchPattern, setSearchPattern] = useState('');
  const [replacePattern, setReplacePattern] = useState('');
  const [bulkMatches, setBulkMatches] = useState<BulkEditMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Chat sub-view: 'edit' | 'preview' | 'chat'
  const [chatSubView, setChatSubView] = useState<'edit' | 'preview' | 'chat'>('chat');


  // Fetch books on mount
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const fetchedBooks = await booksApi.getAll();
        setBooks(fetchedBooks);
        if (fetchedBooks.length > 0) {
          setSelectedBook(fetchedBooks[0]);
        }
      } catch (error) {
        console.error('Failed to load books:', error);
      }
    };
    fetchBooks();
  }, []);

  // Fetch chapter content when book or chapter changes
  useEffect(() => {
    if (!selectedBook) return;

    const fetchChapter = async () => {
      try {
        setLoading(true);
        setSuggestions([]);
        setAppliedSuggestions(new Set());
        const response = await chaptersApi.getContent(selectedBook.id, selectedChapter);
        let chapterContent = response.content;
        // Support JSON content
        if (typeof chapterContent !== 'string') {
             chapterContent = JSON.stringify(chapterContent, null, 2);
        }
        chapterContent = chapterContent || '';
        setContent(chapterContent);
        setOriginalContent(chapterContent);
      } catch (error) {
        console.error('Failed to load chapter:', error);
        setContent('');
        setOriginalContent('');
      } finally {
        setLoading(false);
      }
    };
    fetchChapter();
  }, [selectedBook, selectedChapter]);


  // AI Proofreading Handler
  const handleProofread = async () => {
    if (!content.trim()) return;

    setIsProofreading(true);
    setSuggestions([]);

    try {
      const response = await fetch('/api/ai/proofread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          bookName: selectedBook?.amharicName,
          chapter: selectedChapter
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } else {
        // Fallback: simple local proofreading
        const localSuggestions = performLocalProofreading(content);
        setSuggestions(localSuggestions);
      }
    } catch (error) {
      console.error('Proofreading failed:', error);
      // Use local proofreading as fallback
      const localSuggestions = performLocalProofreading(content);
      setSuggestions(localSuggestions);
    } finally {
      setIsProofreading(false);
    }
  };

  // Local proofreading for common Amharic Bible issues
  const performLocalProofreading = (text: string): ProofreadSuggestion[] => {
    const suggestions: ProofreadSuggestion[] = [];

    // Check for verse number formatting
    const verseIssues = text.match(/\d+\s*[።።]/g);
    if (verseIssues) {
      suggestions.push({
        original: 'Inconsistent verse punctuation',
        suggested: 'Use consistent format: [1] or 1.',
        reason: 'Verse numbers should be consistent throughout',
        type: 'verse'
      });
    }

    // Check for double spaces
    if (text.includes('  ')) {
      suggestions.push({
        original: 'Double spaces found',
        suggested: 'Single space',
        reason: 'Remove extra whitespace for cleaner text',
        type: 'formatting'
      });
    }

    // Check for common Amharic punctuation
    if (text.includes('::') && !text.includes('።')) {
      suggestions.push({
        original: ':: (double colon)',
        suggested: '። (Amharic period)',
        reason: 'Use proper Amharic punctuation',
        type: 'formatting'
      });
    }

    return suggestions;
  };

  // Apply a suggestion
  const applySuggestion = (index: number, suggestion: ProofreadSuggestion) => {
    if (suggestion.original && suggestion.suggested) {
      const newContent = content.replace(suggestion.original, suggestion.suggested);
      setContent(newContent);
    }
    setAppliedSuggestions(prev => new Set([...prev, index]));
  };


  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Process with AI OCR
    setIsProcessingImage(true);
    setOcrResult('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('bookName', selectedBook?.amharicName || '');
      formData.append('chapter', String(selectedChapter));

      const response = await fetch('/api/ai/ocr', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setOcrResult(data.text || '');
      }
    } catch (error) {
      console.error('OCR failed:', error);
      setOcrResult('❌ Failed to extract text. Please try again.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Apply OCR result to editor
  const applyOcrResult = () => {
    if (ocrResult && !ocrResult.startsWith('❌')) {
      setContent(ocrResult);
    }
  };

  // Bulk Search Handler
  const handleBulkSearch = async () => {
    if (!searchPattern.trim()) return;

    setIsSearching(true);
    setBulkMatches([]);
    setSelectedMatches(new Set());

    try {
      const response = await fetch('/api/chapters/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: searchPattern })
      });

      if (response.ok) {
        const data = await response.json();
        setBulkMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Bulk search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Apply Bulk Replace
  const handleBulkReplace = async () => {
    if (selectedMatches.size === 0) return;

    const confirmed = confirm(
      `Apply replacement to ${selectedMatches.size} location(s)?\n\n` +
      `Replace: "${searchPattern}"\n` +
      `With: "${replacePattern}"`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      const matchesToUpdate = bulkMatches.filter(m =>
        selectedMatches.has(`${m.bookId}-${m.chapterNumber}`)
      );

      for (const match of matchesToUpdate) {
        const response = await chaptersApi.getContent(match.bookId, match.chapterNumber);
        const updatedContent = response.content?.replace(
          new RegExp(searchPattern, 'g'),
          replacePattern
        );
        if (updatedContent) {
          await chaptersApi.updateContent(match.bookId, match.chapterNumber, updatedContent);
        }
      }

      alert(`✅ Successfully updated ${matchesToUpdate.length} chapter(s)!`);
      setBulkMatches([]);
      setSelectedMatches(new Set());
    } catch (error) {
      console.error('Bulk replace failed:', error);
      alert('❌ Bulk replace failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };


  // Save Handler
  const handleSave = async () => {
    if (!selectedBook) return;

    try {
      setSaving(true);

      let contentToSave: any = content;
      try {
          // Try to parse as JSON if it looks like it
          if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
              contentToSave = JSON.parse(content);
          }
      } catch (e) {
          console.log('Using raw string content (not JSON)');
      }

      await chaptersApi.updateContent(selectedBook.id, selectedChapter, contentToSave);
      setOriginalContent(content);
      alert('✅ Chapter saved successfully!');
    } catch (error) {
      console.error('Failed to save chapter:', error);
      alert('❌ Failed to save chapter. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Chat Handler
  const handleSendChat = async () => {
    if (!chatInput.trim() || isSendingChat) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsSendingChat(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          content: content,
          bookName: selectedBook?.amharicName,
          chapter: selectedChapter,
          history: chatMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message || 'Sorry, I could not process your request.'
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: '❌ Failed to get response. Please try again.'
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Connection error. Please try again.'
      }]);
    } finally {
      setIsSendingChat(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // Apply AI suggestion from chat to content
  const applyFromChat = (text: string) => {
    setContent(text);
    setActiveTab('editor');
  };

  // Reset Handler
  const handleReset = () => {
    if (confirm('Reset to original content?')) {
      setContent(originalContent);
      setSuggestions([]);
      setAppliedSuggestions(new Set());
    }
  };

  // Toggle Match Selection
  const toggleMatchSelection = (matchKey: string) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchKey)) {
        newSet.delete(matchKey);
      } else {
        newSet.add(matchKey);
      }
      return newSet;
    });
  };

  // Select/Deselect All Matches
  const toggleAllMatches = () => {
    if (selectedMatches.size === bulkMatches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(bulkMatches.map(m => `${m.bookId}-${m.chapterNumber}`)));
    }
  };

  const hasChanges = content !== originalContent;

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-parchment via-parchment-dark to-parchment text-ink">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />


      {/* Header */}
      <div className="border-b border-oxblood/20 bg-parchment-dark backdrop-blur-sm px-4 md:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto">
          {/* Title & Mode Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <FileText className="text-ochre" size={24} />
              <span className="bg-gradient-to-r from-ochre to-ochre-light bg-clip-text text-transparent">
                Admin Edit Mode
              </span>
            </h1>

            {/* Mode Tabs */}
            <div className="flex bg-parchment-dark rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'editor'
                    ? 'bg-oxblood text-parchment'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <FileText size={16} />
                <span className="hidden sm:inline">Editor</span>
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'ai'
                    ? 'bg-oxblood text-parchment'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Sparkles size={16} />
                <span className="hidden sm:inline">AI Tools</span>
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'bulk'
                    ? 'bg-oxblood text-parchment'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Layers size={16} />
                <span className="hidden sm:inline">Bulk Edit</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'chat'
                    ? 'bg-oxblood text-parchment'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <MessageCircle size={16} />
                <span className="hidden sm:inline">AI Chat</span>
              </button>
            </div>
          </div>


          {/* Controls Row */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Book Selector */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-semibold uppercase mb-1.5 block text-ochre/80">መጽሐፍ Book</label>
              <select
                value={selectedBook?.id || ''}
                onChange={(e) => {
                  const book = books.find(b => b.id === parseInt(e.target.value));
                  setSelectedBook(book || null);
                  setSelectedChapter(1);
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-parchment-dark border border-rule text-ink focus:border-oxblood focus:ring-1 focus:ring-oxblood/50 transition-all"
              >
                {books.map(book => (
                  <option key={book.id} value={book.id}>
                    {book.amharicName} ({book.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter Selector */}
            <div className="w-24">
              <label className="text-xs font-semibold uppercase mb-1.5 block text-ochre/80">ምዕራፍ</label>
              <input
                type="number"
                min={1}
                max={selectedBook?.chapters || 1}
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 rounded-lg bg-parchment-dark border border-rule text-ink focus:border-oxblood focus:ring-1 focus:ring-oxblood/50 transition-all text-center font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 items-center ml-auto">
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className={`p-2.5 rounded-lg transition-all ${
                  hasChanges
                    ? 'bg-rule hover:bg-rule/40 text-ink-soft'
                    : 'bg-parchment-dark text-ink-soft cursor-not-allowed'
                }`}
                title="Reset"
              >
                <RefreshCw size={18} />
              </button>

              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2.5 rounded-lg transition-all ${
                  showPreview
                    ? 'bg-oxblood/20 text-ochre'
                    : 'bg-rule text-ink-soft hover:bg-rule/40'
                }`}
                title={showPreview ? 'Hide Preview' : 'Show Preview'}
              >
                {showPreview ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>

              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                  hasChanges
                    ? 'bg-oxblood text-parchment hover:bg-oxblood-light shadow-sm'
                    : 'bg-rule text-ink-mid cursor-not-allowed'
                }`}
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-oxblood border-t-transparent mx-auto mb-4"></div>
                <p className="text-ink-soft">Loading chapter...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Editor Tab */}
              {activeTab === 'editor' && (
                <div className={`grid gap-4 h-full ${showPreview ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Editor Panel */}
                  <div className="flex flex-col h-full min-h-[400px]">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold uppercase text-ochre/80">✏️ Editor</h2>
                      <span className="text-xs text-ink-mid">
                        {content.length} chars {hasChanges && '• ⚠️ Unsaved'}
                      </span>
                    </div>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="flex-1 w-full p-4 rounded-xl bg-parchment-dark/50 border border-rule text-ink font-serif text-lg resize-none focus:border-oxblood focus:ring-1 focus:ring-oxblood/30 transition-all leading-relaxed"
                      placeholder="Chapter content..."
                      dir="auto"
                      lang="am"
                    />
                  </div>

                  {/* Preview Panel */}
                  {showPreview && (
                    <div className="flex flex-col h-full min-h-[400px]">
                      <h2 className="text-sm font-semibold uppercase text-ochre/80 mb-2">👁️ Preview</h2>
                      <div className="flex-1 overflow-auto p-6 rounded-xl bg-ochre/5 border border-oxblood/20">
                        <div
                          className="font-serif text-lg leading-loose text-ink whitespace-pre-wrap"
                          dir="auto"
                          lang="am"
                          style={{ fontFamily: '"Noto Serif Ethiopic", serif' }}
                        >
                          {content || <span className="text-ink-mid italic">No content</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* AI Tools Tab */}
              {activeTab === 'ai' && (
                <div className="grid md:grid-cols-2 gap-6 h-full">
                  {/* AI Proofreading Panel */}
                  <div className="bg-parchment-dark/50 rounded-2xl border border-rule p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-ochre flex items-center gap-2">
                        <Wand2 size={18} />
                        AI Proofreading
                      </h3>
                      <button
                        onClick={handleProofread}
                        disabled={isProofreading || !content.trim()}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                          isProofreading || !content.trim()
                            ? 'bg-rule text-ink-mid cursor-not-allowed'
                            : 'bg-oxblood text-parchment hover:bg-oxblood-light'
                        }`}
                      >
                        {isProofreading ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-parchment border-t-transparent rounded-full" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            Proofread
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-3">
                      {suggestions.length === 0 ? (
                        <div className="text-center py-12 text-ink-mid">
                          <Wand2 size={40} className="mx-auto mb-3 opacity-50" />
                          <p>Click "Proofread" to analyze the content</p>
                        </div>
                      ) : (
                        suggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border transition-all ${
                              appliedSuggestions.has(idx)
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-rule/50 border-rule hover:border-oxblood/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded font-mono ${
                                  suggestion.type === 'spelling' ? 'bg-oxblood/15 text-oxblood' :
                                  suggestion.type === 'grammar' ? 'bg-ochre/15 text-ochre' :
                                  suggestion.type === 'verse' ? 'bg-ochre/10 text-ochre' :
                                  'bg-ink-soft/10 text-ink-soft'
                                }`}>
                                  {suggestion.type}
                                </span>
                                <p className="text-ink-soft mt-2">{suggestion.reason}</p>
                                <div className="mt-2 text-sm">
                                  <span className="text-red-400 line-through">{suggestion.original}</span>
                                  <span className="mx-2">→</span>
                                  <span className="text-green-400">{suggestion.suggested}</span>
                                </div>
                              </div>
                              {!appliedSuggestions.has(idx) && (
                                <button
                                  onClick={() => applySuggestion(idx, suggestion)}
                                  className="p-2 bg-oxblood text-parchment rounded-lg hover:bg-oxblood transition-colors"
                                  title="Apply"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                              {appliedSuggestions.has(idx) && (
                                <CheckCircle2 className="text-green-500" size={24} />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>


                  {/* Image OCR Panel */}
                  <div className="bg-parchment-dark/50 rounded-2xl border border-rule p-5 flex flex-col">
                    <h3 className="font-bold text-ochre flex items-center gap-2 mb-4">
                      <Image size={18} />
                      Image to Text (OCR)
                    </h3>

                    {/* Upload Area */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-rule rounded-xl p-6 text-center cursor-pointer hover:border-oxblood/50 hover:bg-rule/30 transition-all mb-4"
                    >
                      {uploadedImage ? (
                        <div className="relative">
                          <img
                            src={uploadedImage}
                            alt="Uploaded"
                            className="max-h-48 mx-auto rounded-lg"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedImage(null);
                              setOcrResult('');
                            }}
                            className="absolute top-2 right-2 p-1 bg-oxblood rounded-full text-parchment hover:bg-oxblood-light"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload size={40} className="mx-auto mb-3 text-ink-mid" />
                          <p className="text-ink-soft">Click or drag PDF page image</p>
                          <p className="text-xs text-ink-soft mt-1">PNG, JPG up to 10MB</p>
                        </>
                      )}
                    </div>

                    {/* OCR Result */}
                    {isProcessingImage && (
                      <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-2 border-oxblood border-t-transparent rounded-full mx-auto mb-3" />
                        <p className="text-ink-soft">AI is reading the image...</p>
                      </div>
                    )}

                    {ocrResult && !isProcessingImage && (
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-ink-soft">Extracted Text:</span>
                          <button
                            onClick={applyOcrResult}
                            disabled={ocrResult.startsWith('❌')}
                            className="px-3 py-1.5 bg-oxblood text-parchment rounded-lg text-sm font-semibold hover:bg-oxblood transition-colors flex items-center gap-1"
                          >
                            <Copy size={14} />
                            Apply to Editor
                          </button>
                        </div>
                        <div className="flex-1 p-4 bg-parchment-dark/50 rounded-xl border border-rule overflow-auto max-h-48">
                          <pre className="text-sm text-ink-soft whitespace-pre-wrap font-serif" dir="auto">
                            {ocrResult}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Bulk Edit Tab */}
              {activeTab === 'bulk' && (
                <div className="h-full flex flex-col">
                  {/* Search Controls */}
                  <div className="bg-parchment-dark/50 rounded-2xl border border-rule p-5 mb-4">
                    <h3 className="font-bold text-ochre flex items-center gap-2 mb-4">
                      <Layers size={18} />
                      Bulk Find & Replace
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block text-ink-soft">Find Pattern</label>
                        <input
                          type="text"
                          value={searchPattern}
                          onChange={(e) => setSearchPattern(e.target.value)}
                          placeholder="e.g., :: or [subtitle]"
                          className="w-full px-4 py-2.5 rounded-lg bg-parchment-dark border border-rule text-ink focus:border-oxblood transition-all"
                          dir="auto"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block text-ink-soft">Replace With</label>
                        <input
                          type="text"
                          value={replacePattern}
                          onChange={(e) => setReplacePattern(e.target.value)}
                          placeholder="e.g., ። or **subtitle**"
                          className="w-full px-4 py-2.5 rounded-lg bg-parchment-dark border border-rule text-ink focus:border-oxblood transition-all"
                          dir="auto"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleBulkSearch}
                        disabled={isSearching || !searchPattern.trim()}
                        className={`px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                          isSearching || !searchPattern.trim()
                            ? 'bg-rule text-ink-mid cursor-not-allowed'
                            : 'bg-ochre text-parchment hover:bg-ochre-light'
                        }`}
                      >
                        {isSearching ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-parchment border-t-transparent rounded-full" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search size={16} />
                            Search All Chapters
                          </>
                        )}
                      </button>

                      {bulkMatches.length > 0 && (
                        <button
                          onClick={handleBulkReplace}
                          disabled={selectedMatches.size === 0 || saving}
                          className={`px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                            selectedMatches.size === 0 || saving
                              ? 'bg-rule text-ink-mid cursor-not-allowed'
                              : 'bg-oxblood text-parchment hover:bg-oxblood-light'
                          }`}
                        >
                          <Zap size={16} />
                          Replace Selected ({selectedMatches.size})
                        </button>
                      )}
                    </div>
                  </div>


                  {/* Search Results */}
                  <div className="flex-1 bg-parchment-dark/50 rounded-2xl border border-rule p-5 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-ink-soft">
                        {bulkMatches.length > 0
                          ? `Found ${bulkMatches.length} matches`
                          : 'Search results will appear here'
                        }
                      </h4>
                      {bulkMatches.length > 0 && (
                        <button
                          onClick={toggleAllMatches}
                          className="text-sm text-ochre hover:text-ochre"
                        >
                          {selectedMatches.size === bulkMatches.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-auto space-y-2">
                      {bulkMatches.length === 0 ? (
                        <div className="text-center py-12 text-ink-mid">
                          <Search size={40} className="mx-auto mb-3 opacity-50" />
                          <p>Enter a search pattern to find matches across all chapters</p>
                        </div>
                      ) : (
                        bulkMatches.map((match, idx) => {
                          const matchKey = `${match.bookId}-${match.chapterNumber}`;
                          const isSelected = selectedMatches.has(matchKey);

                          return (
                            <div
                              key={idx}
                              onClick={() => toggleMatchSelection(matchKey)}
                              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-oxblood/10 border-oxblood/50'
                                  : 'bg-rule/30 border-rule hover:border-ink-soft'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-oxblood border-oxblood'
                                    : 'border-ink-soft'
                                }`}>
                                  {isSelected && <Check size={14} className="text-ink" />}
                                </div>
                                <div className="flex-1">
                                  <span className="font-semibold text-ink">
                                    {match.bookName} - Chapter {match.chapterNumber}
                                  </span>
                                  <p className="text-sm text-ink-soft mt-1 font-mono">
                                    Line {match.lineNumber}: "...{match.matchedText.slice(0, 50)}..."
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Tab - With Sub-tabs for Edit/Preview/Chat */}
              {activeTab === 'chat' && (
                <div className="h-full flex flex-col">
                  {/* Sub-tabs */}
                  <div className="flex bg-parchment-dark rounded-xl p-1 mb-4 gap-1">
                    <button
                      onClick={() => setChatSubView('edit')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        chatSubView === 'edit'
                          ? 'bg-oxblood text-parchment'
                          : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      <FileText size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => setChatSubView('preview')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        chatSubView === 'preview'
                          ? 'bg-oxblood text-parchment'
                          : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      <Eye size={16} />
                      Preview
                    </button>
                    <button
                      onClick={() => setChatSubView('chat')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        chatSubView === 'chat'
                          ? 'bg-ochre text-parchment'
                          : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      <Bot size={16} />
                      AI Chat
                    </button>
                  </div>

                  {/* Edit Sub-view */}
                  {chatSubView === 'edit' && (
                    <div className="flex-1 flex flex-col bg-parchment-dark/50 rounded-xl border border-rule overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-rule bg-parchment-dark/80">
                        <span className="font-semibold text-ochre">✏️ Editor</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-ink-mid">{content.length} chars</span>
                          <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                              hasChanges
                                ? 'bg-oxblood text-parchment hover:bg-oxblood'
                                : 'bg-rule text-ink-mid'
                            }`}
                          >
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="flex-1 w-full p-4 bg-transparent text-ink font-serif text-lg resize-none focus:outline-none leading-relaxed"
                        placeholder="Chapter content..."
                        dir="auto"
                        lang="am"
                        style={{ fontFamily: '"Noto Serif Ethiopic", serif' }}
                      />
                    </div>
                  )}

                  {/* Preview Sub-view */}
                  {chatSubView === 'preview' && (
                    <div className="flex-1 flex flex-col bg-ochre/5 rounded-xl border border-oxblood/20 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-oxblood/20 bg-parchment-dark/50">
                        <span className="font-semibold text-ochre">👁️ Preview</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-ink-mid">
                            {content.length} chars • {selectedBook?.amharicName} • Ch. {selectedChapter}
                          </span>
                          <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                              hasChanges
                                ? 'bg-oxblood text-parchment hover:bg-oxblood'
                                : 'bg-rule text-ink-mid'
                            }`}
                          >
                            <Save size={14} />
                            {saving ? '...' : 'Save'}
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-6">
                        <div
                          className="font-serif text-xl leading-loose text-ink"
                          dir="auto"
                          lang="am"
                          style={{
                            fontFamily: '"Noto Serif Ethiopic", serif',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {content || <span className="text-ink-mid italic">No content to preview</span>}
                        </div>

                        {/* Warning if content seems truncated */}
                        {content.endsWith('...') && (
                          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <p className="text-yellow-400 text-sm flex items-center gap-2">
                              <AlertCircle size={16} />
                              Content appears to be truncated. Use AI Chat or Image OCR to extract full content.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chat Sub-view */}
                  {chatSubView === 'chat' && (
                    <div className="flex-1 flex flex-col bg-parchment-dark/30 rounded-xl border border-rule overflow-hidden">
                      {/* Chat Header */}
                      <div className="bg-ochre/10 border-b border-rule px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-ochre flex items-center justify-center">
                            <Bot size={20} className="text-parchment" />
                          </div>
                          <div>
                            <h3 className="font-bold text-ink">Gemini AI Assistant</h3>
                            <p className="text-xs text-ink-soft">
                              {selectedBook?.amharicName} • Chapter {selectedChapter}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 overflow-auto p-4 space-y-4">
                        {chatMessages.length === 0 ? (
                          <div className="text-center py-12">
                            <Bot size={48} className="mx-auto mb-4 text-ink-soft" />
                            <p className="text-ink-soft mb-4">Ask AI to help you edit</p>
                            <div className="flex flex-wrap justify-center gap-2">
                              {[
                                'Proofread this chapter',
                                'Fix verse numbering',
                                'Check punctuation',
                                'Format as poetry'
                              ].map((suggestion, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setChatInput(suggestion)}
                                  className="px-4 py-2 bg-rule hover:bg-rule/40 rounded-full text-sm text-ink-soft transition-colors"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-ochre flex items-center justify-center flex-shrink-0">
                                  <Bot size={16} className="text-parchment" />
                                </div>
                              )}
                              <div
                                className={`max-w-[80%] p-4 rounded-2xl ${
                                  msg.role === 'user'
                                    ? 'bg-oxblood text-parchment'
                                    : 'bg-rule text-ink'
                                }`}
                              >
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {msg.content}
                                </div>
                                {msg.role === 'assistant' && msg.content.includes('```') && (
                                  <button
                                    onClick={() => {
                                      const codeMatch = msg.content.match(/```[\s\S]*?\n([\s\S]*?)```/);
                                      if (codeMatch) {
                                        setContent(codeMatch[1].trim());
                                        setChatSubView('preview');
                                      }
                                    }}
                                    className="mt-3 px-4 py-2 bg-oxblood text-parchment rounded-lg text-sm font-semibold hover:bg-oxblood transition-colors flex items-center gap-2"
                                  >
                                    <Check size={14} />
                                    Apply to Editor
                                  </button>
                                )}
                              </div>
                              {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-oxblood flex items-center justify-center flex-shrink-0">
                                  <User size={16} className="text-ink" />
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        {isSendingChat && (
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-ochre flex items-center justify-center">
                              <Bot size={16} className="text-parchment" />
                            </div>
                            <div className="bg-rule p-4 rounded-2xl">
                              <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-ink-soft rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-ink-soft rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-ink-soft rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat Input */}
                      <div className="border-t border-rule p-4 bg-parchment-dark/50">
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                            placeholder="Ask AI to help edit, proofread, or format..."
                            className="flex-1 px-4 py-3 rounded-xl bg-rule border border-rule text-ink placeholder-ink-soft focus:border-ochre text-sm"
                          />
                          <button
                            onClick={handleSendChat}
                            disabled={!chatInput.trim() || isSendingChat}
                            className={`px-5 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                              chatInput.trim() && !isSendingChat
                                ? 'bg-ochre text-parchment hover:bg-ochre-light'
                                : 'bg-rule text-ink-mid'
                            }`}
                          >
                            <Send size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

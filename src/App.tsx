import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  MessageSquare,
  Code2,
  BookOpen,
  Sparkles,
  Sliders,
  Terminal,
  Layers,
  Smile,
  ShieldAlert,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { INITIAL_COMMENTS, CommentItem } from './data/comments';
import { CameraView } from './components/CameraView';
import { CommentDeck } from './components/CommentDeck';
import { PythonCodeViewer } from './components/PythonCodeViewer';
import { soundEffects } from './services/soundEffects';
import { ttsService } from './services/ttsService';

/**
 * Filters out emojis, symbols, and pictographs from comment text so only
 * clean English text is passed to the text-to-speech engine.
 */
const filterEmojis = (text: string): string => {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'camera' | 'deck' | 'python' | 'guide'>('camera');
  const [comments, setComments] = useState<CommentItem[]>(INITIAL_COMMENTS);
  const [activeComment, setActiveComment] = useState<string>(INITIAL_COMMENTS[0].text);
  const [activeCategory, setActiveCategory] = useState<string>(INITIAL_COMMENTS[0].category);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showGlow, setShowGlow] = useState<boolean>(true);

  // Auto-rotation timer (cycles comment every 2.8 seconds when not paused)
  const cycleComment = useCallback(
    (reason: 'SWAG' | 'SHOCK' | 'SMILE' = 'SWAG') => {
      let pool = comments;
      if (reason === 'SHOCK') {
        pool = comments.filter((c) => c.type === 'shock');
      } else if (reason === 'SMILE') {
        pool = comments.filter((c) => c.type === 'smile');
      } else {
        pool = comments.filter((c) => c.type === 'general');
      }

      if (pool.length === 0) pool = comments;

      // Pick random avoiding immediate repeat
      const available = pool.filter((c) => c.text !== activeComment);
      const next = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : pool[Math.floor(Math.random() * pool.length)];

      if (!next) return;

      setActiveComment(next.text);
      setActiveCategory(next.category);
      soundEffects.playCommentChime();

      // Filter out emojis from the string passed to the text-to-speech engine,
      // ensuring it only reads the English text aloud
      const spokenText = filterEmojis(next.text);
      if (spokenText) {
        ttsService.speak(spokenText);
      }
    },
    [comments, activeComment]
  );

  // Periodic timer
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      cycleComment('SWAG');
    }, 2800);
    return () => clearInterval(interval);
  }, [isPaused, cycleComment]);

  // Global Keyboard shortcuts (Q/ESC, SPACE, C, S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        cycleComment('SWAG');
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleComment]);

  const handleSelectComment = (item: CommentItem) => {
    setActiveComment(item.text);
    setActiveCategory(item.category);
    const spokenText = filterEmojis(item.text);
    if (spokenText) {
      ttsService.speak(spokenText);
    }
  };

  const handleAddComment = (newComment: CommentItem) => {
    setComments((prev) => [newComment, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Cyber Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-cyan-500/20 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-wider font-orbitron bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                AI FUNNY FACE COMMENTATOR
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                v1.0 AR FILTER
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Multi-Face Tracking &bull; Button-Controlled Sessions &bull; Max 5 Jokes/Face &bull; Offline pyttsx3 Voice
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono-code font-bold transition cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>AR Camera</span>
          </button>

          <button
            onClick={() => setActiveTab('deck')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono-code font-bold transition cursor-pointer ${
              activeTab === 'deck'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Jokes Deck</span>
            <span className="sm:hidden">Jokes</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-cyan-300">
              {comments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono-code font-bold transition cursor-pointer ${
              activeTab === 'python'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Python Code</span>
            <span className="sm:hidden">Python</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono-code font-bold transition cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Windows Setup</span>
            <span className="sm:hidden">Guide</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        {/* TAB 1: LIVE AR CAMERA */}
        {activeTab === 'camera' && (
          <div className="flex flex-col gap-6">
            <CameraView
              comments={comments}
              activeComment={activeComment}
              activeCategory={activeCategory}
              onNextComment={cycleComment}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused((prev) => !prev)}
              showLandmarks={showLandmarks}
              showGlow={showGlow}
            />

            {/* Quick Feature Chips & Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Neon Glow Contour</div>
                    <div className="text-[11px] text-slate-400">Multi-layer pulsing facial aura</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowGlow((prev) => !prev)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono-code transition cursor-pointer ${
                    showGlow ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {showGlow ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Constellation Nodes</div>
                    <div className="text-[11px] text-slate-400">Cyber landmark points on face</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowLandmarks((prev) => !prev)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono-code transition cursor-pointer ${
                    showLandmarks ? 'bg-purple-500 text-white font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {showLandmarks ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Facial Reactions</div>
                    <div className="text-[11px] text-slate-400">Mouth open &amp; smile detection</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono-code bg-emerald-500/20 text-emerald-300 font-bold">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: JOKES DECK */}
        {activeTab === 'deck' && (
          <CommentDeck
            comments={comments}
            activeComment={activeComment}
            onSelectComment={handleSelectComment}
            onAddComment={handleAddComment}
          />
        )}

        {/* TAB 3: PYTHON CODE VIEWER */}
        {activeTab === 'python' && <PythonCodeViewer />}

        {/* TAB 4: WINDOWS SETUP GUIDE */}
        {activeTab === 'guide' && (
          <div className="w-full flex flex-col gap-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-cyan-500/30 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <Terminal className="w-6 h-6 text-cyan-400" />
                <h2 className="text-lg font-bold font-orbitron text-cyan-300">
                  WINDOWS CMD &amp; VIRTUAL ENVIRONMENT SETUP
                </h2>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                The complete Python application is created in the directory <code className="text-cyan-400 bg-slate-950 px-2 py-0.5 rounded font-mono-code">AI-Funny-Face/</code> with independent modules (<code className="text-purple-300">main.py</code>, <code className="text-purple-300">face_tracker.py</code>, <code className="text-purple-300">comment_engine.py</code>, <code className="text-purple-300">effects.py</code>). Follow these exact steps to run it on your Windows laptop:
              </p>

              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold font-mono-code text-cyan-400">
                  <span>STEP 1: OPEN WINDOWS COMMAND PROMPT &amp; NAVIGATE</span>
                </div>
                <div className="p-3 rounded-xl bg-black font-mono-code text-xs text-emerald-400 select-all">
                  cd AI-Funny-Face
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold font-mono-code text-cyan-400">
                  <span>STEP 2: CREATE PYTHON 3.12 VIRTUAL ENVIRONMENT</span>
                </div>
                <div className="p-3 rounded-xl bg-black font-mono-code text-xs text-emerald-400 select-all">
                  python -m venv .venv
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold font-mono-code text-cyan-400">
                  <span>STEP 3: ACTIVATE THE VIRTUAL ENVIRONMENT</span>
                </div>
                <div className="p-3 rounded-xl bg-black font-mono-code text-xs text-emerald-400 select-all">
                  .venv\Scripts\activate
                </div>
                <p className="text-[11px] text-slate-500">
                  (On PowerShell, use: <code className="text-slate-400">.\.venv\Scripts\Activate.ps1</code>)
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold font-mono-code text-cyan-400">
                  <span>STEP 4: INSTALL DEPENDENCIES</span>
                </div>
                <div className="p-3 rounded-xl bg-black font-mono-code text-xs text-emerald-400 select-all">
                  pip install -r requirements.txt
                </div>
                <p className="text-[11px] text-slate-500">
                  Installs OpenCV (opencv-python), MediaPipe 0.10.21, and NumPy.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold font-mono-code text-cyan-400">
                  <span>STEP 5: RUN THE APPLICATION</span>
                </div>
                <div className="p-3 rounded-xl bg-black font-mono-code text-xs text-emerald-400 select-all">
                  python main.py
                </div>
                <p className="text-[11px] text-slate-400">
                  Your physical webcam will turn on with full face tracking, glowing outlines, and floating comments!
                </p>
              </div>

              {/* Troubleshooting Card */}
              <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono-code">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>WEBCAM PERMISSIONS &amp; TROUBLESHOOTING</span>
                </div>
                <ul className="text-xs text-amber-200/90 list-disc list-inside space-y-1">
                  <li>
                    <strong>Camera busy:</strong> Close Zoom, MS Teams, Discord, or web browsers if they are holding your webcam lock.
                  </li>
                  <li>
                    <strong>Privacy settings:</strong> In Windows 11/10 Settings &rarr; Privacy &amp; Security &rarr; Camera, toggle &ldquo;Let apps access your camera&rdquo; to ON.
                  </li>
                  <li>
                    <strong>Release cleanly:</strong> Press <code>[Q]</code> or <code>[ESC]</code> inside the camera window to cleanly release the webcam device.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono-code">
        <div>AI Funny Face Commentator &bull; Python 3.12 + OpenCV + MediaPipe 0.10.x + Offline pyttsx3 TTS</div>
        <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-slate-400">
          <span>[Q/ESC] Quit</span>
          <span>[SPACE] Pause</span>
          <span>[C] Next Joke</span>
          <span>[M] Mute Voice</span>
          <span>[V] Repeat Voice</span>
          <span>[S] Snap</span>
        </div>
      </footer>
    </div>
  );
}

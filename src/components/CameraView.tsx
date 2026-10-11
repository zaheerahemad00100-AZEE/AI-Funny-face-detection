import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Download,
  Sparkles,
  Smile,
  AlertCircle,
  RotateCcw,
  PlayCircle,
  StopCircle,
  Users,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CommentItem } from '../data/comments';
import { soundEffects } from '../services/soundEffects';
import { ttsService } from '../services/ttsService';

interface CameraViewProps {
  comments: CommentItem[];
  activeComment: string;
  activeCategory: string;
  onNextComment: (reason?: 'SWAG' | 'SHOCK' | 'SMILE') => void;
  isPaused: boolean;
  onTogglePause: () => void;
  showLandmarks: boolean;
  showGlow: boolean;
}

interface TrackedFace {
  id: string;
  bbox: [number, number, number, number];
  center: [number, number];
  ovalPoints: [number, number][];
  cyberPoints: [number, number][];
  reaction: 'neutral' | 'shock' | 'smile';
  comment: string;
  category: string;
  isMaxReached: boolean;
}

interface FaceCommentRecord {
  commentsSeen: string[];
  currentComment: string;
  currentCategory: string;
  lastUpdateTime: number;
  isMaxReached: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  comments,
  activeComment,
  activeCategory,
  onNextComment,
  isPaused,
  onTogglePause,
  showLandmarks,
  showGlow,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // SESSION STATE: Default is INACTIVE until Start Session is clicked!
  const [sessionActive, setSessionActive] = useState<boolean>(false);

  // Camera & Mode state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [numFacesTracked, setNumFacesTracked] = useState<number>(0);
  const [snapshotToast, setSnapshotToast] = useState<boolean>(false);

  // Multi-face comment memory (Max 4-5 comments per face)
  const faceRecordsRef = useRef<{ [faceId: string]: FaceCommentRecord }>({});

  // Expression simulator states (for demo/testing or when no webcam)
  const [simMouthOpen, setSimMouthOpen] = useState<boolean>(false);
  const [simSmiling, setSimSmiling] = useState<boolean>(false);
  const [simHeadPos, setSimHeadPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.45 });
  const [detectedReaction, setDetectedReaction] = useState<'neutral' | 'shock' | 'smile'>('neutral');

  // Refs for animation loops & cooldowns
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const reactionCooldownRef = useRef<number>(0);

  // MediaPipe FaceLandmarker ref (up to 4 faces)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceLandmarkerRef = useRef<any>(null);
  const isMpLoadingRef = useRef<boolean>(false);

  // Initialize MediaPipe Vision Tasks with max 4 faces
  useEffect(() => {
    let isMounted = true;
    async function initMediaPipe() {
      if (faceLandmarkerRef.current || isMpLoadingRef.current) return;
      isMpLoadingRef.current = true;
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 4, // Multi-face tracking up to 4 faces
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
        });
        if (isMounted) {
          faceLandmarkerRef.current = landmarker;
        }
      } catch (err) {
        console.warn('MediaPipe initialization fallback to simulation mode:', err);
      } finally {
        isMpLoadingRef.current = false;
      }
    }

    initMediaPipe();
    return () => {
      isMounted = false;
      if (faceLandmarkerRef.current?.close) {
        try {
          faceLandmarkerRef.current.close();
        } catch {}
      }
    };
  }, []);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          setCameraActive(true);
          setIsSimulatorMode(false);
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Camera permission denied or camera unavailable.';
      setCameraError(errorMsg);
      setCameraActive(false);
      setIsSimulatorMode(true);
    }
  }, []);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Auto-start camera preview on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // -------------------------------------------------------------
  // START & END SESSION LOGIC
  // -------------------------------------------------------------
  const handleStartSession = useCallback(() => {
    setSessionActive(true);
    ttsService.setSessionActive(true);
    faceRecordsRef.current = {};
    soundEffects.playCommentChime();
    console.log('[CameraView] Session Started: Face tracking and commentary active.');
  }, []);

  const handleEndSession = useCallback(() => {
    setSessionActive(false);
    ttsService.setSessionActive(false);
    setNumFacesTracked(0);
    faceRecordsRef.current = {};
    console.log('[CameraView] Session Ended: Face tracking stopped and pending voice cleared.');
  }, []);

  // Audio FX Mute toggle
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEffects.setMuted(next);
  };

  // Voice TTS Mute toggle (hotkey 'M')
  const toggleVoiceMute = useCallback(() => {
    setIsVoiceMuted((prev) => {
      const next = !prev;
      ttsService.setMuted(next);
      return next;
    });
  }, []);

  // Repeat current voice comment (hotkey 'V')
  const repeatVoiceComment = useCallback(() => {
    if (sessionActive) {
      ttsService.repeat(activeComment);
    }
  }, [sessionActive, activeComment]);

  // Keyboard shortcut listeners (ENTER=Start, E=End, M=Mute, V=Repeat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!sessionActive) handleStartSession();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (sessionActive) handleEndSession();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleVoiceMute();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        repeatVoiceComment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionActive, handleStartSession, handleEndSession, toggleVoiceMute, repeatVoiceComment]);

  // Take Snapshot with watermark
  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    soundEffects.playShutterSound();
    setSnapshotToast(true);
    setTimeout(() => setSnapshotToast(false), 2000);

    const imageUri = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `AI_Funny_Face_Snap_${Date.now()}.png`;
    link.href = imageUri;
    link.click();
  };

  // Helper: Pick a unique comment for a specific face (Max 4-5 per appearance)
  const getOrUpdateFaceComment = useCallback(
    (faceId: string, reaction: 'neutral' | 'shock' | 'smile', timeNow: number) => {
      const records = faceRecordsRef.current;
      const MAX_COMMENTS = 5;

      // 1. Newly detected face
      if (!records[faceId]) {
        // Collect comments currently assigned to other active faces
        const activeAssigned = new Set(
          Object.entries(records)
            .filter(([fid]) => fid !== faceId)
            .map(([, rec]) => rec.currentComment)
        );

        const available = comments.filter((c) => !activeAssigned.has(c.text));
        const picked = available.length > 0
          ? available[Math.floor(Math.random() * available.length)]
          : comments[Math.floor(Math.random() * comments.length)];

        records[faceId] = {
          commentsSeen: [picked.text],
          currentComment: picked.text,
          currentCategory: picked.category,
          lastUpdateTime: timeNow,
          isMaxReached: false,
        };

        // Speak aloud
        if (!isVoiceMuted) {
          ttsService.speak(picked.text);
        }

        return {
          comment: picked.text,
          category: picked.category,
          isMaxReached: false,
        };
      }

      const rec = records[faceId];

      // 2. Already reached max 4-5 comments
      if (rec.isMaxReached) {
        return {
          comment: rec.currentComment,
          category: 'MAX SWAG REACHED',
          isMaxReached: true,
        };
      }

      // 3. Check dwell rotation interval (every 2.8s)
      if (timeNow - rec.lastUpdateTime >= 2800) {
        if (rec.commentsSeen.length >= MAX_COMMENTS) {
          rec.isMaxReached = true;
          rec.currentComment = 'CERTIFIED LEGEND: MAX SWAG UNLOCKED!';
          rec.currentCategory = 'MAX SWAG REACHED';
          rec.lastUpdateTime = timeNow;
          return {
            comment: rec.currentComment,
            category: rec.currentCategory,
            isMaxReached: true,
          };
        }

        const activeAssigned = new Set(
          Object.entries(records)
            .filter(([fid]) => fid !== faceId)
            .map(([, r]) => r.currentComment)
        );

        let pool = comments.filter((c) => !rec.commentsSeen.includes(c.text) && !activeAssigned.has(c.text));
        if (pool.length === 0) {
          pool = comments.filter((c) => !rec.commentsSeen.includes(c.text));
        }
        if (pool.length === 0) pool = comments;

        const next = pool[Math.floor(Math.random() * pool.length)];
        rec.commentsSeen.push(next.text);
        rec.currentComment = next.text;
        rec.currentCategory = next.category;
        rec.lastUpdateTime = timeNow;

        if (!isVoiceMuted) {
          ttsService.speak(next.text);
        }

        return {
          comment: next.text,
          category: next.category,
          isMaxReached: false,
        };
      }

      return {
        comment: rec.currentComment,
        category: rec.currentCategory,
        isMaxReached: false,
      };
    },
    [comments, isVoiceMuted]
  );

  // -------------------------------------------------------------
  // MAIN CANVAS RENDERING LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    let animId: number;

    const render = (time: number) => {
      frameCountRef.current += 1;
      if (time - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = time;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const video = videoRef.current;

      if (!canvas || !ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // Clear frame
      ctx.clearRect(0, 0, cw, ch);

      const trackedFaces: TrackedFace[] = [];

      // Draw background camera video
      if (cameraActive && video && video.readyState >= 2 && !isPaused) {
        ctx.save();
        ctx.translate(cw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, cw, ch);
        ctx.restore();

        // ONLY perform face tracking when SESSION IS ACTIVE!
        if (sessionActive) {
          if (faceLandmarkerRef.current) {
            try {
              const results = faceLandmarkerRef.current.detectForVideo(video, time);
              if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                // Track up to 4 faces
                const rawFaces = results.faceLandmarks.slice(0, 4);

                rawFaces.forEach((landmarks: unknown[], index: number) => {
                  const faceId = `Face #${index + 1}`;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pts = landmarks.map((lm: any) => [
                    (1 - lm.x) * cw,
                    lm.y * ch,
                  ]) as [number, number][];

                  const xs = pts.map((p) => p[0]);
                  const ys = pts.map((p) => p[1]);
                  const xMin = Math.max(0, Math.min(...xs));
                  const xMax = Math.min(cw, Math.max(...xs));
                  const yMin = Math.max(0, Math.min(...ys));
                  const yMax = Math.min(ch, Math.max(...ys));
                  const faceH = yMax - yMin;

                  const ovalIndices = [
                    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
                  ];
                  const ovalPoints = ovalIndices.map((idx) => pts[idx]).filter(Boolean);

                  const cyberIndices = [1, 4, 33, 133, 362, 263, 61, 291, 13, 14, 70, 300, 116, 345];
                  const cyberPoints = cyberIndices.map((idx) => pts[idx]).filter(Boolean);

                  const upLip = pts[13];
                  const lowLip = pts[14];
                  const mouthL = pts[61];
                  const mouthR = pts[291];
                  const eyeL = pts[33];
                  const eyeR = pts[263];

                  let rx: 'neutral' | 'shock' | 'smile' = 'neutral';
                  if (upLip && lowLip && faceH > 0) {
                    const mouthOpen = Math.hypot(lowLip[0] - upLip[0], lowLip[1] - upLip[1]) / faceH;
                    const mouthW = Math.hypot(mouthR[0] - mouthL[0], mouthR[1] - mouthL[1]);
                    const eyeDist = Math.hypot(eyeR[0] - eyeL[0], eyeR[1] - eyeL[1]);
                    const smileRatio = mouthW / Math.max(1, eyeDist);

                    if (mouthOpen > 0.085) rx = 'shock';
                    else if (smileRatio > 0.62) rx = 'smile';
                  }

                  const { comment, category, isMaxReached } = getOrUpdateFaceComment(faceId, rx, time);

                  trackedFaces.push({
                    id: faceId,
                    bbox: [xMin, yMin, xMax, yMax],
                    center: [(xMin + xMax) / 2, (yMin + yMax) / 2],
                    ovalPoints,
                    cyberPoints,
                    reaction: rx,
                    comment,
                    category,
                    isMaxReached,
                  });
                });
              }
            } catch {}
          } else {
            // Simulator fallback
            const fx = cw * 0.5;
            const fy = ch * 0.45;
            const fw = cw * 0.32;
            const fh = ch * 0.44;
            const sim = generateSimulatedFace(fx, fy, fw, fh, simMouthOpen, simSmiling);
            const { comment, category, isMaxReached } = getOrUpdateFaceComment('Face #1', sim.reaction, time);
            trackedFaces.push({
              ...sim,
              id: 'Face #1',
              comment,
              category,
              isMaxReached,
            });
          }
        }
      } else if (isSimulatorMode || !cameraActive) {
        // Futuristic simulator screen
        const grad = ctx.createRadialGradient(cw / 2, ch / 2, 80, cw / 2, ch / 2, cw * 0.7);
        grad.addColorStop(0, '#15132a');
        grad.addColorStop(0.6, '#0c0a1a');
        grad.addColorStop(1, '#05040a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        if (sessionActive) {
          const fx = cw * simHeadPos.x;
          const fy = ch * simHeadPos.y;
          const fw = cw * 0.3;
          const fh = ch * 0.42;

          const sim = generateSimulatedFace(fx, fy, fw, fh, simMouthOpen, simSmiling);
          drawAvatarHologram(ctx, fx, fy, fw, fh, simMouthOpen, simSmiling, time);

          const { comment, category, isMaxReached } = getOrUpdateFaceComment('Face #1', sim.reaction, time);
          trackedFaces.push({
            ...sim,
            id: 'Face #1',
            comment,
            category,
            isMaxReached,
          });
        }
      }

      // Update face count
      setNumFacesTracked(trackedFaces.length);

      // RENDER AR ELEMENTS
      if (!sessionActive) {
        // SESSION INACTIVE: Draw Standby card
        drawSessionInactiveStandby(ctx, cw, ch, time);
      } else {
        // SESSION ACTIVE: Draw multi-face overlays
        if (trackedFaces.length > 0) {
          setDetectedReaction(trackedFaces[0].reaction);

          trackedFaces.forEach((face) => {
            let themeColor = '#00F0FF';
            if (face.isMaxReached) themeColor = '#FFDC28';
            else if (face.reaction === 'shock') themeColor = '#FF8C1E';
            else if (face.reaction === 'smile') themeColor = '#FFDC28';

            // Glow contour
            if (showGlow && face.ovalPoints.length > 2) {
              drawGlowContour(ctx, face.ovalPoints, themeColor, time);
            }

            // Cyber landmarks
            if (showLandmarks && face.cyberPoints.length > 0) {
              drawCyberNodes(ctx, face.cyberPoints, '#B43CFF');
            }

            // Floating comment bubble
            drawMultiFaceCommentBubble(
              ctx,
              face.id,
              face.comment,
              face.category,
              face,
              themeColor,
              cw,
              ch,
              time,
              face.isMaxReached
            );
          });
        } else {
          setDetectedReaction('neutral');
          drawNoFaceCard(ctx, cw, ch, time);
        }
      }

      // HUD Header
      drawHudHeader(ctx, cw, sessionActive, trackedFaces.length, detectedReaction, fps, isPaused, isVoiceMuted);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    sessionActive,
    cameraActive,
    isSimulatorMode,
    isPaused,
    showGlow,
    showLandmarks,
    simHeadPos,
    simMouthOpen,
    simSmiling,
    detectedReaction,
    fps,
    isVoiceMuted,
    getOrUpdateFaceComment,
  ]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border border-cyan-500/30 bg-slate-950 shadow-2xl shadow-cyan-950/40">
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />

      {/* Main Canvas Viewport */}
      <div className="relative w-full aspect-video bg-black overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-contain"
        />

        <div className="absolute inset-0 cyber-scanlines opacity-40 pointer-events-none" />

        {/* Snapshot Notification */}
        {snapshotToast && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-6 py-2.5 rounded-full bg-emerald-500/90 text-white font-mono-code font-bold text-sm tracking-wider shadow-lg shadow-emerald-500/40 animate-bounce">
            📸 SNAPSHOT SAVED TO DOWNLOADS!
          </div>
        )}

        {/* Session Status Pill (Top Left) */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 text-xs font-mono-code">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              sessionActive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
            }`}
          />
          <span className={sessionActive ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
            {sessionActive ? 'SESSION ACTIVE' : 'SESSION INACTIVE'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-white font-bold">{fps} FPS</span>
        </div>

        {/* Face Count Pill (Top Right) */}
        {sessionActive && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 text-xs font-mono-code text-cyan-300">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {numFacesTracked > 0 ? `${numFacesTracked} FACE(S) DETECTED` : 'SEARCHING FOR FACE...'}
            </span>
          </div>
        )}

        {/* Camera Permission Alert */}
        {cameraError && !cameraActive && (
          <div className="absolute bottom-16 left-6 right-6 z-20 p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CameraOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Camera unavailable. Interactive Cyber Avatar simulator mode enabled!</span>
            </div>
            <button
              onClick={startCamera}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg font-mono-code text-xs font-semibold cursor-pointer transition"
            >
              Retry Camera
            </button>
          </div>
        )}
      </div>

      {/* Cyber HUD Control Deck */}
      <div className="w-full bg-slate-950/95 border-t border-cyan-500/30 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Start / End Session Primary Buttons */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <button
            onClick={handleStartSession}
            disabled={sessionActive}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition cursor-pointer shadow-lg active:scale-95 ${
              !sessionActive
                ? 'bg-gradient-to-r from-emerald-400 to-cyan-500 hover:from-emerald-300 hover:to-cyan-400 text-slate-950 shadow-emerald-500/30 font-orbitron'
                : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed opacity-40'
            }`}
            title="Press ENTER key to start session"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Start Session [Enter]</span>
          </button>

          <button
            onClick={handleEndSession}
            disabled={!sessionActive}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition cursor-pointer shadow-lg active:scale-95 ${
              sessionActive
                ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/30 font-orbitron'
                : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed opacity-40'
            }`}
            title="Press 'E' key to end session"
          >
            <StopCircle className="w-4 h-4" />
            <span>End Session [E]</span>
          </button>

          <button
            onClick={takeSnapshot}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-mono-code text-xs border border-slate-700 transition cursor-pointer active:scale-95"
            title="Press 'S' key shortcut"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Snap [S]</span>
          </button>

          <button
            onClick={onTogglePause}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-mono-code text-xs border border-slate-700 transition cursor-pointer"
            title="Press 'Space' key shortcut"
          >
            {isPaused ? <Play className="w-4 h-4 text-cyan-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={repeatVoiceComment}
            disabled={!sessionActive}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-mono-code text-xs border transition cursor-pointer active:scale-95 ${
              sessionActive
                ? 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border-purple-500/30'
                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
            }`}
            title="Repeat current comment aloud [V]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>Repeat [V]</span>
          </button>

          <button
            onClick={toggleVoiceMute}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition cursor-pointer font-mono-code text-xs ${
              isVoiceMuted
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
            }`}
            title="Toggle Voice Speech [M]"
          >
            {isVoiceMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isVoiceMuted ? 'Voice: Muted [M]' : 'Voice: On [M]'}</span>
          </button>
        </div>

        {/* Center/Right: Simulation Cues */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <span className="text-slate-400 font-mono-code text-[11px] mr-1">TEST CUES:</span>
          <button
            onClick={() => {
              setSimMouthOpen((prev) => !prev);
              if (!simMouthOpen) soundEffects.playShockSound();
            }}
            className={`px-2.5 py-1 rounded-lg font-mono-code transition cursor-pointer ${
              simMouthOpen
                ? 'bg-orange-500 text-black font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            😲 Shock
          </button>
          <button
            onClick={() => {
              setSimSmiling((prev) => !prev);
              if (!simSmiling) soundEffects.playSmileSound();
            }}
            className={`px-2.5 py-1 rounded-lg font-mono-code transition cursor-pointer ${
              simSmiling
                ? 'bg-yellow-400 text-black font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            😄 Smile
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   CANVAS AR RENDERERS FOR BUTTON-CONTROLLED MULTI-FACE COMMENTARY
   ========================================================================= */

function drawSessionInactiveStandby(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  time: number
) {
  const cardW = 540;
  const cardH = 140;
  const x = (cw - cardW) / 2;
  const y = (ch - cardH) / 2;

  const pulse = (Math.sin(time * 0.003) + 1) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(12, 10, 22, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, 20);
  ctx.fill();

  ctx.shadowColor = '#FF8C1E';
  ctx.shadowBlur = 12 + 6 * pulse;
  ctx.strokeStyle = '#FF8C1E';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.font = 'bold 20px "Orbitron", monospace';
  ctx.fillStyle = '#FF8C1E';
  ctx.fillText('● SESSION INACTIVE', x + 35, y + 42);

  ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Click [Start Session] button below or press ENTER to begin', x + 35, y + 78);

  ctx.font = '400 13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Face detection, tracking, comments & voice will activate.', x + 35, y + 106);

  ctx.restore();
}

function drawGlowContour(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  color: string,
  time: number
) {
  if (pts.length < 3) return;

  const pulse = (Math.sin(time * 0.004) + 1) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();

  ctx.shadowColor = color;
  ctx.shadowBlur = 18 + 8 * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 + 2 * pulse;
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  ctx.shadowBlur = 8;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.85;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.95;
  ctx.stroke();

  ctx.restore();
}

function drawCyberNodes(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  color: string
) {
  ctx.save();
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.9;
    ctx.fill();
  }
  ctx.restore();
}

function drawMultiFaceCommentBubble(
  ctx: CanvasRenderingContext2D,
  faceId: string,
  comment: string,
  category: string,
  faceData: TrackedFace,
  themeColor: string,
  cw: number,
  ch: number,
  time: number,
  isMaxReached: boolean
) {
  const [xMin, yMin, xMax, yMax] = faceData.bbox;
  const [centerX] = faceData.center;

  ctx.save();
  ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
  const textMetrics = ctx.measureText(comment);
  const textW = textMetrics.width;

  ctx.font = '600 12px "JetBrains Mono", monospace';
  const badgeText = isMaxReached
    ? `⚡ ${faceId} [MAX SWAG REACHED]`
    : `⚡ ${faceId} | ${category}`;
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = badgeMetrics.width;

  const contentW = Math.max(textW, badgeW);
  const padX = 22;
  const bubbleW = contentW + padX * 2;
  const bubbleH = 72;

  const bob = Math.sin(time * 0.004) * 5;

  let targetX = centerX - bubbleW / 2;
  let targetY = yMin - bubbleH - 22 + bob;

  if (targetY < 55) {
    targetY = yMin + 10 + bob;
    targetX = xMax + 20;

    if (targetX + bubbleW > cw - 20) {
      targetX = xMin - bubbleW - 20;
      if (targetX < 20) {
        targetX = centerX - bubbleW / 2;
        targetY = yMax + 22 + bob;
      }
    }
  }

  targetX = Math.max(20, Math.min(cw - bubbleW - 20, targetX));
  targetY = Math.max(55, Math.min(ch - bubbleH - 45, targetY));

  ctx.fillStyle = 'rgba(12, 10, 22, 0.9)';
  ctx.beginPath();
  ctx.roundRect(targetX, targetY, bubbleW, bubbleH, 16);
  ctx.fill();

  ctx.shadowColor = themeColor;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Badge
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillStyle = themeColor;
  ctx.fillText(badgeText, targetX + padX, targetY + 25);

  // Main punchline text
  ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillText(comment, targetX + padX + 1.5, targetY + 52);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(comment, targetX + padX, targetY + 51);

  // Pointer line from bubble to head
  ctx.beginPath();
  const anchorX = Math.max(targetX + 16, Math.min(targetX + bubbleW - 16, centerX));
  const anchorY = targetY < yMin ? targetY + bubbleH : targetY;
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(centerX, yMin);
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
  ctx.fillStyle = themeColor;
  ctx.fill();

  ctx.restore();
}

function drawHudHeader(
  ctx: CanvasRenderingContext2D,
  cw: number,
  sessionActive: boolean,
  numFaces: number,
  reaction: string,
  fps: number,
  isPaused: boolean,
  isVoiceMuted: boolean = false
) {
  ctx.save();

  // Top header bar
  ctx.fillStyle = 'rgba(10, 8, 20, 0.85)';
  ctx.fillRect(0, 0, cw, 46);
  ctx.strokeStyle = '#00F0FF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.lineTo(cw, 46);
  ctx.stroke();

  // Title
  ctx.font = 'bold 15px "Orbitron", monospace';
  ctx.fillStyle = '#00F0FF';
  ctx.fillText('[ AI FUNNY FACE COMMENTATOR ]', 20, 29);

  // Status Badge
  const statusX = 400;
  ctx.beginPath();
  ctx.arc(statusX, 23, 5, 0, Math.PI * 2);
  ctx.fillStyle = sessionActive ? '#34D399' : '#FB923C';
  ctx.fill();

  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillStyle = sessionActive ? '#34D399' : '#FB923C';
  const statusText = sessionActive
    ? numFaces > 0
      ? `SESSION ACTIVE (${numFaces} FACE${numFaces > 1 ? 'S' : ''})`
      : 'SESSION ACTIVE (SEARCHING...)'
    : 'SESSION INACTIVE';
  ctx.fillText(statusText, statusX + 14, 28);

  // Voice Status Badge
  const voiceX = cw - 300;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  if (isVoiceMuted) {
    ctx.fillStyle = '#FB923C';
    ctx.fillText('[VOICE: MUTED]', voiceX, 28);
  } else {
    ctx.fillStyle = '#34D399';
    ctx.fillText('[VOICE: ON]', voiceX, 28);
  }

  // FPS
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94A3B8';
  const fpsText = isPaused ? `[PAUSED] FPS: ${fps}` : `FPS: ${fps}`;
  ctx.fillText(fpsText, cw - 145, 28);

  ctx.restore();
}

function drawNoFaceCard(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  time: number
) {
  const cardW = 460;
  const cardH = 120;
  const x = (cw - cardW) / 2;
  const y = (ch - cardH) / 2;

  const pulse = (Math.sin(time * 0.003) + 1) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 12, 28, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, cardW, cardH, 20);
  ctx.fill();

  ctx.shadowColor = '#FF8C1E';
  ctx.shadowBlur = 10 + 6 * pulse;
  ctx.strokeStyle = '#FF8C1E';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.font = 'bold 18px "Orbitron", monospace';
  ctx.fillStyle = '#FF8C1E';
  ctx.fillText('SEARCHING FOR FACES...', x + 30, y + 40);

  ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Step into the camera spotlight, Superstar!', x + 30, y + 72);

  ctx.font = '400 13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('AI Commentator is waiting to hype you up...', x + 30, y + 98);

  ctx.restore();
}

function generateSimulatedFace(
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  mouthOpen: boolean,
  smiling: boolean
) {
  const hw = fw / 2;
  const hh = fh / 2;

  const ovalPoints: [number, number][] = [];
  const numPts = 36;
  for (let i = 0; i < numPts; i++) {
    const angle = (i / numPts) * Math.PI * 2;
    const px = fx + Math.sin(angle) * hw;
    const py = fy - Math.cos(angle) * hh;
    ovalPoints.push([px, py]);
  }

  const eyeL: [number, number] = [fx - hw * 0.45, fy - hh * 0.2];
  const eyeR: [number, number] = [fx + hw * 0.45, fy - hh * 0.2];
  const nose: [number, number] = [fx, fy + hh * 0.1];
  const mouthL: [number, number] = [fx - (smiling ? hw * 0.45 : hw * 0.35), fy + (smiling ? hh * 0.48 : hh * 0.52)];
  const mouthR: [number, number] = [fx + (smiling ? hw * 0.45 : hw * 0.35), fy + (smiling ? hh * 0.48 : hh * 0.52)];
  const mouthUp: [number, number] = [fx, fy + hh * 0.48];
  const mouthLow: [number, number] = [fx, fy + (mouthOpen ? hh * 0.68 : hh * 0.54)];

  const cyberPoints: [number, number][] = [
    eyeL,
    eyeR,
    nose,
    mouthL,
    mouthR,
    mouthUp,
    mouthLow,
    [fx - hw * 0.45, fy - hh * 0.4],
    [fx + hw * 0.45, fy - hh * 0.4],
    [fx - hw * 0.6, fy + hh * 0.2],
    [fx + hw * 0.6, fy + hh * 0.2],
  ];

  let reaction: 'neutral' | 'shock' | 'smile' = 'neutral';
  if (mouthOpen) reaction = 'shock';
  else if (smiling) reaction = 'smile';

  return {
    bbox: [fx - hw, fy - hh, fx + hw, fy + hh] as [number, number, number, number],
    center: [fx, fy] as [number, number],
    ovalPoints,
    cyberPoints,
    reaction,
  };
}

function drawAvatarHologram(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  mouthOpen: boolean,
  smiling: boolean,
  time: number
) {
  const hw = fw / 2;
  const hh = fh / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.ellipse(fx, fy, hw * 0.9, hh * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(fx - hw * 1.5, fy + hh * 1.6);
  ctx.quadraticCurveTo(fx - hw * 0.9, fy + hh * 0.95, fx, fy + hh * 0.95);
  ctx.quadraticCurveTo(fx + hw * 0.9, fy + hh * 0.95, fx + hw * 1.5, fy + hh * 1.6);
  ctx.strokeStyle = 'rgba(180, 60, 255, 0.25)';
  ctx.stroke();

  const eyeY = fy - hh * 0.18;
  const eyeL = fx - hw * 0.42;
  const eyeR = fx + hw * 0.42;

  ctx.fillStyle = '#00F0FF';
  ctx.beginPath();
  ctx.arc(eyeL, eyeY, 7, 0, Math.PI * 2);
  ctx.arc(eyeR, eyeY, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#00F0FF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(eyeL - 15, eyeY - 14);
  ctx.lineTo(eyeL + 15, eyeY - 12);
  ctx.moveTo(eyeR - 15, eyeY - 12);
  ctx.lineTo(eyeR + 15, eyeY - 14);
  ctx.stroke();

  const mouthY = fy + hh * 0.5;
  ctx.fillStyle = smiling ? '#FFDC28' : mouthOpen ? '#FF8C1E' : '#B43CFF';
  ctx.beginPath();
  if (mouthOpen) {
    ctx.ellipse(fx, mouthY + 8, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (smiling) {
    ctx.beginPath();
    ctx.arc(fx, mouthY - 4, 28, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.strokeStyle = '#FFDC28';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(fx - 20, mouthY);
    ctx.lineTo(fx + 20, mouthY);
    ctx.strokeStyle = '#B43CFF';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.restore();
}

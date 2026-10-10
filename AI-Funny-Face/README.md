# 🎭 AI Funny Face Commentator

An intelligent, real-time Augmented Reality camera filter built with **Python 3.12**, **OpenCV**, **MediaPipe 0.10.x**, and **pyttsx3**. It features **Button-Controlled Sessions (Start/End Session)**, tracks **multiple faces independently**, renders dynamic cyber neon glow contours and facial landmarks, detects expressions (mouth open shock, smiling), and speaks personalized funny comments aloud in real time.

---

## ✨ Features & New Capabilities

- 🔘 **Button-Controlled Sessions**:
  - Application launches in an **Inactive Session** state; face detection and speech do not run until you start.
  - **Start Session**: Activates camera face tracking, multi-face visual bubbles, and spoken commentary.
  - **End Session**: Immediately stops face tracking and commentary, clears the speech queue, and silences ongoing voice output.
  - Status Indicator: `● SESSION ACTIVE` vs `● SESSION INACTIVE`.
  - Trigger by clicking the on-screen buttons `[START SESSION]` / `[END SESSION]` with your mouse, or using `[ENTER]` and `[E]` hotkeys.
- 👥 **Multi-Face Independent Tracking**:
  - Detects and tracks up to 4 faces simultaneously (`Face #1`, `Face #2`, etc.).
  - **Face-Specific Comments**: Each face receives its own attached comment bubble.
  - **Comment Cap (4–5 comments per appearance)**: Each face receives a maximum of 4–5 unique comments per appearance, then unlocks a gold `CERTIFIED LEGEND [MAX SWAG REACHED]` badge.
  - **No Duplicate Conflicts**: Different active faces in the same session receive different comments.
- 🔊 **Real-Time Offline Text-to-Speech (TTS)**:
  - Powered by `pyttsx3` using system voices (Windows SAPI5 / macOS nsss / Linux espeak).
  - 100% offline, zero internet or cloud API dependencies.
  - Non-blocking worker thread so camera feed runs at a smooth 30+ FPS.
  - Immediately canceled and cleared when End Session is clicked.
- 😲 **Facial Reaction Visual Cues**:
  - **Mouth Opening** -> Triggers surprise punchlines (*"SHOCK LAGA LAGA SHOCK LAGA!"*).
  - **Big Smile** -> Triggers celebratory punchlines (*"32 KE 32 DAANT DIKHA DIYE!"*).
- 📸 **Snapshot Capture**: Press `[S]` to save a high-res photo with watermark to disk.

---

## 📁 Project Structure

```text
AI-Funny-Face/
├── main.py              # Main loop, session state machine, mouse callbacks, hotkeys
├── speech_engine.py     # Background worker thread, pyttsx3 offline TTS, queue clearance
├── face_tracker.py      # Multi-face tracking (up to 4 faces) with stable ID association
├── comment_engine.py    # Multi-face comment engine, 4-5 comment cap per face, session pool
├── effects.py           # Start/End buttons, glow rendering, multi-face bubbles & HUD
├── requirements.txt     # Python dependencies (opencv-python, mediapipe, pyttsx3, numpy)
├── run_windows.bat      # One-click Windows starter batch script
└── README.md            # Documentation & setup guide
```

---

## 🛠️ Windows Installation & Setup Guide

### 1. Prerequisites
Ensure you have **Python 3.12** installed on Windows.
Check by opening **Command Prompt (cmd.exe)** or **PowerShell**:
```cmd
python --version
```

### 2. Navigate to the Project Folder
```cmd
cd path\to\AI-Funny-Face
```

### 3. Create a Virtual Environment (`.venv`)
```cmd
python -m venv .venv
```

### 4. Activate the Virtual Environment
- **On Windows Command Prompt (cmd.exe)**:
  ```cmd
  .venv\Scripts\activate
  ```
- **On Windows PowerShell**:
  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```

### 5. Install Dependencies
```cmd
pip install -r requirements.txt
```

---

## 🚀 Running the Application

```cmd
python main.py
```

*Or launch from the project root:*
```cmd
python main.py
```

*Or double-click `run_windows.bat` in Windows Explorer.*

---

## 🎮 Interactive Controls

| Control | Action |
| :--- | :--- |
| **Mouse Click** | Click **`[START SESSION]`** or **`[END SESSION]`** on screen |
| **`ENTER`** | **Start Session** (activates face tracking & voice commentary) |
| **`E`** | **End Session** (immediately stops tracking and halts voice) |
| **`M`** | Mute / Unmute voice commentary (TTS) |
| **`V`** | Repeat current comment aloud |
| **`C`** | Force next funny comment for visible faces |
| **`SPACE`** | Pause / Resume camera video feed |
| **`S`** | Take a snapshot and save as `snapshot_<timestamp>.png` |
| **`Q`** or **`ESC`** | Cleanly exit application |

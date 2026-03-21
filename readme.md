YouTube Playlist Downloader

A full-stack web application for downloading YouTube playlists as MP3 or MP4 with real-time progress tracking, queue management, and ZIP export.

-Overview

This project provides a clean, scalable architecture for downloading entire YouTube playlists through a web interface. It features a FastAPI backend with WebSocket support for live progress updates and a React frontend with a SaaS-style dashboard for managing multiple download tasks concurrently.

-Features
Backend
REST API for initiating downloads
WebSocket-based real-time progress updates
Background task processing
Playlist extraction using yt-dlp
Automatic ZIP file generation
Multi-task queue handling
Frontend
Modern React (Vite) interface
Queue dashboard for multiple downloads
Real-time progress bars
WebSocket integration for live updates
Download ZIP button on completion
Clean SaaS-style UI

-Tech Stack
Backend
FastAPI
Uvicorn
WebSockets
yt-dlp
Python multiprocessing / async tasks
Frontend
React (TypeScript)
Vite
WebSocket API
Fetch API

-Project Structure
youTube-playlist-downloader/
│
├── backend/
│   ├── main.py
│   ├── downloader.py
│   ├── websocket_manager.py
│   ├── tasks.py
│   ├── models.py
│   ├── utils/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
│
└── README.md

-Installation & Setup
Prerequisites
Python 3.9+
Node.js 16+
npm or yarn

-Backend Setup
1. Navigate to backend directory
cd backend
2. Create virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
3. Install dependencies
pip install fastapi uvicorn[standard] yt-dlp websockets python-multipart
4. Run the server
uvicorn main:app --reload

Backend will run at:

http://127.0.0.1:8000

-Frontend Setup
1. Navigate to frontend directory
cd frontend
2. Install dependencies
npm install
3. Start development server
npm run dev

Frontend will run at:

http://localhost:5173

-API Endpoints
Start Download

POST /download

Request:

{
  "url": "https://youtube.com/playlist?list=XXXX",
  "format": "mp4"
}

Response:

{
  "task_id": "uuid",
  "status": "started"
}
Get Task Status

GET /status/{task_id}

Download ZIP

GET /download/{task_id}/zip

Returns a ZIP file containing all downloaded media.

-WebSocket
Endpoint
ws://127.0.0.1:8000/ws/{task_id}
Purpose
Streams real-time progress updates
Sends download status per file
Updates frontend progress bars dynamically

-Application Flow
User submits a playlist URL
Frontend sends request to /download
Backend creates a task and starts processing
WebSocket connection is established using task_id
Backend streams progress updates
Frontend updates UI in real time
Upon completion:
ZIP file becomes available
User can download the archive

-Known Limitations
Some YouTube videos may require authentication (cookies)
yt-dlp may fail for restricted or unavailable videos
WebSocket support requires uvicorn[standard] or websockets

-Handling YouTube Restrictions

If downloads fail with bot detection errors:

yt-dlp --cookies-from-browser chrome <playlist_url>

Or configure cookies in backend yt-dlp options.

-Testing
API Testing (curl)
curl -X POST http://127.0.0.1:8000/download \
-H "Content-Type: application/json" \
-d '{"url":"<playlist_url>"}'
WebSocket Testing

Use browser console:

new WebSocket("ws://127.0.0.1:8000/ws/test");

-Key Design Considerations
Separation of concerns between API, download logic, and WebSocket handling
Stateless frontend with real-time updates via sockets
Task-based architecture for scalable concurrent downloads
Extensible structure for future queue systems (e.g., Redis/Celery)

-Future Improvements
Redis-backed job queue
User authentication and sessions
Persistent database for download history
Docker containerization
Cloud storage integration (S3, GCS)
Retry and error recovery mechanisms
Advanced format/quality selection UI

-Security Considerations
Validate and sanitize user input URLs
Implement rate limiting for public deployments
Avoid exposing backend without protection
Restrict file system access for downloads

-Development Notes
Ensure hooks in React are not used conditionally
Maintain consistent WebSocket lifecycle per task
Keep backend async-safe for concurrent downloads
Monitor yt-dlp updates for compatibility changes

-License
This project is intended for educational and personal use. Ensure compliance with YouTube’s Terms of Service when using this application.

-Acknowledgements
FastAPI
yt-dlp
React
Vite
Open source community tools
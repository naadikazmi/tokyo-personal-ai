# Tokyo Personal AI

A desktop-first Windows personal AI assistant built with Expo SDK 56, Expo Web, React Native, TypeScript, a local Node
API server, optional Supabase/OpenAI, and Electron desktop packaging.

Tokyo is local-first. Chat, notes, PDF Notes Studio, planner tasks, memories, permissions, study tools, coding help, research outlines, clipboard helper, file workspace, and activity logs work
without Supabase. OpenAI is optional: when `OPENAI_API_KEY` exists, the backend uses it; when it is missing, the backend
returns useful local fallback replies instead of blocking chat.

## Easiest Start on Windows

Double-click this file:

```text
Start Tokyo Personal AI.bat
```

The launcher:

- Opens the project folder automatically.
- Runs `npm install` only when `node_modules` is missing.
- Starts the local API server on the first available port starting at `8083`.
- Starts Expo Web on the first available port starting at `8082`.
- Opens Tokyo Personal AI in your browser automatically.
- Keeps the launcher window open so beginner-friendly errors can be read.
- Writes runtime logs to `.tokyo-runtime/`.

Use this first while developing. For daily desktop use after building, open the installed app or run:

```text
release/win-unpacked/Tokyo Personal AI.exe
```

Do not run `Start Tokyo Personal AI.bat` and the desktop EXE at the same time. Use one startup method at a time so the app does not open duplicate windows or compete for local development servers.

## Manual Commands

```powershell
npm install
npm run dev
```

This starts the local API and Expo Web, waits until the app is ready, then opens the browser automatically.

You can also run services separately:

```powershell
npm run start:api
npm run start:web
```

Default local URLs:

- Expo Web starts at `http://localhost:8082` when available.
- Local API starts at `http://localhost:8083` when available.

If either port is busy, the launcher and `npm run dev` choose the next available port and pass it to the app.

## Windows Desktop App / EXE

Tokyo Personal AI includes Electron desktop support.

Development desktop window:

```powershell
npm run desktop:dev
```

Build a Windows installer:

```powershell
npm run desktop:build
```

Create an unpacked Windows app folder for testing:

```powershell
npm run desktop:pack
```

Build output is created in:

```text
release/
```

The Electron app opens a desktop window titled `Tokyo Personal AI`, starts the local API automatically when packaged,
serves the exported web app locally, auto-selects free ports, focuses the existing window if opened twice, and keeps
browser mode untouched. Main-process startup logs are written to:

```text
%APPDATA%\Tokyo Personal AI\logs\main.log
```

## Environment Variables

Copy `.env.example` to `.env`.

Frontend-safe values:

```text
EXPO_PUBLIC_API_BASE_URL=http://localhost:8083
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
EXPO_PUBLIC_ENABLE_GOOGLE_OAUTH=false
```

Server-only values. Do not expose these with `EXPO_PUBLIC_`:

```text
API_PORT=8083
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
RESEARCH_PROVIDER=tavily
RESEARCH_API_KEY=your-search-provider-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Supported `RESEARCH_PROVIDER` values: `tavily`, `brave`, `serpapi`, `bing`.

Leave values blank for local/demo mode. Missing OpenAI or Supabase keys should not stop the app from opening.

Never put `OPENAI_API_KEY`, `RESEARCH_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` in a frontend `EXPO_PUBLIC_` variable.

## Demo / Local Mode

Supabase is optional. If Supabase is not configured, Tokyo shows:

```text
Local mode active — cloud sync disabled.
```

In local mode, chat history, memories, notes, planner tasks, permissions, settings, research history, and logs are
stored in browser/Electron local storage on this laptop.

OpenAI is optional. If `OPENAI_API_KEY` is missing, the local backend still handles coding help, study explanations,
daily planning, research outlines, memory/note/task suggestions, and safe action guidance.

The calm banner `Demo AI active` means Tokyo is using the local fallback. It is expected when OpenAI is not configured.

## Practical Features

- Smart Command Center in Chat detects requests such as `Open Notepad`, `Open YouTube`, `Create a note: ...`, `Remember that ...`, `Add task: ...`, `Search my memories for ...`, `Summarize my notes`, `Plan my day`, and `Make me C++ code for a simple game`.
- Notes screen creates, edits, deletes with confirmation, searches, pins, and categorizes local notes as Study, Work, Personal, Ideas, Code, or Other.
- Planner creates, edits, deletes, completes/reopens, prioritizes, filters Today/Upcoming/Completed/High/Overdue, and suggests a daily plan.
- Study Mode generates simple explanations, short notes, exam-style answers, quizzes, flashcards, and step-by-step study plans, then saves them to Notes.
- Coding Helper generates starter code, explains code, gives debug checklists, creates small project plans, and saves snippets to Notes.
- PDF Notes Studio imports text-based PDFs locally, extracts page text, creates study notes, flashcards, MCQs, glossary terms, exam questions, page-referenced Q&A, and exports/saves generated notes.
- File Workspace uses one configured safe folder only. In the desktop app it can open a folder picker; browser mode keeps a manual path fallback. It searches filenames, previews top-level files, tests access, opens approved files/folders, and creates text files after confirmation.
- Clipboard Helper reads clipboard text only after pressing Paste, then summarizes, rewrites professionally, shortens, makes friendlier, fixes grammar, translates to Urdu/Roman Urdu, sends text to Chat, or saves it as a note.
- Dashboard shows mode status, AI/OpenAI status, Supabase status, today's tasks, recent notes, memory count, activity, permissions, Emergency Lock, and quick actions.

## PDF Notes Studio

Open `PDF Notes` from the sidebar.

What works now:

- Browser mode: use `Upload PDF`.
- Desktop mode: use `Choose PDF` to pick a local `.pdf` file through Electron.
- Text is extracted page by page and stored locally as session metadata and generated notes. The PDF binary is not stored in local storage.
- Local mode generates easy notes, chapter summaries, important definitions, key points, exam-style questions, flashcards, MCQs, a glossary, a revision checklist, and page-referenced PDF Q&A.
- `Save to Notes` stores the generated PDF notes in the normal Notes screen.
- `Export notes` copies Markdown/text to the clipboard.
- Recent PDF sessions appear inside PDF Notes and on the dashboard.

Privacy behavior:

- PDFs are processed locally by default.
- If `OPENAI_API_KEY` is configured, generated text chunks may be sent to the configured local backend for better notes.
- Emergency Lock keeps existing PDF notes readable but forces note generation to stay local and blocks cloud/AI PDF processing.
- Scanned or image-only PDFs show: `This PDF may be scanned/image-based. OCR is not available yet.`

## Laptop Actions

Tokyo can detect simple action requests in chat and show an approval card before anything runs.

Supported now:

- Open allowlisted apps: Notepad, Calculator, Paint, Chrome/default browser, VS Code, File Explorer.
- Open websites in the default browser: YouTube, Google, Gmail, ChatGPT, Supabase, GitHub, and valid custom URLs.
- Create local notes with category support.
- Save local memories from “remember that ...”.
- Add planner tasks/reminders from chat.
- Search and summarize local notes and memories.
- Search filenames inside one safe workspace folder.
- Open/create files only inside the configured safe workspace folder.

Disabled intentionally:

- Arbitrary system commands.
- Destructive actions.
- Rename/move files, until a safer preview flow is completed.
- Clipboard auto-reading. Clipboard text is read only after user action.
- Browser automation beyond opening a URL.

Emergency Lock disables app launching, website opening, file workspace access, clipboard helper, browser automation, device-control placeholders, and system-command placeholders. Chat, notes, planner viewing, and ordinary local data management remain available.

Configure the safe file workspace in Settings or the File Workspace screen. File actions stay disabled until a folder is saved. The app suggests this folder, but it will not use it until you approve/save it:

```text
Documents\Tokyo Personal AI Workspace
```

## Add OpenAI Later

1. Copy `.env.example` to `.env` if you have not already.
2. Add server-only values:

```text
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

3. Restart Tokyo using the `.bat` launcher or `npm run desktop:dev`.

Do not expose the OpenAI key in frontend code or any `EXPO_PUBLIC_` variable.

## Add Supabase Later

1. Create a Supabase project.
2. Run the SQL migration listed below.
3. Add frontend-safe auth values:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

4. For server-side API sync, add server-only values:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-side-service-role-key
```

5. Restart the app.

## Supabase SQL

Run this file in the Supabase SQL editor:

```text
supabase/migrations/20260620_personal_ai_core.sql
```

It creates or updates:

- `activity_logs`
- `memories`
- `chat_messages`
- `research_history`
- `avatars`
- `permissions`
- `settings`

The migration also enables RLS policies using `auth.uid()::text = user_id`.

## Forgot Password

Tokyo Personal AI includes a browser-based "Forgot password?" flow on the login screen.

How it works:

1. The user clicks `Forgot password?`.
2. If Supabase is configured, Tokyo sends a reset email with `supabase.auth.resetPasswordForEmail`.
3. The message always says: `If an account exists for this email, a reset link has been sent.`
4. The reset link opens `/reset-password`, where the user creates a new password.
5. The new password is saved with `supabase.auth.updateUser`.

Demo mode behavior:

- If Supabase is not configured, the reset dialog says password reset requires Supabase email auth setup.
- Demo users do not need a password.
- `Continue as Demo User` remains available.

Do not use the Supabase `service_role` key in the Expo app. Only use the public anon or publishable key in
`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Safety Rules

- No full device access by default.
- Powerful future actions require permission gates plus visible user approval.
- Emergency lock disables risky permissions immediately.
- The app must log important actions.
- No file edit, delete, message send, command run, package install, browser automation, private data access, or system
  setting change should happen without explicit approval.
- File deletion is not implemented.
- Rename/move file actions remain disabled until a safe preview-and-confirm implementation exists.
- Hateful or extremist slogans are not treated as normal research prompts. Tokyo will only provide educational context, harms, and safety framing, and logs the filtered event.

## Permissions

Tokyo stores permissions locally in Demo/Local Mode and can sync them later when Supabase is configured.

Current permission categories:

- Chat only
- Research only
- Study Mode
- Coding Helper
- Memory access
- Notes
- Planner actions
- Open apps
- Open websites
- Clipboard helper
- File read access inside the configured safe workspace
- File write access inside the configured safe workspace
- PDF processing
- Voice placeholder
- Browser automation placeholder
- Device control placeholder
- System command access disabled by default
- Full device control disabled by default

Turning off Study Mode or Coding Helper pauses generation in those screens without deleting saved notes. Emergency Lock pauses risky laptop, file, website, clipboard, automation, and device-control permissions.

## Current Capabilities

- Chat through `/api/chat` with OpenAI when configured and useful local fallback when not configured.
- Notes, PDF Notes Studio, Study Mode, Coding Helper, Clipboard Helper, Planner, Memories, Dashboard, and Activity Logs work in local/demo mode.
- Offline research outlines through `/api/research`, with live source-grounded research structure ready for OpenAI plus a search provider.
- Approval-card laptop actions from chat through `/api/actions/execute`.
- Safe Windows app and website launching after approval.
- Safe file workspace actions after approval.
- Supabase-backed memories/logs/history/avatars when the migration and keys are configured.
- Local-first storage for chat, memories, notes, tasks, permissions, settings, logs, and research history.
- Tokyo-branded avatar modes with fallback rendering when no real 3D model is present.
- System Health panel and safe test buttons on the dashboard.

## Troubleshooting

- `Node.js was not found`: install Node.js 22 LTS or newer, then double-click `Start Tokyo Personal AI.bat` again.
- Browser does not open: check `.tokyo-runtime/web.err.log`, then open the printed `App:` URL manually.
- API does not start in browser mode: check `.tokyo-runtime/api.err.log`. Chat still falls back locally when OpenAI is missing, but laptop actions need the local API.
- Packaged EXE shows a startup problem: check `%APPDATA%\Tokyo Personal AI\logs\main.log`.
- Do not run `.bat` and EXE together: close one before starting the other. The `.bat` is best for browser/development mode; the EXE is best for daily desktop mode after building.
- Port `8083` is busy: this is expected on some systems. The launcher and EXE check for an existing healthy Tokyo API first, then automatically try `8084`, `8085`, and later ports.
- Port seems stuck or the app opens on the wrong backend: close all old Tokyo app windows, close any old launcher terminal windows, then start Tokyo again using only one method.
- To manually free port `8083` on Windows, open PowerShell and inspect the process first:

```powershell
Get-NetTCPConnection -LocalPort 8083 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
Get-Process -Id <OwningProcess>
```

If it is an old Tokyo/Node process you want to stop, run:

```powershell
Stop-Process -Id <OwningProcess>
```

Replace `<OwningProcess>` with the number shown by the first command. Do not stop a process if you do not recognize it.
- Opening the EXE twice: the second launch should focus the existing window and exit. If Windows still shows multiple windows, close them all and reopen the EXE once.
- OpenAI is missing: leave `OPENAI_API_KEY` blank for local mode. Tokyo will use useful fallback replies. Add the key to server `.env` only when you want real OpenAI replies.
- Supabase is missing or tables are not created: use Demo Mode. Local chat, notes, memories, planner tasks, settings, permissions, and logs still work.
- Google login is not configured: use email auth if Supabase is configured, or `Continue as Demo User`. The Google button should show a setup message instead of crashing.
- File actions say `SAFE_WORKSPACE_REQUIRED`: open File Workspace or Settings, save a safe folder, enable the file permissions you need, then approve the action again.
- Notepad/website actions do nothing: make sure Emergency Lock is off, the matching permission is enabled, and you clicked Approve on the chat action card.
- Clipboard helper is blocked: turn off Emergency Lock and enable Clipboard helper in Permissions. Clipboard is read only when you press Paste.
- PDF upload fails with an OCR message: the PDF is probably scanned or image-based. Text PDF extraction works now; OCR is not implemented yet.
- PDF `Choose PDF` is unavailable: use the desktop EXE or `npm run desktop:dev`. In browser mode, use `Upload PDF` instead.
- PDF notes stay local in Emergency Lock: this is intentional. Unlock if you want configured OpenAI-backed PDF note generation.
- Voice buttons do not record or speak: voice is currently a placeholder. The buttons should show a calm coming-soon message.
- Avatar/model is missing: the fallback Tokyo avatar should render. A missing 3D model should not block chat or the rest of the app.
- Electron build fails on first run: run `npm install` once, then retry `npm run desktop:build`.
- Blank screen in Electron: run `npm run desktop:dev` first. If that works, run `npm run desktop:pack` and check `release/`.

## Build Outputs

`npm run desktop:build` creates:

```text
release/Tokyo Personal AI Setup 1.0.0.exe
release/win-unpacked/Tokyo Personal AI.exe
```

`npm run desktop:pack` creates only the unpacked app folder for quick testing.

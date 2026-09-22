"""Entry point that sets the Windows asyncio event loop policy before
Uvicorn creates its event loop.

Playwright needs to launch a subprocess (the browser), which Windows'
default event loop cannot do — only the Proactor loop supports
subprocesses. This must run before any event loop is created, which is
why it lives here rather than in main.py: by the time main.py is
imported, Uvicorn has already created its loop and it's too late.

Run the backend with:
    python run.py
instead of:
    uvicorn main:app --reload
"""

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
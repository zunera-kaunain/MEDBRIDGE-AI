"""Make NVIDIA CUDA libraries loadable on Windows.

The nvidia-cublas-cu12 and nvidia-cudnn-cu12 pip packages install their DLLs
into site-packages/nvidia/*/bin, which is not on PATH. Windows only searches
PATH and a handful of system directories, so CTranslate2 fails with:

    RuntimeError: Library cublas64_12.dll is not found or cannot be loaded

os.add_dll_directory registers those folders for the current process.

IMPORT THIS BEFORE faster_whisper OR ctranslate2. Once CTranslate2 has
loaded and failed, adding directories afterwards does nothing.

    from utils.cuda_dlls import register_cuda_dlls
    register_cuda_dlls()
    from faster_whisper import WhisperModel
"""

import os
import platform
from pathlib import Path

_registered = False


def register_cuda_dlls() -> list[str]:
    """Add bundled NVIDIA DLL directories to the search path.

    Returns the directories registered. Safe to call more than once, and a
    no-op on non-Windows platforms where the loader uses rpath instead.
    """
    global _registered
    if _registered or platform.system() != "Windows":
        return []

    try:
        import nvidia
    except ImportError:
        # No bundled CUDA libraries. A system-wide CUDA Toolkit install may
        # still work, so this is not fatal.
        return []

    # nvidia-* are NAMESPACE packages: __file__ is None, so __path__ is the
    # only way to locate them. Using __file__ raises TypeError.
    roots = [Path(p) for p in nvidia.__path__]
    added: list[str] = []

    # rglob rather than hardcoded subpaths — layout has shifted between
    # releases (cublas/bin, cudnn/bin, and occasionally lib/x64).
    dll_dirs = {p.parent for root in roots for p in root.rglob("*.dll")}
    for dll_dir in dll_dirs:
        try:
            os.add_dll_directory(str(dll_dir))
            added.append(str(dll_dir))
        except OSError:
            continue

    _registered = True
    return added
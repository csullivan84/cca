#!/usr/bin/env python3
"""Stream the Windows runtime, corresponding source and validation into cca.zip."""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
output = root.parent / 'cca.zip'
windows = root / 'dist' / 'win-unpacked'
if not (windows / 'CCA.exe').is_file():
    raise SystemExit('Build Windows first: npm run build:windows')
if not (windows / 'portable.txt').is_file():
    raise SystemExit('Portable marker missing; rebuild using the afterPack hook.')
version = json.loads((root / 'package.json').read_text())['version']
files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
if output.exists():
    # Preserve the original supplied upstream source archive once.
    original = root.parent / 'cca-original-source.zip'
    with zipfile.ZipFile(output) as old:
        original_archive = 'BUILD.json' not in old.namelist()
    if original_archive and not original.exists():
        output.rename(original)
temporary = output.with_suffix('.zip.partial')
with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(windows.rglob('*')):
        if file.is_file() and 'data' not in file.relative_to(windows).parts:
            archive.write(file, 'windows/' + file.relative_to(windows).as_posix())
    for name in sorted(filter(None, files)):
        file = root / name
        if file.is_file():
            archive.write(file, 'source/' + name)
    for name in ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'IMPROVEMENTS.md']:
        archive.write(root / name, name)
    for file in sorted((root / 'docs').glob('*.md')):
        archive.write(file, 'docs/' + file.name)
    for name in ['unit-tests.txt', 'ui-tests.txt', 'packaged-mac-tests.txt', 'dependency-audit.jsonl']:
        file = root / 'artifacts' / name
        if file.is_file():
            archive.write(file, 'validation/' + name)
    archive.writestr('Start CCA.cmd', '@echo off\r\ncd /d "%~dp0windows"\r\nstart "" "%~dp0windows\\CCA.exe"\r\n')
    archive.writestr('START-HERE.txt', f'CCA {version} for Windows x64\r\n\r\n1. Extract ALL files from this ZIP.\r\n2. Run Start CCA.cmd or windows\\CCA.exe.\r\n\r\nNo Node.js, Git, GitHub login, or administrator install is required.\r\nKeep the windows folder intact. Preferences live in windows\\data.\r\nThis build is unsigned. Do not disable system security protections.\r\nSource, GPL license and verification notes are included.\r\nSee source\\docs\\VALIDATION.md for test coverage and limits.\r\nSource commit: {commit}\r\n')
    archive.writestr('BUILD.json', json.dumps({'version': version, 'electron': '44.3.0', 'platform': 'win32', 'arch': 'x64', 'sourceCommit': commit, 'signed': False}, indent=2) + '\n')
with zipfile.ZipFile(temporary) as archive:
    corrupt = archive.testzip()
    if corrupt:
        raise SystemExit('Archive verification failed: ' + corrupt)
    required = {'windows/CCA.exe', 'windows/resources/app.asar', 'windows/portable.txt', 'Start CCA.cmd', 'source/package.json', 'source/LICENSE'}
    if not required.issubset(archive.namelist()):
        raise SystemExit('Archive is missing required files.')
temporary.replace(output)
hash_value = hashlib.file_digest(output.open('rb'), 'sha256').hexdigest()
output.with_suffix('.zip.sha256').write_text(hash_value + '  cca.zip\n')
print(f'Created {output} ({output.stat().st_size:,} bytes)')
print(f'SHA-256: {hash_value}')

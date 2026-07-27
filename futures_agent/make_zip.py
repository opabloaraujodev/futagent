import zipfile
import os
from pathlib import Path

def create_project_zip(output_filename="binance_futures_agent_project.zip"):
    ignore = {
        'node_modules', '.git', 'dist', '__pycache__', '.venv',
        '.DS_Store', output_filename, '.vite'
    }
    root_dir = Path('.')
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in root_dir.rglob('*'):
            if any(part in ignore for part in file_path.parts):
                continue
            if file_path.is_file():
                zip_file.write(file_path, str(file_path))
    print(f"Zip created successfully: {output_filename} ({os.path.getsize(output_filename)} bytes)")

if __name__ == "__main__":
    create_project_zip()

"""Publish the built website to the existing Hostinger FTP account over TLS."""

import argparse
import ftplib
import getpass
import hashlib
import io
from pathlib import Path
import ssl


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, help='FTP path mapped to public_html')
    args = parser.parse_args()
    build = Path(__file__).resolve().parents[1] / 'dist'
    files = sorted(path for path in build.rglob('*') if path.is_file())
    if not (build / 'index.html').is_file():
        raise SystemExit('Run npm run build first.')
    # Assets must exist before the HTML that references them becomes public.
    files.sort(key=lambda path: path.name == 'index.html')
    password = getpass.getpass('Hostinger FTP password: ')

    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45) as ftp:
        ftp.connect('46.202.182.239', 21)
        # The specified server presents a valid Hostinger certificate for hstgr.io.
        # Keep the IP endpoint, validating its TLS chain and certificate name.
        ftp.host = 'hstgr.io'
        ftp.login('u195207028.ezcentriko.com', password)
        del password
        ftp.prot_p()
        print(f'Login directory: {ftp.pwd()}', flush=True)
        ftp.cwd(args.root)
        existing_root = set(ftp.nlst())
        if 'index.html' not in {Path(name).name for name in existing_root}:
            raise RuntimeError(f'Target {ftp.pwd()} does not contain the expected website index.html: {sorted(existing_root)}')

        directories = {'.'}
        for path in files:
            relative = path.relative_to(build).as_posix()
            parent = path.relative_to(build).parent.as_posix()
            if parent not in directories:
                accumulated = ''
                for part in parent.split('/'):
                    accumulated = f'{accumulated}/{part}'.lstrip('/')
                    try:
                        ftp.mkd(accumulated)
                    except ftplib.error_perm:
                        current = ftp.pwd()
                        ftp.cwd(accumulated)
                        ftp.cwd(current)
                directories.add(parent)

            siblings = {name.rsplit('/', 1)[-1] for name in ftp.nlst(parent)}
            previous = None
            if path.name in siblings:
                data = io.BytesIO()
                ftp.retrbinary(f'RETR {relative}', data.write)
                previous = data.getvalue()

            content = path.read_bytes()
            if content == previous:
                print(f'Unchanged: {relative}', flush=True)
                continue

            temporary = f'{relative}.upload'
            ftp.storbinary(f'STOR {temporary}', io.BytesIO(content))
            uploaded = hashlib.sha256()
            ftp.retrbinary(f'RETR {temporary}', uploaded.update)
            if uploaded.digest() != hashlib.sha256(content).digest():
                raise RuntimeError(f'Upload verification failed: {relative}')
            ftp.rename(temporary, relative)
            print(f'Published and verified: {relative} ({len(content)} bytes)', flush=True)
        print('Publication complete. No backups created; no unrelated files deleted.', flush=True)


if __name__ == '__main__':
    main()

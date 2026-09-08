import concurrent.futures, hashlib, io, json, pathlib, re, urllib.request
from pypdf import PdfReader

out = pathlib.Path('.release-work/sources')
out.mkdir(parents=True, exist_ok=True)
sources = [
 {'id': 'lopdp-doc', 'url': 'https://spdp.gob.ec/wp-content/uploads/2024/12/03.pdf.pdf'},
 {'id': 'reglamento-lopdp-doc', 'url': 'https://spdp.gob.ec/wp-content/uploads/2024/12/04.pdf.pdf'},
]
def fetch(source):
    url = source['url']
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read(20_000_000)
            final_url = response.url
        if content.startswith(b'%PDF'):
            text = '\n'.join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)
            frames = []
        else:
            html = content.decode('utf-8', errors='replace')
            frames = re.findall(r'(?:src|href)=[\"\x27]([^\"\x27]+\.pdf[^\"\x27]*)', html)
            text = re.sub('<[^>]+>', ' ', html)
            text = re.sub(r'\s+', ' ', text)
        (out / (source['id'] + '.txt')).write_text(text, encoding='utf-8')
        result = {'id': source['id'], 'url': url, 'finalUrl': final_url, 'sha256': hashlib.sha256(content).hexdigest(), 'frames': frames, 'length': len(text)}
        (out / (source['id'] + '.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
        return result
    except Exception as error:
        return {'id': source['id'], 'error': str(error)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    for result in pool.map(fetch, sources):
        print(json.dumps(result), flush=True)

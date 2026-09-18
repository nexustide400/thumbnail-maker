const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
let sourceImage = null;
let sourceName = 'image';
let ratio = 'landscape';
// Ignore stale image loads after replacement or clearing.
let loadVersion = 0;

function cropGeometry(width, height, mode, value) {
  const [rw, rh] = mode === 'landscape' ? [16, 9] : [9, 16];
  // Integer multiples preserve the exact ratio without resampling pixels.
  const unit = Math.floor(Math.min(width / rw, height / rh));
  if (unit < 1) return null;
  const w = unit * rw, h = unit * rh;
  const horizontal = width / height > rw / rh;
  const x = Math.round((width - w) * (horizontal ? value / 100 : .5));
  const y = Math.round((height - h) * (horizontal ? .5 : value / 100));
  return {w, h, x, y, horizontal, overflow: horizontal ? width - w : height - h};
}

function render() {
  if (!sourceImage) return;
  const width = sourceImage.naturalWidth, height = sourceImage.naturalHeight;
  const crop = cropGeometry(width, height, ratio, Number($('position').value));
  $('sourceSize').textContent = `${width} × ${height}`;
  if (!crop) {
    $('previewWrap').hidden = true;
    $('downloadButton').disabled = true;
    $('position').disabled = true;
    $('positionLabel').textContent = '中央';
    $('startLabel').textContent = '上 / 左';
    $('endLabel').textContent = '下 / 右';
    $('outputSize').textContent = '—';
    $('notice').textContent = 'この比率で切り抜くには画像が小さすぎます。別の画像か比率を選んでください。';
    return;
  }
  canvas.width = crop.w;
  canvas.height = crop.h;
  ctx.drawImage(sourceImage, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  $('previewWrap').hidden = false;
  $('downloadButton').disabled = false;
  $('position').disabled = crop.overflow === 0;
  const v = Number($('position').value);
  $('positionLabel').textContent = v === 50 || !crop.overflow ? '中央' : `${crop.horizontal ? (v < 50 ? '左' : '右') : (v < 50 ? '上' : '下')}寄せ ${Math.abs(v - 50) * 2}%`;
  $('startLabel').textContent = crop.horizontal ? '左' : '上';
  $('endLabel').textContent = crop.horizontal ? '右' : '下';
  $('outputSize').textContent = `${crop.w} × ${crop.h}`;
  $('notice').textContent = width === crop.w && height === crop.h ? 'すでに選択した比率です。そのまま保存できます。' : '元のピクセルをそのまま使用。正確な比率に合わせて、端の数pxも切り抜く場合があります。';
}

async function loadFile(file) {
  if (!file) return;
  const version = ++loadVersion;
  if (!file.type.startsWith('image/')) {
    $('notice').textContent = '画像ファイルを選んでください。';
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
    if (version !== loadVersion) return;
    sourceImage = img;
    sourceName = file.name.replace(/\.[^.]+$/, '') || 'image';
    $('filename').textContent = file.name;
    $('filename').title = file.name;
    $('emptyState').hidden = true;
    $('removeButton').disabled = false;
    $('position').value = 50;
    render();
  } catch {
    if (version === loadVersion) $('notice').textContent = 'この画像を読み込めませんでした。別の画像をお試しください。';
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clearImage() {
  ++loadVersion;
  sourceImage = null;
  sourceName = 'image';
  canvas.width = 0;
  canvas.height = 0;
  $('fileInput').value = '';
  $('emptyState').hidden = false;
  $('previewWrap').hidden = true;
  $('position').value = 50;
  $('position').disabled = true;
  $('positionLabel').textContent = '中央';
  $('startLabel').textContent = '上 / 左';
  $('endLabel').textContent = '下 / 右';
  $('filename').textContent = '画像が選択されていません';
  $('filename').title = '';
  $('sourceSize').textContent = '—';
  $('outputSize').textContent = '—';
  $('downloadButton').disabled = true;
  $('removeButton').disabled = true;
  $('notice').textContent = '拡大・縮小せず、選んだ比率で切り抜きます。';
}

for (const id of ['pickButton', 'replaceButton']) {
  $(id).addEventListener('click', () => $('fileInput').click());
}
$('fileInput').addEventListener('change', event => {
  loadFile(event.target.files[0]);
  event.target.value = '';
});
$('position').addEventListener('input', render);
$('removeButton').addEventListener('click', clearImage);

document.querySelectorAll('[data-ratio]').forEach(button => button.addEventListener('click', () => {
  ratio = button.dataset.ratio;
  $('position').value = 50;
  document.querySelectorAll('[data-ratio]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));

for (const type of ['dragenter', 'dragover']) {
  $('dropZone').addEventListener(type, event => {
    event.preventDefault();
    $('dropZone').classList.add('is-over');
  });
}

for (const type of ['dragleave', 'drop']) {
  $('dropZone').addEventListener(type, event => {
    event.preventDefault();
    $('dropZone').classList.remove('is-over');
  });
}
$('dropZone').addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));
$('downloadButton').addEventListener('click', () => {
  if (!sourceImage || $('downloadButton').disabled) return;
  const name = `${sourceName}-${ratio === 'landscape' ? '16x9' : '9x16'}-${canvas.width}x${canvas.height}.png`;
  canvas.toBlob(blob => {
    if (!blob) {
      $('notice').textContent = '保存用画像を作成できませんでした。';
      return;
    }
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

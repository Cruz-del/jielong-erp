/**
 * 捷隆纺织 - 文件预览/下载通用模块
 * 支持：图片预览（灯箱）、PDF预览、其他文件下载
 *
 * 使用：FileViewer.preview(url, fileName)
 *       FileViewer.download(url, fileName)
 */

const FileViewer = (function() {
  'use strict';

  const IMG_EXTS = ['.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg'];
  const PDF_EXT = '.pdf';

  function isImage(url, name) {
    const n = (name || url || '').toLowerCase();
    return IMG_EXTS.some(ext => n.endsWith(ext)) || url.startsWith('data:image/');
  }

  function isPDF(url, name) {
    return (name || url || '').toLowerCase().endsWith(PDF_EXT);
  }

  /** 预览文件：图片→灯箱，PDF→灯箱内嵌，其他→下载 */
  function preview(url, fileName) {
    if (!url) return;
    if (isImage(url, fileName)) {
      showImageLightbox(url, fileName);
    } else if (isPDF(url, fileName)) {
      showPDFLightbox(url, fileName);
    } else {
      download(url, fileName);
    }
  }

  /** PDF灯箱（内嵌预览+下载按钮） */
  function showPDFLightbox(url, title) {
    const old = document.getElementById('fileViewerLightbox');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fileViewerLightbox';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;
      display:flex;flex-direction:column;animation:fadeIn .2s ease;
    `;
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,.05)">
        <span style="color:#fff;font-size:13px;font-weight:500">${title||'PDF 预览'}</span>
        <div style="display:flex;gap:8px">
          <button id="fvPdfDownload" style="padding:6px 14px;border-radius:6px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:13px;cursor:pointer"><i class="fas fa-download"></i> 下载</button>
          <button id="fvPdfNewTab" style="padding:6px 14px;border-radius:6px;background:rgba(255,255,255,.1);border:none;color:#fff;font-size:13px;cursor:pointer"><i class="fas fa-external-link-alt"></i> 新标签打开</button>
          <button id="fvCloseBtnPdf" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:18px;cursor:pointer"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <iframe src="${url}" style="flex:1;width:100%;border:none;background:#525659" onerror="this.style.display='none';document.getElementById('fvPdfError').style.display='flex'"></iframe>
      <div id="fvPdfError" style="display:none;flex:1;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#fff">
        <i class="fas fa-exclamation-triangle" style="font-size:40px;color:#f59e0b"></i>
        <p style="margin:0;font-size:15px">PDF 无法在线预览</p>
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,.5)">可能是浏览器限制，请下载后查看</p>
        <button onclick="document.querySelector('#fvPdfDownload').click()" style="padding:10px 24px;border-radius:8px;background:#3b82f6;color:#fff;border:none;font-size:14px;cursor:pointer;margin-top:4px"><i class="fas fa-download"></i> 下载文件</button>
      </div>
    `;

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('#fvCloseBtnPdf').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#fvPdfDownload').addEventListener('click', (e) => {
      e.stopPropagation();
      download(url, title);
    });
    overlay.querySelector('#fvPdfNewTab').addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(url, '_blank');
    });

    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
  }

  /** 下载文件（支持跨域URL） */
  function download(url, fileName) {
    // 对于远程URL（Supabase等），使用fetch+blob绕过跨域下载限制
    if (url.startsWith('http')) {
      fetch(url, { mode: 'cors' })
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName || 'download';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 100);
        })
        .catch(() => {
          // fetch 失败，回退到直接打开
          window.open(url + '?download', '_blank');
        });
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
    }
  }

  /** 图片灯箱 */
  function showImageLightbox(url, title) {
    // 移除旧灯箱
    const old = document.getElementById('fileViewerLightbox');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fileViewerLightbox';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      animation:fadeIn .2s ease;
    `;
    overlay.innerHTML = `
      <div style="position:absolute;top:16px;right:16px;display:flex;gap:12px;z-index:1">
        <button id="fvDownloadBtn" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:18px;cursor:pointer"><i class="fas fa-download"></i></button>
        <button id="fvCloseBtn" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:20px;cursor:pointer"><i class="fas fa-times"></i></button>
      </div>
      <img src="${url}" alt="${title||''}" style="max-width:95%;max-height:85vh;object-fit:contain;border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,.5)">
      ${title ? `<p style="color:rgba(255,255,255,.7);font-size:13px;margin-top:12px">${title}</p>` : ''}
    `;

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('#fvCloseBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#fvDownloadBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      download(url, title);
      if (typeof Toast !== 'undefined') Toast.info('正在下载...');
    });

    // ESC 关闭
    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);

    // 注入 Font Awesome（如果页面没有）
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const fa = document.createElement('link');
      fa.rel = 'stylesheet';
      fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
      document.head.appendChild(fa);
    }

    // 注入动画
    if (!document.getElementById('fv-anim')) {
      const style = document.createElement('style');
      style.id = 'fv-anim';
      style.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}';
      document.head.appendChild(style);
    }
  }

  /** 为文件列表中的每个文件渲染预览/下载按钮 */
  function renderFileActions(fileUrl, fileName) {
    return `
      <button onclick="FileViewer.preview('${fileUrl}','${fileName}')" title="预览" style="border:none;background:#eff4ff;color:#2563eb;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:13px"><i class="fas fa-eye"></i></button>
      <button onclick="FileViewer.download('${fileUrl}','${fileName}')" title="下载" style="border:none;background:#ecfdf5;color:#10b981;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:13px"><i class="fas fa-download"></i></button>
    `;
  }

  console.log('🖼️ FileViewer 已加载（图片灯箱 + PDF预览 + 下载）');
  return { preview, download, renderFileActions, isImage, isPDF };
})();

window.FileViewer = FileViewer;

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeBtn');
  const copyBtn = document.getElementById('copyBtn');
  const detailContent = document.getElementById('detailContent');
  
  let currentContent = '';
  
  // 接收来自侧边栏的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_DETAIL') {
      renderDetail(message.data);
      currentContent = message.data.content;
    }
  });
  
  // 渲染详情
  function renderDetail(data) {
    let html = '';
    
    if (data.prompt) {
      html += `
        <div class="prompt-section">
          <h3>提问</h3>
          <div class="prompt-text">${escapeHtml(data.prompt)}</div>
        </div>
      `;
    }
    
    html += `
      <div class="response-section">
        <h3>回答</h3>
        <div class="markdown-content">${marked.parse(data.content || '')}</div>
      </div>
    `;
    
    detailContent.innerHTML = html;
  }
  
  // 关闭按钮
  closeBtn.addEventListener('click', () => {
    window.close();
  });
  
  // 复制按钮
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentContent).then(() => {
      showToast('已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
      showToast('复制失败', 'error');
    });
  });
  
  // 显示Toast提示
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    if (type === 'error') {
      toast.style.backgroundColor = 'var(--destructive)';
    } else {
      toast.style.backgroundColor = 'var(--foreground)';
      toast.style.color = 'var(--background)';
    }
    
    toast.style.cssText = `
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-size: 0.875rem;
      z-index: 1000;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }
  
  // 辅助函数：HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
});

// side-panel.js - 侧边栏逻辑

let conversations = [];
let prompts = [];
let currentTab = 'conversations';
let isSidePanelOpen = false;

// 与background建立连接
const port = chrome.runtime.connect({ name: 'sidepanel' });

// 监听来自background的消息
port.onMessage.addListener((message) => {
  if (message.type === 'INITIAL_DATA') {
    conversations = message.data;
    renderConversations();
  } else if (message.type === 'NEW_CONVERSATION') {
    addConversation(message.data);
  } else if (message.type === 'UPDATE_CONVERSATION') {
    updateConversation(message.data);
  } else if (message.type === 'CONVERSATION_COMPLETE') {
    completeConversation(message.data);
  } else if (message.type === 'CONVERSATION_INTERRUPTED') {
    interruptConversation(message.data);
  }
});

// 监听runtime消息（用于其他来源的通知）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_CONVERSATION') {
    addConversation(message.data);
  } else if (message.type === 'UPDATE_CONVERSATION') {
    updateConversation(message.data);
  } else if (message.type === 'CONVERSATION_COMPLETE') {
    completeConversation(message.data);
  } else if (message.type === 'CONVERSATION_INTERRUPTED') {
    interruptConversation(message.data);
  } else if (message.type === 'PLAY_NOTIFICATION_SOUND') {
    playNotificationSound();
  } else if (message.type === 'PROMPTS_UPDATED') {
    prompts = message.prompts;
    renderPrompts();
  }
});

// Tab切换
document.getElementById('tabConversations').addEventListener('click', () => switchTab('conversations'));
document.getElementById('tabPrompts').addEventListener('click', () => switchTab('prompts'));

function switchTab(tab) {
  currentTab = tab;
  
  // 更新tab按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  // 切换内容区域
  const conversationsTab = document.getElementById('conversationsTab');
  const promptsTab = document.getElementById('promptsTab');
  const addPromptBtn = document.getElementById('addPromptBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  if (tab === 'conversations') {
    conversationsTab.style.display = 'flex';
    promptsTab.style.display = 'none';
    addPromptBtn.style.display = 'none';
    refreshBtn.style.display = 'flex';
  } else {
    conversationsTab.style.display = 'none';
    promptsTab.style.display = 'flex';
    addPromptBtn.style.display = 'flex';
    refreshBtn.style.display = 'none';
    renderPrompts();
  }
}

// 添加新对话
function addConversation(conversation) {
  const existingIndex = conversations.findIndex(c => c.id === conversation.id);
  if (existingIndex === -1) {
    conversation.status = conversation.status || 'in_progress';
    conversation.timestamp = conversation.timestamp || Date.now();
    conversation.content = conversation.content || '';
    conversations.unshift(conversation);
    renderConversations();
  } else {
    conversations[existingIndex] = { ...conversations[existingIndex], ...conversation };
    updateCardContent(conversation.id, conversation.content);
    updateCardStatus(conversation.id, conversation.status);
  }
}

// 更新对话
function updateConversation(conversation) {
  const index = conversations.findIndex(c => c.id === conversation.id);
  if (index !== -1) {
    conversations[index] = { ...conversations[index], ...conversation };
    updateCardContent(conversation.id, conversation.content);
    if (conversation.status) {
      updateCardStatus(conversation.id, conversation.status);
    }
  }
}

// 完成对话
function completeConversation(conversation) {
  const index = conversations.findIndex(c => c.id === conversation.id);
  if (index !== -1) {
    conversations[index] = { ...conversations[index], ...conversation };
    updateCardStatus(conversation.id, 'completed');
    updateCardContent(conversation.id, conversation.content);
  }
}

// 中断对话
function interruptConversation(conversation) {
  const index = conversations.findIndex(c => c.id === conversation.id);
  if (index !== -1) {
    conversations[index] = { ...conversations[index], ...conversation };
    updateCardStatus(conversation.id, 'interrupted');
  }
}

// 渲染所有对话
function renderConversations() {
  const container = document.getElementById('conversationsList');
  const emptyState = document.getElementById('emptyState');

  const cards = container.querySelectorAll('.card');
  cards.forEach(card => card.remove());

  if (conversations.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  conversations.sort((a, b) => b.timestamp - a.timestamp);

  conversations.forEach(conversation => {
    const card = createCard(conversation);
    container.appendChild(card);
  });
}

// 创建卡片元素
function createCard(conversation) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${conversation.id}`;
  card.dataset.conversationId = conversation.id;
  card.dataset.expanded = 'false';

  const time = formatTime(conversation.timestamp);
  const statusClass = getStatusClass(conversation.status);
  const displayContent = conversation.editedContent || conversation.content;
  const isLongContent = displayContent.length > 300;
  const isLongPrompt = conversation.prompt && conversation.prompt.length > 100;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-status">
        <div class="status-indicator ${statusClass}"></div>
        <span class="status-text">${getStatusText(conversation.status)}</span>
      </div>
      <span class="card-time">${time}</span>
    </div>
    ${conversation.prompt ? `
      <div class="card-prompt">
        <div class="prompt-content" id="prompt-${conversation.id}">${escapeHtml(conversation.prompt)}</div>
        ${isLongPrompt ? `
          <div class="prompt-expand-toggle" id="prompt-expand-${conversation.id}" data-expanded="false">
            <span class="expand-text">展开</span>
            <svg class="expand-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        ` : ''}
      </div>
    ` : ''}
    <div class="card-content" id="content-${conversation.id}">
      <div class="display-content markdown-content" id="display-content-${conversation.id}">${marked.parse(displayContent)}</div>
      <div class="edit-content" style="display: none;">
        <textarea class="textarea" id="textarea-${conversation.id}">${escapeHtml(displayContent)}</textarea>
        <div class="edit-actions">
          <button class="btn btn-cancel" data-id="${conversation.id}">取消</button>
          <button class="btn btn-primary" data-id="${conversation.id}">保存</button>
        </div>
      </div>
    </div>
    ${isLongContent ? `
      <div class="expand-toggle" id="expand-${conversation.id}" data-expanded="false">
        <span class="expand-text">查看详情</span>
        <svg class="expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    ` : ''}
    <div class="card-footer">
      <div class="card-actions">
        <button class="btn btn-icon-small" id="copy-${conversation.id}" title="复制">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        ${conversation.status === 'completed' ? `
          <button class="btn btn-icon-small" id="edit-${conversation.id}" title="编辑">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        ` : ''}
        <button class="btn btn-icon-small btn-destructive" id="delete-${conversation.id}" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  bindCardEvents(card, conversation);

  if (isLongContent) {
    const displayContentDiv = card.querySelector(`#display-content-${conversation.id}`);
    displayContentDiv.style.maxHeight = '100px';
    displayContentDiv.style.overflow = 'hidden';
  }

  if (isLongPrompt) {
    const promptContentDiv = card.querySelector(`#prompt-${conversation.id}`);
    promptContentDiv.style.maxHeight = '60px';
    promptContentDiv.style.overflow = 'hidden';
  }

  return card;
}

// 绑定卡片事件
function bindCardEvents(card, conversation) {
  const copyBtn = card.querySelector(`#copy-${conversation.id}`);
  copyBtn.addEventListener('click', () => copyToClipboard(conversation.id));

  const editBtn = card.querySelector(`#edit-${conversation.id}`);
  if (editBtn) {
    editBtn.addEventListener('click', () => enterEditMode(conversation.id));
  }

  const saveBtn = card.querySelector('.edit-actions .btn-primary');
  const cancelBtn = card.querySelector('.edit-actions .btn-cancel');
  if (saveBtn && cancelBtn) {
    saveBtn.addEventListener('click', () => saveEdit(conversation.id));
    cancelBtn.addEventListener('click', () => cancelEdit(conversation.id));
  }

  const deleteBtn = card.querySelector(`#delete-${conversation.id}`);
  deleteBtn.addEventListener('click', () => deleteConversation(conversation.id));

  const expandBtn = card.querySelector(`#expand-${conversation.id}`);
  if (expandBtn) {
    expandBtn.addEventListener('click', () => showDetail(conversation.id));
  }

  const promptExpandBtn = card.querySelector(`#prompt-expand-${conversation.id}`);
  if (promptExpandBtn) {
    promptExpandBtn.addEventListener('click', () => togglePromptExpand(conversation.id));
  }
}

// 更新卡片状态
function updateCardStatus(conversationId, status) {
  const card = document.getElementById(`card-${conversationId}`);
  if (!card) return;

  const indicator = card.querySelector('.status-indicator');
  const statusText = card.querySelector('.status-text');

  if (indicator) {
    indicator.className = `status-indicator ${getStatusClass(status)}`;
  }

  if (statusText) {
    statusText.textContent = getStatusText(status);
  }
}

// 更新卡片内容
function updateCardContent(conversationId, content) {
  const card = document.getElementById(`card-${conversationId}`);
  if (!card) return;

  const displayContentDiv = card.querySelector(`#display-content-${conversationId}`);
  if (displayContentDiv) {
    displayContentDiv.innerHTML = marked.parse(content || '');
    
    const isExpanded = card.dataset.expanded === 'true';
    const expandBtn = card.querySelector(`#expand-${conversationId}`);
    
    if (expandBtn && !isExpanded) {
      displayContentDiv.style.maxHeight = '100px';
      displayContentDiv.style.overflow = 'hidden';
    } else {
      displayContentDiv.style.maxHeight = 'none';
      displayContentDiv.style.overflow = 'auto';
    }
  }

  const textarea = card.querySelector('.textarea');
  if (textarea && !textarea.dataset.isEditing) {
    textarea.value = content;
  }
}

// 显示详情页面
function showDetail(conversationId) {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  chrome.tabs.create({
    url: chrome.runtime.getURL('detail.html'),
    active: true
  }, (tab) => {
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_DETAIL',
        data: {
          prompt: conversation.prompt,
          content: conversation.editedContent || conversation.content
        }
      });
    }, 100);
  });
}

// 复制到剪贴板
function copyToClipboard(conversationId) {
  const conversation = conversations.find(c => c.id === conversationId);
  if (!conversation) return;

  const content = conversation.editedContent || conversation.content;
  
  navigator.clipboard.writeText(content).then(() => {
    showToast('已复制到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败', 'error');
  });
}

// 进入编辑模式
function enterEditMode(conversationId) {
  const card = document.getElementById(`card-${conversationId}`);
  if (!card) return;

  const displayContent = card.querySelector('.display-content');
  const editContent = card.querySelector('.edit-content');
  const textarea = card.querySelector('.textarea');

  if (displayContent && editContent && textarea) {
    displayContent.style.display = 'none';
    editContent.style.display = 'block';
    textarea.focus();
    textarea.dataset.isEditing = 'true';
  }
}

// 保存编辑
function saveEdit(conversationId) {
  const card = document.getElementById(`card-${conversationId}`);
  if (!card) return;

  const textarea = card.querySelector('.textarea');
  if (!textarea) return;

  const newContent = textarea.value;
  
  const conversation = conversations.find(c => c.id === conversationId);
  if (conversation) {
    conversation.editedContent = newContent;
  }

  chrome.runtime.sendMessage({
    type: 'UPDATE_EDITED_CONTENT',
    data: {
      conversationId: conversationId,
      content: newContent
    }
  });

  const displayContent = card.querySelector('.display-content');
  const editContent = card.querySelector('.edit-content');

  if (displayContent && editContent) {
    displayContent.innerHTML = marked.parse(newContent);
    displayContent.style.display = 'block';
    editContent.style.display = 'none';
    delete textarea.dataset.isEditing;
  }

  showToast('已保存');
}

// 取消编辑
function cancelEdit(conversationId) {
  const card = document.getElementById(`card-${conversationId}`);
  if (!card) return;

  const conversation = conversations.find(c => c.id === conversationId);
  const originalContent = conversation ? (conversation.editedContent || conversation.content) : '';

  const displayContent = card.querySelector('.display-content');
  const editContent = card.querySelector('.edit-content');
  const textarea = card.querySelector('.textarea');

  if (displayContent && editContent && textarea) {
    textarea.value = originalContent;
    displayContent.style.display = 'block';
    editContent.style.display = 'none';
    delete textarea.dataset.isEditing;
  }
}

// 删除对话
function deleteConversation(conversationId) {
  if (confirm('确认删除此条记录？')) {
    chrome.runtime.sendMessage({
      type: 'DELETE_CONVERSATION',
      conversationId: conversationId
    }, (response) => {
      if (response && response.success) {
        conversations = conversations.filter(c => c.id !== conversationId);
        const card = document.getElementById(`card-${conversationId}`);
        if (card) {
          card.remove();
        }
        
        if (conversations.length === 0) {
          document.getElementById('emptyState').style.display = 'flex';
        }
        
        showToast('已删除');
      }
    });
  }
}

// 显示提示消息
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
    color: var(--primary-foreground);
    font-size: 0.875rem;
    z-index: 1000;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    animation: slideUp 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(1rem);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @keyframes slideDown {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(1rem);
    }
  }
`;
document.head.appendChild(style);

// 辅助函数：格式化时间
function formatTime(timestamp) {
  if (!timestamp || isNaN(timestamp) || typeof timestamp !== 'number') {
    return '刚刚';
  }
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (isNaN(date.getTime())) {
    return '刚刚';
  }
  
  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// 辅助函数：获取状态类名
function getStatusClass(status) {
  switch (status) {
    case 'in_progress':
      return 'in-progress';
    case 'completed':
      return 'completed';
    case 'interrupted':
      return 'interrupted';
    default:
      return '';
  }
}

// 辅助函数：获取状态文本
function getStatusText(status) {
  switch (status) {
    case 'in_progress':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'interrupted':
      return '已中断';
    default:
      return '未知';
  }
}

// 辅助函数：HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// 展开/折叠Prompt
function togglePromptExpand(conversationId) {
  const card = document.getElementById(`card-${conversationId}`);
  if (!card) return;

  const promptContentDiv = card.querySelector(`#prompt-${conversationId}`);
  const promptExpandBtn = card.querySelector(`#prompt-expand-${conversationId}`);
  if (!promptContentDiv || !promptExpandBtn) return;

  const isExpanded = promptExpandBtn.dataset.expanded === 'true';
  const newExpandedState = !isExpanded;

  promptExpandBtn.dataset.expanded = newExpandedState.toString();

  if (newExpandedState) {
    promptContentDiv.style.maxHeight = 'none';
    promptContentDiv.style.overflow = 'auto';
    promptExpandBtn.querySelector('.expand-text').textContent = '收起';
    promptExpandBtn.querySelector('.expand-icon').style.transform = 'rotate(180deg)';
  } else {
    promptContentDiv.style.maxHeight = '60px';
    promptContentDiv.style.overflow = 'hidden';
    promptExpandBtn.querySelector('.expand-text').textContent = '展开';
    promptExpandBtn.querySelector('.expand-icon').style.transform = 'rotate(0deg)';
  }
}

// 播放通知提示音
async function playNotificationSound() {
  try {
    const result = await chrome.storage.local.get(['customSound']);
    let soundData = result.customSound;
    
    if (soundData) {
      const audio = new Audio(soundData);
      audio.play().catch(err => console.error('Sound play error:', err));
    } else {
      const audio = new Audio(chrome.runtime.getURL('sounds/default-notification.mp3'));
      audio.play().catch(err => console.error('Sound play error:', err));
    }
  } catch (error) {
    console.error('Error playing sound:', error);
  }
}

// 刷新按钮
document.getElementById('refreshBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_CONVERSATIONS' }, (response) => {
    if (response && response.conversations) {
      conversations = response.conversations;
      renderConversations();
    }
  });
});

// 加载提示词
async function loadPrompts() {
  try {
    const result = await chrome.storage.local.get(['prompts']);
    if (result.prompts) {
      prompts = result.prompts;
    } else {
      prompts = [];
    }
  } catch (error) {
    console.error('Error loading prompts:', error);
    prompts = [];
  }
}

// 保存提示词
async function savePrompts() {
  try {
    await chrome.storage.local.set({ prompts: prompts });
  } catch (error) {
    console.error('Error saving prompts:', error);
  }
}

// 渲染提示词列表
function renderPrompts(filterText = '') {
  const container = document.getElementById('promptsList');
  const emptyState = document.getElementById('promptsEmptyState');
  
  const cards = container.querySelectorAll('.prompt-card');
  cards.forEach(card => card.remove());
  
  let filteredPrompts = [...prompts];
  
  if (filterText) {
    const lowerFilter = filterText.toLowerCase();
    filteredPrompts = filteredPrompts.filter(p => 
      p.title.toLowerCase().includes(lowerFilter) || 
      p.content.toLowerCase().includes(lowerFilter)
    );
  }
  
  if (filteredPrompts.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  filteredPrompts.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return b.pinned ? 1 : -1;
    }
    return b.timestamp - a.timestamp;
  });
  
  filteredPrompts.forEach(prompt => {
    const card = createPromptCard(prompt);
    container.appendChild(card);
  });
}

// 创建提示词卡片
function createPromptCard(prompt) {
  const card = document.createElement('div');
  card.className = `prompt-card ${prompt.pinned ? 'pinned' : ''}`;
  card.id = `prompt-card-${prompt.id}`;
  
  card.innerHTML = `
    <div class="prompt-card-header">
      <div class="prompt-card-title">
        ${prompt.pinned ? `
          <div class="pin-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
            </svg>
          </div>
        ` : ''}
        <span>${escapeHtml(prompt.title)}</span>
      </div>
    </div>
    <div class="prompt-card-content">
      <div class="display-content markdown-content" id="prompt-display-${prompt.id}">${marked.parse(prompt.content)}</div>
      <div class="edit-content" style="display: none;">
        <input type="text" class="title-input" id="prompt-title-${prompt.id}" value="${escapeHtml(prompt.title)}" placeholder="提示词标题" style="margin-bottom: 0.5rem; width: 100%; padding: 0.5rem; border: 1px solid var(--input); border-radius: var(--radius); font-size: 0.875rem;">
        <textarea class="textarea" id="prompt-textarea-${prompt.id}" placeholder="提示词内容">${escapeHtml(prompt.content)}</textarea>
        <div class="edit-actions">
          <button class="btn btn-cancel" data-id="${prompt.id}">取消</button>
          <button class="btn btn-primary" data-id="${prompt.id}">保存</button>
        </div>
      </div>
    </div>
    <div class="prompt-card-actions">
      <div class="prompt-actions">
        <button class="btn btn-icon-small" id="prompt-copy-${prompt.id}" title="复制">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="btn btn-icon-small" id="prompt-edit-${prompt.id}" title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn btn-icon-small" id="prompt-pin-${prompt.id}" title="${prompt.pinned ? '取消置顶' : '置顶'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="17" x2="12" y2="22"></line>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
          </svg>
        </button>
        <button class="btn btn-icon-small btn-destructive" id="prompt-delete-${prompt.id}" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  bindPromptCardEvents(card, prompt);
  return card;
}

// 绑定提示词卡片事件
function bindPromptCardEvents(card, prompt) {
  card.querySelector(`#prompt-copy-${prompt.id}`).addEventListener('click', () => copyPrompt(prompt.id));
  card.querySelector(`#prompt-edit-${prompt.id}`).addEventListener('click', () => enterPromptEditMode(prompt.id));
  card.querySelector(`#prompt-pin-${prompt.id}`).addEventListener('click', () => togglePinPrompt(prompt.id));
  card.querySelector(`#prompt-delete-${prompt.id}`).addEventListener('click', () => deletePrompt(prompt.id));
  
  const saveBtn = card.querySelector('.edit-actions .btn-primary');
  const cancelBtn = card.querySelector('.edit-actions .btn-cancel');
  saveBtn.addEventListener('click', () => savePromptEdit(prompt.id));
  cancelBtn.addEventListener('click', () => cancelPromptEdit(prompt.id));
}

// 复制提示词
function copyPrompt(promptId) {
  const prompt = prompts.find(p => p.id === promptId);
  if (!prompt) return;
  
  navigator.clipboard.writeText(prompt.content).then(() => {
    showToast('已复制到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败', 'error');
  });
}

// 进入提示词编辑模式
function enterPromptEditMode(promptId) {
  const card = document.getElementById(`prompt-card-${promptId}`);
  if (!card) return;
  
  const displayContent = card.querySelector('.display-content');
  const editContent = card.querySelector('.edit-content');
  
  if (displayContent && editContent) {
    displayContent.style.display = 'none';
    editContent.style.display = 'block';
    card.querySelector('.title-input').focus();
  }
}

// 保存提示词编辑
function savePromptEdit(promptId) {
  const card = document.getElementById(`prompt-card-${promptId}`);
  if (!card) return;
  
  const titleInput = card.querySelector('.title-input');
  const textarea = card.querySelector('.textarea');
  
  const prompt = prompts.find(p => p.id === promptId);
  if (prompt) {
    prompt.title = titleInput.value;
    prompt.content = textarea.value;
    prompt.timestamp = Date.now();
  }
  
  savePrompts();
  renderPrompts(document.getElementById('promptSearch').value);
  showToast('已保存');
}

// 取消提示词编辑
function cancelPromptEdit(promptId) {
  const card = document.getElementById(`prompt-card-${promptId}`);
  if (!card) return;
  
  const displayContent = card.querySelector('.display-content');
  const editContent = card.querySelector('.edit-content');
  
  if (displayContent && editContent) {
    displayContent.style.display = 'block';
    editContent.style.display = 'none';
  }
}

// 切换提示词置顶
function togglePinPrompt(promptId) {
  const prompt = prompts.find(p => p.id === promptId);
  if (prompt) {
    prompt.pinned = !prompt.pinned;
    savePrompts();
    renderPrompts(document.getElementById('promptSearch').value);
    showToast(prompt.pinned ? '已置顶' : '已取消置顶');
  }
}

// 删除提示词
function deletePrompt(promptId) {
  if (confirm('确认删除此提示词？')) {
    prompts = prompts.filter(p => p.id !== promptId);
    savePrompts();
    renderPrompts(document.getElementById('promptSearch').value);
    showToast('已删除');
  }
}

// 添加提示词
document.getElementById('addPromptBtn').addEventListener('click', () => {
  const title = prompt('请输入提示词标题：') || '未命名提示词';
  if (title === null) return;
  
  const content = prompt('请输入提示词内容：') || '';
  if (content === null) return;
  
  const newPrompt = {
    id: Date.now().toString(),
    title: title,
    content: content,
    timestamp: Date.now(),
    pinned: false
  };
  
  prompts.unshift(newPrompt);
  savePrompts();
  renderPrompts();
  showToast('已添加提示词');
});

// 搜索提示词
document.getElementById('promptSearch').addEventListener('input', (e) => {
  renderPrompts(e.target.value);
});

// 初始化
loadPrompts();
console.log('Side panel loaded');

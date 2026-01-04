// background.js - 后台服务脚本

let conversations = new Map(); // 存储对话状态: conversationId -> {tabId, content, status, timestamp}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_CONVERSATION') {
    handleNewConversation(message.data, sender.tab.id, sendResponse);
  } else if (message.type === 'UPDATE_CONVERSATION') {
    handleUpdateConversation(message.data, sender.tab.id, sendResponse);
  } else if (message.type === 'CONVERSATION_COMPLETE') {
    handleConversationComplete(message.data, sender.tab.id, sendResponse);
  } else if (message.type === 'GET_CONVERSATIONS') {
    sendResponse({ conversations: Array.from(conversations.values()) });
  } else if (message.type === 'DELETE_CONVERSATION') {
    handleDeleteConversation(message.conversationId, sendResponse);
  } else if (message.type === 'UPDATE_EDITED_CONTENT') {
    handleUpdateEditedContent(message.data, sendResponse);
  }
  return true; // 保持消息通道开放以支持异步响应
});

// 处理新对话开始
function handleNewConversation(data, tabId, sendResponse) {
  const conversation = {
    id: data.id,
    tabId: tabId,
    content: '',
    status: 'in_progress', // in_progress, completed, interrupted
    timestamp: Date.now(),
    prompt: data.prompt || '',
    editedContent: null
  };
  
  conversations.set(data.id, conversation);
  saveToStorage();
  
  // 通知侧边栏
  broadcastToSidePanel({
    type: 'NEW_CONVERSATION',
    data: conversation
  });
  
  sendResponse({ success: true });
}

// 处理对话内容更新
function handleUpdateConversation(data, tabId, sendResponse) {
  const conversation = conversations.get(data.id);
  if (conversation) {
    conversation.content = data.content;
    conversation.tabId = tabId;
    conversation.timestamp = Date.now();
    
    // 通知侧边栏更新
    broadcastToSidePanel({
      type: 'UPDATE_CONVERSATION',
      data: conversation
    });
  }
  sendResponse({ success: true });
}

// 处理对话完成
function handleConversationComplete(data, tabId, sendResponse) {
  const conversation = conversations.get(data.id);
  if (conversation) {
    conversation.status = 'completed';
    conversation.content = data.content || conversation.content;
    conversation.timestamp = Date.now();
    
    // 检查是否需要发送提醒（仅在后台标签页完成时）
    checkAndSendNotification(conversation, tabId);
    
    // 通知侧边栏更新
    broadcastToSidePanel({
      type: 'CONVERSATION_COMPLETE',
      data: conversation
    });
  }
  sendResponse({ success: true });
}

// 处理删除对话
function handleDeleteConversation(conversationId, sendResponse) {
  conversations.delete(conversationId);
  saveToStorage();
  sendResponse({ success: true });
}

// 处理编辑内容更新
function handleUpdateEditedContent(data, sendResponse) {
  const conversation = conversations.get(data.conversationId);
  if (conversation) {
    conversation.editedContent = data.content;
    saveToStorage();
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: 'Conversation not found' });
  }
}

// 检查并发送通知
async function checkAndSendNotification(conversation, currentTabId) {
  try {
    // 检查标签页是否处于后台
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
    
    if (!activeTab || activeTab.id !== currentTabId) {
      // 标签页不在前台，发送通知
      await sendNotification(conversation);
    }
    
    // 通过消息通知侧边栏播放提示音
    broadcastToSidePanel({
      type: 'PLAY_NOTIFICATION_SOUND'
    });
  } catch (error) {
    console.error('Error checking tab status:', error);
  }
}

// 发送系统通知
async function sendNotification(conversation) {
  const content = conversation.content.substring(0, 50) + (conversation.content.length > 50 ? '...' : '');
  
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'DeepSeek 回复已完成',
    message: content,
    priority: 2,
    requireInteraction: false
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Notification error:', chrome.runtime.lastError);
    }
  });
}

// 播放通知提示音（此函数已废弃，现在由side-panel处理）
async function playNotificationSound() {
  // 不再使用，声音播放已移至side-panel
}

// 广播消息到侧边栏
function broadcastToSidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // 侧边栏可能未打开，忽略错误
  });
}

// 保存到本地存储
async function saveToStorage() {
  const data = Array.from(conversations.values());
  await chrome.storage.local.set({ conversations: data });
}

// 从本地存储加载
async function loadFromStorage() {
  const result = await chrome.storage.local.get(['conversations']);
  if (result.conversations) {
    conversations = new Map(result.conversations.map(conv => [conv.id, conv]));
  }
}

// 监听通知点击事件
chrome.notifications.onClicked.addListener((notificationId) => {
  // 找到最新的完成对话
  const completedConvos = Array.from(conversations.values())
    .filter(c => c.status === 'completed')
    .sort((a, b) => b.timestamp - a.timestamp);
  
  if (completedConvos.length > 0) {
    const latest = completedConvos[0];
    chrome.tabs.get(latest.tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting tab:', chrome.runtime.lastError);
        return;
      }
      if (tab) {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });
  }
});

// 监听标签页关闭事件，标记对应对话为中断
chrome.tabs.onRemoved.addListener((tabId) => {
  conversations.forEach((conv, id) => {
    if (conv.tabId === tabId && conv.status === 'in_progress') {
      conv.status = 'interrupted';
      broadcastToSidePanel({
        type: 'CONVERSATION_INTERRUPTED',
        data: conv
      });
    }
  });
  saveToStorage();
});

// 监听标签页更新事件（刷新等）
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    conversations.forEach((conv, id) => {
      if (conv.tabId === tabId && conv.status === 'in_progress') {
        conv.status = 'interrupted';
        broadcastToSidePanel({
          type: 'CONVERSATION_INTERRUPTED',
          data: conv
        });
      }
    });
    saveToStorage();
  }
});

// 监听侧边栏或主页打开事件
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel' || port.name === 'index') {
    // 发送当前所有对话给侧边栏/主页
    port.postMessage({
      type: 'INITIAL_DATA',
      data: Array.from(conversations.values())
    });
  }
});

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  loadFromStorage();
  console.log('DeepSeek Notification Extension installed');
});

// 启动时加载存储的数据
loadFromStorage();

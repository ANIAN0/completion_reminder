// content-script.js - 注入到DeepSeek页面的脚本

(function() {
  let currentConversationId = null;
  let observer = null;
  let lastContent = '';
  let completionTimeout = null;
  let isMonitoring = false;
  let messageCheckInterval = null; // 定期检查消息的定时器
  let messageElementsCount = 0; // 消息元素数量

  console.log('[DeepSeek Extension] Script loaded');

  // 初始化监听
  function initMonitoring() {
    if (isMonitoring) return;
    isMonitoring = true;

    console.log('[DeepSeek Extension] Initializing monitoring...');

    // 监听DOM变化
    setupMutationObserver();
    
    // 监听发送按钮点击
    setupSendButtonObserver();
    
    console.log('[DeepSeek Extension] Monitoring started');
  }

  // 设置MutationObserver监听消息变化
  function setupMutationObserver() {
    const observerConfig = {
      childList: true,
      subtree: true,
      characterData: true
    };

    observer = new MutationObserver((mutations) => {
      if (!currentConversationId) return;
      
      // 检查消息数量变化
      checkMessageChanges();
    });

    // 从body开始监听
    observer.observe(document.body, observerConfig);
  }

  // 检查消息变化
  function checkMessageChanges() {
    if (!currentConversationId) return;

    // 获取所有消息元素
    const allMessages = document.querySelectorAll('[class*="message"], [role="assistant"], [role="user"]');
    const currentCount = allMessages.length;
    
    if (currentCount > messageElementsCount) {
      // 有新消息
      messageElementsCount = currentCount;
      console.log('[DeepSeek Extension] New message detected, total:', currentCount);
      
      // 检查最新的assistant回复
      checkLatestAssistantMessage();
    }
  }

  // 获取最新的assistant消息
  function checkLatestAssistantMessage() {
    // 尝试多种选择器
    const selectors = [
      '[role="assistant"]',
      '[class*="assistant"]',
      '[data-message-role="assistant"]',
      '[data-testid*="assistant"]',
      '.assistant-message'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      console.log('[DeepSeek Extension] Found', elements.length, 'elements with selector:', selector);
      
      if (elements.length > 0) {
        const latestElement = elements[elements.length - 1];
        const content = (latestElement.textContent || latestElement.innerText || '').trim();
        
        console.log('[DeepSeek Extension] Latest message content length:', content.length);
        
        if (content && content !== lastContent) {
          lastContent = content;
          console.log('[DeepSeek Extension] Content updated, new length:', content.length);
          handleContentUpdate(content);
        }
        return;
      }
    }
    
    // 如果找不到特定选择器，尝试通用方法
    const allMessages = document.querySelectorAll('[class*="message"]');
    console.log('[DeepSeek Extension] Using generic selector, found', allMessages.length, 'messages');
    
    if (allMessages.length > 0) {
      // 尝试找出assistant消息（通常是偶数索引或根据样式判断）
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        const text = (msg.textContent || msg.innerText || '').trim();
        if (text && text.length > 10) { // 假设assistant回复较长
          console.log('[DeepSeek Extension] Using generic message, length:', text.length);
          if (text !== lastContent) {
            lastContent = text;
            handleContentUpdate(text);
          }
          return;
        }
      }
    }
  }

  // 监听发送按钮
  function setupSendButtonObserver() {
    console.log('[DeepSeek Extension] Setting up send button observer...');
    
    // 定期查找并绑定发送按钮
    const setupButton = () => {
      // DeepSeek发送按钮的特定类名
      const buttonSelectors = [
        'div[class*="ds-icon-button"]',  // 主选择器
        'div[class*="send"]',
        'div[class*="submit"]',
        'div[role="button"]',
        'button[aria-label*="发送"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]',
      ];
      
      let sendButton = null;
      for (const selector of buttonSelectors) {
        const buttons = document.querySelectorAll(selector);
        console.log('[DeepSeek Extension] Found', buttons.length, 'elements with selector:', selector);
        
        sendButton = document.querySelector(selector);
        if (sendButton) {
          console.log('[DeepSeek Extension] Found send button with selector:', selector);
          console.log('[DeepSeek Extension] Button classes:', sendButton.className);
          break;
        }
      }
      
      // 如果还是找不到，尝试查找包含发送图标的元素
      if (!sendButton) {
        const allDivs = document.querySelectorAll('div');
        console.log('[DeepSeek Extension] Checking', allDivs.length, 'div elements for send button');
        
        for (const div of allDivs) {
          const className = (div.className || '').toLowerCase();
          const innerHTML = (div.innerHTML || '').toLowerCase();
          const ariaLabel = (div.getAttribute('aria-label') || '').toLowerCase();
          
          // 检查类名是否包含发送相关的标识
          if (className.includes('ds-icon-button') || 
              className.includes('send') || 
              className.includes('submit') ||
              ariaLabel.includes('发送') || 
              ariaLabel.includes('send') ||
              innerHTML.includes('arrow-right') || 
              innerHTML.includes('paper-plane')) {
            sendButton = div;
            console.log('[DeepSeek Extension] Found potential send button');
            console.log('[DeepSeek Extension] Button class:', className);
            console.log('[DeepSeek Extension] Button innerHTML:', innerHTML.substring(0, 100));
            break;
          }
        }
      }
      
      if (sendButton) {
        // 防止重复绑定
        const newHandler = (e) => {
          console.log('[DeepSeek Extension] Send button clicked');
          handleSendMessage();
        };
        
        // 移除旧的事件监听器
        sendButton.removeEventListener('click', newHandler);
        // 添加新的事件监听器
        sendButton.addEventListener('click', newHandler, true); // 使用捕获阶段
        
        console.log('[DeepSeek Extension] Send button handler attached');
      } else {
        console.log('[DeepSeek Extension] Send button not found, will retry in 2s');
        setTimeout(setupButton, 2000);
      }
    };
    
    // 延迟执行，确保DOM完全加载
    setTimeout(setupButton, 2000);
    
    // 监听回车键发送（DeepSeek使用Enter发送，Shift+Enter换行）
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const textarea = document.activeElement;
        if (textarea && (textarea.tagName === 'TEXTAREA' || 
                          textarea.getAttribute('contenteditable') === 'true' ||
                          textarea.tagName === 'INPUT')) {
          console.log('[DeepSeek Extension] Enter key pressed on input element');
          console.log('[DeepSeek Extension] Active element:', textarea.tagName, textarea.className);
          
          // 检查扩展上下文
          if (chrome.runtime && chrome.runtime.sendMessage) {
            setTimeout(handleSendMessage, 100);
          }
        }
      }
    };
    
    // 添加键盘监听
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
    console.log('[DeepSeek Extension] Keyboard listener attached');
  }

  // 处理发送消息
  function handleSendMessage() {
    console.log('[DeepSeek Extension] Handling send message...');
    
    // 检查扩展是否有效
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.error('[DeepSeek Extension] Extension context invalidated');
      return;
    }
    
    const prompt = getLastUserPrompt();
    console.log('[DeepSeek Extension] User prompt:', prompt.substring(0, 50) + '...');
    
    // 生成新的对话ID
    currentConversationId = generateConversationId();
    lastContent = '';
    messageElementsCount = document.querySelectorAll('[class*="message"], [role="assistant"], [role="user"]').length;
    
    console.log('[DeepSeek Extension] New conversation ID:', currentConversationId);
    console.log('[DeepSeek Extension] Current message count:', messageElementsCount);
    
    // 清除之前的定时器
    if (completionTimeout) {
      clearTimeout(completionTimeout);
    }
    if (messageCheckInterval) {
      clearInterval(messageCheckInterval);
      messageCheckInterval = null;
    }
    
    // 启动定期检查
    messageCheckInterval = setInterval(() => {
      checkLatestAssistantMessage();
    }, 500);
    
    // 通知后台新对话开始
    safeSendMessage({
      type: 'NEW_CONVERSATION',
      data: {
        id: currentConversationId,
        prompt: prompt
      }
    });
  }

  // 提取用户输入的提示词
  function getLastUserPrompt() {
    const inputs = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (const input of inputs) {
      const value = input.value || input.textContent;
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  // 处理内容更新
  function handleContentUpdate(content) {
    console.log('[DeepSeek Extension] Handling content update, length:', content.length);
    
    if (!currentConversationId || !content) return;
    
    // 通知后台更新内容
    safeSendMessage({
      type: 'UPDATE_CONVERSATION',
      data: {
        id: currentConversationId,
        content: content
      }
    });
    
    // 设置完成检测定时器
    if (completionTimeout) {
      clearTimeout(completionTimeout);
    }
    
    completionTimeout = setTimeout(() => {
      handleConversationComplete(content);
    }, 2000); // 2秒无新数据则认为完成
  }

  // 处理对话完成
  function handleConversationComplete(content) {
    console.log('[DeepSeek Extension] Conversation completed, length:', content.length);
    
    if (!currentConversationId) return;
    
    safeSendMessage({
      type: 'CONVERSATION_COMPLETE',
      data: {
        id: currentConversationId,
        content: content
      }
    });
    
    // 清除定时器
    if (messageCheckInterval) {
      clearInterval(messageCheckInterval);
      messageCheckInterval = null;
    }
    
    // 清除当前对话ID
    currentConversationId = null;
  }

  // 安全发送消息（处理Extension context invalidated）
  function safeSendMessage(message) {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errorDetails = JSON.stringify(chrome.runtime.lastError);
            console.error('[DeepSeek Extension] Extension context invalidated:', errorDetails);
            console.error('[DeepSeek Extension] Please reload the extension from chrome://extensions');
          }
        });
      } else {
        console.error('[DeepSeek Extension] Extension context not available');
        console.error('[DeepSeek Extension] Please reload the extension from chrome://extensions');
      }
    } catch (error) {
      console.error('[DeepSeek Extension] Error sending message:', error.message);
      console.error('[DeepSeek Extension] Please reload the extension from chrome://extensions');
    }
  }

  // 生成唯一的对话ID
  function generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 检查是否在DeepSeek页面
  if (window.location.hostname === 'chat.deepseek.com' || 
      window.location.hostname === 'www.chat.deepseek.com') {
    console.log('[DeepSeek Extension] Detected DeepSeek page');
    
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      console.log('[DeepSeek Extension] Page still loading, waiting for DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[DeepSeek Extension] DOMContentLoaded fired');
        setTimeout(initMonitoring, 3000);
      });
    } else {
      console.log('[DeepSeek Extension] Page loaded, waiting for React to render');
      // 等待更长时间确保React等框架渲染完成
      setTimeout(initMonitoring, 3000);
    }
  } else {
    console.log('[DeepSeek Extension] Not on DeepSeek page:', window.location.hostname);
  }

  // 监听URL变化（SPA路由）
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('[DeepSeek Extension] URL changed to:', url);
      
      // 重置监听状态
      if (currentConversationId) {
        safeSendMessage({
          type: 'CONVERSATION_COMPLETE',
          data: {
            id: currentConversationId,
            content: lastContent
          }
        });
        currentConversationId = null;
      }
      
      // 重新初始化
      if (messageCheckInterval) {
        clearInterval(messageCheckInterval);
        messageCheckInterval = null;
      }
      setTimeout(initMonitoring, 1000);
    }
  });
  urlObserver.observe(document.body, { subtree: true, childList: true });

  // 向background脚本发送就绪消息
  safeSendMessage({ type: 'CONTENT_SCRIPT_READY' });

  console.log('[DeepSeek Extension] Content script initialized');
})();

// popup.js - 下拉菜单逻辑

document.addEventListener('DOMContentLoaded', () => {
  const openHomeBtn = document.getElementById('openHome');
  const openSidePanelBtn = document.getElementById('openSidePanel');
  const openSettingsBtn = document.getElementById('openSettings');
  const openAboutBtn = document.getElementById('openAbout');

  // 打开主页
  openHomeBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html'),
      active: true
    });
    window.close();
  });

  // 打开侧边栏
  openSidePanelBtn.addEventListener('click', async () => {
    try {
      // 获取当前窗口ID
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab && currentTab.windowId) {
        // 在当前窗口打开侧边栏
        await chrome.sidePanel.open({ windowId: currentTab.windowId });
      } else {
        // 获取所有窗口
        const windows = await chrome.windows.getAll({ populate: true });
        if (windows.length > 0 && windows[0].id) {
          await chrome.sidePanel.open({ windowId: windows[0].id });
        }
      }
      
      // 关闭popup
      window.close();
    } catch (error) {
      console.error('Error opening side panel:', error);
      alert('无法打开侧边栏');
    }
  });

  // 打开提示音配置页面
  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // 打开关于页面
  openAboutBtn.addEventListener('click', () => {
    alert(`
DeepSeek 对话实时通知插件
版本：1.0.0

功能：
• 监听 DeepSeek 对话完成
• 后台通知提醒
• 侧边栏管理对话
• 自定义提示音

数据隐私：
所有数据仅存储在本地浏览器中，不会上传至任何服务器。
    `.trim());
  });

  // 检查侧边栏状态并更新按钮状态
  checkSidePanelStatus();
});

// 检查侧边栏状态
async function checkSidePanelStatus() {
  try {
    const openSidePanelBtn = document.getElementById('openSidePanel');
    
    // 尝试获取当前窗口信息
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs && tabs.length > 0 ? tabs[0] : null;
    
    if (currentTab) {
      // 检查侧边栏是否已打开
      try {
        // 注意：sidePanel.open() 会在侧边栏已打开时自动聚焦它
        // 这里我们无法直接检测状态，所以始终允许打开
        openSidePanelBtn.disabled = false;
      } catch (error) {
        console.error('Error checking side panel status:', error);
        openSidePanelBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Error checking side panel:', error);
  }
}

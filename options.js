// options.js - 提示音配置页面逻辑

document.addEventListener('DOMContentLoaded', async () => {
  const soundInput = document.getElementById('soundInput');
  const uploadLabel = document.getElementById('uploadLabel');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const errorMessage = document.getElementById('errorMessage');
  const previewBtn = document.getElementById('previewBtn');
  const resetBtn = document.getElementById('resetBtn');
  const currentSoundName = document.getElementById('currentSoundName');
  const soundStatus = document.getElementById('soundStatus');

  let selectedFile = null;
  let currentSoundData = null;

  // 加载当前提示音设置
  async function loadCurrentSound() {
    try {
      const result = await chrome.storage.local.get(['customSound']);
      
      if (result.customSound) {
        currentSoundData = result.customSound;
        currentSoundName.textContent = '自定义提示音';
        soundStatus.textContent = '已上传自定义音效';
      } else {
        currentSoundData = null;
        currentSoundName.textContent = '默认提示音';
        soundStatus.textContent = '使用默认音效';
      }
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  }

  // 文件选择处理
  soundInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件格式
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      showError('请上传 MP3 格式文件');
      event.target.value = '';
      return;
    }

    // 验证文件大小
    const maxSize = 500 * 1024; // 500KB
    if (file.size > maxSize) {
      showError('文件大小不得超过 500KB');
      event.target.value = '';
      return;
    }

    // 验证文件类型
    if (!file.type.includes('audio') && !file.type.includes('mp3')) {
      showError('文件格式不正确，请上传音频文件');
      event.target.value = '';
      return;
    }

    // 隐藏错误消息
    hideError();

    // 显示文件信息
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);

    // 切换显示
    uploadLabel.style.display = 'none';
    fileInfo.style.display = 'flex';

    // 自动保存
    await saveSoundFile(file);
  });

  // 移除文件
  removeFileBtn.addEventListener('click', async () => {
    selectedFile = null;
    soundInput.value = '';
    fileInfo.style.display = 'none';
    uploadLabel.style.display = 'flex';
    
    await loadCurrentSound();
  });

  // 试听提示音
  previewBtn.addEventListener('click', () => {
    try {
      let audio;
      
      if (currentSoundData) {
        // 播放自定义提示音
        audio = new Audio(currentSoundData);
      } else {
        // 播放默认提示音
        audio = new Audio(chrome.runtime.getURL('sounds/default-notification.mp3'));
      }
      
      audio.play().catch(err => {
        console.error('Playback error:', err);
        showToast('播放失败', 'error');
      });
    } catch (error) {
      console.error('Error playing sound:', error);
      showToast('播放失败', 'error');
    }
  });

  // 恢复默认提示音
  resetBtn.addEventListener('click', async () => {
    if (confirm('确定要恢复默认提示音吗？')) {
      try {
        await chrome.storage.local.remove(['customSound']);
        currentSoundData = null;
        await loadCurrentSound();
        showToast('已恢复默认提示音');
        
        // 清除文件选择
        selectedFile = null;
        soundInput.value = '';
        fileInfo.style.display = 'none';
        uploadLabel.style.display = 'flex';
      } catch (error) {
        console.error('Error resetting sound:', error);
        showToast('恢复失败', 'error');
      }
    }
  });

  // 保存音频文件
  async function saveSoundFile(file) {
    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        const base64Data = event.target.result;
        
        try {
          await chrome.storage.local.set({ customSound: base64Data });
          currentSoundData = base64Data;
          
          // 更新UI
          currentSoundName.textContent = file.name;
          soundStatus.textContent = '自定义音效';
          
          showToast('提示音已保存');
        } catch (error) {
          console.error('Error saving sound:', error);
          showToast('保存失败', 'error');
        }
      };
      
      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        showToast('文件读取失败', 'error');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing file:', error);
      showToast('文件处理失败', 'error');
    }
  }

  // 显示错误消息
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
  }

  // 隐藏错误消息
  function hideError() {
    errorMessage.classList.remove('show');
  }

  // 格式化文件大小
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  }

  // 显示Toast提示
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    
    if (type === 'error') {
      toast.classList.add('error');
    } else {
      toast.classList.remove('error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  // 初始化
  await loadCurrentSound();
});

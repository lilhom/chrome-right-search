import { SearchEngine, DEFAULT_SEARCH_ENGINES, STORAGE_KEYS } from './types.js';
import { showConfirm } from './component/Modal.js';

/**
 * 存储当前搜索引擎配置的数组
 */
let engines: SearchEngine[] = [];

/**
 * 从存储加载搜索引擎配置并渲染列表
 * @returns {Promise<void>}
 */
async function loadEngines(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SEARCH_ENGINES);
    engines = result[STORAGE_KEYS.SEARCH_ENGINES] || DEFAULT_SEARCH_ENGINES;
    renderEngines();
  } catch (error) {
    console.error('加载搜索引擎配置失败:', error);
    engines = DEFAULT_SEARCH_ENGINES;
    renderEngines();
    showMessage('加载配置失败，使用默认设置', 'error');
  }
}

/**
 * 移动搜索引擎的位置
 * @param index - 当前位置索引
 * @param direction - 移动方向，'up' 或 'down'
 */
function moveEngine(index: number, direction: 'up' | 'down'): void {
  // 计算目标位置的索引
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  // 边界检查，如果超出范围则直接返回
  if (newIndex < 0 || newIndex >= engines.length) return;
  
  // 交换两个位置的数据
  const temp = engines[index];
  engines[index] = engines[newIndex];
  engines[newIndex] = temp;
  // 重新渲染列表
  renderEngines();
}

/**
 * 渲染搜索引擎列表
 */
function renderEngines(): void {
  // 获取列表容器元素
  const container = document.getElementById('engineList');
  if (!container) return;

  // 清空容器内容
  container.innerHTML = '';

  // 遍历搜索引擎数组，为每个引擎创建列表项
  engines.forEach((engine, index) => {
    const item = document.createElement('div');
    item.className = 'engine-item';
    item.setAttribute('data-index', index.toString());
    item.innerHTML = `
      <span class="checkbox-label">启用</span>
      <input type="checkbox" ${engine.enabled ? 'checked' : ''} data-index="${index}">
      <input type="text" class="name-input" value="${escapeHtml(engine.name)}" data-index="${index}">
      <input type="text" class="url-input" value="${escapeHtml(engine.url)}" data-index="${index}">
      <button class="move-up" data-index="${index}" title="上移">↑</button>
      <button class="move-down" data-index="${index}" title="下移">↓</button>
      <button class="delete" data-index="${index}" data-id="${engine.id}">删除</button>
    `;
    container.appendChild(item);
  });

  // 绑定启用/禁用复选框的事件处理
  document.querySelectorAll('.engine-item input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const index = parseInt((e.target as HTMLInputElement).dataset.index || '0');
      engines[index].enabled = (e.target as HTMLInputElement).checked;
    });
  });

  // 绑定搜索引擎名称输入框的事件处理
  document.querySelectorAll('.engine-item input.name-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = parseInt((e.target as HTMLInputElement).dataset.index || '0');
      engines[index].name = (e.target as HTMLInputElement).value;
    });
  });

  // 绑定搜索引擎URL输入框的事件处理
  document.querySelectorAll('.engine-item input.url-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const index = parseInt((e.target as HTMLInputElement).dataset.index || '0');
      engines[index].url = (e.target as HTMLInputElement).value;
    });
  });

  // 绑定上移按钮的点击事件
  document.querySelectorAll('.engine-item .move-up').forEach((button) => {
    button.addEventListener('click', (e) => {
      const index = parseInt((e.target as HTMLButtonElement).dataset.index || '0');
      moveEngine(index, 'up');
    });
  });

  // 绑定下移按钮的点击事件
  document.querySelectorAll('.engine-item .move-down').forEach((button) => {
    button.addEventListener('click', (e) => {
      const index = parseInt((e.target as HTMLButtonElement).dataset.index || '0');
      moveEngine(index, 'down');
    });
  });

  // 绑定删除按钮的点击事件，弹出确认框
  document.querySelectorAll('.engine-item .delete').forEach((button) => {
    button.addEventListener('click', (e) => {
      const index = parseInt((e.currentTarget as HTMLButtonElement).dataset.index || '0');
      const engineName = engines[index].name;
      showConfirm('确认删除', `确定要删除搜索引擎「${engineName}」吗？`, () => {
        engines.splice(index, 1);
        renderEngines();
      });
    });
  });
}

/**
 * HTML转义，防止XSS攻击
 * @param text - 需要转义的文本
 * @returns 转义后的文本
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 显示ElementUI风格的消息提示
 * @param message - 提示消息内容
 * @param type - 消息类型，'success' 或 'error'
 */
function showMessage(message: string, type: 'success' | 'error' = 'success'): void {
  // 获取消息提示的DOM元素
  const toast = document.getElementById('messageToast');
  const toastMessage = document.getElementById('toastMessage');

  // 如果元素不存在则返回
  if (!toast || !toastMessage) return;

  // 设置消息内容
  toastMessage.textContent = message;
  // 移除隐藏状态和之前的类型样式
  toast.classList.remove('hidden', 'el-message--success', 'el-message--error');
  // 添加新的类型样式
  toast.classList.add(`el-message--${type}`);
  
  // 根据消息类型设置不同的图标
  if (type === 'success') {
    const icon = toast.querySelector('.el-message__icon');
    if (icon) icon.textContent = '✓';
  } else {
    const icon = toast.querySelector('.el-message__icon');
    if (icon) icon.textContent = '✕';
  }

  // 2秒后自动隐藏消息提示
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2000);
}

/**
 * 添加新的搜索引擎
 */
function addEngine(): void {
  // 获取输入框元素
  const nameInput = document.getElementById('newName') as HTMLInputElement;
  const urlInput = document.getElementById('newUrl') as HTMLInputElement;

  if (!nameInput || !urlInput) {
    showMessage('无法找到输入框元素', 'error');
    return;
  }

  // 获取输入的值并去除首尾空格
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  // 验证名称和URL是否为空
  if (!name || !url) {
    showMessage('请输入名称和URL', 'error');
    return;
  }

  // 验证URL是否包含查询占位符
  if (!url.includes('{q}')) {
    showMessage('URL必须包含 {q} 占位符', 'error');
    return;
  }

  try {
    // 创建新的搜索引擎对象
    const newEngine: SearchEngine = {
      id: `custom-${Date.now()}`,
      name,
      url,
      enabled: true,
    };

    // 添加到数组并清空输入框
    engines.push(newEngine);
    nameInput.value = '';
    urlInput.value = '';
    // 重新渲染列表
    renderEngines();
    // 显示成功提示
    showMessage('搜索引擎添加成功');
  } catch (error) {
    console.error('添加搜索引擎失败:', error);
    showMessage('添加搜索引擎失败', 'error');
  }
}

/**
 * 保存搜索引擎配置到存储
 */
async function saveEngines(): Promise<void> {
  try {
    // 将搜索引擎配置保存到Chrome同步存储
    await chrome.storage.sync.set({
      [STORAGE_KEYS.SEARCH_ENGINES]: engines,
    });
    // 显示成功提示
    showMessage('设置已保存！', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showMessage('保存设置失败', 'error');
  }
}

/**
 * 重置搜索引擎配置为默认值
 */
async function resetEngines(): Promise<void> {
  // 弹出确认框
  showConfirm('确认重置', '确定要恢复默认设置吗？', async () => {
    try {
      // 恢复为默认搜索引擎配置
      engines = [...DEFAULT_SEARCH_ENGINES];
      // 保存到同步存储
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SEARCH_ENGINES]: engines,
      });
      // 重新渲染列表
      renderEngines();
      // 显示成功提示
      showMessage('已恢复默认设置！', 'success');
    } catch (error) {
      console.error('重置设置失败:', error);
      showMessage('重置设置失败', 'error');
    }
  });
}

// 绑定页面按钮的事件监听器
document.getElementById('addBtn')?.addEventListener('click', addEngine);
document.getElementById('saveBtn')?.addEventListener('click', saveEngines);
document.getElementById('resetBtn')?.addEventListener('click', resetEngines);

// 页面加载时初始化数据
loadEngines();

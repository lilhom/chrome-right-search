import { SearchEngine, DEFAULT_SEARCH_ENGINES, STORAGE_KEYS } from './types.js';
import { showConfirm } from './component/Modal.js';

/**
 * 存储当前搜索引擎配置的数组
 */
let engines: SearchEngine[] = [];
// 当前被拖拽项在原始数组中的索引
let dragSourceIndex: number | null = null;
// 当前“空白占位”在预览列表中的插入索引
let dragPlaceholderIndex: number | null = null;
// 自定义拖拽预览 DOM（用于展示整行悬浮内容）
let dragGhostElement: HTMLElement | null = null;
// 被拖拽行的高度（用于计算占位高度与重叠比例）
let dragItemHeight = 0;
// 鼠标在被拖拽行内的垂直偏移量（保持拖动手感一致）
let dragPointerOffsetY = 0;
// 上一帧被拖拽行的 top 值（用于判断拖动方向）
let dragLastTop = 0;
// 拖动方向：1 表示向下，-1 表示向上
let dragDirection: 1 | -1 = 1;
// 触发换位的覆盖阈值：覆盖目标项约 1/3 时触发
const DRAG_COVERAGE_RATIO = 1 / 3;

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
 * 创建拖拽占位元素
 * @returns 占位元素
 */
function createPlaceholderElement(): HTMLDivElement {
  const placeholder = document.createElement('div');
  placeholder.className = 'engine-item engine-placeholder';
  if (dragItemHeight > 0) {
    // 占位高度跟随被拖拽行，避免列表在拖拽时跳动
    placeholder.style.height = `${dragItemHeight}px`;
  }
  return placeholder;
}

/**
 * 捕获列表项当前位置，用于 FLIP 动画
 * @param container - 列表容器
 * @returns 每个引擎项的位置信息
 */
function captureItemRects(container: HTMLElement): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  container.querySelectorAll('.engine-item[data-engine-id]').forEach((item) => {
    const element = item as HTMLElement;
    const id = element.dataset.engineId;
    if (id) {
      // 以 engine id 建立稳定映射，供重排后计算位移差
      rects.set(id, element.getBoundingClientRect());
    }
  });
  return rects;
}

/**
 * 对列表重排应用 FLIP 动画
 * @param container - 列表容器
 * @param previousRects - 重排前位置
 */
function animateReflow(container: HTMLElement, previousRects: Map<string, DOMRect>): void {
  container.querySelectorAll('.engine-item[data-engine-id]').forEach((item) => {
    const element = item as HTMLElement;
    const id = element.dataset.engineId;
    if (!id) return;

    const previousRect = previousRects.get(id);
    if (!previousRect) return;

    const currentRect = element.getBoundingClientRect();
    // FLIP 核心：先计算“旧位置 -> 新位置”的位移差
    const deltaY = previousRect.top - currentRect.top;
    if (Math.abs(deltaY) < 1) return;

    // 先瞬移回旧位置（不带过渡）
    element.style.transition = 'none';
    element.style.transform = `translateY(${deltaY}px)`;

    requestAnimationFrame(() => {
      // 下一帧再过渡到 0，形成平滑位移动画
      element.style.transition = 'transform 180ms ease';
      element.style.transform = 'translateY(0)';
      const cleanup = () => {
        element.style.transition = '';
        element.removeEventListener('transitionend', cleanup);
      };
      element.addEventListener('transitionend', cleanup);
    });
  });
}

/**
 * 创建整行拖拽预览图（悬浮时保留完整内容）
 * @param row - 当前行元素
 * @param dragEvent - 拖拽事件
 */
function setDragPreview(row: HTMLElement, dragEvent: DragEvent): void {
  if (!dragEvent.dataTransfer) return;

  // 清理旧的拖拽预览，避免重复残留
  dragGhostElement?.remove();
  // 克隆整行作为拖拽预览，保证悬浮内容与原行一致
  const clone = row.cloneNode(true) as HTMLElement;
  clone.style.width = `${row.offsetWidth}px`;
  clone.style.position = 'fixed';
  clone.style.top = '-10000px';
  clone.style.left = '-10000px';
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  clone.style.opacity = '0.95';
  clone.style.background = '#fff';
  clone.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.18)';
  clone.style.borderRadius = '6px';
  document.body.appendChild(clone);
  dragGhostElement = clone;
  // 使用整行克隆作为 drag image
  dragEvent.dataTransfer.setDragImage(clone, 24, Math.min(20, row.offsetHeight - 1));
}

/**
 * 完成拖拽并提交排序
 */
function commitDragSort(): void {
  if (dragSourceIndex === null || dragPlaceholderIndex === null) return;
  const draggedEngine = engines[dragSourceIndex];
  if (!draggedEngine) {
    dragSourceIndex = null;
    dragPlaceholderIndex = null;
    renderEngines();
    return;
  }

  const rest = engines.filter((_, index) => index !== dragSourceIndex);
  // 把被拖拽项插回当前占位位置，提交最终顺序
  rest.splice(dragPlaceholderIndex, 0, draggedEngine);
  engines = rest;
  dragSourceIndex = null;
  dragPlaceholderIndex = null;
  renderEngines();
}

/**
 * 渲染搜索引擎列表
 */
function renderEngines(withAnimation = false): void {
  // 获取列表容器元素
  const container = document.getElementById('engineList');
  if (!container) return;
  const previousRects = withAnimation ? captureItemRects(container) : null;

  // 清空容器内容
  container.innerHTML = '';

  // 遍历搜索引擎数组，为每个引擎创建列表项
  const isDragging = dragSourceIndex !== null && dragPlaceholderIndex !== null;
  const renderList = isDragging
    ? engines
      .map((engine, index) => ({ engine, originalIndex: index }))
      .filter((item) => item.originalIndex !== dragSourceIndex)
    : engines.map((engine, index) => ({ engine, originalIndex: index }));

  renderList.forEach(({ engine, originalIndex }, previewIndex) => {
    if (isDragging && dragPlaceholderIndex === previewIndex) {
      // 在目标插入点先渲染一个空白占位
      container.appendChild(createPlaceholderElement());
    }

    const item = document.createElement('div');
    item.className = 'engine-item';
    item.setAttribute('data-index', originalIndex.toString());
    item.setAttribute('data-preview-index', previewIndex.toString());
    item.setAttribute('data-engine-id', engine.id);
    item.innerHTML = `
      <button class="drag-handle" data-index="${originalIndex}" draggable="true" title="拖拽排序">⋮⋮</button>
      <span class="checkbox-label">启用</span>
      <input type="checkbox" ${engine.enabled ? 'checked' : ''} data-index="${originalIndex}">
      <input type="text" class="name-input" value="${escapeHtml(engine.name)}" data-index="${originalIndex}">
      <input type="text" class="url-input" value="${escapeHtml(engine.url)}" data-index="${originalIndex}">
      <button class="move-up" data-index="${originalIndex}" title="上移">↑</button>
      <button class="move-down" data-index="${originalIndex}" title="下移">↓</button>
      <button class="delete" data-index="${originalIndex}" data-id="${engine.id}">删除</button>
    `;
    container.appendChild(item);
  });

  if (isDragging && dragPlaceholderIndex === renderList.length) {
    // 支持拖到列表末尾时的占位
    container.appendChild(createPlaceholderElement());
  }

  if (withAnimation && previousRects) {
    // 仅在拖拽重排预览时应用位移动画
    animateReflow(container, previousRects);
  }

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

  // 绑定拖拽手柄事件
  document.querySelectorAll('.engine-item .drag-handle').forEach((handle) => {
    handle.addEventListener('dragstart', (e) => {
      const dragEvent = e as DragEvent;
      const index = parseInt((e.currentTarget as HTMLButtonElement).dataset.index || '-1');
      if (index < 0) return;
      const row = (e.currentTarget as HTMLElement).closest('.engine-item') as HTMLElement | null;
      if (row) {
        dragItemHeight = row.offsetHeight;
        const rowTop = row.getBoundingClientRect().top;
        // 记录鼠标在行内的相对位置，后续用来推算拖拽行真实 top
        dragPointerOffsetY = dragEvent.clientY - rowTop;
        // 初始化方向判定基线
        dragLastTop = rowTop;
        dragDirection = 1;
        setDragPreview(row, dragEvent);
      }

      dragSourceIndex = index;
      dragPlaceholderIndex = index;

      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.effectAllowed = 'move';
        dragEvent.dataTransfer.setData('text/plain', index.toString());
      }

      requestAnimationFrame(() => {
        if (dragSourceIndex !== null && dragPlaceholderIndex !== null) {
          // 拖拽开始后进入“空白占位 + 其他项让位”预览态
          renderEngines(true);
        }
      });
    });

    handle.addEventListener('dragend', () => {
      // 结束拖拽时清理所有临时状态，恢复普通渲染
      dragGhostElement?.remove();
      dragGhostElement = null;
      dragSourceIndex = null;
      dragPlaceholderIndex = null;
      dragItemHeight = 0;
      dragPointerOffsetY = 0;
      dragLastTop = 0;
      dragDirection = 1;
      renderEngines();
    });
  });

  container.addEventListener('dragover', (e) => {
    if (dragSourceIndex === null || dragPlaceholderIndex === null) return;
    e.preventDefault();

    const dragEvent = e as DragEvent;
    // 根据鼠标位置反推出被拖拽行的 top/bottom（非仅鼠标点）
    const draggedTop = (dragEvent.clientY || 0) - dragPointerOffsetY;
    const draggedBottom = draggedTop + dragItemHeight;
    const deltaTop = draggedTop - dragLastTop;
    if (Math.abs(deltaTop) > 0.5) {
      // 通过 top 变化判断当前拖动方向（上/下）
      dragDirection = deltaTop > 0 ? 1 : -1;
      dragLastTop = draggedTop;
    }
    const items = Array.from(container.querySelectorAll('.engine-item[data-preview-index]')) as HTMLDivElement[];
    let nextIndex = 0;

    for (const item of items) {
      const previewIndex = parseInt(item.dataset.previewIndex || '-1');
      if (previewIndex < 0) continue;

      const rect = item.getBoundingClientRect();
      // 向下拖时：底边进入目标项超过 1/3 即触发“排到其后”
      // 向上拖时：顶边进入目标项超过 1/3 即触发“排到其后”（等价于上一项前移）
      const shouldPlaceAfter = dragDirection > 0
        ? draggedBottom > rect.top + rect.height * DRAG_COVERAGE_RATIO
        : draggedTop > rect.top + rect.height * (1 - DRAG_COVERAGE_RATIO);
      if (shouldPlaceAfter) {
        nextIndex = previewIndex + 1;
      } else {
        break;
      }
    }

    if (nextIndex !== dragPlaceholderIndex) {
      // 仅在插入位变化时重渲染，减少无效重排
      dragPlaceholderIndex = nextIndex;
      renderEngines(true);
    }
  });

  container.addEventListener('drop', (e) => {
    if (dragSourceIndex === null || dragPlaceholderIndex === null) return;
    e.preventDefault();
    commitDragSort();
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

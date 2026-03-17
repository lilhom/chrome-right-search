import { SearchEngine, DEFAULT_SEARCH_ENGINES, STORAGE_KEYS } from './types.js';

/**
 * 存储所有搜索引擎配置的数组
 */
let searchEngines: SearchEngine[] = [];

/**
 * 标记扩展是否已完成初始化，防止重复初始化
 */
let initialized = false;
let initPromise: Promise<void> | null = null;
let menuUpdatePromise: Promise<void> = Promise.resolve();

/**
 * 初始化函数，在扩展安装、启动或页面加载时调用
 * 负责加载搜索引擎配置并创建右键菜单
 * @returns {Promise<void>}
 */
async function init(): Promise<void> {
  // 防止重复初始化
  if (initialized) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      // 从同步存储获取搜索引擎配置
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SEARCH_ENGINES);
      if (result[STORAGE_KEYS.SEARCH_ENGINES]) {
        // 已存在配置，使用存储的配置
        searchEngines = result[STORAGE_KEYS.SEARCH_ENGINES];
      } else {
        // 不存在配置，使用默认配置并保存到存储
        searchEngines = DEFAULT_SEARCH_ENGINES;
        await chrome.storage.sync.set({
          [STORAGE_KEYS.SEARCH_ENGINES]: DEFAULT_SEARCH_ENGINES,
        });
      }

      // 无论配置来自存储还是默认值，都立即创建菜单
      await createContextMenu();
    } catch (error) {
      console.error('初始化失败:', error);
      // 初始化失败时使用默认配置，保证右键菜单仍可工作
      searchEngines = DEFAULT_SEARCH_ENGINES;
      await createContextMenu();
    } finally {
      initialized = true;
      initPromise = null;
    }
  })();

  await initPromise;
}

// 存储所有搜索引擎配置的数组

/**
 * 标记扩展是否已完成初始化，防止重复初始化
 */

/**
 * 构建搜索URL，将查询词替换到URL模板中
 * @param engine - 搜索引擎配置对象
 * @param query - 用户选择的查询文本
 * @returns 编码后的搜索URL
 */
function buildSearchUrl(engine: SearchEngine, query: string): string {
  // 对查询文本进行URL编码
  const encodedQuery = encodeURIComponent(query);
  // 将URL模板中的 {q} 占位符替换为编码后的查询
  return engine.url.replace('{q}', encodedQuery);
}

/**
 * 创建右键上下文菜单
 * 先清除所有现有菜单项，然后重新创建
 * @returns {Promise<void>}
 */
async function createContextMenu(): Promise<void> {
  menuUpdatePromise = menuUpdatePromise.then(async () => {
    try {
      // 等待清除所有现有菜单项完成
      await new Promise<void>((resolve) => {
        chrome.contextMenus.removeAll(() => resolve());
      });
    } catch {
      // 忽略清除过程中的错误
    }

    // 获取已启用的搜索引擎
    const engines = searchEngines.filter((e) => e.enabled);
    // 如果没有启用的搜索引擎，直接返回
    if (engines.length === 0) return;

    // 父菜单项ID
    const parentId = 'right-search-parent';

    // 创建父菜单项，创建完成后再创建子菜单项
    try {
      chrome.contextMenus.create({
        id: parentId,
        title: '右键搜索',
        contexts: ['selection'],
      });
    } catch {
      return;
    }

    // 为每个启用的搜索引擎创建子菜单项
    for (const engine of engines) {
      try {
        chrome.contextMenus.create({
          id: `search-${engine.id}`,
          parentId: parentId,
          title: engine.name,
          contexts: ['selection'],
        });
      } catch {
      }
    }
  });

  await menuUpdatePromise;
}

/**
 * 右键菜单点击事件处理函数
 * 当用户点击搜索菜单项时，创建新标签页打开搜索结果
 * @param info - 包含点击相关信息的对象
 * @param tab - 用户当前所在的标签页
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await init();

  // 检查是否有选中文本和有效的标签页
  if (!info.selectionText || !tab?.id) {
    return;
  }

  // 获取点击的菜单项ID
  const menuItemId: string = info.menuItemId as string;

  // 忽略父菜单项的点击
  if (menuItemId === 'right-search-parent') {
    return;
  }

  // 忽略非搜索相关的菜单项点击
  if (!menuItemId.startsWith('search-')) {
    return;
  }

  // 从菜单项ID中提取搜索引擎ID
  const engineId = menuItemId.replace('search-', '');

  // 使用缓存的搜索引擎配置，避免每次点击都从存储中获取
  const engine = searchEngines.find((e) => e.id === engineId);

  // 如果找到搜索引擎，创建新标签页进行搜索
  if (engine) {
    // 构建搜索URL
    const searchUrl = buildSearchUrl(engine, info.selectionText);
    try {
      // 获取当前窗口中的所有标签页
      const tabs = await chrome.tabs.query({ windowId: tab.windowId });
      // 找到当前标签页的索引
      const currentIndex = tabs.findIndex(t => t.id === tab.id);
      // 在当前标签页右侧创建新标签页
      await chrome.tabs.create({
        url: searchUrl,
        active: true,
        index: currentIndex + 1,
        windowId: tab.windowId,
      });
    } catch (error) {
      console.error('创建标签页失败:', error);
    }
  }
});

/**
 * 扩展安装事件监听器
 * 扩展首次安装时调用初始化函数
 */
chrome.runtime.onInstalled.addListener(async () => {
  await init();
});

/**
 * Chrome启动事件监听器
 * Chrome浏览器启动时调用初始化函数
 */
chrome.runtime.onStartup.addListener(async () => {
  await init();
});

/**
 * 模块加载时尝试初始化
 * 处理service worker可能未触发onInstalled的情况
 */
if (!initialized) {
  init();
}

/**
 * 存储变化监听器
 * 当搜索引擎配置发生变化时，重新创建右键菜单
 * @param changes - 存储中发生变化的项目
 */
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes[STORAGE_KEYS.SEARCH_ENGINES]) {
    // 更新同步存储的搜索引擎配置
    searchEngines = changes[STORAGE_KEYS.SEARCH_ENGINES].newValue;
    // 重新创建右键菜单
    await createContextMenu();
  }
});

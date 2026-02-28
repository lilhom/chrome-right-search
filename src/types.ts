/**
 * 搜索引擎配置接口
 */
export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon?: string;
  enabled: boolean;
}

/**
 * 默认搜索引擎列表
 */
export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q={q}',
    enabled: true,
  },
  {
    id: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q={q}',
    enabled: true,
  },
  {
    id: 'baidu',
    name: '百度',
    url: 'https://www.baidu.com/s?wd={q}',
    enabled: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/search?q={q}',
    enabled: true,
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    url: 'https://stackoverflow.com/search?q={q}',
    enabled: true,
  },
];

/**
 * 存储键名
 */
export const STORAGE_KEYS = {
  SEARCH_ENGINES: 'searchEngines',
} as const;

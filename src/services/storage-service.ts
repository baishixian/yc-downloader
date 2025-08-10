import { AppConfig } from '../types';

export class StorageService {
  private static instance: StorageService;

  private constructor() {
    // 初始化时不需要创建 store 实例
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * 获取应用配置
   * @returns 应用配置对象
   */
  async getConfig(): Promise<AppConfig> {
    return {
      lastCurlCommand: await window.electronAPI?.storage?.get('lastCurlCommand', '') || '',
      lastExcelPath: await window.electronAPI?.storage?.get('lastExcelPath', '') || '',
      lastDownloadPath: await window.electronAPI?.storage?.get('lastDownloadPath', '') || '',
      maxConcurrentDownloads: await window.electronAPI?.storage?.get('maxConcurrentDownloads', 3) || 3
    };
  }

  /**
   * 保存CURL命令
   * @param curlCommand CURL命令
   */
  async saveCurlCommand(curlCommand: string): Promise<void> {
    await window.electronAPI?.storage?.set('lastCurlCommand', curlCommand);
  }

  /**
   * 获取上次的CURL命令
   * @returns CURL命令字符串
   */
  async getLastCurlCommand(): Promise<string> {
    return await window.electronAPI?.storage?.get('lastCurlCommand', '') || '';
  }

  /**
   * 保存Excel文件路径
   * @param filePath Excel文件路径
   */
  async saveExcelPath(filePath: string): Promise<void> {
    await window.electronAPI?.storage?.set('lastExcelPath', filePath);
  }

  /**
   * 获取上次的Excel文件路径
   * @returns Excel文件路径
   */
  async getLastExcelPath(): Promise<string> {
    return await window.electronAPI?.storage?.get('lastExcelPath', '') || '';
  }

  /**
   * 保存下载路径
   * @param downloadPath 下载路径
   */
  async saveDownloadPath(downloadPath: string): Promise<void> {
    await window.electronAPI?.storage?.set('lastDownloadPath', downloadPath);
  }

  /**
   * 获取上次的下载路径
   * @returns 下载路径
   */
  async getLastDownloadPath(): Promise<string> {
    return await window.electronAPI?.storage?.get('lastDownloadPath', '') || '';
  }

  /**
   * 设置最大并发下载数
   * @param max 最大并发数
   */
  async setMaxConcurrentDownloads(max: number): Promise<void> {
    await window.electronAPI?.storage?.set('maxConcurrentDownloads', Math.max(1, Math.min(10, max)));
  }

  /**
   * 获取最大并发下载数
   * @returns 最大并发数
   */
  async getMaxConcurrentDownloads(): Promise<number> {
    return await window.electronAPI?.storage?.get('maxConcurrentDownloads', 3) || 3;
  }

  /**
   * 清除所有配置
   */
  async clearAll(): Promise<void> {
    await window.electronAPI?.storage?.clear();
  }

  /**
   * 重置为默认配置
   */
  async resetToDefaults(): Promise<void> {
    await window.electronAPI?.storage?.clear();
    // 设置默认值
    const defaults = {
      lastCurlCommand: '',
      lastExcelPath: '',
      lastDownloadPath: '',
      maxConcurrentDownloads: 3
    };
    
    for (const [key, value] of Object.entries(defaults)) {
      await window.electronAPI?.storage?.set(key, value);
    }
  }
} 
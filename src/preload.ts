import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 保存文件
  saveFile: (options: any) => ipcRenderer.invoke('save-file', options),
  
  // 存储相关
  storage: {
    get: (key: string, defaultValue?: any) => ipcRenderer.invoke('storage-get', key, defaultValue),
    set: (key: string, value: any) => ipcRenderer.invoke('storage-set', key, value),
    clear: () => ipcRenderer.invoke('storage-clear'),
    getConfig: () => ipcRenderer.invoke('storage-get-config'),
  },
  
  // 下载相关
  downloadFile: (url: string, folderPath: string, headers: Record<string, string>) => 
    ipcRenderer.invoke('download-file', url, folderPath, headers),
  
  // 批量下载
  startBatchDownload: (options: any) => 
    ipcRenderer.invoke('start-batch-download', options),
  
  // CURL 命令验证
  validateCurlCommand: (command: string) => 
    ipcRenderer.invoke('validate-curl-command', command),
  
  // 选择 Excel 文件
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  
  // Excel 文件验证
  validateExcelFile: (filePath: string) => 
    ipcRenderer.invoke('validate-excel-file', filePath),
  
  // 获取文件信息
  getFileInfo: (url: string, headers: Record<string, string>) => 
    ipcRenderer.invoke('get-file-info', url, headers),
  
  // 获取文件统计信息
  getFileStats: (filePath: string) => 
    ipcRenderer.invoke('get-file-stats', filePath),
  
  // 打开文件
  openFile: (filePath: string) => 
    ipcRenderer.invoke('open-file', filePath),
  
  // 在文件夹中显示文件
  showFileInFolder: (filePath: string) => 
    ipcRenderer.invoke('show-file-in-folder', filePath),
  
  // 路径操作
  pathJoin: (...paths: string[]) => ipcRenderer.invoke('path-join', ...paths),
  pathDirname: (filePath: string) => ipcRenderer.invoke('path-dirname', filePath),
  
  // 目录操作
  ensureDirectory: (dirPath: string) => ipcRenderer.invoke('ensure-directory', dirPath),
  
  // URL验证
  validateUrl: (url: string, headers: Record<string, string>) => 
    ipcRenderer.invoke('validate-url', url, headers),
  
  // 平台信息
  platform: process.platform,
  
  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      saveFile: (options: any) => Promise<string | null>;
      storage: {
        get: (key: string, defaultValue?: any) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        clear: () => Promise<void>;
        getConfig: () => Promise<any>;
      };
      downloadFile: (url: string, folderPath: string, headers: Record<string, string>) => Promise<{
        success: boolean;
        fileName?: string;
        fileSize?: number;
        error?: string;
      }>;
      startBatchDownload: (options: any) => Promise<any>;
      validateCurlCommand: (command: string) => Promise<{ isValid: boolean; errors?: string[] }>;
      selectExcelFile: () => Promise<string | null>;
      validateExcelFile: (filePath: string) => Promise<{ 
        isValid: boolean; 
        rows?: any[]; 
        totalRows?: number; 
        validRows?: number; 
        errors?: string[]; 
        warnings?: string[] 
      }>;
      getFileInfo: (url: string, headers: Record<string, string>) => Promise<{
        contentDisposition?: string;
        contentLength?: string;
        contentType?: string;
      }>;
      getFileStats: (filePath: string) => Promise<{
        size: number;
        created: Date;
        modified: Date;
      }>;
      openFile: (filePath: string) => Promise<void>;
      showFileInFolder: (filePath: string) => Promise<void>;
      pathJoin: (...paths: string[]) => Promise<string>;
      pathDirname: (filePath: string) => Promise<string>;
      ensureDirectory: (dirPath: string) => Promise<void>;
      validateUrl: (url: string, headers: Record<string, string>) => Promise<{ isValid: boolean; error?: string }>;
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
    };
  }
} 
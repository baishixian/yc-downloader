declare global {
  interface Window {
    electronAPI: {
      // 文件下载相关
      downloadFile: (url: string, filePath: string, headers: Record<string, string>) => Promise<void>;
      ensureDirectory: (dirPath: string) => Promise<void>;
      
      // 路径操作
      path: {
        join: (...paths: string[]) => string;
        dirname: (filePath: string) => string;
      };
      
      // 文件夹选择
      selectFolder: () => Promise<string>;
      
      // URL验证
      validateUrl: (url: string, headers: Record<string, string>) => Promise<{ isValid: boolean; error?: string }>;
      
      // 存储
      storage: {
        get: (key: string, defaultValue?: any) => any;
        set: (key: string, value: any) => void;
        clear: () => void;
      };
    };
  }
}

export {}; 
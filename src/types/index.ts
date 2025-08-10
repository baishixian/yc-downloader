// Excel文件行数据结构
export interface ExcelRow {
  标准名称: string;
  标准编号: string;
  存储文件名: string;
  文件ID: string;
}

// CURL命令解析结果
export interface CurlCommand {
  url: string;
  headers: Record<string, string>;
  method: string;
  isValid: boolean;
  error?: string;
}

// 下载任务
export interface DownloadTask {
  id: string;
  fileName: string; // 存储文件名（用作文件夹名）
  actualFileName?: string; // 实际下载的文件名（从Content-Disposition提取）
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  fileSize?: number; // 文件大小
  savePath?: string; // 实际保存路径
  downloadPath?: string; // 用户选择的下载路径
  // Excel行数据
  standardName?: string; // 标准名称
  standardCode?: string; // 标准编号
  storageFileName?: string; // 存储文件名
  fileId?: string; // 文件ID
}

// 下载结果
export interface DownloadResult {
  total: number;
  success: number;
  failed: number;
  tasks: DownloadTask[];
}

// 应用配置
export interface AppConfig {
  lastCurlCommand: string;
  lastExcelPath: string;
  lastDownloadPath: string;
  maxConcurrentDownloads: number;
}

// 验证结果
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Excel验证结果
export interface ExcelValidationResult extends ValidationResult {
  rows: ExcelRow[];
  totalRows: number;
  validRows: number;
}
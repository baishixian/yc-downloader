/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化时间
 * @param date 日期对象
 * @returns 格式化后的时间字符串
 */
export function formatTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 计算下载速度
 * @param downloaded 已下载字节数
 * @param startTime 开始时间
 * @returns 下载速度字符串
 */
export function calculateSpeed(downloaded: number, startTime: Date): string {
  const now = new Date();
  const elapsed = (now.getTime() - startTime.getTime()) / 1000; // 秒
  
  if (elapsed === 0) return '0 B/s';
  
  const speed = downloaded / elapsed;
  return formatFileSize(speed) + '/s';
}

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 验证文件路径是否安全
 * @param filePath 文件路径
 * @returns 是否安全
 */
export function isPathSafe(filePath: string): boolean {
  // 检查是否包含危险字符
  const dangerousChars = /[<>:"|?*]/;
  if (dangerousChars.test(filePath)) {
    return false;
  }
  
  // 检查是否为绝对路径（在Windows上）
  if (typeof window !== 'undefined' && window.electronAPI?.platform === 'win32' && filePath.includes(':\\')) {
    return true;
  }
  
  // 检查是否为绝对路径（在Unix系统上）
  if (typeof window !== 'undefined' && window.electronAPI?.platform !== 'win32' && filePath.startsWith('/')) {
    return true;
  }
  
  return false;
}

/**
 * 清理文件名
 * @param fileName 原始文件名
 * @returns 清理后的文件名
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}

/**
 * 延迟函数
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param wait 等待时间
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit 限制时间
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
} 
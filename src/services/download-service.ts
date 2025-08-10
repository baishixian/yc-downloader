import { DownloadTask, DownloadResult, ExcelRow } from '../types';
import { CurlService } from './curl-service';
import * as path from 'path';

// 定义下载函数类型
type DownloadFunction = (url: string, folderPath: string, headers: Record<string, string>) => Promise<{
  success: boolean;
  fileName?: string;
  fileSize?: number;
  error?: string;
}>;

export class DownloadService {
  private static instance: DownloadService;
  private downloadQueue: DownloadTask[] = [];
  private isDownloading = false;
  private maxConcurrent = 3;
  private activeDownloads = 0;
  private downloadFunction: DownloadFunction | null = null;

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  /**
   * 设置下载函数
   * @param downloadFn 下载函数
   */
  setDownloadFunction(downloadFn: DownloadFunction): void {
    this.downloadFunction = downloadFn;
  }

  /**
   * 设置最大并发下载数
   * @param max 最大并发数
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, max);
  }

  /**
   * 添加下载任务
   * @param tasks 下载任务数组
   */
  addTasks(tasks: DownloadTask[]): void {
    this.downloadQueue.push(...tasks);
    this.processQueue();
  }

  /**
   * 处理下载队列
   */
  private async processQueue(): Promise<void> {
    // 移除isDownloading标志，避免死锁
    while (this.downloadQueue.length > 0 && this.activeDownloads < this.maxConcurrent) {
      const task = this.downloadQueue.shift();
      if (task) {
        this.activeDownloads++;
        console.log(`启动下载任务: ${task.fileName}, 当前活跃下载: ${this.activeDownloads}/${this.maxConcurrent}`);

        // 异步执行下载任务
        this.downloadFile(task).finally(() => {
          this.activeDownloads--;
          console.log(`下载任务完成: ${task.fileName}, 剩余活跃下载: ${this.activeDownloads}`);

          // 递归处理队列中的下一个任务
          if (this.downloadQueue.length > 0) {
            setImmediate(() => this.processQueue());
          }
        });
      }
    }
  }

  /**
   * 下载单个文件
   * @param task 下载任务
   */
  private async downloadFile(task: DownloadTask): Promise<void> {
    try {
      if (!this.downloadFunction) {
        throw new Error('下载函数未设置');
      }

      task.status = 'downloading';
      task.startTime = new Date();

      console.log(`开始下载任务: ${task.fileName}, fileId: ${task.fileId}`);
      console.log(`原始curl命令: ${task.url}`);

      // 解析CURL命令并替换stddId
      const parsed = CurlService.parseCurlCommand(task.url);
      if (!parsed.isValid) {
        throw new Error(parsed.error || 'CURL命令无效');
      }

      console.log(`解析后的URL: ${parsed.url}`);
      console.log(`解析后的headers:`, parsed.headers);

      // 替换URL中的stddId参数
      const url = CurlService.replaceStddId(parsed.url, task.fileId || '');
      console.log(`替换stddId后的URL: ${url}`);

      // 使用用户选择的下载路径，在其中创建以存储文件名命名的子文件夹
      const subFolderPath = path.join(task.downloadPath || '', task.storageFileName || task.fileName);
      console.log(`文件保存路径: ${subFolderPath}`);

      // 使用注入的下载函数进行下载
      const downloadResult = await this.downloadFunction(url, subFolderPath, parsed.headers);

      if (downloadResult.success) {
        // 从下载结果中获取实际文件名和文件大小
        const actualFileName = downloadResult.fileName || 'unknown_file';
        const fileSize = downloadResult.fileSize || 0;
        const fullFilePath = path.join(subFolderPath, actualFileName);

        // 更新任务信息
        task.status = 'completed';
        task.actualFileName = actualFileName;
        task.fileSize = fileSize;
        task.savePath = fullFilePath;
        task.progress = 100;
        task.endTime = new Date();

        console.log(`文件下载完成: ${actualFileName}, 大小: ${fileSize} bytes, 保存路径: ${fullFilePath}`);
      } else {
        throw new Error(downloadResult.error || '下载失败');
      }
    } catch (error) {
      console.error(`下载文件失败: fileName=${task.fileName} url=${task.url}`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '未知错误';
      task.endTime = new Date();

      // 添加更详细的错误信息
      if (error instanceof Error) {
        if (error.message.includes('HTML内容')) {
          task.error = '下载失败：服务器返回HTML页面，可能是登录过期或权限不足';
        } else if (error.message.includes('HTTP')) {
          task.error = `下载失败：HTTP错误 ${error.message}`;
        } else if (error.message.includes('超时')) {
          task.error = '下载失败：请求超时，请检查网络连接';
        } else if (error.message.includes('重定向')) {
          task.error = '下载失败：重定向次数过多，可能是登录页面循环';
        } else {
          task.error = `下载失败：${error.message}`;
        }
      }
    }
  }

  /**
   * 从Content-Disposition头提取文件名
   * @param contentDisposition Content-Disposition头值
   * @returns 提取的文件名
   */
  private extractFileNameFromHeader(contentDisposition: string): string | null {
    if (!contentDisposition) return null;

    // 匹配 filename= 或 filename*= 格式
    const filenameMatch = contentDisposition.match(/filename[^=]*=([^;]+)/);
    if (filenameMatch) {
      let filename = filenameMatch[1].trim();

      // 移除引号
      if ((filename.startsWith('"') && filename.endsWith('"')) ||
          (filename.startsWith("'") && filename.endsWith("'"))) {
        filename = filename.slice(1, -1);
      }

      // 处理URL编码
      try {
        filename = decodeURIComponent(filename);
      } catch (e) {
        // 如果解码失败，尝试其他编码方式
        try {
          filename = decodeURIComponent(escape(filename));
        } catch (e2) {
          console.warn('文件名解码失败:', filename);
        }
      }

      return filename;
    }

    return null;
  }

  /**
   * 批量下载文件
   * @param curlCommand 原始CURL命令
   * @param excelRows Excel数据行
   * @param downloadPath 下载路径
   * @returns 下载结果
   */
  async batchDownload(
    curlCommand: string,
    excelRows: ExcelRow[],
    downloadPath: string
  ): Promise<DownloadResult> {
    const result: DownloadResult = {
      total: excelRows.length,
      success: 0,
      failed: 0,
      tasks: []
    };

    // 创建下载任务
    const tasks: DownloadTask[] = [];
    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];

      tasks.push({
        id: `task_${i}`,
        fileName: row.存储文件名, // 存储文件名用作文件夹名
        url: curlCommand,
        status: 'pending',
        progress: 0,
        // Excel行数据
        standardName: row.标准名称,
        standardCode: row.标准编号,
        storageFileName: row.存储文件名,
        fileId: row.文件ID,
        downloadPath: downloadPath // 添加用户选择的下载路径
      });
    }

    result.tasks = tasks;

    // 添加任务到队列
    this.addTasks(tasks);

    // 等待所有任务完成
    await this.waitForCompletion(tasks);

    // 统计结果
    result.success = tasks.filter(t => t.status === 'completed').length;
    result.failed = tasks.filter(t => t.status === 'failed').length;

    return result;
  }

  /**
   * 开始批量下载（新接口）
   * @param options 下载选项
   * @returns 下载结果
   */
  async startBatchDownload(options: {
    curlCommand: string;
    excelRows: ExcelRow[];
    downloadPath: string;
    maxConcurrent: number;
  }): Promise<DownloadResult> {
    this.setMaxConcurrent(options.maxConcurrent);
    return this.batchDownload(options.curlCommand, options.excelRows, options.downloadPath);
  }

  /**
   * 等待所有任务完成
   * @param tasks 任务数组
   */
  private async waitForCompletion(tasks: DownloadTask[]): Promise<void> {
    return new Promise((resolve) => {
      const checkComplete = () => {
        const allCompleted = tasks.every(t =>
          t.status === 'completed' || t.status === 'failed'
        );

        if (allCompleted) {
          console.log('所有下载任务已完成');
          resolve();
        } else {
          const pending = tasks.filter(t => t.status === 'pending').length;
          const downloading = tasks.filter(t => t.status === 'downloading').length;
          const completed = tasks.filter(t => t.status === 'completed').length;
          const failed = tasks.filter(t => t.status === 'failed').length;

          console.log(`任务状态: 待下载=${pending}, 下载中=${downloading}, 已完成=${completed}, 失败=${failed}`);

          // 减少检查间隔，提高响应速度
          setTimeout(checkComplete, 50);
        }
      };

      checkComplete();
    });
  }

  /**
   * 暂停所有下载
   */
  pauseAll(): void {
    this.downloadQueue = [];
    this.isDownloading = false;
  }

  /**
   * 获取当前状态
   */
  getStatus(): { queueLength: number; activeDownloads: number; isDownloading: boolean } {
    return {
      queueLength: this.downloadQueue.length,
      activeDownloads: this.activeDownloads,
      isDownloading: this.isDownloading
    };
  }
}
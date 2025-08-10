import React, { useState } from 'react';
import { ExcelRow } from '../../types';

interface DownloadPanelProps {
  downloadPath: string;
  onPathChange: (path: string) => void;
  maxConcurrent: number;
  onMaxConcurrentChange: (max: number) => void;
  curlCommand: string;
  excelRows: ExcelRow[];
  canStart: boolean;
  isDownloading: boolean;
  onDownloadStart: () => void;
  onDownloadComplete: (result: any) => void;
}

const DownloadPanel: React.FC<DownloadPanelProps> = ({
  downloadPath,
  onPathChange,
  maxConcurrent,
  onMaxConcurrentChange,
  curlCommand,
  excelRows,
  canStart,
  isDownloading,
  onDownloadStart,
  onDownloadComplete
}) => {
  const [isSelectingPath, setIsSelectingPath] = useState(false);

  // 选择下载路径
  const selectDownloadPath = async () => {
    setIsSelectingPath(true);
    try {
      const path = await window.electronAPI?.selectFolder() || downloadPath;
      if (path) {
        onPathChange(path);
      }
    } catch (error) {
      console.error('选择下载路径失败:', error);
    } finally {
      setIsSelectingPath(false);
    }
  };

  // 开始下载
  const startDownload = async () => {
    if (!canStart || isDownloading) return;

    onDownloadStart();

    try {
      // 通过 electronAPI 与主进程通信
      const result = await window.electronAPI?.startBatchDownload?.({
        curlCommand,
        excelRows,
        downloadPath,
        maxConcurrent
      });

      if (result) {
        onDownloadComplete(result);
      } else {
        throw new Error('下载服务不可用');
      }
    } catch (error) {
      console.error('下载失败:', error);
      onDownloadComplete({
        total: excelRows.length,
        success: 0,
        failed: excelRows.length,
        tasks: excelRows.map(row => ({
          id: row.文件ID,
          fileName: row.存储文件名,
          url: curlCommand,
          status: 'failed' as const,
          progress: 0,
          error: error instanceof Error ? error.message : '未知错误'
        }))
      });
    }
  };

  return (
    <div className="download-panel">
      {/* 下载路径设置 */}
      <div className="form-group">
        <label className="form-label">下载路径</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input flex-1"
            value={downloadPath}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder="选择或输入下载路径"
            readOnly
          />
          <button
            className="btn btn-secondary"
            onClick={selectDownloadPath}
            disabled={isSelectingPath}
          >
            {isSelectingPath ? '选择中...' : '选择路径'}
          </button>
        </div>
      </div>

      {/* 并发数设置 */}
      <div className="form-group">
        <label className="form-label">最大并发下载数</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="10"
            value={maxConcurrent}
            onChange={(e) => onMaxConcurrentChange(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-medium min-w-[2rem] text-center">
            {maxConcurrent}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          建议值：1-5（网络较慢时使用较小值）
        </div>
      </div>

      {/* 下载信息预览 */}
      <div className="download-info">
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{excelRows.length}</div>
            <div className="text-sm text-gray-600">待下载文件</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{maxConcurrent}</div>
            <div className="text-sm text-gray-600">并发下载数</div>
          </div>
        </div>
      </div>

      {/* 下载按钮 */}
      <div className="flex gap-2 mt-4">
        <button
          className="btn btn-primary flex-1"
          onClick={startDownload}
          disabled={!canStart || isDownloading}
        >
          {isDownloading ? (
            <>
              <span className="loading"></span>
              下载中...
            </>
          ) : (
            '开始下载'
          )}
        </button>
      </div>

      {/* 状态提示 */}
      {!canStart && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-700">
            {!curlCommand.trim() && '• 请输入CURL命令'}
            {excelRows.length === 0 && '• 请上传Excel文件'}
            {!downloadPath.trim() && '• 请选择下载路径'}
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadPanel;
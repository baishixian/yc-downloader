import React, { useState } from 'react';
import { DownloadResult, DownloadTask } from '../../types';

interface ResultViewProps {
  result: DownloadResult;
}

const ResultView: React.FC<ResultViewProps> = ({ result }) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // 切换任务详情展开状态
  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  // 获取状态图标
  const getStatusIcon = (status: DownloadTask['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'downloading':
        return '⏳';
      case 'pending':
        return '⏸️';
      default:
        return '❓';
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: DownloadTask['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'downloading':
        return 'text-blue-600';
      case 'pending':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (date: Date): string => {
    return date.toLocaleString('zh-CN');
  };

  // 计算下载速度
  const calculateSpeed = (task: DownloadTask): string => {
    if (task.status !== 'completed' || !task.startTime || !task.endTime || !task.fileSize) {
      return 'N/A';
    }
    
    const duration = task.endTime.getTime() - task.startTime.getTime();
    if (duration === 0) return 'N/A';
    
    const speed = task.fileSize / (duration / 1000); // bytes per second
    return formatFileSize(speed) + '/s';
  };

  // 打开文件预览
  const openFilePreview = async (task: DownloadTask) => {
    if (task.savePath) {
      try {
        await window.electronAPI.openFile(task.savePath);
      } catch (error) {
        console.error('打开文件失败:', error);
        alert('打开文件失败: ' + error);
      }
    }
  };

  // 打开文件所在文件夹
  const openFileLocation = async (task: DownloadTask) => {
    if (task.savePath) {
      try {
        await window.electronAPI.showFileInFolder(task.savePath);
      } catch (error) {
        console.error('打开文件夹失败:', error);
        alert('打开文件夹失败: ' + error);
      }
    }
  };

  return (
    <div className="result-view">
      {/* 下载统计 */}
      <div className="download-stats mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-number text-blue-600">{result.total}</div>
            <div className="stat-label">总文件数</div>
          </div>
          <div className="stat-card">
            <div className="stat-number text-green-600">{result.success}</div>
            <div className="stat-label">成功下载</div>
          </div>
          <div className="stat-card">
            <div className="stat-number text-red-600">{result.failed}</div>
            <div className="stat-label">下载失败</div>
          </div>
          <div className="stat-card">
            <div className="stat-number text-purple-600">
              {result.total > 0 ? Math.round((result.success / result.total) * 100) : 0}%
            </div>
            <div className="stat-label">成功率</div>
          </div>
        </div>
      </div>

      {/* 下载任务列表 */}
      <div className="download-tasks">
        <h3 className="text-lg font-semibold mb-4">下载任务详情</h3>
        
        <div className="space-y-3">
          {result.tasks.map((task) => (
            <div key={task.id} className="task-item border border-gray-200 rounded-lg">
              {/* 任务头部 */}
              <div 
                className="task-header p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleTaskExpansion(task.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-lg">{getStatusIcon(task.status)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {task.standardName || task.fileName}
                      </div>
                      <div className="text-sm text-gray-500 space-x-4">
                        <span>标准编号: {task.standardCode || 'N/A'}</span>
                        <span>文件ID: {task.fileId || 'N/A'}</span>
                        <span>存储位置: {task.storageFileName || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-medium ${getStatusColor(task.status)}`}>
                      {task.status === 'completed' && '已完成'}
                      {task.status === 'failed' && '失败'}
                      {task.status === 'downloading' && '下载中'}
                      {task.status === 'pending' && '等待中'}
                    </span>
                    
                    {task.status === 'downloading' && (
                      <div className="text-sm text-blue-600">
                        {task.progress}%
                      </div>
                    )}
                    
                    {task.status === 'completed' && task.savePath && (
                      <div className="flex gap-2">
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFilePreview(task);
                          }}
                        >
                          预览
                        </button>
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFileLocation(task);
                          }}
                        >
                          位置
                        </button>
                      </div>
                    )}
                    
                    <button className="text-gray-400 hover:text-gray-600">
                      {expandedTasks.has(task.id) ? '▼' : '▶'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 任务详情 */}
              {expandedTasks.has(task.id) && (
                <div className="task-details p-4 border-t border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">标准名称:</span>
                      <div className="text-gray-600">{task.standardName || 'N/A'}</div>
                    </div>
                    
                    <div>
                      <span className="font-medium">标准编号:</span>
                      <div className="text-gray-600">{task.standardCode || 'N/A'}</div>
                    </div>
                    
                    <div>
                      <span className="font-medium">文件ID:</span>
                      <div className="text-gray-600">{task.fileId || 'N/A'}</div>
                    </div>
                    
                    <div>
                      <span className="font-medium">存储文件名:</span>
                      <div className="text-gray-600">{task.storageFileName || 'N/A'}</div>
                    </div>
                    
                    <div>
                      <span className="font-medium">实际文件名:</span>
                      <div className="text-gray-600">{task.actualFileName || 'N/A'}</div>
                    </div>
                    
                    <div>
                      <span className="font-medium">保存路径:</span>
                      <div className="text-gray-600 break-all">{task.savePath || 'N/A'}</div>
                    </div>
                    
                    {task.startTime && (
                      <div>
                        <span className="font-medium">开始时间:</span>
                        <div className="text-gray-600">{formatTime(task.startTime)}</div>
                      </div>
                    )}
                    
                    {task.endTime && (
                      <div>
                        <span className="font-medium">完成时间:</span>
                        <div className="text-gray-600">{formatTime(task.endTime)}</div>
                      </div>
                    )}
                    
                    {task.fileSize && (
                      <div>
                        <span className="font-medium">文件大小:</span>
                        <div className="text-gray-600">{formatFileSize(task.fileSize)}</div>
                      </div>
                    )}
                    
                    {task.status === 'completed' && (
                      <div>
                        <span className="font-medium">下载速度:</span>
                        <div className="text-gray-600">{calculateSpeed(task)}</div>
                      </div>
                    )}
                  </div>
                  
                  {task.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-sm text-red-700">
                        <span className="font-medium">错误信息:</span> {task.error}
                      </div>
                      {task.url && (
                        <div className="mt-2">
                          <span className="font-medium">URL:</span>
                          <div className="text-red-600 break-all">{task.url}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 flex gap-3">
        <button className="btn btn-secondary">
          导出结果
        </button>
        <button className="btn btn-primary">
          重新下载失败文件
        </button>
      </div>
    </div>
  );
};

export default ResultView; 
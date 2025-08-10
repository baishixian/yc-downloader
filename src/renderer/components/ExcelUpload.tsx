import React, { useState, useRef, useCallback } from 'react';
import { ExcelRow } from '../../types';

interface ExcelUploadProps {
  onDataLoaded: (rows: ExcelRow[], filePath: string) => void;
  lastPath: string;
}

const ExcelUpload: React.FC<ExcelUploadProps> = ({ onDataLoaded, lastPath }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
    details?: string[];
  } | null>(null);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  // 处理文件选择
  const handleFileSelect = useCallback(async () => {
    setIsLoading(true);
    setValidationResult(null);

    try {
      // 让主进程通过文件选择器选择文件
      const filePath = await window.electronAPI?.selectExcelFile?.();

      if (!filePath) {
        setIsLoading(false);
        return; // 用户取消了文件选择
      }

      // 通过 electronAPI 与主进程通信，传递文件路径
      const result = await window.electronAPI?.validateExcelFile?.(filePath);

      if (result?.isValid) {
        setValidationResult({
          isValid: true,
          message: `Excel文件验证成功！共${result.totalRows}行，其中${result.validRows}行有效`,
          type: 'success',
          details: result.warnings && result.warnings.length > 0 ? result.warnings : undefined
        });

        // 从文件路径中提取文件名
        const fileName = filePath.split('/').pop() || filePath;
        setCurrentFile(fileName);
        if (result.rows) {
          onDataLoaded(result.rows, fileName);
        }
      } else {
        setValidationResult({
          isValid: false,
          message: 'Excel文件格式不正确',
          type: 'error',
          details: result?.errors || ['未知错误']
        });
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: '文件读取失败: ' + (error instanceof Error ? error.message : '未知错误'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded]);

  // 处理拖拽
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    // 拖拽文件时也调用文件选择器
    handleFileSelect();
  }, [handleFileSelect]);

  // 清空当前文件
  const clearFile = () => {
    setCurrentFile('');
    setValidationResult(null);
    onDataLoaded([], '');
  };

  return (
    <div className="excel-upload">
      {/* 文件上传区域 */}
      <div
        className={`file-upload ${dragActive ? 'dragover' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleFileSelect}
      >
        {isLoading ? (
          <div className="text-center">
            <span className="loading"></span>
            <div className="file-upload-text">正在验证Excel文件...</div>
          </div>
        ) : currentFile ? (
          <div className="text-center">
            <div className="file-upload-icon">📊</div>
            <div className="file-upload-text">{currentFile}</div>
            <div className="file-upload-hint">点击更换文件或拖拽新文件</div>
          </div>
        ) : (
          <div className="text-center">
            <div className="file-upload-icon">📁</div>
            <div className="file-upload-text">点击选择Excel文件或拖拽到此处</div>
            <div className="file-upload-hint">支持 .xlsx 和 .xls 格式</div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mt-4">
        <button
          className="btn btn-primary"
          onClick={handleFileSelect}
          disabled={isLoading}
        >
          选择Excel文件
        </button>

        {currentFile && (
          <button
            className="btn btn-secondary"
            onClick={clearFile}
            disabled={isLoading}
          >
            清空文件
          </button>
        )}
      </div>

      {/* 验证结果 */}
      {validationResult && (
        <div className={`alert alert-${validationResult.type} mt-4`}>
          <div className="flex items-center gap-2">
            {validationResult.type === 'success' && (
              <span>✅</span>
            )}
            {validationResult.type === 'error' && (
              <span>❌</span>
            )}
            {validationResult.type === 'warning' && (
              <span>⚠️</span>
            )}
            <span>{validationResult.message}</span>
          </div>

          {validationResult.details && validationResult.details.length > 0 && (
            <div className="mt-2">
              <ul className="text-sm space-y-1">
                {validationResult.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 上次使用的文件提示 */}
      {lastPath && !currentFile && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">
            上次使用的文件: <span className="font-medium">{lastPath}</span>
          </div>
        </div>
      )}

      {/* 格式要求说明 */}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="font-bold text-yellow-800 mb-2">Excel文件格式要求：</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 必须包含以下四列：标准名称、标准编号、存储文件名、文件ID</li>
          <li>• 第一行必须是标题行</li>
          <li>• 文件ID列必须包含有效的数字</li>
          <li>• 存储文件名将用作下载后的文件名</li>
        </ul>
      </div>
    </div>
  );
};

export default ExcelUpload;
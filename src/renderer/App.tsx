import React, { useState, useEffect } from 'react';
import CurlInput from './components/CurlInput';
import ExcelUpload from './components/ExcelUpload';
import DownloadPanel from './components/DownloadPanel';
import ResultView from './components/ResultView';
import { AppConfig, DownloadResult, ExcelRow } from '../types';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    lastCurlCommand: '',
    lastExcelPath: '',
    lastDownloadPath: '',
    maxConcurrentDownloads: 3
  });
  
  const [curlCommand, setCurlCommand] = useState('');
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [downloadPath, setDownloadPath] = useState('');
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 通过 electronAPI 与主进程通信，而不是直接使用服务
        const savedConfig = await window.electronAPI?.storage?.getConfig?.() || config;
        setConfig(savedConfig);
        
        // 恢复上次的输入
        setCurlCommand(savedConfig.lastCurlCommand);
        setDownloadPath(savedConfig.lastDownloadPath);
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    };
    
    loadConfig();
  }, []);

  // 保存配置
  const saveConfig = async (updates: Partial<AppConfig>) => {
    try {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      
      // 通过 electronAPI 保存到存储
      if (updates.lastCurlCommand !== undefined) {
        await window.electronAPI?.storage?.set?.('lastCurlCommand', updates.lastCurlCommand);
      }
      if (updates.lastExcelPath !== undefined) {
        await window.electronAPI?.storage?.set?.('lastExcelPath', updates.lastExcelPath);
      }
      if (updates.lastDownloadPath !== undefined) {
        await window.electronAPI?.storage?.set?.('lastDownloadPath', updates.lastDownloadPath);
      }
      if (updates.maxConcurrentDownloads !== undefined) {
        await window.electronAPI?.storage?.set?.('maxConcurrentDownloads', updates.maxConcurrentDownloads);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  };

  // 处理CURL命令更新
  const handleCurlUpdate = async (command: string) => {
    setCurlCommand(command);
    await saveConfig({ lastCurlCommand: command });
  };

  // 处理Excel数据更新
  const handleExcelUpdate = async (rows: ExcelRow[], filePath: string) => {
    setExcelRows(rows);
    await saveConfig({ lastExcelPath: filePath });
  };

  // 处理下载路径更新
  const handleDownloadPathUpdate = async (path: string) => {
    setDownloadPath(path);
    await saveConfig({ lastDownloadPath: path });
  };

  // 处理下载开始
  const handleDownloadStart = () => {
    setIsDownloading(true);
    setDownloadResult(null);
  };

  // 处理下载完成
  const handleDownloadComplete = (result: DownloadResult) => {
    setIsDownloading(false);
    setDownloadResult(result);
  };

  // 检查是否可以开始下载
  const canStartDownload = curlCommand.trim() !== '' && 
                          excelRows.length > 0 && 
                          downloadPath.trim() !== '';

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>文件下载器</h1>
          <p>批量下载文件的跨平台应用程序</p>
        </header>
        
        <main className="content">
          {/* CURL输入区域 */}
          <section className="section">
            <h2 className="section-title">CURL命令输入</h2>
            <CurlInput
              value={curlCommand}
              onChange={handleCurlUpdate}
              onValidate={(isValid) => console.log('CURL验证结果:', isValid)}
            />
          </section>

          {/* Excel文件上传区域 */}
          <section className="section">
            <h2 className="section-title">Excel文件上传</h2>
            <ExcelUpload
              onDataLoaded={handleExcelUpdate}
              lastPath={config.lastExcelPath}
            />
          </section>

          {/* 下载控制区域 */}
          <section className="section">
            <h2 className="section-title">下载控制</h2>
            <DownloadPanel
              downloadPath={downloadPath}
              onPathChange={handleDownloadPathUpdate}
              maxConcurrent={config.maxConcurrentDownloads}
              onMaxConcurrentChange={(max) => saveConfig({ maxConcurrentDownloads: max })}
              curlCommand={curlCommand}
              excelRows={excelRows}
              canStart={canStartDownload}
              isDownloading={isDownloading}
              onDownloadStart={handleDownloadStart}
              onDownloadComplete={handleDownloadComplete}
            />
          </section>

          {/* 结果展示区域 */}
          {downloadResult && (
            <section className="section">
              <h2 className="section-title">下载结果</h2>
              <ResultView result={downloadResult} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default App; 
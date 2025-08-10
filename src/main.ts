import { app, Menu, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// HTTP 响应类型定义
interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  pipe: (dest: NodeJS.WritableStream) => void;
}

let mainWindow: BrowserWindow | null = null;

// 创建主窗口
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '文件下载器',
    icon: path.join(__dirname, '../assets/icon.png'), // 暂时注释掉图标
  });

  Menu.setApplicationMenu(null);

  // 加载渲染进程
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 设置应用配置以减少警告
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');

// 应用准备就绪时创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理器
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择下载文件夹'
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-file', async (event, options: Electron.SaveDialogOptions) => {
  if (!mainWindow) return null;
  
  const result = await dialog.showSaveDialog(mainWindow, options);
  
  return result.canceled ? null : result.filePath;
});

// 文件下载相关
ipcMain.handle('download-file', async (event, url: string, folderPath: string, headers: Record<string, string>) => {
  try {
    const https = require('https');
    const http = require('http');
    
    // URL编码处理函数
    const encodeUrl = (rawUrl: string): string => {
      try {
        // 首先进行预处理，确保特殊字符被正确编码
        const preProcessedUrl = preProcessUrl(rawUrl);

        // 使用URL构造函数来规范化URL
        const urlObj = new URL(preProcessedUrl);

        // 确保查询参数被正确编码
        const searchParams = new URLSearchParams();

        // 手动处理每个查询参数，确保值被正确编码
        const originalParams = new URLSearchParams(urlObj.search);
        for (const [key, value] of originalParams.entries()) {
          // 对参数值进行更严格的编码
          const encodedValue = strictEncodeURIComponent(value);
          searchParams.set(key, encodedValue);
        }

        urlObj.search = searchParams.toString();
        return urlObj.toString();
      } catch (error) {
        // 如果URL构造失败，尝试手动编码
        console.warn('URL规范化失败，使用手动编码:', error);
        return manualEncodeUrl(rawUrl);
      }
    };

    // 预处理URL，处理可能导致解析失败的字符
    const preProcessUrl = (url: string): string => {
      // 分离URL的基础部分和查询参数部分
      const urlParts = url.split('?');
      if (urlParts.length < 2) {
        return url; // 没有查询参数，直接返回
      }

      const baseUrl = urlParts[0];
      const queryString = urlParts.slice(1).join('?');

      // 处理查询参数中的特殊字符
      const processedQueryString = queryString
        .split('&')
        .map(param => {
          const [key, value] = param.split('=');
          if (key && value !== undefined) {
            // 确保参数值中的特殊字符被正确处理
            const processedValue = value
              .replace(/\s/g, '%20')  // 空格
              .replace(/"/g, '%22')   // 双引号
              .replace(/'/g, '%27')   // 单引号
              .replace(/</g, '%3C')   // 小于号
              .replace(/>/g, '%3E')   // 大于号
              .replace(/\[/g, '%5B')  // 左方括号
              .replace(/\]/g, '%5D')  // 右方括号
              .replace(/\{/g, '%7B')  // 左花括号
              .replace(/\}/g, '%7D')  // 右花括号
              .replace(/\|/g, '%7C')  // 竖线
              .replace(/\\/g, '%5C')  // 反斜杠
              .replace(/\^/g, '%5E')  // 插入符号
              .replace(/`/g, '%60');  // 反引号

            return `${key}=${processedValue}`;
          }
          return param;
        })
        .join('&');

      return `${baseUrl}?${processedQueryString}`;
    };

    // 更严格的URI组件编码
    const strictEncodeURIComponent = (str: string): string => {
      return encodeURIComponent(str)
        .replace(/[!'()*]/g, (c) => {
          return '%' + c.charCodeAt(0).toString(16).toUpperCase();
        });
    };

    // 手动编码URL中的特殊字符
    const manualEncodeUrl = (url: string): string => {
      try {
        // 分离URL的各个部分
        const urlParts = url.split('?');
        if (urlParts.length < 2) {
          return url; // 没有查询参数，直接返回
        }

        const baseUrl = urlParts[0];
        const queryString = urlParts.slice(1).join('?');

        // 处理查询参数
        const params = queryString.split('&');
        const encodedParams = params.map(param => {
          const [key, value] = param.split('=');
          if (key && value !== undefined) {
            // 对参数值进行更严格的编码
            let encodedValue = value;

            // 首先解码，然后重新编码，确保不会重复编码
            try {
              encodedValue = decodeURIComponent(value);
            } catch (e) {
              // 如果解码失败，说明可能已经是编码状态或包含无效字符
              encodedValue = value;
            }

            // 使用更严格的编码
            encodedValue = strictEncodeURIComponent(encodedValue);

            return `${key}=${encodedValue}`;
          }
          return param;
        });

        return `${baseUrl}?${encodedParams.join('&')}`;
      } catch (error) {
        console.warn('手动URL编码失败:', error);
        return url; // 编码失败时返回原URL
      }
    };

    return new Promise<{ success: boolean; fileName?: string; fileSize?: number; error?: string }>((resolve) => {
      const downloadWithRedirect = (downloadUrl: string, maxRedirects: number = 5) => {
        if (maxRedirects <= 0) {
          resolve({ success: false, error: '重定向次数过多' });
          return;
        }

        console.log(`downloadWithRedirect ${downloadUrl}`);
        try {
          // 清理URL字符串，去除前后空格和其他问题字符
          let cleanUrl = downloadUrl.trim();

          // 确保URL格式正确
          if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            throw new Error('URL必须以http://或https://开头');
          }

          // 使用URL对象来安全地处理URL
          const urlObj = new URL(cleanUrl);

          // 验证URL对象是否正确解析
          if (!urlObj.hostname) {
            throw new Error(`URL解析失败：hostname为空，原始URL: ${cleanUrl}`);
          }

          // 确保查询参数被正确编码
          const searchParams = new URLSearchParams();
          const originalParams = new URLSearchParams(urlObj.search);
          for (const [key, value] of originalParams.entries()) {
            searchParams.set(key, value);
          }
          urlObj.search = searchParams.toString();

          const protocol = urlObj.protocol === 'https:' ? https : http;

          // 使用URL对象的各个部分来构建请求选项
          const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: headers,
            timeout: 3 * 60000 // 减少超时时间到3分钟
          };

          console.log('请求选项:', {
            hostname: requestOptions.hostname,
            port: requestOptions.port,
            path: requestOptions.path,
            method: requestOptions.method
          });

          // 验证请求选项
          if (!requestOptions.hostname) {
            throw new Error(`请求选项中hostname为空，URL解析可能失败。原始URL: ${cleanUrl}, 解析后hostname: ${urlObj.hostname}`);
          }

          const request = protocol.request(requestOptions, (response: any) => {
            // 处理重定向
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
              const location = response.headers.location;
              if (location) {
                // 使用URL对象来安全地处理重定向URL
                const redirectUrl = location.startsWith('http') ? location : new URL(location, downloadUrl).href;
                console.log(`重定向到: ${redirectUrl}`);
                downloadWithRedirect(redirectUrl, maxRedirects - 1);
                return;
              } else {
                resolve({ success: false, error: `重定向响应缺少Location头: HTTP ${response.statusCode}` });
                return;
              }
            }

            if (response.statusCode !== 200) {
              resolve({ success: false, error: `HTTP ${response.statusCode}` });
              return;
            }

            // 检查响应内容类型
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
              resolve({ success: false, error: '服务器返回HTML内容，可能是登录页面或错误页面' });
              return;
            }

            // 获取文件大小用于进度计算
            const contentLength = parseInt(response.headers['content-length'] || '0');
            let downloadedBytes = 0;

            // 从响应头提取文件名
            let fileName = 'unknown_file';
            const contentDisposition = response.headers['content-disposition'];
            console.log('Content-Disposition头:', contentDisposition);

            if (contentDisposition) {
              // 支持多种Content-Disposition格式：
              // 1. filename="xxx"
              // 2. filename=xxx
              // 3. fileName=xxx (用户要求的格式)
              // 4. attachment;filename=xxx
              // 5. attachment;fileName=xxx
              let fileNameMatch = contentDisposition.match(/fileName[^;=\n]*=([^;\n]*)/i);
              if (!fileNameMatch) {
                fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
              }

              if (fileNameMatch && fileNameMatch[1]) {
                let extractedFileName = fileNameMatch[1].replace(/['"]/g, '').trim();
                console.log('提取的原始文件名:', extractedFileName);

                // 改进的中文文件名解码逻辑
                try {
                  // 方法1: 标准解码
                  let decodedFileName = decodeURIComponent(extractedFileName);
                  console.log('标准解码后的文件名:', decodedFileName);

                  // 检查是否仍然包含乱码字符（如：å、ç、è等）
                  const hasGarbledChars = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(decodedFileName);

                  if (hasGarbledChars) {
                    console.log('检测到乱码字符，尝试UTF-8修复');

                    // 方法2: 将乱码字符串重新编码为UTF-8
                    try {
                      // 将字符串转换为字节数组，然后用UTF-8解码
                      const bytes = [];
                      for (let i = 0; i < decodedFileName.length; i++) {
                        bytes.push(decodedFileName.charCodeAt(i) & 0xFF);
                      }
                      const buffer = Buffer.from(bytes);
                      decodedFileName = buffer.toString('utf8');
                      console.log('UTF-8字节修复后的文件名:', decodedFileName);
                    } catch (e) {
                      console.log('UTF-8字节修复失败:', e);
                    }

                    // 如果还是有问题，尝试其他编码
                    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(decodedFileName)) {
                      try {
                        // 方法3: 尝试从Latin-1到UTF-8的转换
                        const buffer = Buffer.from(extractedFileName, 'latin1');
                        decodedFileName = buffer.toString('utf8');
                        console.log('Latin-1到UTF-8转换后的文件名:', decodedFileName);
                      } catch (e) {
                        console.log('Latin-1到UTF-8转换失败:', e);
                      }
                    }

                    // 如果还是有问题，尝试GBK解码（中文常用编码）
                    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(decodedFileName)) {
                      try {
                        // 方法4: 使用iconv-lite处理GBK编码（如果可用）
                        const iconv = require('iconv-lite');
                        if (iconv.encodingExists('gbk')) {
                          const buffer = Buffer.from(extractedFileName, 'binary');
                          decodedFileName = iconv.decode(buffer, 'gbk');
                          console.log('GBK解码后的文件名:', decodedFileName);
                        }
                      } catch (e) {
                        console.log('GBK解码失败或iconv-lite不可用:', e);
                      }
                    }
                  }

                  extractedFileName = decodedFileName;

                } catch (e) {
                  console.log('标准解码失败，尝试其他方法');

                  try {
                    // 如果标准解码失败，尝试处理UTF-8编码问题
                    // 将字符串转换为Buffer，然后用UTF-8解码
                    const buffer = Buffer.from(extractedFileName, 'latin1');
                    extractedFileName = buffer.toString('utf8');
                    console.log('UTF-8解码后的文件名:', extractedFileName);
                  } catch (e2) {
                    try {
                      // 备用方法：使用escape+decodeURIComponent
                      extractedFileName = decodeURIComponent(escape(extractedFileName));
                      console.log('备用解码后的文件名:', extractedFileName);
                    } catch (e3) {
                      console.warn('所有解码方法都失败，使用原始文件名:', extractedFileName);
                    }
                  }
                }

                if (extractedFileName) {
                  fileName = extractedFileName;
                }
              } else {
                console.warn('无法从Content-Disposition中提取文件名');
              }
            } else {
              console.log('响应中没有Content-Disposition头');
            }

            // 如果没有从Content-Disposition获取到文件名，尝试从URL中提取
            if (fileName === 'unknown_file') {
              try {
                // 使用URL对象来提取文件名
                const urlFileName = urlObj.pathname.split('/').pop();
                if (urlFileName && urlFileName.includes('.')) {
                  fileName = decodeURIComponent(urlFileName);
                  console.log('从URL提取的文件名:', fileName);
                }
              } catch (e) {
                console.warn('从URL提取文件名失败:', e);
              }
            }

            console.log('最终使用的文件名:', fileName);

            // 构建完整的文件路径
            const filePath = path.join(folderPath, fileName);

            // 确保目录存在
            fs.mkdirSync(folderPath, { recursive: true });

            const fileStream = fs.createWriteStream(filePath);

            // 监听数据流，计算下载进度
            response.on('data', (chunk: Buffer) => {
              downloadedBytes += chunk.length;
              if (contentLength > 0) {
                const progress = Math.round((downloadedBytes / contentLength) * 100);
                console.log(`下载进度: ${progress}% (${downloadedBytes}/${contentLength} bytes)`);
              }
            });

            response.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close();

              try {
                const stats = fs.statSync(filePath);
                console.log(`文件下载完成，大小: ${stats.size} bytes`);

                // 优化文件验证：只对小文件或文件开头进行HTML检查
                const shouldCheckContent = stats.size < 1024 * 1024; // 只检查小于1MB的文件
                if (shouldCheckContent) {
                  const fileBuffer = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
                  const fileStart = fileBuffer.slice(0, 500).toLowerCase(); // 只检查前500字符

                  // 检查是否包含HTML特征
                  if (fileStart.includes('<!doctype html') ||
                      fileStart.includes('<html') ||
                      fileStart.includes('<head') ||
                      fileStart.includes('<body') ||
                      fileStart.includes('<!html') ||
                      fileStart.includes('<?xml')) {

                    fs.unlinkSync(filePath);
                    resolve({ success: false, error: '服务器返回HTML内容，可能是登录页面或错误页面' });
                    return;
                  }
                } else {
                  console.log('文件较大，跳过HTML内容检查');
                }

                resolve({
                  success: true,
                  fileName: fileName,
                  fileSize: stats.size
                });
              } catch (e) {
                try {
                  if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                  }
                } catch (unlinkError) {
                  // 忽略删除文件的错误
                }
                resolve({ success: false, error: `文件处理失败: ${e instanceof Error ? e.message : '未知错误'}` });
              }
            });

            fileStream.on('error', (error: Error) => {
              resolve({ success: false, error: `文件写入失败: ${error.message}` });
            });
          });

          request.on('error', (error: Error) => {
            resolve({ success: false, error: `网络请求失败: ${error.message}` });
          });

          request.on('timeout', () => {
            request.destroy();
            resolve({ success: false, error: '请求超时（60秒）' });
          });

          request.end();
        } catch (error) {
          console.error('URL解析失败:', error);
          resolve({ success: false, error: `URL解析失败: ${error instanceof Error ? error.message : '未知错误'}` });
        }
      };

      // 直接使用传入的url参数进行下载，不再重复解析curl命令
      downloadWithRedirect(url);
    });
  } catch (error) {
    return {
      success: false,
      error: `下载失败: ${error instanceof Error ? error.message : '未知错误'}`
    };
  }
});

// 获取文件信息（HEAD请求）
ipcMain.handle('get-file-info', async (event, url: string, headers: Record<string, string>) => {
  try {
    const https = require('https');
    const http = require('http');

    return new Promise<{ contentDisposition?: string; contentLength?: string; contentType?: string }>((resolve, reject) => {
      const getInfoWithRedirect = (infoUrl: string, maxRedirects: number = 5) => {
        if (maxRedirects <= 0) {
          reject(new Error('重定向次数过多'));
          return;
        }

        const protocol = infoUrl.startsWith('https:') ? https : http;
        const request = protocol.request(infoUrl, {
          method: 'HEAD',
          headers,
          timeout: 10000
        }, (response: HttpResponse) => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
            const location = response.headers.location;
            if (location) {
              const redirectUrl = location.startsWith('http') ? location : new URL(location, infoUrl).href;
              console.log(`获取文件信息重定向到: ${redirectUrl}`);
              getInfoWithRedirect(redirectUrl, maxRedirects - 1);
              return;
            } else {
              reject(new Error(`重定向响应缺少Location头: HTTP ${response.statusCode}`));
              return;
            }
          }

          if (response.statusCode < 400) {
            resolve({
              contentDisposition: response.headers['content-disposition'],
              contentLength: response.headers['content-length'],
              contentType: response.headers['content-type']
            });
          } else {
            reject(new Error(`HTTP ${response.statusCode}`));
          }
        });

        request.on('error', reject);
        request.on('timeout', () => {
          request.destroy();
          reject(new Error('请求超时'));
        });

        request.end();
      };

      getInfoWithRedirect(url);
    });
  } catch (error) {
    throw new Error(`获取文件信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

// 获取文件统计信息
ipcMain.handle('get-file-stats', async (event, filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    throw new Error(`获取文件统计信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

// 打开文件
ipcMain.handle('open-file', async (event, filePath: string) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(filePath);
  } catch (error) {
    throw new Error(`打开文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

// 在文件夹中显示文件
ipcMain.handle('show-file-in-folder', async (event, filePath: string) => {
  try {
    const { shell } = require('electron');
    await shell.showItemInFolder(filePath);
  } catch (error) {
    throw new Error(`显示文件位置失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

// 确保目录存在
ipcMain.handle('ensure-directory', async (event, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error) {
    throw new Error(`创建目录失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
});

// 路径操作
ipcMain.handle('path-join', async (event, ...paths: string[]) => {
  return path.join(...paths);
});

ipcMain.handle('path-dirname', async (event, filePath: string) => {
  return path.dirname(filePath);
});

// URL 验证
ipcMain.handle('validate-url', async (event, url: string, headers: Record<string, string>) => {
  try {
    const https = require('https');
    const http = require('http');

    return new Promise<{ isValid: boolean; error?: string }>((resolve) => {
      const validateWithRedirect = (validateUrl: string, maxRedirects: number = 5) => {
        if (maxRedirects <= 0) {
          resolve({ isValid: false, error: '重定向次数过多' });
          return;
        }

        const protocol = validateUrl.startsWith('https:') ? https : http;
        const request = protocol.get(validateUrl, { headers, timeout: 10000 }, (response: HttpResponse) => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
            const location = response.headers.location;
            if (location) {
              // 如果是相对URL，转换为绝对URL
              const redirectUrl = location.startsWith('http') ? location : new URL(location, validateUrl).href;
              console.log(`验证重定向到: ${redirectUrl}`);
              validateWithRedirect(redirectUrl, maxRedirects - 1);
              return;
            } else {
              resolve({ isValid: false, error: `重定向响应缺少Location头: HTTP ${response.statusCode}` });
              return;
            }
          }

          if (response.statusCode < 400) {
            resolve({ isValid: true });
          } else {
            resolve({ isValid: false, error: `HTTP ${response.statusCode}` });
          }
        });

        request.on('error', (error: Error) => {
          resolve({ isValid: false, error: error.message });
        });

        request.on('timeout', () => {
          request.destroy();
          resolve({ isValid: false, error: '请求超时' });
        });
      };

      validateWithRedirect(url);
    });
  } catch (error) {
    return { isValid: false, error: error instanceof Error ? error.message : '未知错误' };
  }
});

// 存储相关
ipcMain.handle('storage-get', async (event, key: string, defaultValue?: unknown) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return data[key] !== undefined ? data[key] : defaultValue;
    }
    return defaultValue;
  } catch (error) {
    console.error('读取配置失败:', error);
    return defaultValue;
  }
});

ipcMain.handle('storage-set', async (event, key: string, value: unknown) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    let data: Record<string, unknown> = {};

    if (fs.existsSync(configPath)) {
      data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    data[key] = value;
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('保存配置失败:', error);
    throw error;
  }
});

ipcMain.handle('storage-clear', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.error('清除配置失败:', error);
    throw error;
  }
});

// 获取完整配置
ipcMain.handle('storage-get-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        lastCurlCommand: data.lastCurlCommand || '',
        lastExcelPath: data.lastExcelPath || '',
        lastDownloadPath: data.lastDownloadPath || '',
        maxConcurrentDownloads: data.maxConcurrentDownloads || 3
      };
    }
    return {
      lastCurlCommand: '',
      lastExcelPath: '',
      lastDownloadPath: '',
      maxConcurrentDownloads: 3
    };
  } catch (error) {
    console.error('读取配置失败:', error);
    return {
      lastCurlCommand: '',
      lastExcelPath: '',
      lastDownloadPath: '',
      maxConcurrentDownloads: 3
    };
  }
});

// 批量下载
ipcMain.handle('start-batch-download', async (event, options: any) => {
  try {
    console.log('开始批量下载:', options);

    const { curlCommand, excelRows, downloadPath, maxConcurrent } = options;

    if (!curlCommand || !excelRows || !downloadPath) {
      throw new Error('缺少必要的下载参数');
    }

    // 导入 DownloadService 和 CurlService
    const { DownloadService } = require('./services/download-service');
    const downloadService = DownloadService.getInstance();

    // 注入下载函数
    downloadService.setDownloadFunction(async (url: string, folderPath: string, headers: Record<string, string>) => {
      // 使用主进程中已有的下载逻辑
      const https = require('https');
      const http = require('http');
      const fs = require('fs');
      const path = require('path');

      // URL编码处理函数
      const encodeUrl = (rawUrl: string): string => {
        try {
          // 首先进行预处理，确保特殊字符被正确编码
          const preProcessedUrl = preProcessUrl(rawUrl);

          // 使用URL构造函数来规范化URL
          const urlObj = new URL(preProcessedUrl);

          // 确保查询参数被正确编码
          const searchParams = new URLSearchParams();

          // 手动处理每个查询参数，确保值被正确编码
          const originalParams = new URLSearchParams(urlObj.search);
          for (const [key, value] of originalParams.entries()) {
            // 对参数值进行更严格的编码
            const encodedValue = strictEncodeURIComponent(value);
            searchParams.set(key, encodedValue);
          }

          urlObj.search = searchParams.toString();
          return urlObj.toString();
        } catch (error) {
          // 如果URL构造失败，尝试手动编码
          console.warn('URL规范化失败，使用手动编码:', error);
          return manualEncodeUrl(rawUrl);
        }
      };

      // 预处理URL，处理可能导致解析失败的字符
      const preProcessUrl = (url: string): string => {
        // 分离URL的基础部分和查询参数部分
        const urlParts = url.split('?');
        if (urlParts.length < 2) {
          return url; // 没有查询参数，直接返回
        }

        const baseUrl = urlParts[0];
        const queryString = urlParts.slice(1).join('?');

        // 处理查询参数中的特殊字符
        const processedQueryString = queryString
          .split('&')
          .map(param => {
            const [key, value] = param.split('=');
            if (key && value !== undefined) {
              // 确保参数值中的特殊字符被正确处理
              const processedValue = value
                .replace(/\s/g, '%20')  // 空格
                .replace(/"/g, '%22')   // 双引号
                .replace(/'/g, '%27')   // 单引号
                .replace(/</g, '%3C')   // 小于号
                .replace(/>/g, '%3E')   // 大于号
                .replace(/\[/g, '%5B')  // 左方括号
                .replace(/\]/g, '%5D')  // 右方括号
                .replace(/\{/g, '%7B')  // 左花括号
                .replace(/\}/g, '%7D')  // 右花括号
                .replace(/\|/g, '%7C')  // 竖线
                .replace(/\\/g, '%5C')  // 反斜杠
                .replace(/\^/g, '%5E')  // 插入符号
                .replace(/`/g, '%60');  // 反引号

              return `${key}=${processedValue}`;
            }
            return param;
          })
          .join('&');

        return `${baseUrl}?${processedQueryString}`;
      };

      // 更严格的URI组件编码
      const strictEncodeURIComponent = (str: string): string => {
        return encodeURIComponent(str)
          .replace(/[!'()*]/g, (c) => {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
          });
      };

      // 手动编码URL中的特殊字符
      const manualEncodeUrl = (url: string): string => {
        try {
          // 分离URL的各个部分
          const urlParts = url.split('?');
          if (urlParts.length < 2) {
            return url; // 没有查询参数，直接返回
          }

          const baseUrl = urlParts[0];
          const queryString = urlParts.slice(1).join('?');

          // 处理查询参数
          const params = queryString.split('&');
          const encodedParams = params.map(param => {
            const [key, value] = param.split('=');
            if (key && value !== undefined) {
              // 对参数值进行更严格的编码
              let encodedValue = value;

              // 首先解码，然后重新编码，确保不会重复编码
              try {
                encodedValue = decodeURIComponent(value);
              } catch (e) {
                // 如果解码失败，说明可能已经是编码状态或包含无效字符
                encodedValue = value;
              }

              // 使用更严格的编码
              encodedValue = strictEncodeURIComponent(encodedValue);

              return `${key}=${encodedValue}`;
            }
            return param;
          });

          return `${baseUrl}?${encodedParams.join('&')}`;
        } catch (error) {
          console.warn('手动URL编码失败:', error);
          return url; // 编码失败时返回原URL
        }
      };

      return new Promise<{ success: boolean; fileName?: string; fileSize?: number; error?: string }>((resolve) => {
        const downloadWithRedirect = (downloadUrl: string, maxRedirects: number = 5) => {
          if (maxRedirects <= 0) {
            resolve({ success: false, error: '重定向次数过多' });
            return;
          }

          try {
            // 使用URL对象来安全地处理URL
            const urlObj = new URL(downloadUrl.trim());

            // 确保查询参数被正确编码
            const searchParams = new URLSearchParams();
            const originalParams = new URLSearchParams(urlObj.search);
            for (const [key, value] of originalParams.entries()) {
              searchParams.set(key, value);
            }
            urlObj.search = searchParams.toString();

            const protocol = urlObj.protocol === 'https:' ? https : http;

            // 使用URL对象的各个部分来构建请求选项
            const requestOptions = {
              hostname: urlObj.hostname,
              port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
              path: urlObj.pathname.trim() + urlObj.search.trim(),
              method: 'GET',
              headers: headers,
              timeout: 300000
            };

            console.log('请求选项:', {
              hostname: requestOptions.hostname,
              port: requestOptions.port,
              path: requestOptions.path,
              method: requestOptions.method
            });

            const request = protocol.request(requestOptions, (response: any) => {
              // 处理重定向
              if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                const location = response.headers.location;
                if (location) {
                  // 使用URL对象来安全地处理重定向URL
                  const redirectUrl = location.startsWith('http') ? location : new URL(location, downloadUrl).href;
                  console.log(`重定向到: ${redirectUrl}`);
                  downloadWithRedirect(redirectUrl, maxRedirects - 1);
                  return;
                } else {
                  resolve({ success: false, error: `重定向响应缺少Location头: HTTP ${response.statusCode}` });
                  return;
                }
              }

              if (response.statusCode !== 200) {
                resolve({ success: false, error: `HTTP ${response.statusCode}` });
                return;
              }

              // 检查响应内容类型
              const contentType = response.headers['content-type'] || '';
              if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
                resolve({ success: false, error: '服务器返回HTML内容，可能是登录页面或错误页面' });
                return;
              }

              // 从响应头提取文件名
              let fileName = 'unknown_file';
              const contentDisposition = response.headers['content-disposition'];
              console.log('Content-Disposition头:', contentDisposition);

              if (contentDisposition) {
                // 支持多种Content-Disposition格式：
                // 1. filename="xxx"
                // 2. filename=xxx
                // 3. fileName=xxx (用户要求的格式)
                // 4. attachment;filename=xxx
                // 5. attachment;fileName=xxx
                let fileNameMatch = contentDisposition.match(/fileName[^;=\n]*=([^;\n]*)/i);
                if (!fileNameMatch) {
                  fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
                }

                if (fileNameMatch && fileNameMatch[1]) {
                  let extractedFileName = fileNameMatch[1].replace(/['"]/g, '').trim();
                  console.log('提取的原始文件名:', extractedFileName);

                  // 改进的中文文件名解码逻辑
                  try {
                    // 方法1: 标准解码
                    let decodedFileName = decodeURIComponent(extractedFileName);
                    console.log('标准解码后的文件名:', decodedFileName);

                    // 检查是否仍然包含乱码字符（如：å、ç、è等）
                    const hasGarbledChars = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(decodedFileName);

                    if (hasGarbledChars) {
                      console.log('检测到乱码字符，尝试UTF-8修复');

                      // 方法2: 将乱码字符串重新编码为UTF-8
                      try {
                        // 将字符串转换为字节数组，然后用UTF-8解码
                        const bytes = [];
                        for (let i = 0; i < decodedFileName.length; i++) {
                          bytes.push(decodedFileName.charCodeAt(i) & 0xFF);
                        }
                        const buffer = Buffer.from(bytes);
                        decodedFileName = buffer.toString('utf8');
                        console.log('UTF-8字节修复后的文件名:', decodedFileName);
                      } catch (e) {
                        console.log('UTF-8字节修复失败:', e);
                      }

                      // 如果还是有问题，尝试其他编码
                      if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(decodedFileName)) {
                        try {
                          // 方法3: 尝试从Latin-1到UTF-8的转换
                          const buffer = Buffer.from(extractedFileName, 'latin1');
                          decodedFileName = buffer.toString('utf8');
                          console.log('Latin-1到UTF-8转换后的文件名:', decodedFileName);
                        } catch (e) {
                          console.log('Latin-1到UTF-8转换失败:', e);
                        }
                      }

                      // 如果还是有问题，尝试GBK解码（中文常用编码）
                      if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(decodedFileName)) {
                        try {
                          // 方法4: 使用iconv-lite处理GBK编码（如果可用）
                          const iconv = require('iconv-lite');
                          if (iconv.encodingExists('gbk')) {
                            const buffer = Buffer.from(extractedFileName, 'binary');
                            decodedFileName = iconv.decode(buffer, 'gbk');
                            console.log('GBK解码后的文件名:', decodedFileName);
                          }
                        } catch (e) {
                          console.log('GBK解码失败或iconv-lite不可用:', e);
                        }
                      }
                    }

                    extractedFileName = decodedFileName;

                  } catch (e) {
                    console.log('标准解码失败，尝试其他方法');

                    try {
                      // 如果标准解码失败，尝试处理UTF-8编码问题
                      // 将字符串转换为Buffer，然后用UTF-8解码
                      const buffer = Buffer.from(extractedFileName, 'latin1');
                      extractedFileName = buffer.toString('utf8');
                      console.log('UTF-8解码后的文件名:', extractedFileName);
                    } catch (e2) {
                      try {
                        // 备用方法：使用escape+decodeURIComponent
                        extractedFileName = decodeURIComponent(escape(extractedFileName));
                        console.log('备用解码后的文件名:', extractedFileName);
                      } catch (e3) {
                        console.warn('所有解码方法都失败，使用原始文件名:', extractedFileName);
                      }
                    }
                  }

                  if (extractedFileName) {
                    fileName = extractedFileName;
                  }
                } else {
                  console.warn('无法从Content-Disposition中提取文件名');
                }
              } else {
                console.log('响应中没有Content-Disposition头');
              }

              // 如果没有从Content-Disposition获取到文件名，尝试从URL中提取
              if (fileName === 'unknown_file') {
                try {
// 使用URL对象来提取文件名
                  const urlFileName = urlObj.pathname.split('/').pop();
                  if (urlFileName && urlFileName.includes('.')) {
                    fileName = decodeURIComponent(urlFileName);
                  }
                } catch (e) {
                  console.warn('从URL提取文件名失败:', e);
                }
              }

              console.log('最终使用的文件名:', fileName);

              // 构建完整的文件路径
              const filePath = path.join(folderPath, fileName);

              // 确保目录存在
              fs.mkdirSync(folderPath, { recursive: true });

              const fileStream = fs.createWriteStream(filePath);
              response.pipe(fileStream);

              fileStream.on('finish', () => {
                fileStream.close();

                try {
                  const fileBuffer = fs.readFileSync(filePath);
                  const fileStart = fileBuffer.slice(0, 100).toString().toLowerCase();

                  // 检查是否包含HTML特征
                  if (fileStart.includes('<!doctype html') ||
                      fileStart.includes('<html') ||
                      fileStart.includes('<head') ||
                      fileStart.includes('<body') ||
                      fileStart.includes('<!html') ||
                      fileStart.includes('<?xml')) {

                    fs.unlinkSync(filePath);
                    resolve({ success: false, error: '服务器返回HTML内容，可能是登录页面或错误页面' });
                    return;
                  }

                  const stats = fs.statSync(filePath);
                  resolve({
                    success: true,
                    fileName: fileName,
                    fileSize: stats.size
                  });
                } catch (e) {
                  try {
                    if (fs.existsSync(filePath)) {
                      fs.unlinkSync(filePath);
                    }
                  } catch (unlinkError) {
                    // 忽略删除文件的错误
                  }
                  resolve({ success: false, error: `文件内容验证失败: ${e instanceof Error ? e.message : '未知错误'}` });
                }
              });

              fileStream.on('error', (error: Error) => {
                resolve({ success: false, error: `文件写入失败: ${error.message}` });
              });
            });

            request.on('error', (error: Error) => {
              resolve({ success: false, error: `网络请求失败: ${error.message}` });
            });

            request.on('timeout', () => {
              request.destroy();
              resolve({ success: false, error: '请求超时' });
            });

            request.end();
          } catch (error) {
            console.error('URL解析失败:', error);
            resolve({ success: false, error: `URL解析失败: ${error instanceof Error ? error.message : '未知错误'}` });
          }
        };

        // 直接使用传入的url参数进行下载，不再重复解析curl命令
        downloadWithRedirect(url);
      });
    });

    // 开始批量下载
    const result = await downloadService.startBatchDownload({
      curlCommand,
      excelRows,
      downloadPath,
      maxConcurrent: maxConcurrent || 3
    });

    return result;
  } catch (error) {
    console.error('批量下载失败:', error);
    throw error;
  }
});

// CURL 命令验证
ipcMain.handle('validate-curl-command', async (event, command: string) => {
  try {
    // 简单的 CURL 命令验证
    const isValid = command.trim().startsWith('curl ');
    const errors: string[] = [];

    if (!isValid) {
      errors.push('命令必须以 "curl " 开头');
    }

    if (!command.includes('http')) {
      errors.push('命令必须包含有效的URL');
    }

    return {
      isValid: isValid && errors.length === 0,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['验证失败: ' + (error instanceof Error ? error.message : '未知错误')]
    };
  }
});

// 选择 Excel 文件
ipcMain.handle('select-excel-file', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel 文件', extensions: ['xlsx', 'xls'] }
    ],
    title: '选择 Excel 文件'
  });

  return result.canceled ? null : result.filePaths[0];
});

// Excel 文件验证
ipcMain.handle('validate-excel-file', async (event, filePath: string) => {
  try {
    console.log('验证Excel文件:', filePath);

    // 使用 xlsx 库读取文件
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return {
        isValid: false,
        rows: [],
        totalRows: 0,
        validRows: 0,
        errors: ['Excel文件为空或无法读取'],
        warnings: []
      };
    }

    // 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return {
        isValid: false,
        rows: [],
        totalRows: 0,
        validRows: 0,
        errors: ['Excel文件至少需要包含标题行和一行数据'],
        warnings: []
      };
    }

    // 验证标题行
    const headers = jsonData[0] as string[];
    const requiredColumns = ['标准名称', '标准编号', '存储文件名', '文件ID'];
    const errors: string[] = [];

    for (const requiredColumn of requiredColumns) {
      if (!headers.includes(requiredColumn)) {
        errors.push(`缺少必需的列: ${requiredColumn}`);
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        rows: [],
        totalRows: 0,
        validRows: 0,
        errors,
        warnings: []
      };
    }

    // 获取列索引
    const columnIndexes = {
      标准名称: headers.indexOf('标准名称'),
      标准编号: headers.indexOf('标准编号'),
      存储文件名: headers.indexOf('存储文件名'),
      文件ID: headers.indexOf('文件ID')
    };

    // 解析数据行
    const rows: any[] = [];
    let validRowCount = 0;
    const warnings: string[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];

      // 检查行是否为空
      if (row.every(cell => !cell || cell.toString().trim() === '')) {
        continue;
      }

      // 验证必需字段
      const 标准名称 = row[columnIndexes.标准名称]?.toString().trim() || '';
      const 标准编号 = row[columnIndexes.标准编号]?.toString().trim() || '';
      const 存储文件名 = row[columnIndexes.存储文件名]?.toString().trim() || '';
      const 文件ID = row[columnIndexes.文件ID]?.toString().trim() || '';

      if (!标准名称 || !标准编号 || !存储文件名 || !文件ID) {
        warnings.push(`第${i + 1}行缺少必需数据`);
        continue;
      }

      rows.push({
        标准名称,
        标准编号,
        存储文件名,
        文件ID
      });

      validRowCount++;
    }

    const totalRows = jsonData.length - 1;
    const isValid = validRowCount > 0;

    if (validRowCount === 0) {
      errors.push('没有找到有效的数据行');
    } else if (validRowCount < totalRows) {
      warnings.push(`共${totalRows}行，其中${validRowCount}行有效`);
    }

    return {
      isValid,
      rows,
      totalRows,
      validRows: validRowCount,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      rows: [],
      totalRows: 0,
      validRows: 0,
      errors: ['文件验证失败: ' + (error instanceof Error ? error.message : '未知错误')],
      warnings: []
    };
  }
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason, promise);
});
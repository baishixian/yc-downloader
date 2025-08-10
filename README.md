# 文件下载器

一个基于Electron的文件批量下载工具，支持从Excel文件读取下载信息，使用CURL命令进行下载。

## 功能特性

- 📁 **Excel文件上传**：支持上传包含下载信息的Excel文件
- 🔗 **CURL命令支持**：支持CURL命令格式的下载请求
- 📂 **智能文件夹创建**：根据Excel中的"存储文件名"列自动创建对应的文件夹
- 📝 **文件名自动提取**：从HTTP响应头的Content-Disposition中自动提取实际文件名
- 🌐 **中文编码支持**：正确处理中文文件名的编码问题
- ⚡ **并发下载**：支持多线程并发下载，提高下载效率
- 📊 **详细任务列表**：显示标准名称、文件ID、下载状态、保存位置等信息
- 🔍 **文件预览**：支持点击预览已下载的文件
- 📍 **位置定位**：快速定位文件在系统中的位置
- 📈 **下载统计**：实时显示下载进度和成功率

## 安装和运行

### 1. 克隆项目
```bash
git clone <repository-url>
cd downloader
```

### 2. 安装依赖
```bash
npm install
```

### 3. 运行开发环境
```bash
npm run dev
```

### 4. 构建生产版本
```bash
npm run build
```

## 使用方法

### 1. 准备Excel文件
Excel文件应包含以下列：
- **标准名称**：文件的标准名称
- **标准编号**：文件的标准编号
- **存储文件名**：用于创建文件夹的名称（将作为文件保存的文件夹）
- **文件ID**：文件的唯一标识符

### 2. 准备CURL命令
CURL命令中应包含`{stddId}`占位符，程序会自动替换为Excel中对应的文件ID。

示例：
```bash
curl -H "Authorization: Bearer token" "https://api.example.com/download/{stddId}"
```

### 3. 开始下载
1. 上传Excel文件
2. 输入CURL命令
3. 选择下载路径
4. 设置并发下载数
5. 点击"开始下载"

## 下载逻辑说明

### 文件夹结构
程序会根据Excel中的"存储文件名"列创建对应的文件夹，下载的文件将保存在这些文件夹中。

### 文件名提取
程序会从HTTP响应头的`Content-Disposition: attachment; filename=xxx`中提取实际的文件名，支持：
- 标准filename格式
- URL编码的文件名
- 中文文件名（自动处理编码）

### 文件保存路径
最终的文件保存路径为：`下载路径/存储文件名/实际文件名`

## 技术架构

- **前端**：React + TypeScript
- **后端**：Electron + Node.js
- **构建工具**：Webpack
- **样式**：CSS3 + 自定义组件库

## 主要组件

- **ExcelUpload**：Excel文件上传和解析
- **CurlInput**：CURL命令输入和验证
- **DownloadPanel**：下载配置和启动
- **ResultView**：下载结果展示和文件管理

## API接口

### 文件操作
- `getFileInfo(url, headers)`：获取文件信息（HEAD请求）
- `downloadFile(url, filePath, headers)`：下载文件
- `getFileStats(filePath)`：获取文件统计信息
- `openFile(filePath)`：打开文件
- `showFileInFolder(filePath)`：在文件夹中显示文件

### 路径操作
- `pathJoin(...paths)`：路径拼接
- `pathDirname(filePath)`：获取目录路径
- `ensureDirectory(dirPath)`：确保目录存在

## 错误处理

程序会处理以下类型的错误：
- 网络连接错误
- HTTP状态码错误
- 文件系统权限错误
- 文件名编码错误
- 重定向循环错误

## 注意事项

1. **网络环境**：确保网络连接稳定，支持HTTPS
2. **文件权限**：确保有足够的权限创建文件夹和文件
3. **磁盘空间**：确保有足够的磁盘空间存储下载的文件
4. **并发设置**：根据网络环境调整并发下载数，建议1-5个

## 开发说明

### 项目结构
```
src/
├── main.ts              # Electron主进程
├── preload.ts           # 预加载脚本
├── renderer/            # 渲染进程
│   ├── App.tsx         # 主应用组件
│   ├── components/     # 组件目录
│   └── styles.css      # 样式文件
├── services/            # 服务层
├── types/               # 类型定义
└── utils/               # 工具函数
```

### 开发模式
- 使用`npm run dev`启动开发服务器
- 支持热重载和调试
- 使用`npm run build`构建生产版本

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！ 
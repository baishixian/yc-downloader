import { CurlCommand, ValidationResult } from '../types';

export class CurlService {
  /**
   * 解析CURL命令
   * @param curlCommand CURL命令字符串
   * @returns 解析后的CURL命令对象
   */
  static parseCurlCommand(curlCommand: string): CurlCommand {
    try {
      // 移除开头的 'curl' 命令
      let command = curlCommand.trim();
      if (command.startsWith('curl ')) {
        command = command.substring(5);
      }

      // 处理多个curl命令拼接的情况，只取第一个
      const curlSeparatorIndex = command.indexOf('curl ');
      if (curlSeparatorIndex > 0) {
        // 找到第二个curl命令的位置，只保留第一个
        command = command.substring(0, curlSeparatorIndex).trim();
        console.warn('检测到多个curl命令拼接，只使用第一个命令');
      }

      // 提取URL - 改进的方法：从命令末尾提取URL，而不是从header中提取
      let url = '';

      // 首先移除所有的 -H "header" 参数，然后从剩余部分提取URL
      let cleanCommand = command;

      // 移除所有 -H "..." 参数
      cleanCommand = cleanCommand.replace(/-H\s+(['"])((?:[^'"]|\\['"])*?)\1/g, '');

      // 移除其他常见参数
      cleanCommand = cleanCommand.replace(/--compressed/g, '');
      cleanCommand = cleanCommand.replace(/-X\s+\w+/g, '');
      cleanCommand = cleanCommand.replace(/--data[^"]*"[^"]*"/g, '');

      // 清理多余的空格
      cleanCommand = cleanCommand.trim();

      console.log('清理后的命令:', cleanCommand);

      // 现在从清理后的命令中提取URL
      // 先尝试匹配引号包围的URL
      const quotedUrlMatch = cleanCommand.match(/["']([^"']*https?:\/\/[^"']+)["']/);
      if (quotedUrlMatch) {
        url = quotedUrlMatch[1];
        console.log('从引号中提取URL:', url);
      } else {
        // 如果没有引号，匹配以http开头的URL直到空格或命令结束
        const urlMatch = cleanCommand.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          url = urlMatch[1];
          console.log('从命令中提取URL:', url);
        }
      }

      if (!url) {
        console.error('无法解析URL，原始命令:', command);
        console.error('清理后命令:', cleanCommand);
        return {
          url: '',
          headers: {},
          method: 'GET',
          isValid: false,
          error: '无法解析URL'
        };
      }

      // 确保URL被正确编码
      url = this.normalizeUrl(url);
      console.log('规范化后的URL:', url);

      // 提取请求头 - 改进的正则表达式，更好地处理引号转义
      const headers: Record<string, string> = {};

      // 匹配 -H "header: value" 或 -H 'header: value' 格式
      const headerMatches = command.matchAll(/-H\s+(['"])((?:[^'"]|\\['"])*?)\1/g);

      for (const match of headerMatches) {
        const headerString = match[2];
        const colonIndex = headerString.indexOf(':');

        if (colonIndex > 0) {
          const headerName = headerString.substring(0, colonIndex).trim();
          let headerValue = headerString.substring(colonIndex + 1).trim();

          // 处理转义的引号
          headerValue = headerValue.replace(/\\"/g, '"').replace(/\\'/g, "'");

          headers[headerName] = headerValue;
        }
      }

      // 提取请求方法
      let method = 'GET';
      const methodMatch = command.match(/-X\s+(\w+)/);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
      }

      // 验证是否为GET请求
      if (method !== 'GET') {
        return {
          url,
          headers,
          method,
          isValid: false,
          error: '仅支持GET请求'
        };
      }

      console.log('解析成功 - URL:', url);
      console.log('解析成功 - Headers:', Object.keys(headers));

      return {
        url,
        headers,
        method,
        isValid: true
      };
    } catch (error) {
      console.error('解析CURL命令失败:', error);
      return {
        url: '',
        headers: {},
        method: 'GET',
        isValid: false,
        error: `解析失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 规范化URL，确保正确编码
   * @param url 原始URL
   * @returns 规范化后的URL
   */
  private static normalizeUrl(url: string): string {
    try {
      // 首先尝试手动预处理URL，确保特殊字符被正确编码
      const preProcessedUrl = this.preProcessUrl(url);

      // 使用URL构造函数来规范化URL
      const urlObj = new URL(preProcessedUrl);

      // 确保查询参数被正确编码
      const searchParams = new URLSearchParams();

      // 手动处理每个查询参数，确保值被正确编码
      const originalParams = new URLSearchParams(urlObj.search);
      for (const [key, value] of originalParams.entries()) {
        // 对参数值进行更严格的编码
        const encodedValue = this.strictEncodeURIComponent(value);
        searchParams.set(key, encodedValue);
      }

      urlObj.search = searchParams.toString();
      return urlObj.toString();
    } catch (error) {
      // 如果URL构造失败，尝试手动编码
      console.warn('URL规范化失败，尝试手动编码:', error);
      return this.manualEncodeUrl(url);
    }
  }

  /**
   * 预处理URL，处理可能导致解析失败的字符
   * @param url 原始URL
   * @returns 预处理后的URL
   */
  private static preProcessUrl(url: string): string {
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
  }

  /**
   * 更严格的URI组件编码
   * @param str 要编码的字符串
   * @returns 编码后的字符串
   */
  private static strictEncodeURIComponent(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
      });
  }

  /**
   * 手动编码URL中的特殊字符
   * @param url 原始URL
   * @returns 编码后的URL
   */
  private static manualEncodeUrl(url: string): string {
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
          encodedValue = this.strictEncodeURIComponent(encodedValue);

          return `${key}=${encodedValue}`;
        }
        return param;
      });

      return `${baseUrl}?${encodedParams.join('&')}`;
    } catch (error) {
      console.warn('手动URL编码失败:', error);
      return url; // 编码失败时返回原URL
    }
  }

  /**
   * 验证CURL命令是否可以正常访问
   * @param curlCommand CURL命令字符串
   * @returns 验证结果
   */
  static async validateCurlCommand(curlCommand: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: false,
      errors: [],
      warnings: []
    };

    try {
      const parsed = this.parseCurlCommand(curlCommand);

      if (!parsed.isValid) {
        result.errors.push(parsed.error || 'CURL命令格式无效');
        return result;
      }

      // 测试URL是否可访问
      try {
        const validationResult = await window.electronAPI.validateUrl(parsed.url, parsed.headers);

        if (validationResult.isValid) {
          result.isValid = true;
          result.warnings.push('CURL命令验证成功');
        } else {
          result.errors.push(validationResult.error || 'URL验证失败');
        }
      } catch (error) {
        result.errors.push(`验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } catch (error) {
      result.errors.push(`验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 替换URL中的stddId参数
   * @param url 原始URL
   * @param newStddId 新的标准ID
   * @returns 替换后的URL
   */
  static replaceStddId(url: string, newStddId: string): string {
    try {
      console.log(`replaceStddId - 原始URL: ${url}`);
      console.log(`replaceStddId - 新的stddId: ${newStddId}`);

      // 使用URL对象来安全地处理URL参数
      const urlObj = new URL(url);
      const searchParams = urlObj.searchParams;

      // 替换stddId参数（支持大小写变体）
      let replaced = false;
      if (searchParams.has('stddId')) {
        searchParams.set('stddId', newStddId);
        replaced = true;
        console.log(`replaceStddId - 替换了stddId参数`);
      }
      if (searchParams.has('stddid')) {
        searchParams.set('stddid', newStddId);
        replaced = true;
        console.log(`replaceStddId - 替换了stddid参数`);
      }

      // 重新构建URL，确保参数被正确编码
      urlObj.search = searchParams.toString();
      const result = urlObj.toString();

      console.log(`replaceStddId - 替换后URL: ${result}`);
      console.log(`replaceStddId - 是否进行了替换: ${replaced}`);

      return result;
    } catch (error) {
      // 如果URL解析失败，回退到字符串替换方式
      console.warn('URL对象处理失败，使用字符串替换:', error);
      console.log(`replaceStddId - 回退到字符串替换，原始URL: ${url}`);

      let result = url.replace(/stddId=[^&\s"']+/g, `stddId=${encodeURIComponent(newStddId)}`);
      result = result.replace(/stddid=[^&\s"']+/g, `stddid=${encodeURIComponent(newStddId)}`);

      console.log(`replaceStddId - 字符串替换后URL: ${result}`);
      return result;
    }
  }
}
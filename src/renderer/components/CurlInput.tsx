import React, { useState, useCallback } from 'react';
import { debounce } from '../../utils';

interface CurlInputProps {
  value: string;
  onChange: (command: string) => void;
  onValidate: (isValid: boolean) => void;
}

const CurlInput: React.FC<CurlInputProps> = ({ value, onChange, onValidate }) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  // 防抖验证
  const debouncedValidate = useCallback(
    debounce(async (command: string) => {
      if (!command.trim()) {
        setValidationResult(null);
        onValidate(false);
        return;
      }

      setIsValidating(true);
      try {
        // 通过 electronAPI 与主进程通信，而不是直接使用服务
        const result = await window.electronAPI?.validateCurlCommand?.(command);
        const isValid = result?.isValid || false;
        
        setValidationResult({
          isValid,
          message: isValid 
            ? 'CURL命令验证成功' 
            : (result?.errors?.join(', ') || '验证失败'),
          type: isValid ? 'success' : 'error'
        });
        
        onValidate(isValid);
      } catch (error) {
        setValidationResult({
          isValid: false,
          message: '验证失败: ' + (error instanceof Error ? error.message : '未知错误'),
          type: 'error'
        });
        onValidate(false);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    [onValidate]
  );

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const command = e.target.value;
    onChange(command);
    debouncedValidate(command);
  };

  // 处理粘贴
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.includes('curl')) {
      // 阻止默认粘贴行为，避免重复处理
      e.preventDefault();

      // 自动清理粘贴的文本
      const cleanedCommand = pastedText.trim();
      onChange(cleanedCommand);
      debouncedValidate(cleanedCommand);
    }
  };

  // 清空输入
  const handleClear = () => {
    onChange('');
    setValidationResult(null);
    onValidate(false);
  };

  // 获取状态样式类
  const getStatusClass = () => {
    if (isValidating) return 'validating';
    if (validationResult?.type === 'success') return 'success';
    if (validationResult?.type === 'error') return 'error';
    if (validationResult?.type === 'warning') return 'warning';
    return '';
  };

  return (
    <div className="curl-input">
      <div className="form-group">
        <label className="form-label">
          CURL命令
          <span className="text-sm text-gray-600 ml-2">
            (仅支持GET请求，将自动替换stddId参数)
          </span>
        </label>
        <textarea
          className={`form-input form-textarea ${getStatusClass()}`}
          value={value}
          onChange={handleInputChange}
          onPaste={handlePaste}
          placeholder="粘贴CURL命令，例如: curl -H 'Authorization: Bearer token' 'https://api.example.com/download?stddId=123'"
          disabled={isValidating}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          onClick={() => debouncedValidate(value)}
          disabled={!value.trim() || isValidating}
        >
          {isValidating ? (
            <>
              <span className="loading"></span>
              验证中...
            </>
          ) : (
            '验证CURL'
          )}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleClear}
          disabled={!value.trim()}
        >
          清空
        </button>
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
        </div>
      )}

      {/* 使用提示 */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-bold text-blue-800 mb-2">使用说明：</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 粘贴完整的CURL命令，包含所有必要的请求头和参数</li>
          <li>• 确保URL中包含stddId参数，程序会自动替换此参数</li>
          <li>• 仅支持GET请求，不支持POST、PUT等其他方法</li>
          <li>• 程序会保持所有原始参数不变，只替换stddId值</li>
        </ul>
      </div>
    </div>
  );
};

export default CurlInput;
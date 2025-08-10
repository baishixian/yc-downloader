import * as XLSX from 'xlsx';
import { ExcelRow, ExcelValidationResult } from '../types';

export class ExcelService {
  /**
   * 验证Excel文件格式
   * @param file Excel文件对象
   * @returns 验证结果
   */
  static async validateExcelFile(file: File): Promise<ExcelValidationResult> {
    const result: ExcelValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      rows: [],
      totalRows: 0,
      validRows: 0
    };

    try {
      // 读取Excel文件
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        result.errors.push('Excel文件为空或无法读取');
        return result;
      }

      // 转换为JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        result.errors.push('Excel文件至少需要包含标题行和一行数据');
        return result;
      }

      // 验证标题行
      const headers = jsonData[0] as string[];
      const requiredColumns = ['标准名称', '标准编号', '存储文件名', '文件ID'];
      
      for (const requiredColumn of requiredColumns) {
        if (!headers.includes(requiredColumn)) {
          result.errors.push(`缺少必需的列: ${requiredColumn}`);
        }
      }

      if (result.errors.length > 0) {
        return result;
      }

      // 获取列索引
      const columnIndexes = {
        标准名称: headers.indexOf('标准名称'),
        标准编号: headers.indexOf('标准编号'),
        存储文件名: headers.indexOf('存储文件名'),
        文件ID: headers.indexOf('文件ID')
      };

      // 解析数据行
      const rows: ExcelRow[] = [];
      let validRowCount = 0;

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
          result.warnings.push(`第${i + 1}行缺少必需数据`);
          continue;
        }

        // // 验证文件ID格式（假设是数字）
        // if (isNaN(Number(文件ID))) {
        //   result.warnings.push(`第${i + 1}行文件ID格式无效: ${文件ID}`);
        //   continue;
        // }

        rows.push({
          标准名称,
          标准编号,
          存储文件名,
          文件ID
        });

        validRowCount++;
      }

      result.totalRows = jsonData.length - 1;
      result.validRows = validRowCount;
      result.rows = rows;
      result.isValid = validRowCount > 0;

      if (validRowCount === 0) {
        result.errors.push('没有找到有效的数据行');
      } else if (validRowCount < result.totalRows) {
        result.warnings.push(`共${result.totalRows}行，其中${validRowCount}行有效`);
      }

    } catch (error) {
      result.errors.push(`读取Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 从Excel文件读取数据
   * @param file Excel文件对象
   * @returns Excel行数据数组
   */
  static async readExcelFile(file: File): Promise<ExcelRow[]> {
    const validation = await this.validateExcelFile(file);
    
    if (!validation.isValid) {
      throw new Error(`Excel文件验证失败: ${validation.errors.join(', ')}`);
    }

    return validation.rows;
  }

  /**
   * 导出下载结果到Excel
   * @param data 要导出的数据
   * @param filePath 保存路径
   */
  static exportToExcel(data: any[], filePath: string): void {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '下载结果');
      XLSX.writeFile(workbook, filePath);
    } catch (error) {
      throw new Error(`导出Excel失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
} 
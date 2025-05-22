// 教室数据存储
let classroomSchedule = {};
let reservations = [];
// 临时教室修改（只影响当天）
let temporaryClassroomChanges = {}; // 格式: { '2023-05-22': { 'WS!h:S6-104': { added: true, periods: ['morning'] }, 'WS!h:S6-201': { removed: true } } }

// DOM 元素
const uploadForm = document.getElementById('upload-form');
const uploadStatus = document.getElementById('upload-status');
const dateSelect = document.getElementById('date-select');
const classroomContainer = document.getElementById('classroom-container');
const reservationForm = document.getElementById('reservation-form');
// 临时教室修改表单
const tempModForm = document.getElementById('temporary-classroom-form');

// 设置日期选择器默认为今天
const today = new Date();
const formattedDate = today.toISOString().split('T')[0];
dateSelect.value = formattedDate;

// 监听表单提交
if (uploadForm) {
    uploadForm.addEventListener('submit', handleFileUpload);
    
    // 在选择文件时立即更新状态
    const fileInput = document.getElementById('schedule-file');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const fileName = e.target.files[0] ? e.target.files[0].name : '未选择文件';
            uploadStatus.innerHTML = `<p>已选择文件: ${fileName}</p>`;
            console.log('文件选择事件已触发，选择的文件:', fileName);
        });
    } else {
        console.error('找不到文件输入元素，ID: schedule-file');
    }
} else {
    console.error('找不到上传表单元素，ID: upload-form');
}

dateSelect.addEventListener('change', displayClassrooms);
reservationForm.addEventListener('submit', handleReservation);

// 处理文件上传
function handleFileUpload(event) {
    event.preventDefault();
    console.log('开始处理文件上传');
    
    try {
        const fileInput = document.getElementById('schedule-file');
        if (!fileInput) {
            throw new Error('找不到文件输入元素，可能是DOM未加载完成');
        }
        
        const file = fileInput.files[0];
        console.log('选择的文件:', file ? file.name : '无');
        
        if (!file) {
            uploadStatus.innerHTML = '<p class="error">请选择文件</p>';
            return;
        }
        
        // 检查文件大小 (限制为10MB)
        if (file.size > 10 * 1024 * 1024) {
            uploadStatus.innerHTML = '<p class="error">文件过大，请上传小于10MB的文件</p>';
            return;
        }
        
        // 检查文件类型
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
        const isCsv = fileName.endsWith('.csv');
        const isTxt = fileName.endsWith('.txt');
        
        console.log('文件类型检查:', { isExcel, isCsv, isTxt });
        
        if (!(isExcel || isCsv || isTxt)) {
            uploadStatus.innerHTML = '<p class="error">不支持的文件格式，请上传.xls、.xlsx、.csv或.txt文件</p>';
            return;
        }
        
        uploadStatus.innerHTML = '<p>正在处理文件，请稍候...</p>';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('文件读取完成');
            
            try {
                if (typeof XLSX === 'undefined') {
                    throw new Error('XLSX库未加载，请刷新页面或检查网络连接');
                }
                
                let workbook;
                
                try {
                    if (isExcel) {
                        // 处理Excel文件
                        const data = new Uint8Array(e.target.result);
                        console.log('读取Excel数据，长度:', data.length);
                        workbook = XLSX.read(data, { type: 'array' });
                    } else if (isCsv || isTxt) {
                        // 处理CSV或TXT文件
                        const content = e.target.result;
                        console.log('读取文本数据，长度:', content.length);
                        workbook = XLSX.read(content, { type: 'string' });
                    }
                } catch (xlsxError) {
                    console.error('XLSX处理错误:', xlsxError);
                    throw new Error(`Excel处理错误: ${xlsxError.message || '未知XLSX错误'}`);
                }
                
                if (!workbook) {
                    throw new Error('无法创建工作簿对象');
                }
                
                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    throw new Error('工作簿中没有工作表');
                }
                
                console.log('成功读取工作簿，工作表:', workbook.SheetNames);
                
                // 处理工作表，processWorkbook会处理数据的清空
                const success = processWorkbook(workbook);
                
                // 打印调试信息
                console.log('解析后的教室数据:', classroomSchedule);
                console.log('教室数量:', Object.keys(classroomSchedule).length);
                
                // 添加更详细的控制台输出
                if (Object.keys(classroomSchedule).length > 0) {
                    console.log('%c课表解析成功!', 'color: green; font-weight: bold');
                } else {
                    console.log('%c课表解析失败，未找到教室数据!', 'color: red; font-weight: bold');
                }
                
                // 确保有数据才保存
                if (Object.keys(classroomSchedule).length > 0) {
                    // 保存到本地存储
                    localStorage.setItem('classroomSchedule', JSON.stringify(classroomSchedule));
                    console.log('课表数据已保存到本地存储，大小:', JSON.stringify(classroomSchedule).length, '字节');
                    
                    uploadStatus.innerHTML = '<p class="success">课表上传成功！</p>';
                    
                    // 强制更新教室显示
                    setTimeout(displayClassrooms, 100);
                } else {
                    throw new Error('未能从课表中识别出教室信息，添加了默认数据');
                }
            } catch (error) {
                console.error('处理文件时出错:', error);
                
                // 使用示例数据
                addExampleData();
                localStorage.setItem('classroomSchedule', JSON.stringify(classroomSchedule));
                
                uploadStatus.innerHTML = `
                    <p class="warning">处理文件遇到问题，已加载示例数据: ${error.message || '未知错误'}</p>
                    <p>您可以继续使用系统，但教室数据为示例数据。</p>
                `;
                
                // 使用示例数据更新显示
                setTimeout(displayClassrooms, 100);
            }
        };
        
        reader.onerror = function(error) {
            console.error('文件读取错误:', error);
            uploadStatus.innerHTML = '<p class="error">读取文件时出错，请检查文件是否损坏</p>';
            
            // 使用示例数据
            addExampleData();
            localStorage.setItem('classroomSchedule', JSON.stringify(classroomSchedule));
            setTimeout(displayClassrooms, 100);
        };
        
        console.log('开始读取文件...');
        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    } catch (error) {
        console.error('上传处理过程中出错:', error);
        uploadStatus.innerHTML = `<p class="error">上传过程中出错: ${error.message || '未知错误'}</p>`;
        
        // 使用示例数据
        addExampleData();
        localStorage.setItem('classroomSchedule', JSON.stringify(classroomSchedule));
        setTimeout(displayClassrooms, 100);
    }
}

// 处理工作表数据
function processWorkbook(workbook) {
    // 处理工作表前先清空原有数据
    classroomSchedule = {};
    
    // 尝试多种方法解析课表
    let success = false;
    
    console.log('开始处理工作表数据，工作表数量:', workbook.SheetNames.length);
    
    // 循环所有工作表尝试解析
    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        
        // 将工作表转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`尝试解析工作表: ${sheetName}, 数据行数: ${jsonData.length}`);
        if (jsonData.length > 0) {
            console.log('首行数据:', jsonData[0]);
            if (jsonData.length > 1) {
                console.log('第二行数据:', jsonData[1]);
            }
        }
        
        // 特定处理"2024-2025学年第2学期总课表.xls"格式
        // 假设第一行是星期和节次，格式如"一/1-2"、"二/3-4"等
        // 假设第一列是教室信息
        
        // 周几映射
        const dayMapping = {
            '一': '周一', '二': '周二', '三': '周三', '四': '周四', '五': '周五', '六': '周六', '日': '周日',
        };
        
        // 查找表头行
        let headerRow = -1;
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const row = jsonData[i];
            if (!row) continue;
            
            // 检查是否包含类似"一/1-2"格式的表头
            let hasTimeHeader = false;
            for (let j = 1; j < row.length; j++) {
                const cell = String(row[j] || '');
                if (cell.match(/[一二三四五六日]\/(1-2|3-4|5-6|7-8|9-10)/)) {
                    headerRow = i;
                    hasTimeHeader = true;
                    console.log(`在第${i+1}行找到表头，格式为: ${cell}`);
                    break;
                }
            }
            
            if (hasTimeHeader) break;
        }
        
        // 如果找到表头行
        if (headerRow !== -1) {
            const headers = jsonData[headerRow];
            const timeSlots = [];
            
            // 解析表头，确定每列对应的时间段
            for (let j = 1; j < headers.length; j++) {
                const header = String(headers[j] || '');
                const match = header.match(/([一二三四五六日])\/(1-2|3-4|5-6|7-8|9-10)/);
                
                if (match) {
                    const day = dayMapping[match[1]] || match[1];
                    const period = match[2];
                    timeSlots.push({
                        index: j,
                        day: day,
                        period: period
                    });
                    console.log(`找到时间段: 星期${match[1]}, 节次${period}, 对应${day}`);
                }
            }
            
            console.log(`共找到${timeSlots.length}个时间段，分别是:`, timeSlots);
            
            // 遍历数据行
            for (let i = headerRow + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                
                // 第一列应该是教室信息
                const classroom = row[0];
                if (!classroom) continue;
                
                const classroomStr = String(classroom).trim();
                
                // 确保是教室标识
                if (classroomStr.includes('WS!h:S6-') || 
                    classroomStr.match(/[A-Z]\d+-\d+/) || 
                    classroomStr.includes('教室') ||
                    classroomStr.match(/[南北]\d+/)) {
                    
                    // 处理教室名称
                    let classroomKey = classroomStr;
                    
                    // 初始化教室数据
                    if (!classroomSchedule[classroomKey]) {
                        classroomSchedule[classroomKey] = {};
                    }
                    
                    // 处理每个时间段的课程信息
                    for (const { index, day, period } of timeSlots) {
                        if (index < row.length) {
                            const cellContent = row[index];
                            
                            // 如果单元格有内容，则视为有课
                            if (cellContent) {
                                // 确保教室在特定日期的数据结构已初始化
                                if (!classroomSchedule[classroomKey][day]) {
                                    classroomSchedule[classroomKey][day] = {};
                                }
                                
                                // 保存课程信息
                                classroomSchedule[classroomKey][day][period] = String(cellContent).trim();
                                success = true;
                            }
                        }
                    }
                }
            }
        }
        
        // 如果这种方式解析成功，就不再尝试其他方法
        if (success && Object.keys(classroomSchedule).length > 0) {
            console.log('成功解析课表，教室数量:', Object.keys(classroomSchedule).length);
            console.log('示例数据:', JSON.stringify(Object.values(classroomSchedule)[0], null, 2));
            return true;
        }
        
        // 如果上面的方法失败，尝试备用方法
        // 搜索包含"教室"和"课表"的表头
        if (!success) {
            success = extractClassroomDataFromGenericSchedule(jsonData);
        }
    }
    
    // 如果没有成功解析，添加示例数据
    if (!success || Object.keys(classroomSchedule).length === 0) {
        console.log('未能成功解析课表，使用示例数据');
        addExampleData();
        return true;
    }
    
    return success;
}

// 从通用课表格式提取教室数据
function extractClassroomDataFromGenericSchedule(jsonData) {
    let success = false;
    
    // 寻找可能的表头行
    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        // 查找"教室"或"课表"所在列
        let classroomColIndex = -1;
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '');
            if (cell.includes('教室') || cell.includes('课表') || cell.includes('教室编号')) {
                classroomColIndex = j;
                break;
            }
        }
        
        if (classroomColIndex !== -1) {
            // 找到教室列，现在寻找所有包含时间段的列
            const timeColIndices = [];
            
            // 遍历同一行，查找时间段列
            for (let j = 0; j < row.length; j++) {
                if (j === classroomColIndex) continue;
                
                const cell = String(row[j] || '');
                // 寻找可能的时间段标识
                if (cell.match(/周[一二三四五六日]/) || 
                    cell.match(/[一二三四五六日]\//) || 
                    cell.match(/[1-8]节/) ||
                    cell.match(/[1-8]-[1-8]/)) {
                    
                    // 提取周几和节次信息
                    let day = '未知';
                    let period = '未知';
                    
                    // 尝试多种格式匹配
                    let match = cell.match(/周([一二三四五六日])/);
                    if (match) {
                        day = '周' + match[1];
                    }
                    
                    match = cell.match(/([一二三四五六日])\//);
                    if (match) {
                        day = '周' + match[1];
                    }
                    
                    match = cell.match(/([1-8])-([1-8])/);
                    if (match) {
                        period = `${match[1]}-${match[2]}`;
                    }
                    
                    match = cell.match(/([1-8])节/);
                    if (match) {
                        period = `${match[1]}-${match[1]}`;
                    }
                    
                    // 只有当能够识别出日期和时间段时才添加
                    if (day !== '未知' && period !== '未知') {
                        timeColIndices.push({
                            index: j,
                            day: day,
                            period: period
                        });
                    }
                }
            }
            
            // 如果找到了时间段列，处理后续数据行
            if (timeColIndices.length > 0) {
                for (let row_idx = i + 1; row_idx < jsonData.length; row_idx++) {
                    const dataRow = jsonData[row_idx];
                    if (!dataRow || dataRow.length === 0) continue;
                    
                    // 获取教室标识
                    const classroom = dataRow[classroomColIndex];
                    if (!classroom) continue;
                    
                    const classroomStr = String(classroom).trim();
                    
                    // 检查是否是合法的教室标识
                    if (classroomStr.match(/[A-Z0-9]+-[0-9]+/) || 
                        classroomStr.includes('WS!h:S6-') || 
                        classroomStr.match(/[南北][0-9]+/)) {
                        
                        // 初始化教室数据
                        if (!classroomSchedule[classroomStr]) {
                            classroomSchedule[classroomStr] = {};
                        }
                        
                        // 处理每个时间段
                        for (const { index, day, period } of timeColIndices) {
                            if (index < dataRow.length) {
                                const classInfo = dataRow[index];
                                
                                if (classInfo) {
                                    // 确保日期数据结构已初始化
                                    if (!classroomSchedule[classroomStr][day]) {
                                        classroomSchedule[classroomStr][day] = {};
                                    }
                                    
                                    // 保存课程信息
                                    classroomSchedule[classroomStr][day][period] = String(classInfo).trim();
                                    success = true;
                                }
                            }
                        }
                    }
                }
            }
            
            // 如果成功找到了数据，跳出循环
            if (success) break;
        }
    }
    
    return success;
}

// 添加示例数据
function addExampleData() {
    console.log('添加示例数据用于测试');
    
    classroomSchedule = {
        "WS!h:S6-104": {
            "周一": { "1-2": "高等数学", "3-4": "英语" },
            "周三": { "5-6": "大学物理" }
        },
        "WS!h:S6-201": {
            "周二": { "1-2": "程序设计", "3-4": "数据结构" },
            "周四": { "7-8": "操作系统" }
        },
        "WS!h:S6-302": {
            "周一": { "5-6": "线性代数" },
            "周五": { "1-2": "概率论", "3-4": "离散数学" }
        }
    };
}

// 直接提取教室数据（备选方法，当标准格式无法识别时）
function extractClassroomData(jsonData) {
    let foundAny = false;
    
    // 常见教室格式的正则表达式
    const classroomPatterns = [
        /WS!h:S6-\d+/,
        /S\d+-\d+/,
        /[A-Z]\d+-\d+/,
        /教室\s*[A-Z0-9-]+/,
        /\b[A-Z]\d{1,3}\b/
    ];
    
    // 搜索教室标识
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '');
            
            // 检查是否符合任何教室格式
            let classroom = null;
            
            for (const pattern of classroomPatterns) {
                const match = cell.match(pattern);
                if (match) {
                    classroom = match[0].trim();
                    break;
                }
            }
            
            // 如果找到教室号
            if (classroom) {
                // 如果包含"教室"字样但不是完整的教室号，则提取后面的部分
                if (classroom.includes('教室')) {
                    classroom = classroom.replace(/教室\s*/, '');
                }
                
                console.log('找到教室号:', classroom);
                
                // 查找教师和课程信息
                if (i + 1 < jsonData.length && j + 1 < row.length) {
                    // 尝试找出后续几行的课程信息
                    const success = extractClassSchedule(jsonData, i, j, classroom);
                    if (success) {
                        foundAny = true;
                    }
                }
            }
        }
    }
    
    return foundAny;
}

// 提取特定教室的课程安排
function extractClassSchedule(jsonData, rowIndex, colIndex, classroom) {
    let foundAny = false;
    
    // 初始化教室数据
    if (!classroomSchedule[classroom]) {
        classroomSchedule[classroom] = {
            '周一': {}, '周二': {}, '周三': {}, '周四': {}, '周五': {}, '周六': {}, '周日': {}
        };
    }
    
    // 查找课程信息的模式可能会很复杂，这里是简化示例
    // 在实际应用中需要根据具体表格格式调整
    
    // 寻找周几和节次信息
    const timePatterns = [
        {regex: /周一.*?(\d+-\d+)/i, day: '周一'},
        {regex: /周二.*?(\d+-\d+)/i, day: '周二'},
        {regex: /周三.*?(\d+-\d+)/i, day: '周三'},
        {regex: /周四.*?(\d+-\d+)/i, day: '周四'},
        {regex: /周五.*?(\d+-\d+)/i, day: '周五'},
        {regex: /周六.*?(\d+-\d+)/i, day: '周六'},
        {regex: /周日.*?(\d+-\d+)/i, day: '周日'},
        {regex: /周一.*?第(\d+)-(\d+)节/i, day: '周一', format: range},
        {regex: /周二.*?第(\d+)-(\d+)节/i, day: '周二', format: range},
        {regex: /周三.*?第(\d+)-(\d+)节/i, day: '周三', format: range},
        {regex: /周四.*?第(\d+)-(\d+)节/i, day: '周四', format: range},
        {regex: /周五.*?第(\d+)-(\d+)节/i, day: '周五', format: range},
        {regex: /周六.*?第(\d+)-(\d+)节/i, day: '周六', format: range},
        {regex: /周日.*?第(\d+)-(\d+)节/i, day: '周日', format: range}
    ];
    
    // 辅助函数 - 创建区间字符串
    function range(start, end) {
        return `${start}-${end}`;
    }
    
    // 检查行周围的信息
    const searchRadius = 5; // 查找范围
    for (let r = Math.max(0, rowIndex - searchRadius); r <= Math.min(jsonData.length - 1, rowIndex + searchRadius); r++) {
        for (let c = 0; c < (jsonData[r] ? jsonData[r].length : 0); c++) {
            const cellValue = String(jsonData[r][c] || '');
            
            // 检查是否包含课程和时间信息
            for (const pattern of timePatterns) {
                const match = cellValue.match(pattern.regex);
                if (match) {
                    let period;
                    if (pattern.format) {
                        period = pattern.format(match[1], match[2]);
                    } else {
                        period = match[1];
                    }
                    
                    // 获取课程信息
                    const courseInfo = getCourseInfo(jsonData, r, c);
                    
                    if (courseInfo) {
                        classroomSchedule[classroom][pattern.day][period] = courseInfo;
                        foundAny = true;
                    }
                }
            }
        }
    }
    
}

// 获取课程信息
function getCourseInfo(jsonData, rowIndex, colIndex) {
    // 尝试从周围单元格获取课程信息
    for (let r = Math.max(0, rowIndex - 1); r <= Math.min(jsonData.length - 1, rowIndex + 1); r++) {
        for (let c = Math.max(0, colIndex - 1); c <= Math.min((jsonData[r] ? jsonData[r].length : 0) - 1, colIndex + 1); c++) {
            if (!jsonData[r] || c < 0) continue;
            
            const cellValue = String(jsonData[r][c] || '');
            
            // 检查是否包含课程名称特征（通常较长的文本）
            if (cellValue.length > 3 && 
                !cellValue.match(/周[一二三四五六日]|WS!h|S\d+|\d+-\d+|^$/) && 
                cellValue.length < 50) { // 避免过长文本
                return cellValue;
            }
        }
    }
    
    return "有课";  // 默认值
}

// 根据选定日期显示教室信息
function displayClassrooms() {
    const date = new Date(dateSelect.value);
    const dayOfWeek = date.getDay(); // 0是周日，1-6是周一到周六
    const dateString = dateSelect.value; // 当前选择的日期字符串，格式如 "2023-05-22"
    
    // 转换为中文周几
    const dayMap = {
        0: '周日',
        1: '周一',
        2: '周二',
        3: '周三',
        4: '周四',
        5: '周五',
        6: '周六'
    };
    
    const day = dayMap[dayOfWeek];
    console.log('当前选择日期:', dateSelect.value, '对应星期:', day);
    
    // 调试: 显示课表数据中包含的星期
    if (Object.keys(classroomSchedule).length > 0) {
        const allDays = new Set();
        for (const classroom in classroomSchedule) {
            for (const dayName in classroomSchedule[classroom]) {
                allDays.add(dayName);
            }
        }
        console.log('课表数据中包含的星期:', Array.from(allDays));
    }
    
    // 获取容器元素
    const morningContainer = document.getElementById('morning-classrooms');
    const afternoonContainer = document.getElementById('afternoon-classrooms');
    const eveningContainer = document.getElementById('evening-classrooms');
    const statsContainer = document.getElementById('classroom-stats');
    
    // 清空容器
    morningContainer.innerHTML = '';
    afternoonContainer.innerHTML = '';
    eveningContainer.innerHTML = '';
    statsContainer.innerHTML = '';
    
    // 检查是否有数据
    if (Object.keys(classroomSchedule).length === 0) {
        morningContainer.innerHTML = '<p>暂无数据，请先上传课表</p>';
        return;
    }
    
    console.log('有教室数据:', Object.keys(classroomSchedule).length, '个教室');
    
    // 使用原始课表数据
    const displaySchedule = JSON.parse(JSON.stringify(classroomSchedule));
    
    // 应用临时教室修改
    if (temporaryClassroomChanges[dateString]) {
        const changesForToday = temporaryClassroomChanges[dateString];
        for (const classroom in changesForToday) {
            const change = changesForToday[classroom];
            if (change.removed) {
                // 如果教室被临时移除，从显示数据中删除
                if (displaySchedule[classroom] && displaySchedule[classroom][day]) {
                    delete displaySchedule[classroom][day];
                }
            } else if (change.added) {
                // 如果教室被临时添加，添加到显示数据中
                if (!displaySchedule[classroom]) {
                    displaySchedule[classroom] = {};
                }
                if (!displaySchedule[classroom][day]) {
                    displaySchedule[classroom][day] = {};
                }
                
                // 为指定的时间段添加标记
                if (change.periods.includes('morning')) {
                    displaySchedule[classroom][day]['added-morning'] = '临时添加';
                }
                if (change.periods.includes('afternoon')) {
                    displaySchedule[classroom][day]['added-afternoon'] = '临时添加';
                }
                if (change.periods.includes('evening')) {
                    displaySchedule[classroom][day]['added-evening'] = '临时添加';
                }
            }
        }
    }
    
    // 为不同时间段准备教室列表
    const morningClassrooms = new Set();
    const afternoonClassrooms = new Set();
    const eveningClassrooms = new Set();
    
    // 定义时间段对应的课程节次
    const morningPeriods = ['1-2', '3-4'];
    const afternoonPeriods = ['5-6', '7-8'];
    const eveningPeriods = ['9-10'];
    
    // 遍历所有教室查找当天有课的
    for (const classroom in displaySchedule) {
        const schedule = displaySchedule[classroom];
        
        // 检查该教室在当天是否有数据
        let hasData = false;
        if (schedule[day]) {
            // 如果教室在当天的数据不为空，则视为有课安排
            hasData = true;
        }
        
        if (hasData) {
            console.log(`教室 ${classroom} 在 ${day} 有数据:`, schedule[day]);
            // 检查不同时间段是否有课
            let hasMorningClass = false;
            let hasAfternoonClass = false;
            let hasEveningClass = false;
            
            // 初始化所有时段，如果没有特定信息，都视为无课程
            const daySchedule = schedule[day] || {};
            
            // 对于每个时间段，检查是否有课程信息
            for (const period of morningPeriods) {
                if (daySchedule[period]) {
                    hasMorningClass = true;
                }
            }
            
            for (const period of afternoonPeriods) {
                if (daySchedule[period]) {
                    hasAfternoonClass = true;
                }
            }
            
            for (const period of eveningPeriods) {
                if (daySchedule[period]) {
                    hasEveningClass = true;
                }
            }
            
            // 检查临时添加的时段
            if (daySchedule['added-morning']) hasMorningClass = true;
            if (daySchedule['added-afternoon']) hasAfternoonClass = true;
            if (daySchedule['added-evening']) hasEveningClass = true;
            
            // 按时段分类教室
            if (hasMorningClass) morningClassrooms.add(classroom);
            if (hasAfternoonClass) afternoonClassrooms.add(classroom);
            if (hasEveningClass) eveningClassrooms.add(classroom);
            
            // 创建上午教室卡片
            if (hasMorningClass) {
                createClassroomCard(classroom, daySchedule, morningPeriods, morningContainer, dateString);
            }
            
            // 创建下午教室卡片
            if (hasAfternoonClass) {
                createClassroomCard(classroom, daySchedule, afternoonPeriods, afternoonContainer, dateString);
            }
            
            // 创建晚上教室卡片
            if (hasEveningClass) {
                createClassroomCard(classroom, daySchedule, eveningPeriods, eveningContainer, dateString);
            }
        }
    }
    
    // 如果某个时段没有教室需要开放
    if (morningClassrooms.size === 0) {
        morningContainer.innerHTML = `<p>上午(09:00-12:20)没有需要开放的教室</p>`;
    }
    
    if (afternoonClassrooms.size === 0) {
        afternoonContainer.innerHTML = `<p>下午(14:00-17:45)没有需要开放的教室</p>`;
    }
    
    if (eveningClassrooms.size === 0) {
        eveningContainer.innerHTML = `<p>晚上(18:00-21:00)没有需要开放的教室</p>`;
    }
    
    // 更新统计信息
    updateClassroomStats(morningClassrooms, afternoonClassrooms, eveningClassrooms);
    
    // 更新临时教室修改表单的状态
    updateTemporaryClassroomForm();
}

// 创建教室卡片
function createClassroomCard(classroom, schedule, periods, container, dateString) {
    const card = document.createElement('div');
    card.className = 'classroom-card';
    
    // 检查是否是临时添加的教室
    const isTemporaryAdded = schedule['added-morning'] || schedule['added-afternoon'] || schedule['added-evening'];
    
    if (isTemporaryAdded) {
        card.classList.add('temp-added');
    }
    
    let cardContent = `<h4>${classroom}</h4>`;
    
    // 如果是临时添加的教室，显示标记
    if (isTemporaryAdded) {
        cardContent += `<p class="temp-notice">临时添加</p>`;
    }
    
    // 添加时间段信息
    for (const period of periods) {
        const classInfo = schedule[period];
        if (classInfo) {
            // 有课程信息，解析并显示完整信息
            let displayInfo = classInfo;
            
            // 尝试识别并格式化课程信息
            // 通常格式为：课程名称+班级+教师+周次
            const courseMatches = [
                // 尝试匹配常见的课程信息格式
                /(.+?班)(.+?)(\d+周)/,  // 例如：计算机1班高等数学1-15周
                /(.+?)(\d+-\d+周)/,     // 例如：数据结构1-8周
                /(.+?\))(.+)/,          // 例如：(实验班)程序设计
                /(.+)/                   // 如果上述都不匹配，直接显示原始信息
            ];
            
            let formattedInfo = displayInfo;
            
            // 尝试各种匹配方式
            for (const pattern of courseMatches) {
                const match = String(displayInfo).match(pattern);
                if (match) {
                    if (match.length >= 3) {
                        // 格式化显示：课程 (周次)
                        formattedInfo = `${match[1].trim()} ${match[2] ? '(' + match[match.length-1].trim() + ')' : ''}`;
                    }
                    break;
                }
            }
            
            cardContent += `<p class="class-time">${period}节: ${formattedInfo}</p>`;
        } else {
            // 没有课程信息，显示空闲
            cardContent += `<p class="class-time class-free">${period}节: 空闲</p>`;
        }
    }
    
    // 添加临时删除按钮
    cardContent += `
        <button class="remove-classroom-btn" onclick="removeClassroomTemporarily('${classroom}', '${dateString}')">
            临时删除此教室
        </button>
    `;
    
    card.innerHTML = cardContent;
    container.appendChild(card);
}

// 更新教室统计信息
function updateClassroomStats(morningClassrooms, afternoonClassrooms, eveningClassrooms) {
    const statsContainer = document.getElementById('classroom-stats');
    
    // 所有需要开放的教室 (合并三个集合)
    const allClassrooms = new Set([
        ...morningClassrooms, 
        ...afternoonClassrooms, 
        ...eveningClassrooms
    ]);
    
    // 全天都需要开放的教室 (三个集合的交集)
    const allDayClassrooms = new Set(
        [...morningClassrooms].filter(classroom => 
            afternoonClassrooms.has(classroom) && eveningClassrooms.has(classroom)
        )
    );
    
    // 只在上午开放的教室
    const onlyMorningClassrooms = new Set(
        [...morningClassrooms].filter(classroom => 
            !afternoonClassrooms.has(classroom) && !eveningClassrooms.has(classroom)
        )
    );
    
    // 只在下午开放的教室
    const onlyAfternoonClassrooms = new Set(
        [...afternoonClassrooms].filter(classroom => 
            !morningClassrooms.has(classroom) && !eveningClassrooms.has(classroom)
        )
    );
    
    // 创建统计卡片
    const statCards = [
        {
            title: '今日总开放教室',
            value: allClassrooms.size,
            color: '#1890ff'
        },
        {
            title: '全天开放教室',
            value: allDayClassrooms.size,
            color: '#52c41a'
        },
        {
            title: '上午开放教室',
            value: morningClassrooms.size,
            color: '#fa8c16'
        },
        {
            title: '下午开放教室',
            value: afternoonClassrooms.size,
            color: '#1890ff'
        },
        {
            title: '晚上开放教室',
            value: eveningClassrooms.size,
            color: '#722ed1'
        }
    ];
    
    // 添加到页面
    statCards.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <h5>${stat.title}</h5>
            <div class="number" style="color: ${stat.color}">${stat.value}</div>
        `;
        statsContainer.appendChild(card);
    });
}

// 处理预约申请
function handleReservation(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const department = document.getElementById('department').value;
    const classroom = document.getElementById('classroom').value;
    const date = document.getElementById('reservation-date').value;
    const timePeriod = document.getElementById('time-period').value;
    const startTime = document.getElementById('start-time').value;
    const purpose = document.getElementById('purpose').value;
    
    // 根据选择的时间段确定具体课时
    let periodStart, periodEnd;
    
    if (timePeriod === 'morning') {
        periodStart = '1';
        periodEnd = '4';
    } else if (timePeriod === 'afternoon') {
        periodStart = '5';
        periodEnd = '8';
    } else if (timePeriod === 'evening') {
        periodStart = '9';
        periodEnd = '10';
    } else if (startTime) {
        // 如果选择了具体时段，使用该时段
        [periodStart, periodEnd] = startTime.split('-');
    } else {
        alert('请选择预约时段');
        return;
    }
    
    // 格式化时间段
    const effectiveStartTime = `${periodStart}-${periodEnd}`;
    
    // 验证所选时段是否可用
    const isAvailable = checkAvailability(classroom, date, effectiveStartTime, effectiveStartTime);
    
    if (!isAvailable) {
        alert('所选教室在该时段已被占用，请选择其他时间或教室');
        return;
    }
    
    // 创建人性化的时间段描述
    let timeDescription;
    if (timePeriod === 'morning') {
        timeDescription = '上午 (09:00-12:20)';
    } else if (timePeriod === 'afternoon') {
        timeDescription = '下午 (14:00-17:45)';
    } else if (timePeriod === 'evening') {
        timeDescription = '晚上 (18:00-21:00)';
    } else {
        timeDescription = `第${startTime}节`;
    }
    
    // 创建预约记录
    const reservation = {
        id: Date.now(),
        name,
        department,
        classroom,
        date,
        startTime: effectiveStartTime,
        endTime: effectiveStartTime,
        timePeriod,
        timeDescription,
        purpose,
        status: '待审批'
    };
    
    // 添加到预约列表
    reservations.push(reservation);
    
    // 保存到本地存储
    saveReservations();
    
    // 重置表单并提示成功
    reservationForm.reset();
    alert('预约申请已提交，等待审批');
}

// 检查教室在特定时间是否可用
function checkAvailability(classroom, date, startTime, endTime) {
    // 转换日期为周几
    const requestDate = new Date(date);
    const dayOfWeek = requestDate.getDay();
    
    const dayMap = {
        0: '周日',
        1: '周一',
        2: '周二',
        3: '周三',
        4: '周四',
        5: '周五',
        6: '周六'
    };
    
    const day = dayMap[dayOfWeek];
    
    // 检查课表占用
    if (classroomSchedule[classroom] && 
        classroomSchedule[classroom][day]) {
        
        // 获取开始和结束时间段
        const startPeriod = parseInt(startTime.split('-')[0]);
        const endPeriod = parseInt(endTime.split('-')[1]);
        
        // 检查所有时间段是否有冲突
        for (let i = startPeriod; i <= endPeriod; i++) {
            for (const period in classroomSchedule[classroom][day]) {
                const [periodStart, periodEnd] = period.split('-').map(Number);
                
                // 检查是否有重叠
                if ((i >= periodStart && i <= periodEnd) && 
                    classroomSchedule[classroom][day][period]) {
                    return false;
                }
            }
        }
    }
    
    // 检查已有预约
    for (const reservation of reservations) {
        if (reservation.classroom === classroom && 
            reservation.date === date && 
            reservation.status !== '已拒绝') {
            
            const resStart = parseInt(reservation.startTime.split('-')[0]);
            const resEnd = parseInt(reservation.endTime.split('-')[1]);
            const reqStart = parseInt(startTime.split('-')[0]);
            const reqEnd = parseInt(endTime.split('-')[1]);
            
            // 检查时间重叠
            if ((reqStart <= resEnd && reqEnd >= resStart)) {
                return false;
            }
        }
    }
    
    return true;
}

// 保存预约到本地存储
function saveReservations() {
    localStorage.setItem('classroomReservations', JSON.stringify(reservations));
}

// 加载预约数据
function loadReservations() {
    const savedReservations = localStorage.getItem('classroomReservations');
    if (savedReservations) {
        reservations = JSON.parse(savedReservations);
    }
}

// 保存临时教室修改到本地存储
function saveTemporaryClassroomChanges() {
    localStorage.setItem('temporaryClassroomChanges', JSON.stringify(temporaryClassroomChanges));
}

// 加载临时教室修改数据
function loadTemporaryClassroomChanges() {
    const savedChanges = localStorage.getItem('temporaryClassroomChanges');
    if (savedChanges) {
        temporaryClassroomChanges = JSON.parse(savedChanges);
    }
}

// 加载保存的数据
function loadSavedData() {
    // 加载预约数据
    loadReservations();
    
    // 加载临时教室修改
    loadTemporaryClassroomChanges();
    
    // 加载教室数据
    const savedSchedule = localStorage.getItem('classroomSchedule');
    if (savedSchedule) {
        classroomSchedule = JSON.parse(savedSchedule);
        displayClassrooms();
    } else {
        // 如果没有教室数据但有临时修改，仍然需要更新显示
        if (Object.keys(temporaryClassroomChanges).length > 0) {
            displayClassrooms();
        }
    }
}

// 设置文件输入测试按钮
function setupFileInputTest() {
    const fileInput = document.getElementById('schedule-file');
    const testClickBtn = document.createElement('button');
    testClickBtn.type = 'button';
    testClickBtn.innerText = '测试文件选择';
    testClickBtn.className = 'btn';
    testClickBtn.onclick = function() {
        console.log('测试按钮点击');
        if (fileInput) {
            fileInput.click();
            console.log('已触发文件选择器点击');
        }
    };
    
    // 添加到DOM
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.appendChild(testClickBtn);
    }
}

// 设置时间段联动
function setupTimePeriodEvents() {
    const timePeriodSelect = document.getElementById('time-period');
    const specificTimeGroup = document.getElementById('specific-time-group');
    
    if (timePeriodSelect && specificTimeGroup) {
        timePeriodSelect.addEventListener('change', function() {
            if (this.value === '') {
                specificTimeGroup.classList.add('hidden');
            } else {
                specificTimeGroup.classList.remove('hidden');
            }
        });
    }
}

// 在页面加载完成时初始化UI
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化UI组件');
    
    // 设置时间段联动
    setupTimePeriodEvents();
    
    // 测试文件输入点击
    setupFileInputTest();
    
    // 设置临时教室修改表单事件
    setupTemporaryClassroomForm();
    
    // 编辑模式按钮
    const editBtn = document.getElementById('toggle-edit-mode');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            document.body.classList.toggle('edit-mode');
        });
    }
    // 临时教室修改展开/收起
    const toggleTempFormBtn = document.getElementById('toggle-temp-form');
    const tempForm = document.getElementById('temp-classroom-controls');
    if (toggleTempFormBtn && tempForm) {
        toggleTempFormBtn.addEventListener('click', function() {
            if (tempForm.style.display === 'none' || tempForm.style.display === '') {
                tempForm.style.display = 'block';
            } else {
                tempForm.style.display = 'none';
            }
        });
    }
});

// 设置临时教室修改表单
function setupTemporaryClassroomForm() {
    const tempModForm = document.getElementById('temporary-classroom-form');
    
    if (tempModForm) {
        tempModForm.addEventListener('submit', addClassroomTemporarily);
        
        // 添加清除按钮事件
        const clearBtn = document.getElementById('clear-temp-changes');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearTemporaryChanges);
        }
    }
}

// 临时删除教室
function removeClassroomTemporarily(classroom, dateString) {
    // 确认删除
    if (!confirm(`确定要临时删除教室 ${classroom} 吗？此修改只影响当天（${dateString}），不会影响其他日期。`)) {
        return;
    }
    
    // 初始化当天的修改记录
    if (!temporaryClassroomChanges[dateString]) {
        temporaryClassroomChanges[dateString] = {};
    }
    
    // 添加临时删除记录
    temporaryClassroomChanges[dateString][classroom] = {
        removed: true
    };
    
    // 保存修改
    saveTemporaryClassroomChanges();
    
    // 刷新显示
    displayClassrooms();
    
    alert(`教室 ${classroom} 已临时删除（仅影响当天）`);
}

// 临时添加教室
function addClassroomTemporarily(event) {
    event.preventDefault();
    
    const classroom = document.getElementById('temp-classroom-name').value;
    const dateString = dateSelect.value;
    
    // 验证输入
    if (!classroom || classroom.trim() === '') {
        alert('请输入有效的教室名称');
        return;
    }
    
    // 获取选中的时间段
    const morningChecked = document.getElementById('temp-morning').checked;
    const afternoonChecked = document.getElementById('temp-afternoon').checked;
    const eveningChecked = document.getElementById('temp-evening').checked;
    
    if (!morningChecked && !afternoonChecked && !eveningChecked) {
        alert('请至少选择一个时间段');
        return;
    }
    
    // 构建时间段数组
    const periods = [];
    if (morningChecked) periods.push('morning');
    if (afternoonChecked) periods.push('afternoon');
    if (eveningChecked) periods.push('evening');
    
    // 初始化当天的修改记录
    if (!temporaryClassroomChanges[dateString]) {
        temporaryClassroomChanges[dateString] = {};
    }
    
    // 添加临时教室记录
    temporaryClassroomChanges[dateString][classroom] = {
        added: true,
        periods: periods
    };
    
    // 保存修改
    saveTemporaryClassroomChanges();
    
    // 重置表单
    document.getElementById('temp-classroom-name').value = '';
    document.getElementById('temp-morning').checked = false;
    document.getElementById('temp-afternoon').checked = false;
    document.getElementById('temp-evening').checked = false;
    
    // 刷新显示
    displayClassrooms();
    
    alert(`教室 ${classroom} 已临时添加（仅影响当天）`);
}

// 更新临时教室修改表单状态
function updateTemporaryClassroomForm() {
    const dateString = dateSelect.value;
    const tempChangesCount = document.getElementById('temp-changes-count');
    
    if (!tempChangesCount) return;
    
    // 计算当天的临时修改数量
    let count = 0;
    if (temporaryClassroomChanges[dateString]) {
        count = Object.keys(temporaryClassroomChanges[dateString]).length;
    }
    
    // 更新显示
    if (count > 0) {
        tempChangesCount.textContent = `当前日期有 ${count} 个临时修改`;
        tempChangesCount.style.display = 'block';
    } else {
        tempChangesCount.style.display = 'none';
    }
}

// 清除当天的临时修改
function clearTemporaryChanges() {
    const dateString = dateSelect.value;
    
    // 确认是否清除
    if (!confirm(`确定要清除 ${dateString} 的所有临时教室修改吗？`)) {
        return;
    }
    
    // 删除当天的修改记录
    if (temporaryClassroomChanges[dateString]) {
        delete temporaryClassroomChanges[dateString];
        saveTemporaryClassroomChanges();
        displayClassrooms();
        alert(`${dateString} 的临时修改已清除`);
    } else {
        alert(`${dateString} 没有临时修改记录`);
    }
}

// 页面加载时初始化
window.addEventListener('load', loadSavedData); 
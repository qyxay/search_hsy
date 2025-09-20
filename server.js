// 导入Node.js内置模块
const http = require('http');
const fs = require('fs').promises;  // 异步文件操作
const path = require('path');      // 路径处理
const url = require('url');        // URL解析
const querystring = require('querystring');  // 查询参数解析

// 1. 配置：JSON资料库路径（按需求修改）
const JSON_FILE_PATH = "C:\\Users\\未来可期\\Desktop\\file-search\\资料库.json";
const PORT = 3000;  // 服务器端口

// 2. 创建HTTP服务器
const server = http.createServer(async (req, res) => {
    // 解析请求URL和路径
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;

    // 3. 处理跨域（确保前端能正常调用API）
    res.setHeader('Access-Control-Allow-Origin', '*');  // 允许所有域访问（开发环境用）
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求（OPTIONS）
    if (req.method === 'OPTIONS') {
        res.writeHead(204);  // 无内容响应
        res.end();
        return;
    }

    // 4. 接口1：搜索接口（/search）- 核心功能
    if (pathname === '/search' && req.method === 'GET') {
        try {
            // 4.1 解析搜索参数（关键词、是否区分大小写、是否全词匹配）
            const queryParams = querystring.parse(parsedUrl.query);
            const searchQuery = queryParams.query || '';  // 搜索关键词
            const caseSensitive = queryParams.caseSensitive === 'true';  // 是否区分大小写
            const wholeWords = queryParams.wholeWords === 'true';  // 是否全词匹配

            // 4.2 读取并解析JSON资料库
            const jsonContent = await fs.readFile(JSON_FILE_PATH, 'utf8');
            const characterData = JSON.parse(jsonContent);  // 解析为JS对象

            // 4.3 执行搜索（遍历角色数据，匹配关键词）
            const searchResults = searchInJson(characterData, searchQuery, caseSensitive, wholeWords);

            // 4.4 返回搜索结果（JSON格式）
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                results: searchResults,
                total: searchResults.length
            }));
        } catch (error) {
            // 4.5 处理错误（如文件不存在、JSON格式错误）
            console.error('搜索接口错误:', error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: false,
                error: error.message || '加载JSON资料库或搜索时出错'
            }));
        }
        return;
    }

    // 5. 接口2：提供前端页面（访问根路径时返回search.html）
    if (pathname === '/' && req.method === 'GET') {
        try {
            // 拼接search.html的路径（与server.js同级目录）
            const htmlPath = path.join(__dirname, 'search.html');
            const htmlContent = await fs.readFile(htmlPath, 'utf8');
            
            // 返回HTML页面
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(htmlContent);
        } catch (error) {
            // 页面不存在时返回404
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('未找到搜索页面（search.html可能不存在）');
        }
        return;
    }

    // 6. 其他路径：返回404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('未找到请求的资源（仅支持访问 / 或 /search）');
});

// 7. 核心函数：在JSON角色数据中搜索关键词
function searchInJson(characterData, query, caseSensitive, wholeWords) {
    if (!query.trim()) return [];  // 关键词为空时返回空结果

    const results = [];
    const queryStr = caseSensitive ? query : query.toLowerCase();  // 统一大小写（若不区分）

    // 遍历所有角色（JSON的key为角色名，value为角色信息）
    Object.keys(characterData).forEach(characterName => {
        const characterInfo = characterData[characterName];
        let isMatch = false;  // 是否匹配关键词
        const matchedInfo = {};  // 存储匹配的信息（过滤未匹配内容）

        // 递归遍历角色的所有信息（支持嵌套结构，如sentence的子属性）
        function traverseInfo(info, parentKey = '') {
            if (typeof info === 'string') {
                // 处理字符串类型（如description、content）
                const infoStr = caseSensitive ? info : info.toLowerCase();
                let match = false;

                // 全词匹配：用正则匹配完整单词
                if (wholeWords) {
                    const regex = new RegExp(`\\b${escapeRegExp(queryStr)}\\b`, caseSensitive ? 'g' : 'gi');
                    match = regex.test(info);
                } else {
                    // 部分匹配：包含关键词即可
                    match = infoStr.includes(queryStr);
                }

                if (match) {
                    isMatch = true;
                    // 关键词高亮（在原字符串中标记匹配部分）
                    const highlightedInfo = highlightKeyword(info, query, caseSensitive, wholeWords);
                    matchedInfo[parentKey] = highlightedInfo;
                }
            } else if (typeof info === 'object' && info !== null) {
                // 处理对象类型（如sentence包含content、tone、source）
                const nestedMatched = {};
                let nestedIsMatch = false;

                Object.keys(info).forEach(key => {
                    const nestedKey = parentKey ? `${parentKey}.${key}` : key;
                    traverseInfo(info[key], nestedKey);
                    // 若子属性匹配，记录到嵌套对象中
                    if (matchedInfo[nestedKey]) {
                        const subKey = nestedKey.split('.').pop();  // 取最后一级key（如content）
                        nestedMatched[subKey] = matchedInfo[nestedKey];
                        delete matchedInfo[nestedKey];  // 从外层删除，避免重复
                        nestedIsMatch = true;
                    }
                });

                // 若嵌套对象有匹配，加入结果
                if (nestedIsMatch) {
                    isMatch = true;
                    matchedInfo[parentKey || Object.keys(info)[0]] = nestedMatched;
                }
            }
        }

        // 开始遍历当前角色的信息
        traverseInfo(characterInfo);

        // 若匹配，加入结果列表
        if (isMatch) {
            results.push({
                character: characterName,  // 角色名
                info: matchedInfo          // 匹配的信息（已高亮关键词）
            });
        }
    });

    return results;
}

// 8. 工具函数1：关键词高亮（用<span class="highlight">包裹匹配部分）
function highlightKeyword(str, query, caseSensitive, wholeWords) {
    if (!query.trim()) return str;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = escapeRegExp(query);
    const regex = wholeWords ? new RegExp(`\\b${escapedQuery}\\b`, flags) : new RegExp(escapedQuery, flags);
    // 替换匹配部分为高亮标签
    return str.replace(regex, match => `<span class="highlight">${match}</span>`);
}

// 9. 工具函数2：转义正则特殊字符（避免关键词中的特殊字符导致正则错误）
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // $&表示匹配的完整字符串
}

// 10. 启动服务器
server.listen(PORT, () => {
    console.log(`服务器已启动：http://localhost:${PORT}`);
    console.log(`监听的JSON资料库：${JSON_FILE_PATH}`);
    console.log('提示：按 Ctrl+C 可停止服务器');
});
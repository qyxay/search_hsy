// 搜索功能核心逻辑
document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取DOM元素
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const clearBtn = document.getElementById('clear-btn');
    const caseSensitiveCheckbox = document.getElementById('case-sensitive');
    const wholeWordsCheckbox = document.getElementById('whole-words');
    const fuzzySearchCheckbox = document.getElementById('fuzzy-search');
    const relevanceSortCheckbox = document.getElementById('relevance-sort');
    
    const statusMessage = document.getElementById('status-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsContainer = document.getElementById('results-container');
    const resultsList = document.getElementById('results-list');
    const resultsCount = document.getElementById('results-count');
    const noResults = document.getElementById('no-results');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // 2. 初始状态：显示提示信息
    statusMessage.classList.remove('hidden');

    // 3. 核心：执行搜索（调用后端API）
    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            showStatus("请输入角色名或关键词进行搜索");
            return;
        }

        // 显示加载状态
        hideAllStates();
        loadingIndicator.classList.remove('hidden');

        try {
            // 构建搜索参数
            const params = new URLSearchParams({
                query,
                caseSensitive: caseSensitiveCheckbox.checked,
                wholeWords: wholeWordsCheckbox.checked,
                fuzzy: fuzzySearchCheckbox.checked,
                sortByRelevance: relevanceSortCheckbox.checked
            });
            const url = `/search?${params.toString()}`;

            // 调用后端搜索接口
            const response = await fetch(url);
            const data = await response.json();

            // 处理接口响应
            if (!response.ok || !data.success) {
                throw new Error(data.error || '搜索失败，请检查资料库是否正常');
            }

            // 显示结果
            hideAllStates();
            if (data.results.length > 0) {
                displayResults(data.results);
                resultsContainer.classList.remove('hidden');
            } else {
                noResults.classList.remove('hidden');
            }
        } catch (error) {
            // 处理错误
            hideAllStates();
            errorText.textContent = `错误: ${error.message}`;
            errorMessage.classList.remove('hidden');
            console.error('搜索错误:', error);
        }
    }

    // 4. 显示搜索结果（优化展示逻辑）
    function displayResults(results) {
        resultsCount.textContent = results.length;
        resultsList.innerHTML = '';

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item bg-white p-5 rounded-lg shadow-sm border border-gray-100';

            // 角色名标题（带相关性标记）
            let relevanceBadge = '';
            if (result.relevance >= 0.8) {
                relevanceBadge = '<span class="relevance-badge bg-green-100 text-green-800 text-xs px-2 py-1 rounded ml-2">高度相关</span>';
            } else if (result.relevance >= 0.5) {
                relevanceBadge = '<span class="relevance-badge bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded ml-2">中等相关</span>';
            }
            
            let resultHtml = `<h3 class="text-lg font-semibold text-gray-800 mb-3">
                角色：${result.character} ${relevanceBadge}
            </h3>`;
            
            // 遍历角色的所有信息
            Object.keys(result.info).forEach(infoKey => {
                const infoValue = result.info[infoKey];
                // 信息类型的中文标签映射（添加name映射）
                const labelMap = {
                    'name': '名字',  // 添加这一行，将name映射为"名字"
                    'description': '基础描述',
                    'introduce': '详细介绍',
                    'sentence': '语录',
                    'content': '内容',
                    'tone': '语气',
                    'source': '来源'
                };
                const currentLabel = labelMap[infoKey] || infoKey;

                // 处理嵌套对象（修复[object Object]显示问题）
                if (typeof infoValue === 'object' && infoValue !== null) {
                    resultHtml += `
                        <div class="mb-3">
                            <span class="info-label">${currentLabel}：</span>
                            <div class="ml-4 mt-2 space-y-2">
                    `;
                    // 遍历嵌套对象的子属性
                    Object.keys(infoValue).forEach(subKey => {
                        const subValue = infoValue[subKey];
                        const subLabel = labelMap[subKey] || subKey;
                        // 确保子属性值是字符串，如果是对象则转换为JSON字符串
                        const displayValue = typeof subValue === 'object' && subValue !== null 
                            ? JSON.stringify(subValue) 
                            : subValue;
                        resultHtml += `<div><span class="text-sm text-gray-500">${subLabel}：</span> ${displayValue}</div>`;
                    });
                    resultHtml += `</div></div>`;
                } else {
                    // 处理普通字符串
                    resultHtml += `
                        <div class="mb-3">
                            <span class="info-label">${currentLabel}：</span>
                            ${infoValue}
                        </div>
                    `;
                }
            });

            // 显示匹配次数
            if (result.matchCount && result.matchCount > 1) {
                resultHtml += `<div class="text-xs text-gray-500 mt-2">
                    共匹配到 ${result.matchCount} 处相关内容
                </div>`;
            }

            resultItem.innerHTML = resultHtml;
            resultsList.appendChild(resultItem);
        });
    }

    // 5. 工具函数：隐藏所有状态提示
    function hideAllStates() {
        statusMessage.classList.add('hidden');
        loadingIndicator.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        noResults.classList.add('hidden');
        errorMessage.classList.add('hidden');
    }

    // 6. 工具函数：显示指定提示信息
    function showStatus(message) {
        hideAllStates();
        statusMessage.querySelector('span').textContent = message;
        statusMessage.classList.remove('hidden');
    }

    // 7. 清除搜索结果（重置输入框和状态）
    function clearResults() {
        searchInput.value = '';
        resultsList.innerHTML = '';
        hideAllStates();
        showStatus("请输入角色名或关键词进行搜索");
        searchInput.focus();
    }

    // 8. 绑定事件监听
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    clearBtn.addEventListener('click', clearResults);
    [caseSensitiveCheckbox, wholeWordsCheckbox, fuzzySearchCheckbox, relevanceSortCheckbox].forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            if (searchInput.value.trim()) performSearch();
        });
    });

    // 9. 初始聚焦输入框
    searchInput.focus();
});
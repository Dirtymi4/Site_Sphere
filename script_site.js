document.addEventListener('DOMContentLoaded', function() {

    // Глобальные переменные
    let projects = JSON.parse(localStorage.getItem('sfera_projects')) || [];
    let currentProject = null;

    function saveProjects() {
        localStorage.setItem('sfera_projects', JSON.stringify(projects));
    }

    const mainPage = document.getElementById('mainPage');
    const editorPage = document.getElementById('editorPage');
    const editorProjectName = document.getElementById('editorProjectName');
    const latexEditor = document.getElementById('latexEditor');
    const editorFileStatus = document.getElementById('editorFileStatus');
    const placeholder = document.getElementById('projectListPlaceholder');
    
    let isModified = false;
    let compileTimeout = null;

    // ========== УЛУЧШЕННЫЙ LATEX ПАРСЕР ==========
    function parseLatexToHTML(content) {
        let title = 'Документ';
        let author = 'СФЕРА';
        let date = new Date().toLocaleDateString('ru-RU');
        
        // Извлекаем мета-данные
        const titleMatch = content.match(/\\title\{(.*?)\}/s);
        if (titleMatch) title = titleMatch[1].replace(/[{}]/g, '').trim();
        
        const authorMatch = content.match(/\\author\{(.*?)\}/s);
        if (authorMatch) author = authorMatch[1].replace(/[{}]/g, '').trim();
        
        const dateMatch = content.match(/\\date\{(.*?)\}/s);
        if (dateMatch) {
            let dateText = dateMatch[1].replace(/[{}]/g, '').trim();
            date = dateText === '\\today' ? new Date().toLocaleDateString('ru-RU') : dateText;
        }
        
        // Извлекаем тело документа
        const docMatch = content.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
        if (!docMatch) {
            return `<div style="color: red; padding: 20px;">Ошибка: отсутствует \\begin{document}...\\end{document}</div>`;
        }
        
        let body = docMatch[1];
        
        // Удаляем \maketitle
        body = body.replace(/\\maketitle\s*/g, '');
        
        // Проверка на незакрытые окружения
        const openEnvs = [];
        const envRegex = /\\(begin|end)\{([^}]+)\}/g;
        let match;
        while ((match = envRegex.exec(body)) !== null) {
            if (match[1] === 'begin') {
                openEnvs.push(match[2]);
            } else {
                const last = openEnvs.pop();
                if (last !== match[2]) {
                    console.warn(`Несоответствие окружений: ожидалось ${last}, получено ${match[2]}`);
                }
            }
        }
        
        // Обрабатываем окружения таблиц
        body = body.replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, (tableEnv) => {
            // Извлекаем caption
            const captionMatch = tableEnv.match(/\\caption\{([^}]+)\}/);
            const caption = captionMatch ? captionMatch[1] : '';
            
            // Извлекаем tabular
            const tabularMatch = tableEnv.match(/\\begin\{tabular\}([\s\S]*?)\\end\{tabular\}/);
            if (!tabularMatch) return tableEnv;
            
            const tabularContent = tabularMatch[1];
            const tabularParams = tableEnv.match(/\\begin\{tabular\}\{([^}]+)\}/);
            const columns = tabularParams ? tabularParams[1] : 'c|c';
            
            // Парсим строки таблицы
            const rows = tabularContent.split('\\\\').filter(row => row.trim());
            
            let html = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #999;">';
            
            rows.forEach(row => {
                // Пропускаем \hline в парсинге строк
                if (row.includes('\\hline')) {
                    row = row.replace(/\\hline\s*/g, '');
                }
                if (row.includes('\\cline')) {
                    row = row.replace(/\\cline\{[^}]+\}\s*/g, '');
                }
                
                if (!row.trim()) return;
                
                html += '<tr>';
                
                // Обрабатываем \multicolumn
                const cells = [];
                let currentPos = 0;
                const multicolRegex = /\\multicolumn\{(\d+)\}\{([^}]+)\}\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
                let multicolMatch;
                let lastIndex = 0;
                let rowCopy = row;
                
                while ((multicolMatch = multicolRegex.exec(row)) !== null) {
                    const before = row.substring(lastIndex, multicolMatch.index);
                    if (before.trim()) {
                        before.split('&').forEach(cell => {
                            if (cell.trim()) cells.push({ content: cell.trim(), colspan: 1 });
                        });
                    }
                    
                    cells.push({
                        content: multicolMatch[3].replace(/[{}]/g, ''),
                        colspan: parseInt(multicolMatch[1]),
                        align: multicolMatch[2]
                    });
                    
                    lastIndex = multicolMatch.index + multicolMatch[0].length;
                }
                
                if (lastIndex < row.length) {
                    const after = row.substring(lastIndex);
                    after.split('&').forEach(cell => {
                        if (cell.trim()) cells.push({ content: cell.trim(), colspan: 1 });
                    });
                }
                
                // Если \multicolumn не найден, просто разбиваем по &
                if (cells.length === 0) {
                    row.split('&').forEach(cell => {
                        let content = cell.trim();
                        // Удаляем \hline если остался
                        content = content.replace(/\\hline\s*/g, '');
                        if (content) cells.push({ content, colspan: 1 });
                    });
                }
                
                cells.forEach(cell => {
                    const tag = cell.content.includes('\\textbf') ? 'th' : 'td';
                    let content = cell.content
                        .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
                        .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
                        .replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');
                    
                    html += `<${tag} style="border: 1px solid #999; padding: 8px; text-align: left;" colspan="${cell.colspan}">${content}</${tag}>`;
                });
                
                html += '</tr>';
            });
            
            html += '</table>';
            if (caption) {
                html += `<div style="text-align: center; margin-top: 5px; font-style: italic;">Таблица: ${caption}</div>`;
            }
            
            return html;
        });
        
        // Обрабатываем окружения figure
        body = body.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, (figEnv) => {
            const captionMatch = figEnv.match(/\\caption\{([^}]+)\}/);
            const caption = captionMatch ? captionMatch[1] : '';
            const includegraphicsMatch = figEnv.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
            
            let html = '<div style="text-align: center; margin: 20px 0; padding: 20px; background: #f5f5f5; border: 1px dashed #999; border-radius: 8px;">';
            if (includegraphicsMatch) {
                html += `<div style="padding: 40px; background: #e0e0e0; border-radius: 4px;">`;
                html += `<i class="fas fa-image" style="font-size: 48px; color: #666;"></i>`;
                html += `<p style="margin-top: 10px;">Рисунок: ${includegraphicsMatch[1]}</p>`;
                html += `</div>`;
            } else {
                html += `<i class="fas fa-image" style="font-size: 48px; color: #666;"></i>`;
                html += `<p>Место для рисунка</p>`;
            }
            if (caption) {
                html += `<p style="margin-top: 10px; font-style: italic;">Рисунок: ${caption}</p>`;
            }
            html += '</div>';
            return html;
        });
        
        // Базовое форматирование
        body = body
            // Заголовки
            .replace(/\\section\*?\{(.*?)\}/g, '<h2 style="font-size: 18pt; font-weight: bold; margin: 20pt 0 10pt 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 4pt;">$1</h2>')
            .replace(/\\subsection\*?\{(.*?)\}/g, '<h3 style="font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt 0;">$1</h3>')
            .replace(/\\subsubsection\*?\{(.*?)\}/g, '<h4 style="font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt 0;">$1</h4>')
            
            // Форматирование текста
            .replace(/\\textbf\{((?:[^{}]|\{[^{}]*\})*)\}/g, '<strong>$1</strong>')
            .replace(/\\textit\{((?:[^{}]|\{[^{}]*\})*)\}/g, '<em>$1</em>')
            .replace(/\\underline\{((?:[^{}]|\{[^{}]*\})*)\}/g, '<u>$1</u>')
            .replace(/\\texttt\{((?:[^{}]|\{[^{}]*\})*)\}/g, '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px;">$1</code>')
            
            // Списки
            .replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (match, content) => {
                const items = content.split('\\item').filter(item => item.trim());
                const listItems = items.map(item => {
                    const cleaned = item.replace(/^\s+/, '').replace(/\n/g, ' ');
                    return `<li style="margin: 4pt 0;">${cleaned}</li>`;
                }).join('');
                return `<ul style="margin: 10pt 0; padding-left: 30pt;">${listItems}</ul>`;
            })
            .replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (match, content) => {
                const items = content.split('\\item').filter(item => item.trim());
                const listItems = items.map(item => {
                    const cleaned = item.replace(/^\s+/, '').replace(/\n/g, ' ');
                    return `<li style="margin: 4pt 0;">${cleaned}</li>`;
                }).join('');
                return `<ol style="margin: 10pt 0; padding-left: 30pt;">${listItems}</ol>`;
            })
            
            // Математика
            .replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, '<div style="text-align: center; margin: 20pt 0;">\\[$1\\]</div>')
            .replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, '<div style="text-align: center; margin: 20pt 0;">\\begin{aligned}$1\\end{aligned}</div>')
            .replace(/\$\$([\s\S]*?)\$\$/g, '<div style="text-align: center; margin: 20pt 0;">\\[$1\\]</div>')
            .replace(/\$([^$]+)\$/g, '\\($1\\)')
            
            // Параграфы
            .replace(/\n\n+/g, '</p><p style="margin-bottom: 10pt; text-align: justify;">')
            .replace(/\n/g, '<br>');
        
        // Оборачиваем в параграфы если нужно
        if (!body.includes('<p')) {
            body = '<p style="margin-bottom: 10pt; text-align: justify;">' + body + '</p>';
        }
        
        // Удаляем оставшиеся LaTeX команды
        body = body
            .replace(/\\centering\s*/g, '')
            .replace(/\\label\{[^}]+\}\s*/g, '')
            .replace(/\\ref\{[^}]+\}\s*/g, '??')
            .replace(/\\cite\{[^}]+\}\s*/g, '[??]')
            .replace(/\\\\\s*/g, '<br>')
            .replace(/\\newpage\s*/g, '<div style="page-break-after: always;"></div>')
            .replace(/\\clearpage\s*/g, '<div style="page-break-after: always;"></div>');
        
        // Если после всех замен текст пустой
        if (!body.trim() || body === '<p style="margin-bottom: 10pt; text-align: justify;"></p>') {
            body = '<p style="color: #999; text-align: center; padding: 40px;">Документ пуст</p>';
        }
        
        // Предупреждение о незакрытых окружениях
        let warning = '';
        if (openEnvs.length > 0) {
            warning = `<div style="background: #FFE5E5; color: #D32F2F; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #D32F2F;">
                <strong>⚠️ Внимание!</strong> Незакрытые окружения: ${openEnvs.join(', ')}
            </div>`;
        }
        
        return `
            ${warning}
            <h1 style="font-size: 24pt; font-weight: bold; text-align: center; margin-bottom: 10px; color: #000;">${title}</h1>
            <p style="text-align: center; color: #666; border-bottom: 1px solid #e0e0e0; padding-bottom: 15px; margin-bottom: 20px;">${author} • ${date}</p>
            ${body}
        `;
    }

    function compileDocument() {
        if (!currentProject) return;
        
        const content = latexEditor.value;
        const pdfPreview = document.getElementById('pdfPreview');
        
        try {
            const html = parseLatexToHTML(content);
            pdfPreview.innerHTML = html;
            
            // Применяем MathJax если есть математика
            if (window.MathJax && (content.includes('$') || content.includes('\\begin{equation'))) {
                MathJax.typesetPromise([pdfPreview]).catch(err => {
                    console.warn('MathJax error:', err);
                });
            }
            
            // Показываем уведомление об успешной компиляции
            showNotification('✅ Документ скомпилирован');
        } catch (error) {
            console.error('Compilation error:', error);
            pdfPreview.innerHTML = `
                <div style="color: #D32F2F; padding: 20px;">
                    <h3 style="color: #D32F2F;">Ошибка компиляции</h3>
                    <p>${error.message}</p>
                    <p style="margin-top: 10px; font-size: 12px; color: #666;">Проверьте синтаксис LaTeX</p>
                </div>
            `;
        }
    }

    // ========== АВТОДОПОЛНЕНИЕ LATEX ==========
    const latexCommands = [
        { cmd: '\\documentclass', snippet: '\\documentclass{article}', desc: 'Класс документа' },
        { cmd: '\\usepackage', snippet: '\\usepackage{${1:package}}', desc: 'Подключить пакет' },
        { cmd: '\\begin', snippet: '\\begin{${1:env}}\n\t$0\n\\end{${1:env}}', desc: 'Начать окружение' },
        { cmd: '\\end', snippet: '\\end{${1:env}}', desc: 'Закончить окружение' },
        { cmd: '\\title', snippet: '\\title{${1:Название}}', desc: 'Заголовок документа' },
        { cmd: '\\author', snippet: '\\author{${1:Автор}}', desc: 'Автор' },
        { cmd: '\\date', snippet: '\\date{${1:\\today}}', desc: 'Дата' },
        { cmd: '\\maketitle', snippet: '\\maketitle', desc: 'Создать заголовок' },
        { cmd: '\\section', snippet: '\\section{${1:Заголовок}}', desc: 'Раздел' },
        { cmd: '\\subsection', snippet: '\\subsection{${1:Подраздел}}', desc: 'Подраздел' },
        { cmd: '\\subsubsection', snippet: '\\subsubsection{${1:Подподраздел}}', desc: 'Подподраздел' },
        { cmd: '\\textbf', snippet: '\\textbf{${1:текст}}', desc: 'Жирный' },
        { cmd: '\\textit', snippet: '\\textit{${1:текст}}', desc: 'Курсив' },
        { cmd: '\\underline', snippet: '\\underline{${1:текст}}', desc: 'Подчёркнутый' },
        { cmd: '\\emph', snippet: '\\emph{${1:текст}}', desc: 'Акцент' },
        { cmd: '\\texttt', snippet: '\\texttt{${1:текст}}', desc: 'Моноширинный' },
        { cmd: '\\begin{itemize}', snippet: '\\begin{itemize}\n\t\\item $0\n\\end{itemize}', desc: 'Маркированный список' },
        { cmd: '\\begin{enumerate}', snippet: '\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}', desc: 'Нумерованный список' },
        { cmd: '\\item', snippet: '\\item ', desc: 'Элемент списка' },
        { cmd: '\\begin{table}', snippet: '\\begin{table}[h]\n\t\\centering\n\t\\begin{tabular}{|c|c|}\n\t\t\\hline\n\t\t$0 \\\\\n\t\t\\hline\n\t\\end{tabular}\n\t\\caption{${1:Подпись}}\n\t\\label{tab:${2:label}}\n\\end{table}', desc: 'Таблица' },
        { cmd: '\\begin{tabular}', snippet: '\\begin{tabular}{${1:|c|c|}}\n\t\\hline\n\t$0 \\\\\n\t\\hline\n\\end{tabular}', desc: 'Табличная разметка' },
        { cmd: '\\hline', snippet: '\\hline', desc: 'Горизонтальная линия' },
        { cmd: '\\multicolumn', snippet: '\\multicolumn{${1:2}}{${2:|c|}}{${3:текст}}', desc: 'Объединить ячейки' },
        { cmd: '\\begin{figure}', snippet: '\\begin{figure}[h]\n\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${1:file}}\n\t\\caption{${2:Подпись}}\n\t\\label{fig:${3:label}}\n\\end{figure}', desc: 'Рисунок' },
        { cmd: '\\includegraphics', snippet: '\\includegraphics[${1:width=\\linewidth}]{${2:file}}', desc: 'Вставить графику' },
        { cmd: '\\caption', snippet: '\\caption{${1:Подпись}}', desc: 'Подпись' },
        { cmd: '\\label', snippet: '\\label{${1:метка}}', desc: 'Метка' },
        { cmd: '\\ref', snippet: '\\ref{${1:метка}}', desc: 'Ссылка' },
        { cmd: '\\begin{equation}', snippet: '\\begin{equation}\n\t$0\n\\end{equation}', desc: 'Уравнение' },
        { cmd: '\\frac', snippet: '\\frac{${1:числ}}{${2:знам}}', desc: 'Дробь' },
        { cmd: '\\sqrt', snippet: '\\sqrt{${1:x}}', desc: 'Корень' },
        { cmd: '\\sum', snippet: '\\sum_{${1:i=1}}^{${2:n}}', desc: 'Сумма' },
        { cmd: '\\int', snippet: '\\int_{${1:a}}^{${2:b}}', desc: 'Интеграл' },
        { cmd: '\\alpha', snippet: '\\alpha', desc: 'α' },
        { cmd: '\\beta', snippet: '\\beta', desc: 'β' },
        { cmd: '\\gamma', snippet: '\\gamma', desc: 'γ' },
        { cmd: '\\delta', snippet: '\\delta', desc: 'δ' },
        { cmd: '\\pi', snippet: '\\pi', desc: 'π' },
        { cmd: '\\sigma', snippet: '\\sigma', desc: 'σ' },
        { cmd: '\\omega', snippet: '\\omega', desc: 'ω' },
        { cmd: '\\infty', snippet: '\\infty', desc: '∞' },
        { cmd: '\\partial', snippet: '\\partial', desc: '∂' },
        { cmd: '\\cdot', snippet: '\\cdot', desc: '·' },
        { cmd: '\\times', snippet: '\\times', desc: '×' },
        { cmd: '\\leq', snippet: '\\leq', desc: '≤' },
        { cmd: '\\geq', snippet: '\\geq', desc: '≥' },
        { cmd: '\\neq', snippet: '\\neq', desc: '≠' },
        { cmd: '\\approx', snippet: '\\approx', desc: '≈' },
        { cmd: '\\Rightarrow', snippet: '\\Rightarrow', desc: '⇒' },
        { cmd: '\\Leftrightarrow', snippet: '\\Leftrightarrow', desc: '⇔' },
        { cmd: '\\newpage', snippet: '\\newpage', desc: 'Новая страница' },
    ];

    let autocompleteVisible = false;
    let autocompleteSelected = 0;
    let autocompleteList = [];
    let autocompleteTriggerPos = -1;

    const acContainer = document.createElement('div');
    acContainer.className = 'autocomplete-container';
    document.body.appendChild(acContainer);

    function hideAutocomplete() {
        acContainer.style.display = 'none';
        autocompleteVisible = false;
        autocompleteSelected = 0;
        autocompleteList = [];
    }

    function showAutocomplete(items, x, y) {
    if (!items || items.length === 0) {
        hideAutocomplete();
        return;
    }
    autocompleteList = items;
    autocompleteSelected = 0;
    autocompleteVisible = true;
    
    acContainer.innerHTML = items.map((item, idx) => `
        <div class="autocomplete-item ${idx === 0 ? 'selected' : ''}" data-index="${idx}">
            <span class="cmd-icon">\\</span>
            <span class="cmd-name">${item.cmd}</span>
            <span class="cmd-desc">${item.desc || ''}</span>
        </div>
    `).join('');

    acContainer.style.display = 'block';
    acContainer.style.visibility = 'hidden';

    const containerHeight = acContainer.offsetHeight;
    const containerWidth = acContainer.offsetWidth;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (x + containerWidth > windowWidth - 20) {
        x = windowWidth - containerWidth - 20;
    }

    if (x < 10) {
        x = 10;
    }

    if (y + containerHeight > windowHeight - 20) {
        y = y - containerHeight - 10; // Показываем сверху
    }

    if (y < 10) {
        y = 10;
    }

    acContainer.style.left = x + 'px';
    acContainer.style.top = y + 'px';
    acContainer.style.visibility = 'visible';

    acContainer.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            insertSnippet(autocompleteList[idx].snippet);
            hideAutocomplete();
            latexEditor.focus();
        });
        el.addEventListener('mouseenter', () => {
            acContainer.querySelectorAll('.autocomplete-item').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            autocompleteSelected = parseInt(el.dataset.index);
        });
    });
}



    function insertSnippet(snippet) {
        if (autocompleteTriggerPos === -1) return;
        
        const pos = latexEditor.selectionStart;
        const text = latexEditor.value;
        const before = text.substring(0, autocompleteTriggerPos);
        const after = text.substring(pos);
        
        let finalSnippet = snippet
            .replace(/\$\{1:(.*?)\}/g, '$1')
            .replace(/\$\{2:(.*?)\}/g, '')
            .replace(/\$\{3:(.*?)\}/g, '')
            .replace('$0', '');
        
        latexEditor.value = before + finalSnippet + after;
        const cursorPos = before.length + finalSnippet.length;
        latexEditor.setSelectionRange(cursorPos, cursorPos);
        
        isModified = true;
        editorFileStatus.textContent = '● Не сохранено';
        editorFileStatus.style.color = '#FFB020';
        
        // Автокомпиляция через 1 секунду после вставки
        if (compileTimeout) clearTimeout(compileTimeout);
        compileTimeout = setTimeout(() => compileDocument(), 1000);
    }

    latexEditor.addEventListener('keydown', (e) => {
        if (autocompleteVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                autocompleteSelected = (autocompleteSelected + 1) % autocompleteList.length;
                updateSelected();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                autocompleteSelected = (autocompleteSelected - 1 + autocompleteList.length) % autocompleteList.length;
                updateSelected();
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (autocompleteList[autocompleteSelected]) {
                    insertSnippet(autocompleteList[autocompleteSelected].snippet);
                    hideAutocomplete();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideAutocomplete();
            }
        }
    });

    function updateSelected() {
        acContainer.querySelectorAll('.autocomplete-item').forEach((el, idx) => {
            if (idx === autocompleteSelected) {
                el.classList.add('selected');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('selected');
            }
        });
    }

    latexEditor.addEventListener('input', (e) => {
        isModified = true;
        editorFileStatus.textContent = '● Не сохранено';
        editorFileStatus.style.color = '#FFB020';
        
        const pos = latexEditor.selectionStart;
        const text = latexEditor.value;
        
        // Автодополнение
        let backslashPos = -1;
        for (let i = pos - 1; i >= 0; i--) {
            if (text[i] === '\\') {
                backslashPos = i;
                break;
            }
            if (text[i] === ' ' || text[i] === '\n' || text[i] === '{' || text[i] === '}' || text[i] === '[' || text[i] === ']') break;
        }
        
        if (backslashPos !== -1) {
            const typed = text.substring(backslashPos + 1, pos);
            if (!typed.includes(' ') && !typed.includes('\n') && typed.length >= 0) {
                const filtered = latexCommands.filter(cmd => 
                    cmd.cmd.toLowerCase().startsWith('\\' + typed.toLowerCase())
                );
                if (filtered.length > 0) {
                    autocompleteTriggerPos = backslashPos;
                    const coords = getCaretCoordinates(latexEditor, pos); // Используем текущую позицию курсора
                    showAutocomplete(filtered, coords.left, coords.top);
                } else {
                    hideAutocomplete();
                }
            } else {
                hideAutocomplete();
            }
        } else {
            hideAutocomplete();
        }
        
        // Автокомпиляция при вводе
        if (compileTimeout) clearTimeout(compileTimeout);
        compileTimeout = setTimeout(() => compileDocument(), 1500);
    });

    latexEditor.addEventListener('blur', () => {
        setTimeout(hideAutocomplete, 200);
    });

    function getCaretCoordinates(element, position) {
    // Создаём зеркальный div для точного позиционирования
    const textBefore = element.value.substring(0, position);


    const div = document.createElement('div');
    const style = window.getComputedStyle(element);
    
    // Копируем ВСЕ стили текста
    div.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: ${style.fontFamily};
        font-size: ${style.fontSize};
        font-weight: ${style.fontWeight};
        line-height: ${style.lineHeight};
        letter-spacing: ${style.letterSpacing};
        padding: ${style.padding};
        border: ${style.border};
        width: ${element.clientWidth}px;
        top: 0;
        left: 0;
    `;

    div.innerHTML = textBefore.replace(/\n/g, '<br>') + '<span id="caret-pos">|</span>';
    
    document.body.appendChild(div);
    
    const span = div.querySelector('#caret-pos');
    const spanRect = span.getBoundingClientRect();
    const editorRect = element.getBoundingClientRect();

    document.body.removeChild(div);

    const scrollTop = element.scrollTop;
    const scrollLeft = element.scrollLeft;

    return {
        left: editorRect.left + spanRect.left + 10, // Отступ справа 10px
        top: editorRect.top + spanRect.top - scrollTop - 3 // Выравнивание по тексту
    };
}

    // Кнопки входа
    document.getElementById('loginBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Функционал входа в разработке.');
    });
    document.getElementById('RegBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Функционал регистрации в разработке.');
    });

    // Переключение страниц
    function showMainPage() {
        mainPage.style.display = 'block';
        editorPage.style.display = 'none';
        currentProject = null;
        updateProjectsDisplay();
    }

    function showEditorPage(project) {
        currentProject = project;
        mainPage.style.display = 'none';
        editorPage.style.display = 'block';
        editorProjectName.textContent = project.name;
        
        let content = project.files.length > 0 ? project.files[0].content : 
            `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[russian]{babel}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\title{${project.name}}
\\author{Автор}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Введение}
Здесь начинается ваш документ LaTeX.

\\end{document}`;
        
        latexEditor.value = content;
        isModified = false;
        editorFileStatus.textContent = 'Сохранено';
        editorFileStatus.style.color = '#6C727C';
        
        setTimeout(() => compileDocument(), 100);
    }

    document.getElementById('backToMainBtn')?.addEventListener('click', showMainPage);

    // Модальное окно создания проекта
    const projectModal = document.getElementById('createProjectModal');
    const projectNameInput = document.getElementById('projectName');
    const errorElement = document.getElementById('projectNameError');

    function validateProjectName(name) {
        if (!name || name.trim() === '') return 'Название не может быть пустым';
        if (name.length < 3) return 'Минимум 3 символа';
        if (!/^[a-zA-Zа-яА-Я0-9\s\-_]+$/.test(name)) return 'Недопустимые символы';
        return null;
    }

    function openProjectModal(e) {
        if (e) e.preventDefault();
        projectModal.classList.add('active');
        projectNameInput.value = '';
        errorElement.classList.remove('show');
        projectNameInput.focus();
    }

    function closeProjectModal() { projectModal.classList.remove('active'); }

    function createNewProject(name) {
        const project = { id: Date.now(), name: name.trim(), createdAt: new Date().toLocaleDateString('ru-RU'), files: [] };
        projects.push(project);
        saveProjects();
        updateProjectsDisplay();
        updateProjectSelect();
        showNotification(`Проект "${project.name}" создан!`);
        closeProjectModal();
        showEditorPage(project);
    }

    document.getElementById('createProjectBtn')?.addEventListener('click', openProjectModal);
    document.getElementById('cancelProjectBtn')?.addEventListener('click', closeProjectModal);
    projectModal?.addEventListener('click', (e) => { if (e.target === projectModal) closeProjectModal(); });
    
    projectNameInput?.addEventListener('input', () => {
        const error = validateProjectName(projectNameInput.value);
        if (error) { errorElement.textContent = error; errorElement.classList.add('show'); }
        else errorElement.classList.remove('show');
    });

    projectNameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const name = projectNameInput.value.trim();
            const error = validateProjectName(name);
            if (!error) createNewProject(name);
            else { errorElement.textContent = error; errorElement.classList.add('show'); }
        }
    });

    document.getElementById('confirmProjectBtn')?.addEventListener('click', () => {
        const name = projectNameInput.value.trim();
        const error = validateProjectName(name);
        if (!error) createNewProject(name);
        else { errorElement.textContent = error; errorElement.classList.add('show'); }
    });

    // Отображение проектов
    function getFileWord(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'файл';
        if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'файла';
        return 'файлов';
    }

    function updateProjectsDisplay() {
        if (!placeholder) return;
        
        if (projects.length === 0) {
            placeholder.className = 'project-placeholder';
            placeholder.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>У вас пока нет проектов</p><small>Нажмите «Создать проект»</small>`;
            return;
        }
        
        placeholder.className = '';
        placeholder.innerHTML = projects.map(p => `
            <div class="project-item">
                <div class="project-info">
                    <i class="fas fa-folder project-icon"></i>
                    <div class="project-details">
                        <h4>${p.name}</h4>
                        <p><span><i class="far fa-calendar-alt"></i>${p.createdAt}</span> • <span><i class="far fa-file"></i>${p.files.length} ${getFileWord(p.files.length)}</span></p>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="open-project-btn" data-id="${p.id}">Открыть</button>
                    <button class="delete-project-btn" data-id="${p.id}" style="background: transparent; border: 1px solid rgba(255,77,77,0.3); color: #FF4D4D; padding: 8px 12px; border-radius: 20px; cursor: pointer;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.open-project-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const project = projects.find(p => p.id === parseInt(btn.dataset.id));
                if (project) showEditorPage(project);
            });
        });
        
        document.querySelectorAll('.delete-project-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Удалить проект?')) {
                    projects = projects.filter(p => p.id !== parseInt(btn.dataset.id));
                    saveProjects();
                    updateProjectsDisplay();
                    updateProjectSelect();
                    showNotification('Проект удалён');
                }
            });
        });
    }

    function updateProjectSelect() {
        const select = document.getElementById('projectSelect');
        if (!select) return;
        select.innerHTML = projects.length === 0 ? '<option value="">-- Нет проектов --</option>' : '<option value="">-- Выберите проект --</option>' + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    function showNotification(msg) {
        const n = document.createElement('div');
        n.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#14171C; color:white; padding:16px 24px; border-radius:12px; border-left:4px solid #2C6BFF; z-index:1001;';
        n.innerHTML = `<i class="fas fa-check-circle" style="color:#2C6BFF; margin-right:8px;"></i>${msg}`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    // Обратная связь
    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackForm = document.getElementById('feedbackForm');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitFeedbackBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const nameInput = document.getElementById('feedbackName');
    const emailInput = document.getElementById('feedbackEmail');
    const messageInput = document.getElementById('feedbackMessage');
    const YOUR_EMAIL = 'violettaoff01@gmail.com';

    document.getElementById('feedbackBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        feedbackModal.classList.add('active');
        successMessage.classList.remove('show');
        feedbackForm.reset();
        nameInput.focus();
    });
    
    document.getElementById('cancelFeedbackBtn')?.addEventListener('click', () => feedbackModal.classList.remove('active'));
    feedbackModal?.addEventListener('click', (e) => { if (e.target === feedbackModal) feedbackModal.classList.remove('active'); });
    
    submitBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();
        if (!name || !email || !message) return;
        
        submitBtn.disabled = true;
        submitBtnText.innerHTML = '<span class="loading-spinner"></span>Отправка...';
        
        try {
            const res = await fetch('https://formsubmit.co/ajax/' + YOUR_EMAIL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message, _subject: `СФЕРА: ${name}`, _template: 'table', _captcha: false })
            });
            if (res.ok) {
                successMessage.classList.add('show');
                feedbackForm.reset();
                setTimeout(() => feedbackModal.classList.remove('active'), 2000);
            }
        } catch { alert('Ошибка. Напишите на ' + YOUR_EMAIL); }
        finally { submitBtn.disabled = false; submitBtnText.textContent = 'Отправить'; }
    });

    // Загрузка файла
    const uploadModal = document.getElementById('uploadModal');
    const projectSelect = document.getElementById('projectSelect');
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileName = document.getElementById('fileName');
    const fileInfo = document.getElementById('fileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');
    const uploadSuccessMessage = document.getElementById('uploadSuccessMessage');
    let selectedFile = null;

    document.getElementById('uploadProjectBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        updateProjectSelect();
        uploadModal.classList.add('active');
        uploadSuccessMessage.classList.remove('show');
        selectedFile = null; fileInput.value = ''; fileInfo.style.display = 'none';
        fileName.textContent = 'Нажмите для выбора файла';
        projectSelect.value = '';
        confirmUploadBtn.disabled = true;
    });
    
    document.getElementById('cancelUploadBtn')?.addEventListener('click', () => uploadModal.classList.remove('active'));
    uploadModal?.addEventListener('click', (e) => { if (e.target === uploadModal) uploadModal.classList.remove('active'); });
    fileUploadArea?.addEventListener('click', () => fileInput.click());
    
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.name.endsWith('.tex')) {
            selectedFile = file;
            selectedFileName.textContent = file.name;
            selectedFileSize.textContent = (file.size / 1024).toFixed(2) + ' KB';
            fileInfo.style.display = 'block';
            fileName.textContent = 'Файл выбран';
            confirmUploadBtn.disabled = !projectSelect.value;
        }
    });
    
    projectSelect?.addEventListener('change', () => confirmUploadBtn.disabled = !projectSelect.value || !selectedFile);
    document.getElementById('removeFileBtn')?.addEventListener('click', () => {
        selectedFile = null; fileInput.value = ''; fileInfo.style.display = 'none';
        fileName.textContent = 'Нажмите для выбора файла'; confirmUploadBtn.disabled = true;
    });
    
    confirmUploadBtn?.addEventListener('click', () => {
        const project = projects.find(p => p.id === parseInt(projectSelect.value));
        if (project && selectedFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                project.files.push({ id: Date.now(), name: selectedFile.name, size: selectedFile.size, uploadedAt: new Date().toLocaleDateString('ru-RU'), content: e.target.result });
                saveProjects();
                updateProjectsDisplay();
                uploadSuccessMessage.classList.add('show');
                setTimeout(() => { uploadModal.classList.remove('active'); showNotification(`Файл "${selectedFile.name}" загружен`); }, 1500);
            };
            reader.readAsText(selectedFile);
        }
    });

    // Сохранение файла
    document.getElementById('saveFileBtn')?.addEventListener('click', () => {
        if (!currentProject) return;
        const content = latexEditor.value;
        if (currentProject.files.length === 0) {
            currentProject.files.push({ id: Date.now(), name: 'main.tex', size: new Blob([content]).size, uploadedAt: new Date().toLocaleDateString('ru-RU'), content });
        } else {
            currentProject.files[0].content = content;
        }
        saveProjects();
        isModified = false;
        editorFileStatus.textContent = '✓ Сохранено';
        editorFileStatus.style.color = '#10B981';
        showNotification('Файл сохранён');
        compileDocument();
        
        setTimeout(() => { if (!isModified) { editorFileStatus.textContent = 'Сохранено'; editorFileStatus.style.color = '#6C727C'; } }, 2000);
    });

    // Компиляция
    document.getElementById('compileBtn')?.addEventListener('click', () => {
        if (!currentProject) { showNotification('Нет проекта'); return; }
        if (isModified) {
            const content = latexEditor.value;
            if (currentProject.files.length === 0) {
                currentProject.files.push({ id: Date.now(), name: 'main.tex', size: new Blob([content]).size, uploadedAt: new Date().toLocaleDateString('ru-RU'), content });
            } else {
                currentProject.files[0].content = content;
            }
            saveProjects();
            isModified = false;
            editorFileStatus.textContent = 'Сохранено';
            editorFileStatus.style.color = '#6C727C';
        }
        compileDocument();
    });

    // Конвертация в Word
    document.getElementById('convertToWordBtn')?.addEventListener('click', () => {
        if (!currentProject) return;
        const content = latexEditor.value;
        
        // Улучшенная очистка для Word
        let text = content
            .replace(/\\documentclass.*?\n/g, '')
            .replace(/\\usepackage.*?\n/g, '')
            .replace(/\\title\{.*?\}\n/g, '')
            .replace(/\\author\{.*?\}\n/g, '')
            .replace(/\\date\{.*?\}\n/g, '')
            .replace(/\\maketitle\n/g, '')
            .replace(/\\begin\{document\}|\\end\{document\}/g, '')
            .replace(/\\section\{(.*?)\}/g, '\n\n$1\n\n')
            .replace(/\\subsection\{(.*?)\}/g, '\n\n$1\n\n')
            .replace(/\\textbf\{(.*?)\}/g, '$1')
            .replace(/\\textit\{(.*?)\}/g, '$1')
            .replace(/\\underline\{(.*?)\}/g, '$1')
            .replace(/\\begin\{itemize\}|\\end\{itemize\}/g, '')
            .replace(/\\begin\{enumerate\}|\\end\{enumerate\}/g, '')
            .replace(/\\item\s+/g, '• ')
            .replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, '[Таблица]')
            .replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, '[Рисунок]')
            .replace(/\$\$[\s\S]*?\$\$/g, '[Формула]')
            .replace(/\$[^$]+\$/g, '[Формула]')
            .replace(/\\begin\{equation\}[\s\S]*?\\end\{equation\}/g, '[Уравнение]')
            .trim();
        
        const blob = new Blob([
            `${currentProject.name}\n\n`,
            `Автор: СФЕРА\n`,
            `Дата: ${new Date().toLocaleDateString('ru-RU')}\n`,
            `\n----------------------------------------\n\n`,
            text,
            `\n\n----------------------------------------\n`,
            `Создано в СФЕРА - Российский LaTeX редактор`
        ], { type: 'application/msword' });
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${currentProject.name}.doc`;
        a.click();
        showNotification('✅ Документ Word скачан!');
    });

    // Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            hideAutocomplete();
        }
    });

    // Инициализация
    updateProjectsDisplay();
    updateProjectSelect();
});
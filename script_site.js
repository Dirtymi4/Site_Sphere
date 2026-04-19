// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================
    let projects = JSON.parse(localStorage.getItem('sfera_projects')) || [];
    let currentProject = null;

    function saveProjects() {
        localStorage.setItem('sfera_projects', JSON.stringify(projects));
    }

    // DOM элементы
    const mainPage = document.getElementById('mainPage');
    const editorPage = document.getElementById('editorPage');
    const editorProjectName = document.getElementById('editorProjectName');
    const latexEditor = document.getElementById('latexEditor');
    const editorFileStatus = document.getElementById('editorFileStatus');
    const placeholder = document.getElementById('projectListPlaceholder');
    
    let isModified = false;

    // ==========================================
    // КНОПКИ ВХОДА И РЕГИСТРАЦИИ
    // ==========================================
    document.getElementById('loginBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Функционал входа находится в разработке.');
    });
    document.getElementById('RegBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Функционал регистрации находится в разработке.');
    });

    // ==========================================
    // ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ
    // ==========================================
    function showMainPage() {
        mainPage.style.display = 'block';
        editorPage.style.display = 'none';
        updateProjectsDisplay();
    }

    function showEditorPage(project) {
        currentProject = project;
        mainPage.style.display = 'none';
        editorPage.style.display = 'block';
        editorProjectName.textContent = project.name;
        
        let content = '';

        if (project.files.length > 0) {
            content = project.files[0].content || `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[russian]{babel}

\\title{${project.name}}
\\author{СФЕРА}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Введение}
Файл: ${project.files[0].name}

\\end{document}`;
        } else {
            content = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[russian]{babel}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\title{${project.name}}
\\author{СФЕРА}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Введение}
Здесь начинается ваш документ LaTeX.

\\begin{equation}
    E = mc^2
\\end{equation}

\\end{document}`;
        }
        
        latexEditor.value = content;
        isModified = false;
        editorFileStatus.textContent = 'Сохранено';
        editorFileStatus.style.color = '#6C727C';
    }

    document.getElementById('backToMainBtn')?.addEventListener('click', showMainPage);

    // ==========================================
    // МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ПРОЕКТА
    // ==========================================
    const projectModal = document.getElementById('createProjectModal');
    const projectNameInput = document.getElementById('projectName');
    const errorElement = document.getElementById('projectNameError');

    function validateProjectName(name) {
        if (!name || name.trim() === '') return 'Название не может быть пустым';
        if (name.length < 3) return 'Минимум 3 символа';
        if (name.length > 50) return 'Максимум 50 символов';
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

    function closeProjectModal() {
        projectModal.classList.remove('active');
    }

    function createNewProject(name) {
        const project = {
            id: Date.now(),
            name: name.trim(),
            createdAt: new Date().toLocaleDateString('ru-RU'),
            files: []
        };
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
        if (error) {
            errorElement.textContent = error;
            errorElement.classList.add('show');
        } else {
            errorElement.classList.remove('show');
        }
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

    // ==========================================
    // ОТОБРАЖЕНИЕ ПРОЕКТОВ
    // ==========================================
    function getFileWord(count) {
        if (count % 10 === 1 && count % 100 !== 11) return 'файл';
        if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'файла';
        return 'файлов';
    }

    function updateProjectsDisplay() {
        if (!placeholder) return;
        
        if (projects.length === 0) {
            placeholder.className = 'project-placeholder';
            placeholder.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <p>У вас пока нет проектов</p>
                <small>Нажмите «Создать проект», чтобы начать</small>
            `;
            return;
        }
        
        placeholder.className = '';
        placeholder.style.cssText = '';
        
        placeholder.innerHTML = projects.map(p => `
            <div class="project-item">
                <div class="project-info">
                    <i class="fas fa-folder project-icon"></i>
                    <div class="project-details">
                        <h4>${p.name}</h4>
                        <p>
                            <span><i class="far fa-calendar-alt"></i>${p.createdAt}</span>
                            <span style="color: #4A5058;">•</span>
                            <span><i class="far fa-file"></i>${p.files.length} ${getFileWord(p.files.length)}</span>
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="open-project-btn" data-id="${p.id}">Открыть</button>
                    <button class="delete-project-btn" data-id="${p.id}" style="
                        background: transparent;
                        border: 1px solid rgba(255, 77, 77, 0.3);
                        color: #FF4D4D;
                        padding: 8px 12px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 14px;
                    "><i class="fas fa-trash"></i></button>
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
                const id = parseInt(btn.dataset.id);
                if (confirm('Удалить проект?')) {
                    projects = projects.filter(p => p.id !== id);
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
        select.innerHTML = projects.length === 0 
            ? '<option value="">-- Нет проектов --</option>'
            : '<option value="">-- Выберите проект --</option>' + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // ==========================================
    // УВЕДОМЛЕНИЯ
    // ==========================================
    function showNotification(msg) {
        const n = document.createElement('div');
        n.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#14171C; color:white; padding:16px 24px; border-radius:12px; border-left:4px solid #2C6BFF; z-index:1001;';
        n.innerHTML = `<i class="fas fa-check-circle" style="color:#2C6BFF; margin-right:8px;"></i>${msg}`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    // ==========================================
    // ОБРАТНАЯ СВЯЗЬ
    // ==========================================
    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackForm = document.getElementById('feedbackForm');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitFeedbackBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const nameInput = document.getElementById('feedbackName');
    const emailInput = document.getElementById('feedbackEmail');
    const messageInput = document.getElementById('feedbackMessage');
    const nameError = document.getElementById('nameError');
    const emailError = document.getElementById('emailError');
    const messageError = document.getElementById('messageError');
    const YOUR_EMAIL = 'violettaoff01@gmail.com';

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function clearFeedbackErrors() {
        nameError?.classList.remove('show');
        emailError?.classList.remove('show');
        messageError?.classList.remove('show');
    }

    function validateFeedbackForm() {
        let valid = true;
        clearFeedbackErrors();
        if (!nameInput.value.trim()) { 
            nameError.textContent = 'Введите имя'; 
            nameError.classList.add('show'); 
            valid = false; 
        }
        if (!emailInput.value.trim()) { 
            emailError.textContent = 'Введите email'; 
            emailError.classList.add('show'); 
            valid = false; 
        } else if (!validateEmail(emailInput.value)) { 
            emailError.textContent = 'Неверный email'; 
            emailError.classList.add('show'); 
            valid = false; 
        }
        if (!messageInput.value.trim()) { 
            messageError.textContent = 'Введите сообщение'; 
            messageError.classList.add('show'); 
            valid = false; 
        }
        return valid;
    }

    document.getElementById('feedbackBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        feedbackModal.classList.add('active');
        successMessage.classList.remove('show');
        feedbackForm.reset();
        clearFeedbackErrors();
        nameInput.focus();
    });
    
    document.getElementById('cancelFeedbackBtn')?.addEventListener('click', () => feedbackModal.classList.remove('active'));
    
    feedbackModal?.addEventListener('click', (e) => { 
        if (e.target === feedbackModal) feedbackModal.classList.remove('active'); 
    });
    
    submitBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!validateFeedbackForm()) return;
        
        submitBtn.disabled = true;
        submitBtnText.innerHTML = '<span class="loading-spinner"></span>Отправка...';
        
        try {
            const res = await fetch('https://formsubmit.co/ajax/' + YOUR_EMAIL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    message: messageInput.value.trim(),
                    _subject: `СФЕРА: Обратная связь от ${nameInput.value.trim()}`,
                    _template: 'table',
                    _captcha: false
                })
            });
            if (res.ok) {
                successMessage.classList.add('show');
                feedbackForm.reset();
                setTimeout(() => feedbackModal.classList.remove('active'), 2000);
            } else throw new Error();
        } catch {
            alert('Ошибка. Напишите на ' + YOUR_EMAIL);
        } finally {
            submitBtn.disabled = false;
            submitBtnText.textContent = 'Отправить';
        }
    });

    // ==========================================
    // ЗАГРУЗКА ФАЙЛА
    // ==========================================
    const uploadModal = document.getElementById('uploadModal');
    const projectSelect = document.getElementById('projectSelect');
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileName = document.getElementById('fileName');
    const fileInfo = document.getElementById('fileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');
    const uploadBtnText = document.getElementById('uploadBtnText');
    const uploadSuccessMessage = document.getElementById('uploadSuccessMessage');
    const fileError = document.getElementById('fileError');
    let selectedFile = null;

    document.getElementById('uploadProjectBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        updateProjectSelect();
        uploadModal.classList.add('active');
        uploadSuccessMessage.classList.remove('show');
        selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        fileName.textContent = 'Нажмите для выбора файла';
        projectSelect.value = '';
        confirmUploadBtn.disabled = true;
    });
    
    document.getElementById('cancelUploadBtn')?.addEventListener('click', () => uploadModal.classList.remove('active'));
    
    uploadModal?.addEventListener('click', (e) => { 
        if (e.target === uploadModal) uploadModal.classList.remove('active'); 
    });
    
    fileUploadArea?.addEventListener('click', () => fileInput.click());
    
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'tex') {
                fileError.textContent = 'Только .tex файлы';
                fileError.classList.add('show');
                return;
            }
            fileError.classList.remove('show');
            selectedFile = file;
            selectedFileName.textContent = file.name;
            selectedFileSize.textContent = (file.size / 1024).toFixed(2) + ' KB';
            fileInfo.style.display = 'block';
            fileName.textContent = 'Файл выбран';
            confirmUploadBtn.disabled = !projectSelect.value;
        }
    });
    
    projectSelect?.addEventListener('change', () => {
        confirmUploadBtn.disabled = !projectSelect.value || !selectedFile;
    });
    
    document.getElementById('removeFileBtn')?.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        fileName.textContent = 'Нажмите для выбора файла';
        confirmUploadBtn.disabled = true;
    });
    
    confirmUploadBtn?.addEventListener('click', () => {
        const project = projects.find(p => p.id === parseInt(projectSelect.value));
        if (project && selectedFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const fileRecord = {
                    id: Date.now(),
                    name: selectedFile.name,
                    size: selectedFile.size,
                    uploadedAt: new Date().toLocaleDateString('ru-RU'),
                    content: e.target.result
                };
                project.files.push(fileRecord);
                saveProjects();
                updateProjectsDisplay();
                uploadSuccessMessage.classList.add('show');
                
                setTimeout(() => {
                    uploadModal.classList.remove('active');
                    showNotification(`Файл "${selectedFile.name}" загружен в "${project.name}"`);
                }, 1500);
            };
            reader.readAsText(selectedFile);
        }
    });

    // ==========================================
    // РЕДАКТОР
    // ==========================================
    latexEditor?.addEventListener('input', () => {
        isModified = true;
        editorFileStatus.textContent = '● Не сохранено';
        editorFileStatus.style.color = '#FFB020';
    });
    
    document.getElementById('saveFileBtn')?.addEventListener('click', () => {
        if (!currentProject) return;
        
        if (currentProject.files.length === 0) {
            currentProject.files.push({
                id: Date.now(),
                name: 'main.tex',
                size: new Blob([latexEditor.value]).size,
                uploadedAt: new Date().toLocaleDateString('ru-RU'),
                content: latexEditor.value
            });
        } else {
            currentProject.files[0].content = latexEditor.value;
            currentProject.files[0].size = new Blob([latexEditor.value]).size;
        }
        
        saveProjects();
        isModified = false;
        editorFileStatus.textContent = '✓ Сохранено';
        editorFileStatus.style.color = '#10B981';
        showNotification('Файл сохранён');
        
        setTimeout(() => {
            if (!isModified) {
                editorFileStatus.textContent = 'Сохранено';
                editorFileStatus.style.color = '#6C727C';
            }
        }, 2000);
    });
    
    document.getElementById('compileBtn')?.addEventListener('click', () => showNotification('Компиляция LaTeX...'));
    
    document.getElementById('convertToWordBtn')?.addEventListener('click', () => {
        if (!currentProject) {
            showNotification('Нет открытого проекта');
            return;
        }
        
        const latexContent = latexEditor.value;
        showNotification('Конвертация в Word...');
        
        // Простая конвертация LaTeX в текст
        let textContent = latexContent
            .replace(/\\documentclass.*?\n/, '')
            .replace(/\\usepackage.*?\n/g, '')
            .replace(/\\title\{(.*?)\}\n/, '')
            .replace(/\\author\{(.*?)\}\n/, '')
            .replace(/\\date\{(.*?)\}\n/, '')
            .replace(/\\maketitle\n/, '')
            .replace(/\\section\{(.*?)\}/g, '\n$1\n')
            .replace(/\\subsection\{(.*?)\}/g, '\n$1\n')
            .replace(/\\textbf\{(.*?)\}/g, '$1')
            .replace(/\\textit\{(.*?)\}/g, '$1')
            .replace(/\\begin\{equation\}(.*?)\\end\{equation\}/gs, '\n$1\n')
            .replace(/\\begin\{document\}/, '')
            .replace(/\\end\{document\}/, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        
        const finalContent = `Документ создан в СФЕРА
Дата: ${new Date().toLocaleDateString('ru-RU')}
Проект: ${currentProject.name}
Автор: Саакова В.А.

============================================

${textContent}

============================================
Сконвертировано с помощью СФЕРА | LaTeX to Word Converter`;
        
        const blob = new Blob([finalContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('✅ Документ Word скачан!');
    });

    // ==========================================
    // ЗАКРЫТИЕ МОДАЛОК ПО ESCAPE
    // ==========================================
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        }
    });

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================
    updateProjectsDisplay();
    updateProjectSelect();
});
// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================
    let projects = []; // Для хранения проектов

    // ==========================================
    // КНОПКИ ВХОДА И РЕГИСТРАЦИИ
    // ==========================================
    const loginBtn = document.getElementById('loginBtn');
    const RegBtn = document.getElementById('RegBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Функционал входа находится в разработке.');
        });
    }

    if (RegBtn) {
        RegBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Функционал регистрации находится в разработке.');
        });
    }

    // ==========================================
    // МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ПРОЕКТА
    // ==========================================
    const projectModal = document.getElementById('createProjectModal');
    const projectNameInput = document.getElementById('projectName');
    const errorElement = document.getElementById('projectNameError');
    const createBtn = document.getElementById('createProjectBtn');
    const cancelProjectBtn = document.getElementById('cancelProjectBtn');
    const confirmBtn = document.getElementById('confirmProjectBtn');
    const placeholder = document.getElementById('projectListPlaceholder');

    // Валидация названия проекта
    function validateProjectName(name) {
        if (!name || name.trim() === '') {
            return 'Название проекта не может быть пустым';
        }
        if (name.length < 3) {
            return 'Название должно содержать минимум 3 символа';
        }
        if (name.length > 50) {
            return 'Название не должно превышать 50 символов';
        }
        if (!/^[a-zA-Zа-яА-Я0-9\s\-_]+$/.test(name)) {
            return 'Можно использовать только буквы, цифры, пробелы, дефисы и подчёркивания';
        }
        return null;
    }

    // Открытие модального окна проекта
    function openProjectModal(e) {
        if (e) e.preventDefault();
        if (projectModal) {
            projectModal.classList.add('active');
            projectNameInput.value = '';
            errorElement.classList.remove('show');
            errorElement.textContent = '';
            projectNameInput.focus();
        }
    }

    // Закрытие модального окна проекта
    function closeProjectModal(e) {
        if (e) e.preventDefault();
        if (projectModal) {
            projectModal.classList.remove('active');
        }
    }

    // Обновление отображения проектов
    function updateProjectsDisplay() {
        if (!placeholder) return;
        
        if (projects.length === 0) {
            placeholder.style.background = '#0F1217';
            placeholder.style.border = '2px dashed rgba(255, 255, 255, 0.1)';
            placeholder.style.borderRadius = '24px';
            placeholder.style.padding = '48px';
            placeholder.style.textAlign = 'center';
            placeholder.innerHTML = `
                <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #2C6BFF; opacity: 0.7;"></i>
                <p style="font-size: 18px; margin-top: 16px;">У вас пока нет проектов</p>
                <small style="color: #6C727C;">Нажмите «Создать проект», чтобы начать конвертацию LaTeX → Word</small>
            `;
            return;
        }

        placeholder.style.background = 'transparent';
        placeholder.style.border = 'none';
        placeholder.style.padding = '0';
        placeholder.style.textAlign = 'left';
        
        const projectsHTML = projects.map(project => `
            <div style="
                background: #0F1217;
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <i class="fas fa-folder" style="color: #2C6BFF; font-size: 20px;"></i>
                    <div>
                        <h4 style="font-size: 16px; font-weight: 500; margin-bottom: 4px; color: #FFFFFF;">${project.name}</h4>
                        <p style="color: #6C727C; font-size: 12px;">
                            <i class="far fa-calendar-alt"></i> ${project.createdAt} • 
                            <i class="far fa-file"></i> ${project.files.length} файлов
                        </p>
                    </div>
                </div>
                <button class="open-project-btn" data-project-id="${project.id}" style="
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #9BA1AA;
                    padding: 8px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                ">Открыть</button>
            </div>
        `).join('');

        placeholder.innerHTML = projectsHTML;
    }

    // Создание нового проекта
    function createNewProject(name) {
        const project = {
            id: Date.now(),
            name: name.trim(),
            createdAt: new Date().toLocaleDateString('ru-RU'),
            files: []
        };
        
        projects.push(project);
        updateProjectsDisplay();
        showNotification(`Проект "${project.name}" успешно создан!`);
        closeProjectModal();
    }

    // Показ уведомления
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #14171C;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            border-left: 4px solid #2C6BFF;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            z-index: 1001;
            font-weight: 500;
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle" style="color: #2C6BFF; margin-right: 8px;"></i>
            ${message}
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    // Обработчики для проекта
    if (createBtn) {
        createBtn.addEventListener('click', openProjectModal);
    }

    if (cancelProjectBtn) {
        cancelProjectBtn.addEventListener('click', closeProjectModal);
    }

    if (projectModal) {
        projectModal.addEventListener('click', (e) => {
            if (e.target === projectModal) closeProjectModal();
        });
    }

    if (projectNameInput) {
        projectNameInput.addEventListener('input', () => {
            const error = validateProjectName(projectNameInput.value);
            if (error) {
                errorElement.textContent = error;
                errorElement.classList.add('show');
            } else {
                errorElement.classList.remove('show');
            }
        });

        projectNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const name = projectNameInput.value.trim();
                const error = validateProjectName(name);
                if (!error) {
                    createNewProject(name);
                } else {
                    errorElement.textContent = error;
                    errorElement.classList.add('show');
                }
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const name = projectNameInput.value.trim();
            const error = validateProjectName(name);
            if (!error) {
                createNewProject(name);
            } else {
                errorElement.textContent = error;
                errorElement.classList.add('show');
                projectNameInput.focus();
            }
        });
    }

    // Инициализация отображения проектов
    updateProjectsDisplay();

    // ==========================================
    // МОДАЛЬНОЕ ОКНО ОБРАТНОЙ СВЯЗИ
    // ==========================================
    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackBtn = document.getElementById('feedbackBtn');
    const cancelFeedbackBtn = document.getElementById('cancelFeedbackBtn');
    const submitBtn = document.getElementById('submitFeedbackBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const successMessage = document.getElementById('successMessage');
    const feedbackForm = document.getElementById('feedbackForm');
    
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
        if (nameError) { nameError.classList.remove('show'); nameError.textContent = ''; }
        if (emailError) { emailError.classList.remove('show'); emailError.textContent = ''; }
        if (messageError) { messageError.classList.remove('show'); messageError.textContent = ''; }
    }

    function validateFeedbackForm() {
        let isValid = true;
        clearFeedbackErrors();
        
        if (!nameInput.value.trim()) {
            if (nameError) { nameError.textContent = 'Введите ваше имя'; nameError.classList.add('show'); }
            isValid = false;
        } else if (nameInput.value.trim().length < 2) {
            if (nameError) { nameError.textContent = 'Имя должно содержать минимум 2 символа'; nameError.classList.add('show'); }
            isValid = false;
        }
        
        if (!emailInput.value.trim()) {
            if (emailError) { emailError.textContent = 'Введите email'; emailError.classList.add('show'); }
            isValid = false;
        } else if (!validateEmail(emailInput.value.trim())) {
            if (emailError) { emailError.textContent = 'Введите корректный email'; emailError.classList.add('show'); }
            isValid = false;
        }
        
        if (!messageInput.value.trim()) {
            if (messageError) { messageError.textContent = 'Введите сообщение'; messageError.classList.add('show'); }
            isValid = false;
        } else if (messageInput.value.trim().length < 10) {
            if (messageError) { messageError.textContent = 'Сообщение должно содержать минимум 10 символов'; messageError.classList.add('show'); }
            isValid = false;
        }
        
        return isValid;
    }

    function openFeedbackModal(e) {
        if (e) e.preventDefault();
        if (feedbackModal) {
            feedbackModal.classList.add('active');
            if (successMessage) successMessage.classList.remove('show');
            if (feedbackForm) feedbackForm.reset();
            clearFeedbackErrors();
            if (nameInput) nameInput.focus();
        }
    }

    function closeFeedbackModal(e) {
        if (e) e.preventDefault();
        if (feedbackModal) {
            feedbackModal.classList.remove('active');
        }
    }

    async function submitFeedbackForm(e) {
        if (e) e.preventDefault();
        
        if (!validateFeedbackForm()) return;
        
        submitBtn.disabled = true;
        submitBtnText.innerHTML = '<span class="loading-spinner"></span>Отправка...';
        
        try {
            const response = await fetch('https://formsubmit.co/ajax/' + YOUR_EMAIL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    name: nameInput.value.trim(),
                    email: emailInput.value.trim(),
                    message: messageInput.value.trim(),
                    _subject: `СФЕРА: Обратная связь от ${nameInput.value.trim()}`,
                    _template: 'table',
                    _captcha: false
                })
            });
            
            if (response.ok) {
                if (successMessage) successMessage.classList.add('show');
                if (feedbackForm) feedbackForm.reset();
                setTimeout(() => {
                    closeFeedbackModal();
                    setTimeout(() => {
                        if (successMessage) successMessage.classList.remove('show');
                    }, 300);
                }, 2000);
            } else {
                throw new Error('Ошибка отправки');
            }
        } catch (error) {
            alert('Ошибка при отправке. Напишите мне на ' + YOUR_EMAIL);
        } finally {
            submitBtn.disabled = false;
            submitBtnText.textContent = 'Отправить';
        }
    }

    if (feedbackBtn) {
        const newFeedbackBtn = feedbackBtn.cloneNode(true);
        feedbackBtn.parentNode.replaceChild(newFeedbackBtn, feedbackBtn);
        newFeedbackBtn.addEventListener('click', openFeedbackModal);
    }

    if (cancelFeedbackBtn) {
        cancelFeedbackBtn.addEventListener('click', closeFeedbackModal);
    }

    if (feedbackModal) {
        feedbackModal.addEventListener('click', (e) => {
            if (e.target === feedbackModal) closeFeedbackModal();
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', submitFeedbackForm);
    }

    // ==========================================
    // ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ПО ESCAPE
    // ==========================================
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (projectModal && projectModal.classList.contains('active')) {
                closeProjectModal();
            }
            if (feedbackModal && feedbackModal.classList.contains('active')) {
                closeFeedbackModal();
            }
        }
    });

});
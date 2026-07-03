/* ========================================
   ООО Модуль — Client Application
   ======================================== */
const API_BASE = '/api';

const app = {
    // --- Tokens ---
    setToken: (token) => localStorage.setItem('modul_token', `Bearer ${token}`),
    getToken: () => localStorage.getItem('modul_token'),
    removeToken: () => localStorage.removeItem('modul_token'),

    // --- API ---
    apiRequest: async (endpoint, options = {}) => {
        const token = app.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': token } : {}),
            ...options.headers
        };
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
            const data = await res.json().catch(() => null);
            return { ok: res.ok, status: res.status, data };
        } catch {
            return { ok: false, status: 0, data: { error: { message: 'Ошибка сети. Сервер запущен?' } } };
        }
    },

    getAuthUser: async () => {
        const token = app.getToken();
        if (!token) return null;
        const res = await app.apiRequest('/auth/me');
        return res.ok ? res.data : null;
    },

    logout: () => {
        app.removeToken();
        window.location.href = 'index.html';
    },

    // --- Auth handlers ---
    handleRegister: async () => {
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const full_name = document.getElementById('regFullName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();

        // Валидация
        if (!username || !email || !password) {
            app.showError('Заполните все обязательные поля');
            return;
        }

        if (username.length < 3) {
            app.showError('Логин должен содержать минимум 3 символа');
            return;
        }

        if (!app.validateEmail(email)) {
            app.showError('Введите корректный email');
            return;
        }

        if (password.length < 6) {
            app.showError('Пароль должен содержать минимум 6 символов');
            return;
        }

        if (phone && !app.validatePhone(phone)) {
            app.showError('Введите корректный номер телефона');
            return;
        }

        const res = await app.apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password, full_name, phone })
        });
        if (res.ok) {
            app.showSuccess('Регистрация успешна! Войдите в аккаунт.');
            setTimeout(() => window.location.reload(), 1500);
        }
        else {
            app.showError(res.data?.error?.message || 'Ошибка регистрации');
        }
    },

    handleLogin: async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            app.showError('Заполните все поля');
            return;
        }

        const res = await app.apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (res.ok && res.data.token) {
            app.setToken(res.data.token);
            window.location.href = res.data.user.role === 'admin' ? 'admin.html' : 'index.html';
        } else {
            app.showError(res.data?.error?.message || 'Неверный логин или пароль');
        }
    },

    // --- Validation helpers ---
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePhone: (phone) => {
        const re = /^[\d\s\+\-\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    showError: (message) => {
        app.showNotification(message, 'error');
    },

    showSuccess: (message) => {
        app.showNotification(message, 'success');
    },

    showNotification: (message, type = 'info') => {
        // Удаляем старые уведомления
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },

    // --- Home page ---
    initHome: async () => {
        const user = await app.getAuthUser();
        const authBtn = document.getElementById('authBtn');
        const userNav = document.getElementById('userNav');
        const adminLink = document.getElementById('adminLink');
        if (user) {
            if (authBtn) authBtn.style.display = 'none';
            if (userNav) { userNav.style.display = 'flex'; document.getElementById('userName').textContent = user.username; }
            if (adminLink && user.role === 'admin') adminLink.style.display = 'inline-block';
        }
        app.loadCategories();
        app.loadCategoryFilter();
        app.loadEquipment();
        const rentalForm = document.getElementById('rentalForm');
        if (rentalForm) rentalForm.addEventListener('submit', app.handleRentalSubmit);
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') app.applyFilters();
            });
        }
    },

    loadCategories: async () => {
        const res = await app.apiRequest('/categories');
        const grid = document.getElementById('categoriesGrid');
        if (!res.ok || !grid) return;
        grid.innerHTML = res.data.items.map(c => `
            <div class="category-card" onclick="app.filterEquipment(${c.id})">
                <span class="icon">${c.icon || '📦'}</span>
                <h3>${c.name}</h3>
                <p>${c.description || ''}</p>
            </div>
        `).join('');
    },

    loadCategoryFilter: async () => {
        const res = await app.apiRequest('/categories');
        const select = document.getElementById('filterCategory');
        if (!res.ok || !select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Все категории</option>' +
            res.data.items.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        select.value = currentValue;
    },

    applyFilters: () => {
        const search = document.getElementById('searchInput')?.value.trim() || '';
        const category = document.getElementById('filterCategory')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const minPrice = document.getElementById('filterMinPrice')?.value || '';
        const maxPrice = document.getElementById('filterMaxPrice')?.value || '';
        const sortBy = document.getElementById('sortBy')?.value || '';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category) params.append('category', category);
        if (status) params.append('status', status);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (sortBy) params.append('sortBy', sortBy);

        app.loadEquipmentWithParams(params.toString());
    },

    resetFilters: () => {
        const searchInput = document.getElementById('searchInput');
        const filterCategory = document.getElementById('filterCategory');
        const filterStatus = document.getElementById('filterStatus');
        const filterMinPrice = document.getElementById('filterMinPrice');
        const filterMaxPrice = document.getElementById('filterMaxPrice');
        const sortBy = document.getElementById('sortBy');

        if (searchInput) searchInput.value = '';
        if (filterCategory) filterCategory.value = '';
        if (filterStatus) filterStatus.value = '';
        if (filterMinPrice) filterMinPrice.value = '';
        if (filterMaxPrice) filterMaxPrice.value = '';
        if (sortBy) sortBy.value = '';

        app.loadEquipment();
    },

    loadEquipmentWithParams: async (queryString) => {
        const endpoint = queryString ? `/equipment?${queryString}` : '/equipment';
        const res = await app.apiRequest(endpoint);
        const grid = document.getElementById('equipmentGrid');
        if (!res.ok || !grid) return;
        if (res.data.items.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:var(--muted);padding:3rem;">Техника не найдена</p>';
            return;
        }
        const equipmentImages = {
            'экскаватор': 'images/excavator.jpg',
            'бульдозер': 'images/bulldozer.jpg',
            'кран': 'images/crane.jpg',
            'погрузчик': 'images/loader.jpg',
            'самосвал': 'images/dumptruck.jpg',
            'каток': 'images/roller.jpg',
            'бетононасос': 'images/concrete_pump.jpg',
            'jcb 531-70': 'images/JCB.webp'
        };
        grid.innerHTML = res.data.items.map(e => {
            const fallbackImg = Object.entries(equipmentImages).find(([k]) => e.name.toLowerCase().includes(k))?.[1];
            const imgSrc = fallbackImg || '';
            return `
            <div class="equipment-card">
                <div class="equipment-img">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${e.name}" onerror="this.style.display='none';this.parentElement.innerText='${e.name}'">` : e.name}
                </div>
                <div class="equipment-info">
                    <span class="equipment-status ${e.status}">${e.status === 'available' ? 'Доступно' : e.status === 'rented' ? 'В аренде' : 'Обслуживание'}</span>
                    <h3>${e.name}</h3>
                    <p class="equipment-specs">${e.specs || e.description || ''}</p>
                    <p class="equipment-price">${e.price_per_day.toLocaleString('ru-RU')} ₽/сутки</p>
                    ${e.status === 'available' ? `<button class="btn-primary btn-block" onclick="app.openRentalModal(${e.id}, '${e.name.replace(/'/g, "\\'")}', ${e.price_per_day})">Оставить заявку</button>` : '<button class="btn-primary btn-block" disabled style="opacity:0.4;cursor:not-allowed;">Недоступно</button>'}
                </div>
            </div>`;
        }).join('');
    },

    loadEquipment: async (categoryId = null) => {
        const endpoint = categoryId ? `/equipment?category=${categoryId}` : '/equipment';
        const res = await app.apiRequest(endpoint);
        const grid = document.getElementById('equipmentGrid');
        if (!res.ok || !grid) return;
        if (res.data.items.length === 0) {
            grid.innerHTML = '<p style="text-align:center;color:var(--muted);padding:3rem;">Техника не найдена</p>';
            return;
        }
        const equipmentImages = {
            'экскаватор': 'images/excavator.jpg',
            'бульдозер': 'images/bulldozer.jpg',
            'кран': 'images/crane.jpg',
            'погрузчик': 'images/loader.jpg',
            'самосвал': 'images/dumptruck.jpg',
            'каток': 'images/roller.jpg',
            'бетононасос': 'images/concrete_pump.jpg',
            'jcb 531-70': 'images/JCB.webp'
        };
        grid.innerHTML = res.data.items.map(e => {
            const fallbackImg = Object.entries(equipmentImages).find(([k]) => e.name.toLowerCase().includes(k))?.[1];
            const imgSrc = fallbackImg || '';
            return `
            <div class="equipment-card">
                <div class="equipment-img">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${e.name}" onerror="this.style.display='none';this.parentElement.innerText='${e.name}'">` : e.name}
                </div>
                <div class="equipment-info">
                    <span class="equipment-status ${e.status}">${e.status === 'available' ? 'Доступно' : e.status === 'rented' ? 'В аренде' : 'Обслуживание'}</span>
                    <h3>${e.name}</h3>
                    <p class="equipment-specs">${e.specs || e.description || ''}</p>
                    <p class="equipment-price">${e.price_per_day.toLocaleString('ru-RU')} ₽/сутки</p>
                    ${e.status === 'available' ? `<button class="btn-primary btn-block" onclick="app.openRentalModal(${e.id}, '${e.name.replace(/'/g, "\\'")}', ${e.price_per_day})">Оставить заявку</button>` : '<button class="btn-primary btn-block" disabled style="opacity:0.4;cursor:not-allowed;">Недоступно</button>'}
                </div>
            </div>`;
        }).join('');
    },

    filterEquipment: (categoryId) => {
        document.getElementById('filterCategory').value = categoryId;
        app.applyFilters();
        document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    },

    openRentalModal: async (id, name, price) => {
        const user = await app.getAuthUser();
        if (!user) { alert('Для оформления заявки необходимо авторизоваться'); window.location.href = 'auth.html'; return; }
        document.getElementById('rentalEquipmentId').value = id;
        document.getElementById('rentalEquipmentName').value = name;
        document.getElementById('rentalPrice').value = price.toLocaleString('ru-RU') + ' ₽/сутки';
        document.getElementById('rentalStart').value = '';
        document.getElementById('rentalEnd').value = '';
        document.getElementById('rentalPhone').value = user.phone || '';
        document.getElementById('rentalComment').value = '';
        document.getElementById('rentalModal').classList.add('active');
    },

    closeRentalModal: () => {
        document.getElementById('rentalModal').classList.remove('active');
    },

    handleRentalSubmit: async (e) => {
        e.preventDefault();
        const equipment_id = parseInt(document.getElementById('rentalEquipmentId').value);
        const start_date = document.getElementById('rentalStart').value;
        const end_date = document.getElementById('rentalEnd').value;
        const contact_phone = document.getElementById('rentalPhone').value.trim();
        const comment = document.getElementById('rentalComment').value.trim();

        // Валидация
        if (!start_date || !end_date) {
            app.showError('Укажите даты аренды');
            return;
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (startDate < today) {
            app.showError('Дата начала не может быть в прошлом');
            return;
        }

        if (endDate <= startDate) {
            app.showError('Дата окончания должна быть позже даты начала');
            return;
        }

        if (!contact_phone) {
            app.showError('Укажите номер телефона');
            return;
        }

        if (!app.validatePhone(contact_phone)) {
            app.showError('Введите корректный номер телефона');
            return;
        }

        const res = await app.apiRequest('/rentals', {
            method: 'POST',
            body: JSON.stringify({ equipment_id, start_date, end_date, contact_phone, comment })
        });
        if (res.ok) {
            app.showSuccess('Заявка успешно создана! Мы свяжемся с вами для подтверждения.');
            app.closeRentalModal();
            app.loadEquipment();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка создания заявки');
        }
    },

    // --- Admin ---
    initAdmin: () => {
        const loginForm = document.getElementById('adminLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                app.adminLogin();
            });
        }
        const addEquipmentForm = document.getElementById('addEquipmentForm');
        if (addEquipmentForm) {
            addEquipmentForm.addEventListener('submit', app.addEquipment);
        }
        const editEquipmentForm = document.getElementById('editEquipmentForm');
        if (editEquipmentForm) {
            editEquipmentForm.addEventListener('submit', app.editEquipment);
        }
        const editUserForm = document.getElementById('editUserForm');
        if (editUserForm) {
            editUserForm.addEventListener('submit', app.editUser);
        }
        const addCategoryForm = document.getElementById('addCategoryForm');
        if (addCategoryForm) {
            addCategoryForm.addEventListener('submit', app.addCategory);
        }
        const editCategoryForm = document.getElementById('editCategoryForm');
        if (editCategoryForm) {
            editCategoryForm.addEventListener('submit', app.editCategory);
        }
        document.querySelectorAll('.admin-nav-item[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                app.adminNavigate(link.getAttribute('data-page'));
            });
        });
        window.addEventListener('hashchange', () => app.adminRoute());
        if (app.getToken()) app.adminCheckAuth();
    },

    adminLogin: async () => {
        const username = document.getElementById('adminLoginUsername').value.trim();
        const password = document.getElementById('adminLoginPassword').value;
        const errorEl = document.getElementById('adminLoginError');
        const res = await app.apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (res.ok && res.data.token) {
            app.setToken(res.data.token);
            if (res.data.user.role !== 'admin') {
                errorEl.textContent = 'Доступ только для администраторов';
                app.logout();
                return;
            }
            app.adminShowApp();
            app.adminNavigate('dashboard');
        } else {
            errorEl.textContent = res.data?.error?.message || 'Ошибка входа';
        }
    },

    adminCheckAuth: async () => {
        const res = await app.apiRequest('/auth/me');
        if (res.ok && res.data.role === 'admin') {
            app.adminShowApp();
            const page = window.location.hash.replace('#', '') || 'dashboard';
            app.adminNavigate(page);
        } else {
            app.logout();
        }
    },

    adminShowApp: () => {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('pages').classList.remove('hidden');
    },

    adminNavigate: (page) => {
        window.location.hash = page;
        app.adminRoute();
    },

    adminRoute: () => {
        const page = window.location.hash.replace('#', '') || 'dashboard';
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.admin-nav-item').forEach(l => l.classList.remove('active'));
        const target = document.getElementById(`page-${page}`);
        if (target) {
            target.classList.remove('hidden');
            const nav = document.querySelector(`.admin-nav-item[data-page="${page}"]`);
            if (nav) nav.classList.add('active');
            app.adminLoadPage(page);
        }
    },

    adminLoadPage: (page) => {
        if (page === 'dashboard') app.loadDashboard();
        if (page === 'users') app.loadAdminUsers();
        if (page === 'equipment') app.loadAdminEquipment();
        if (page === 'rentals') app.loadAdminRentals();
        if (page === 'categories') app.loadAdminCategories();
    },

    loadDashboard: async () => {
        const res = await app.apiRequest('/stats');
        if (res.ok) {
            document.getElementById('statUsers').textContent = res.data.users;
            document.getElementById('statEquipment').textContent = res.data.equipment;
            document.getElementById('statAvailable').textContent = res.data.available;
            document.getElementById('statRented').textContent = res.data.rented;
            document.getElementById('statRentals').textContent = res.data.rentals;
            document.getElementById('statPending').textContent = res.data.pending;
        }
    },

    loadAdminUsers: async () => {
        const res = await app.apiRequest('/users');
        const tbody = document.getElementById('adminUsersTable');
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Ошибка загрузки</td></tr>'; return; }
        if (res.data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Нет пользователей</td></tr>'; return; }
        tbody.innerHTML = res.data.items.map(u => `
            <tr>
                <td>${u.id.substr(0, 12)}…</td>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td>${u.full_name || '—'}</td>
                <td>${u.phone || '—'}</td>
                <td><span class="badge ${u.role}">${u.role === 'admin' ? 'Админ' : 'Клиент'}</span></td>
                <td>
                    <button class="btn-small" onclick="app.openEditUserModal('${u.id}')">Редактировать</button>
                </td>
            </tr>
        `).join('');
    },

    openEditUserModal: async (userId) => {
        const res = await app.apiRequest(`/users/${userId}`);
        if (!res.ok) {
            alert('Не удалось загрузить данные пользователя');
            return;
        }

        const user = res.data;
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserUsername').value = user.username;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserFullName').value = user.full_name || '';
        document.getElementById('editUserPhone').value = user.phone || '';
        document.getElementById('editUserRole').value = user.role;

        document.getElementById('editUserModal').classList.add('active');
    },

    closeEditUserModal: () => {
        document.getElementById('editUserModal').classList.remove('active');
    },

    editUser: async (e) => {
        e.preventDefault();
        const id = document.getElementById('editUserId').value;
        const email = document.getElementById('editUserEmail').value.trim();
        const full_name = document.getElementById('editUserFullName').value.trim();
        const phone = document.getElementById('editUserPhone').value.trim();
        const role = document.getElementById('editUserRole').value;

        // Валидация
        if (!email) {
            app.showError('Email обязателен');
            return;
        }

        if (!app.validateEmail(email)) {
            app.showError('Введите корректный email');
            return;
        }

        if (phone && !app.validatePhone(phone)) {
            app.showError('Введите корректный номер телефона');
            return;
        }

        const res = await app.apiRequest(`/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                email,
                full_name: full_name || null,
                phone: phone || null,
                role
            })
        });

        if (res.ok) {
            app.showSuccess('Пользователь успешно обновлен');
            app.closeEditUserModal();
            app.loadAdminUsers();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка обновления пользователя');
        }
    },

    loadAdminEquipment: async () => {
        const res = await app.apiRequest('/equipment');
        const tbody = document.getElementById('adminEquipmentTable');
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Ошибка загрузки</td></tr>'; return; }
        if (res.data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Нет техники</td></tr>'; return; }
        tbody.innerHTML = res.data.items.map(e => `
            <tr>
                <td>${e.id}</td>
                <td>${e.name}</td>
                <td>${e.category_name || '—'}</td>
                <td>${e.price_per_day.toLocaleString('ru-RU')} ₽</td>
                <td><span class="badge ${e.status}">${e.status === 'available' ? 'Доступно' : e.status === 'rented' ? 'В аренде' : 'Обслуживание'}</span></td>
                <td>
                    <button class="btn-small" onclick="app.openEditEquipmentModal(${e.id})">Редактировать</button>
                    <button class="btn-small btn-accent" onclick="app.deleteEquipment(${e.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    },

    openAddEquipmentModal: async () => {
        // Загрузить категории для выпадающего списка
        const res = await app.apiRequest('/categories');
        const select = document.getElementById('equipmentCategory');
        if (res.ok) {
            select.innerHTML = '<option value="">Выберите категорию</option>' +
                res.data.items.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        // Очистить форму
        document.getElementById('addEquipmentForm').reset();
        document.getElementById('addEquipmentModal').classList.add('active');
    },

    closeAddEquipmentModal: () => {
        document.getElementById('addEquipmentModal').classList.remove('active');
    },

    addEquipment: async (e) => {
        e.preventDefault();
        const category_id = parseInt(document.getElementById('equipmentCategory').value);
        const name = document.getElementById('equipmentName').value.trim();
        const description = document.getElementById('equipmentDescription').value.trim();
        const specs = document.getElementById('equipmentSpecs').value.trim();
        const price_per_day = parseInt(document.getElementById('equipmentPrice').value);
        const image_url = document.getElementById('equipmentImage').value.trim();
        const status = document.getElementById('equipmentStatus').value;

        // Валидация
        if (!category_id || !name || !price_per_day) {
            app.showError('Заполните все обязательные поля');
            return;
        }

        if (name.length < 3) {
            app.showError('Название должно содержать минимум 3 символа');
            return;
        }

        if (price_per_day < 0) {
            app.showError('Цена не может быть отрицательной');
            return;
        }

        const res = await app.apiRequest('/equipment', {
            method: 'POST',
            body: JSON.stringify({
                category_id,
                name,
                slug: name.toLowerCase().replace(/\s+/g, '-'),
                description: description || null,
                specs: specs || null,
                price_per_day,
                image_url: image_url || null,
                status
            })
        });

        if (res.ok) {
            app.showSuccess('Техника успешно добавлена');
            app.closeAddEquipmentModal();
            app.loadAdminEquipment();
            app.loadDashboard();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка добавления техники');
        }
    },

    openEditEquipmentModal: async (id) => {
        const res = await app.apiRequest(`/equipment/${id}`);
        if (!res.ok) {
            alert('Не удалось загрузить данные техники');
            return;
        }

        const equipment = res.data;
        const categoriesRes = await app.apiRequest('/categories');
        const editCategorySelect = document.getElementById('editEquipmentCategory');

        if (categoriesRes.ok) {
            editCategorySelect.innerHTML = '<option value="">Выберите категорию</option>' +
                categoriesRes.data.items.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        document.getElementById('editEquipmentId').value = equipment.id;
        document.getElementById('editEquipmentCategory').value = equipment.category_id;
        document.getElementById('editEquipmentName').value = equipment.name;
        document.getElementById('editEquipmentDescription').value = equipment.description || '';
        document.getElementById('editEquipmentSpecs').value = equipment.specs || '';
        document.getElementById('editEquipmentPrice').value = equipment.price_per_day;
        document.getElementById('editEquipmentImage').value = equipment.image_url || '';
        document.getElementById('editEquipmentStatus').value = equipment.status;

        document.getElementById('editEquipmentModal').classList.add('active');
    },

    closeEditEquipmentModal: () => {
        document.getElementById('editEquipmentModal').classList.remove('active');
    },

    editEquipment: async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('editEquipmentId').value);
        const category_id = parseInt(document.getElementById('editEquipmentCategory').value);
        const name = document.getElementById('editEquipmentName').value.trim();
        const description = document.getElementById('editEquipmentDescription').value.trim();
        const specs = document.getElementById('editEquipmentSpecs').value.trim();
        const price_per_day = parseInt(document.getElementById('editEquipmentPrice').value);
        const image_url = document.getElementById('editEquipmentImage').value.trim();
        const status = document.getElementById('editEquipmentStatus').value;

        // Валидация
        if (!category_id || !name || !price_per_day) {
            app.showError('Заполните все обязательные поля');
            return;
        }

        if (name.length < 3) {
            app.showError('Название должно содержать минимум 3 символа');
            return;
        }

        if (price_per_day < 0) {
            app.showError('Цена не может быть отрицательной');
            return;
        }

        const res = await app.apiRequest(`/equipment/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                category_id,
                name,
                slug: name.toLowerCase().replace(/\s+/g, '-'),
                description: description || null,
                specs: specs || null,
                price_per_day,
                image_url: image_url || null,
                status
            })
        });

        if (res.ok) {
            app.showSuccess('Техника успешно обновлена');
            app.closeEditEquipmentModal();
            app.loadAdminEquipment();
            app.loadDashboard();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка обновления техники');
        }
    },

    deleteEquipment: async (id) => {
        if (!confirm('Вы уверены, что хотите удалить эту технику?')) return;

        const res = await app.apiRequest(`/equipment/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            app.showSuccess('Техника успешно удалена');
            app.loadAdminEquipment();
            app.loadDashboard();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка удаления техники');
        }
    },

    loadAdminRentals: async () => {
        const res = await app.apiRequest('/rentals');
        const tbody = document.getElementById('adminRentalsTable');
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Ошибка загрузки</td></tr>'; return; }
        if (res.data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="td-empty">Нет заявок</td></tr>'; return; }
        tbody.innerHTML = res.data.items.map(r => `
            <tr>
                <td>${r.id}</td>
                <td>${r.full_name || r.username || r.user_id}</td>
                <td>${r.equipment_name || r.equipment_id}</td>
                <td>${r.start_date} — ${r.end_date}</td>
                <td>${r.total_price.toLocaleString('ru-RU')} ₽</td>
                <td><span class="badge ${r.status}">${r.status === 'pending' ? 'Ожидает' : r.status === 'confirmed' ? 'Подтверждено' : r.status === 'cancelled' ? 'Отменено' : 'Завершено'}</span></td>
                <td>
                    ${r.status === 'pending' ? `<button class="btn-small" onclick="app.updateRentalStatus(${r.id}, 'confirmed')">Подтвердить</button><button class="btn-small btn-accent" onclick="app.updateRentalStatus(${r.id}, 'cancelled')">Отменить</button>` : r.status === 'confirmed' ? `<button class="btn-small" onclick="app.updateRentalStatus(${r.id}, 'completed')">Завершить</button>` : '—'}
                </td>
            </tr>
        `).join('');
    },

    updateRentalStatus: async (id, status) => {
        const res = await app.apiRequest(`/rentals/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            app.loadAdminRentals();
            app.loadDashboard();
        } else {
            alert(res.data?.error?.message || 'Ошибка обновления');
        }
    },

    // --- Categories Management ---
    loadAdminCategories: async () => {
        const res = await app.apiRequest('/categories');
        const tbody = document.getElementById('adminCategoriesTable');
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Ошибка загрузки</td></tr>'; return; }
        if (res.data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="td-empty">Нет категорий</td></tr>'; return; }
        tbody.innerHTML = res.data.items.map(c => `
            <tr>
                <td>${c.id}</td>
                <td style="font-size:1.5rem;">${c.icon || '—'}</td>
                <td>${c.name}</td>
                <td><code style="background:var(--bg);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.85rem;">${c.slug}</code></td>
                <td>${c.description || '—'}</td>
                <td>
                    <button class="btn-small" onclick="app.openEditCategoryModal(${c.id})">Редактировать</button>
                    <button class="btn-small btn-accent" onclick="app.deleteCategory(${c.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    },

    openAddCategoryModal: () => {
        document.getElementById('addCategoryForm').reset();
        document.getElementById('addCategoryModal').classList.add('active');
    },

    closeAddCategoryModal: () => {
        document.getElementById('addCategoryModal').classList.remove('active');
    },

    openEditCategoryModal: async (id) => {
        const res = await app.apiRequest(`/categories/${id}`);
        if (!res.ok) {
            alert('Не удалось загрузить данные категории');
            return;
        }

        const category = res.data;
        document.getElementById('editCategoryId').value = category.id;
        document.getElementById('editCategoryName').value = category.name;
        document.getElementById('editCategorySlug').value = category.slug;
        document.getElementById('editCategoryDescription').value = category.description || '';
        document.getElementById('editCategoryIcon').value = category.icon || '';

        document.getElementById('editCategoryModal').classList.add('active');
    },

    closeEditCategoryModal: () => {
        document.getElementById('editCategoryModal').classList.remove('active');
    },

    deleteCategory: async (id) => {
        if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return;

        const res = await app.apiRequest(`/categories/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            app.showSuccess('Категория успешно удалена');
            app.loadAdminCategories();
            app.loadCategoryFilter();
            app.loadCategories();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка удаления категории');
        }
    },

    addCategory: async (e) => {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        const slug = document.getElementById('categorySlug').value.trim();
        const description = document.getElementById('categoryDescription').value.trim();
        const icon = document.getElementById('categoryIcon').value.trim();

        // Валидация
        if (!name || !slug) {
            app.showError('Название и slug обязательны');
            return;
        }

        if (name.length < 2) {
            app.showError('Название должно содержать минимум 2 символа');
            return;
        }

        if (slug.length < 2) {
            app.showError('Slug должен содержать минимум 2 символа');
            return;
        }

        if (!/^[a-z0-9\-_]+$/.test(slug)) {
            app.showError('Slug может содержать только латинские буквы, цифры, дефисы и подчеркивания');
            return;
        }

        const res = await app.apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({
                name,
                slug,
                description: description || null,
                icon: icon || null
            })
        });

        if (res.ok) {
            app.showSuccess('Категория успешно добавлена');
            app.closeAddCategoryModal();
            app.loadAdminCategories();
            app.loadCategoryFilter();
            app.loadCategories();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка добавления категории');
        }
    },

    editCategory: async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('editCategoryId').value);
        const name = document.getElementById('editCategoryName').value.trim();
        const slug = document.getElementById('editCategorySlug').value.trim();
        const description = document.getElementById('editCategoryDescription').value.trim();
        const icon = document.getElementById('editCategoryIcon').value.trim();

        // Валидация
        if (!name || !slug) {
            app.showError('Название и slug обязательны');
            return;
        }

        if (name.length < 2) {
            app.showError('Название должно содержать минимум 2 символа');
            return;
        }

        if (slug.length < 2) {
            app.showError('Slug должен содержать минимум 2 символа');
            return;
        }

        if (!/^[a-z0-9\-_]+$/.test(slug)) {
            app.showError('Slug может содержать только латинские буквы, цифры, дефисы и подчеркивания');
            return;
        }

        const res = await app.apiRequest(`/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                name,
                slug,
                description: description || null,
                icon: icon || null
            })
        });

        if (res.ok) {
            app.showSuccess('Категория успешно обновлена');
            app.closeEditCategoryModal();
            app.loadAdminCategories();
            app.loadCategoryFilter();
            app.loadCategories();
        } else {
            app.showError(res.data?.error?.message || 'Ошибка обновления категории');
        }
    },

    // --- Mobile Menu Toggle ---
    toggleMobileMenu: () => {
        const navLinks = document.getElementById('navLinks');
        const menuToggle = document.getElementById('mobileMenuToggle');
        if (navLinks && menuToggle) {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
        }
    }
};

window.app = app;

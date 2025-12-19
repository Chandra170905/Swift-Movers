const app = {
    // State
    currentPage: 'dashboard',
    user: null,
    theme: 'dark',

    // Core Methods
    async init() {
        this.checkAuth();
        this.loadTheme();
        this.loadNotifications(); // Load saved notifications
        await this.fetchInitialData();
        this.setupNavigation();
        this.setupAuthListeners();
        this.render('dashboard');
    },

    async fetchInitialData() {
        try {
            await fetch('/api/init'); // Seed if empty

            const [quotesRes, inventoryRes, claimsRes, statsRes, activitiesRes] = await Promise.all([
                fetch('/api/quotes'),
                fetch('/api/inventory'),
                fetch('/api/claims'),
                fetch('/api/stats'),
                fetch('/api/activities')
            ]);

            this.data.quotes = await quotesRes.json();
            this.data.inventory = await inventoryRes.json();
            this.data.claims = await claimsRes.json();
            this.data.stats = await statsRes.json();
            this.data.activities = await activitiesRes.json();

            const trucksRes = await fetch('/api/trucks');
            if (trucksRes.ok) {
                this.data.trucks = await trucksRes.json();
            } else {
                console.error('Failed to fetch trucks');
                this.data.trucks = [];
            }

            // Map activities to notifications format for UI compatibility if needed, or just use activities directly
            this.data.notifications = this.data.activities.map(a => ({
                title: a.action,
                message: a.details,
                time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'info' // Default
            }));

        } catch (err) {
            console.error('Failed to fetch data', err);
        }
    },

    loadTheme() {
        const storedTheme = localStorage.getItem('swift_theme');
        if (storedTheme) {
            this.theme = storedTheme;
            document.documentElement.setAttribute('data-theme', this.theme);
        }
    },

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('swift_theme', this.theme);
        this.render('settings');
    },

    // toggleLoginMode removed (Admin Only)

    checkAuth() {
        const user = localStorage.getItem('swift_user');
        if (user) {
            this.user = JSON.parse(user);

            // Auto-fix legacy Client role to Staff since we are now Admin-only
            if (this.user.role === 'Client') {
                this.user.role = 'Staff';
                localStorage.setItem('swift_user', JSON.stringify(this.user));
            }

            this.showApp();
            this.updateSidebar();

            this.updateSidebar();
        } else {
            this.showLogin();
        }
    },

    updateSidebar() {
        if (!this.user) return;
        const initials = this.user.name ? this.user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'SA';
        const sidebarName = document.getElementById('sidebar-name');
        const sidebarRole = document.getElementById('sidebar-role');
        const sidebarAvatar = document.getElementById('sidebar-avatar');

        if (sidebarName) sidebarName.textContent = this.user.name;
        if (sidebarRole) sidebarRole.textContent = this.user.role;
        if (sidebarAvatar) sidebarAvatar.textContent = initials;
    },

    setupAuthListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) { // Ensure login form exists before adding listener
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const errorMsg = document.getElementById('login-error');

                try {
                    const res = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });

                    const data = await res.json();

                    if (data.success) {
                        this.user = data.user;
                        localStorage.setItem('swift_user', JSON.stringify(data.user));
                        this.showApp();
                        this.updateSidebar();
                        loginForm.reset();
                        errorMsg.style.display = 'none';
                    } else {
                        errorMsg.textContent = data.message;
                        errorMsg.style.display = 'block';
                    }
                } catch (err) {
                    errorMsg.textContent = 'Server error. Is Node running?';
                    errorMsg.style.display = 'block';
                }
            });
        }

        // Registration Logic removed

        const userProfile = document.getElementById('btn-profile');
        if (userProfile) {
            userProfile.addEventListener('click', () => {
                this.navigateTo('profile');
            });
        }

        const btnNotif = document.getElementById('btn-notifications');
        if (btnNotif) {
            btnNotif.addEventListener('click', () => {
                this.navigateTo('notifications');
            });
        }

        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                this.navigateTo('settings');
            });
        }
    },

    logout() {
        this.user = null;
        localStorage.removeItem('swift_user');
        this.showLogin();
    },

    showApp() {
        const loginScreen = document.getElementById('login-screen');
        const mainLayout = document.getElementById('main-layout');
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainLayout) mainLayout.classList.remove('hidden');
        if (window.feather) feather.replace(); // Refresh icons if needed
    },

    showLogin() {
        const loginScreen = document.getElementById('login-screen');
        const mainLayout = document.getElementById('main-layout');
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (mainLayout) mainLayout.classList.add('hidden');
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.navigateTo(view);
            });
        });
    },

    navigateTo(view) {
        this.currentPage = view;

        // Update Sidebar
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === view) item.classList.add('active');
        });

        // Update Header
        const titleMap = {
            'dashboard': 'Overview',
            'quotes': 'Quote Management',
            'calculator': 'Cost Calculator',
            'schedule': 'Move Schedule',
            'inventory': 'Warehouse Management',
            'claims': 'Insurance Claims',
            'notifications': 'Activity Log',
            'settings': 'Settings',
            'profile': 'Staff Profile',
            'fleet': 'Fleet Control'
        };
        document.getElementById('page-title').textContent = titleMap[view] || 'Dashboard';

        this.render(view);
    },

    render(view) {
        const container = document.getElementById('app-view');
        container.innerHTML = ''; // Clear current view

        // Simple Router
        switch (view) {
            case 'dashboard':
                container.innerHTML = this.views.dashboard();
                break;
            case 'quotes':
                container.innerHTML = this.views.quotes();
                this.initQuotes();
                break;
            case 'calculator':
                container.innerHTML = this.views.calculator();
                this.initCalculator(); // Bind events
                break;
            case 'schedule':
                container.innerHTML = this.views.schedule();
                this.initSchedule();
                break;
            case 'inventory':
                container.innerHTML = this.views.inventory();
                this.initInventory();
                break;
            case 'claims':
                container.innerHTML = this.views.claims();
                this.initClaims();
                break;
            case 'notifications':
                container.innerHTML = this.views.notifications();
                break;
            case 'settings':
                container.innerHTML = this.views.settings();
                break;
            case 'profile':
                container.innerHTML = this.views.profile();
                break;
            case 'fleet':
                container.innerHTML = this.views.fleet();
                this.initFleet();
                break;
            default:
                container.innerHTML = this.views.dashboard();
        }

        // Re-initialize icons for new content
        if (window.feather) feather.replace();
    },

    // View Templates (Strings for now, typically would be separate files or components)
    views: {
        dashboard() {
            const stats = app.data.stats || { quotes: 0, moves: 0, revenue: 0, claims: 0 };
            return `
                <div class="stats-grid">
                    <div class="card stat-card">
                        <h3>Total Quotes</h3>
                        <div class="value">${stats.quotes}</div>
                    </div>
                    <div class="card stat-card">
                        <h3>Scheduled Moves</h3>
                        <div class="value">${stats.moves}</div>
                    </div>
                    <div class="card stat-card">
                        <h3>Revenue</h3>
                        <div class="value">$${stats.revenue.toLocaleString()}</div>
                    </div>
                    <div class="card stat-card">
                        <h3>Total Claims</h3>
                        <div class="value">${stats.claims}</div>
                    </div>
                </div>

    <div class="card">
        <h3>Recent Activity</h3>
        <div style="margin-top: 1.5rem; display: grid; gap: 1rem;">
            ${app.data.notifications.length ? app.data.notifications.slice(0, 5).map(n => `
                <div style="display: flex; gap: 1rem; align-items: start; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                    <div style="background: ${n.type === 'success' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(56, 189, 248, 0.1)'}; padding: 0.5rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i data-feather="${n.type === 'success' ? 'check' : 'bell'}" style="width: 16px; height: 16px; color: ${n.type === 'success' ? 'var(--secondary)' : 'var(--primary)'};"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.25rem;">${n.title}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">${n.message}</p>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.25rem;">${n.time}</span>
                    </div>
                </div>
            `).join('') : '<p style="color: var(--text-muted);">No recent activity to show.</p>'}
        </div>
    </div>
`;
        },
        quotes() {
            return `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <h3>Active Quotes</h3>
                        <button class="btn-primary" onclick="app.toggleQuoteModal()">+ New Quote</button>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                    <th style="padding: 1rem;">Customer</th>
                                    <th style="padding: 1rem;">From/To</th>
                                    <th style="padding: 1rem;">Date</th>
                                    <th style="padding: 1rem;">Amount</th>
                                    <th style="padding: 1rem;">Status</th>
                                    <th style="padding: 1rem;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="quotes-table-body">
                                <!-- Quotes rendered here -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Simple Modal for New Quote -->
    <div id="quote-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;">
        <div class="card" style="width: 90%; max-width: 500px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
                <h3>New Quote</h3>
                <button onclick="app.toggleQuoteModal()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
            </div>
            <form onsubmit="app.handleQuoteSubmit(event)">
                <input type="text" name="name" placeholder="Customer Name" required>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <input type="text" name="origin" placeholder="Origin Zip" required>
                            <input type="text" name="dest" placeholder="Dest Zip" required>
                            </div>
                            <input type="date" name="date" required>
                                <input type="number" name="amount" placeholder="Estimated Amount ($)" required>
                                    <button type="submit" class="btn-primary" style="width: 100%;">Create Quote</button>
                                </form>
                            </div>
                    </div>
                    `;
        },
        calculator() {
            return `
                    <div class="card" style="max-width: 600px; margin: 0 auto;">
                        <h3>Move Cost Estimator</h3>
                        <div style="margin-top: 2rem;">
                            <label>Distance (miles)</label>
                            <input type="number" id="calc-distance" placeholder="0">

                                <label>Home Size</label>
                                <select id="calc-size">
                                    <option value="1">Studio</option>
                                    <option value="2">1 Bedroom</option>
                                    <option value="3">2 Bedrooms</option>
                                    <option value="4">3+ Bedrooms</option>
                                </select>

                                <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-dark); border-radius: var(--radius-sm);">
                                    <span style="color: var(--text-muted);">Estimated Cost:</span>
                                    <div id="calc-result" class="value" style="font-size: 2rem; color: var(--secondary); font-weight: 700;">$0</div>
                                </div>
                        </div>
                    </div>
                    `;
        },
        schedule() {
            return `
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                            <h3>Upcoming Moves</h3>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn-primary" style="background: var(--bg-dark); border: 1px solid var(--border);">Filter by Date</button>
                            </div>
                        </div>
                        <div id="schedule-list" style="display: grid; gap: 1rem;">
                            <!-- Schedule items here -->
                        </div>
                    </div>
                    `;
        },
        inventory() {
            return `
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                        <div class="card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                                <h3>Warehouse Storage</h3>
                                <span id="total-items" style="color: var(--text-muted);">0 Items</span>
                            </div>
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="text-align: left; color: var(--text-muted); border-bottom: 1px solid var(--border);">
                                        <th style="padding: 0.5rem;">Item</th>
                                        <th style="padding: 0.5rem;">Category</th>
                                        <th style="padding: 0.5rem;">Vol (ft³)</th>
                                        <th style="padding: 0.5rem;"></th>
                                    </tr>
                                </thead>
                                <tbody id="inventory-list">
                                    <!-- Items here -->
                                </tbody>
                            </table>
                        </div>

                        <div class="card" style="height: fit-content;">
                            <h3>Add Item</h3>
                            <form onsubmit="app.handleInventorySubmit(event)" style="margin-top: 1.5rem;">
                                <input type="text" name="item" placeholder="Item Name" required>
                                    <select name="category">
                                        <option value="Furniture">Furniture</option>
                                        <option value="Electronics">Electronics</option>
                                        <option value="Boxes">Boxes</option>
                                        <option value="Fragile">Fragile</option>
                                    </select>
                                    <input type="number" name="volume" placeholder="Volume (ft³)" required>
                                        <button type="submit" class="btn-primary" style="width: 100%;">Add to Inventory</button>
                                    </form>
                                </div>
                        </div>
                        `;
        },
        claims() {
            return `
                        <div class="card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                                <h3>Insurance Claims</h3>
                                <button class="btn-primary" onclick="app.toggleClaimModal()">+ File Claim</button>
                            </div>
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="text-align: left; color: var(--text-muted); border-bottom: 1px solid var(--border);">
                                        <th style="padding: 1rem;">Claim ID</th>
                                        <th style="padding: 1rem;">Customer</th>
                                        <th style="padding: 1rem;">Type</th>
                                        <th style="padding: 1rem;">Amount</th>
                                        <th style="padding: 1rem;">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="claims-list">
                                    <!-- Claims here -->
                                </tbody>
                            </table>
                        </div>

                        <!-- Claim Modal -->
                        <div id="claim-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;">
                            <div class="card" style="width: 90%; max-width: 500px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
                                    <h3>File New Claim</h3>
                                    <button onclick="app.toggleClaimModal()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
                                </div>
                                <form onsubmit="app.handleClaimSubmit(event)">
                                    <input type="text" name="name" placeholder="Customer Name" required value="${app.user ? app.user.name : ''}">
                                    <select name="type" style="width: 100%; padding: 0.75rem; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border); border-radius: var(--radius-sm); color: white; margin-bottom: 1rem;">
                                        <option value="Damaged Item">Damaged Item</option>
                                        <option value="Lost Box">Lost Box</option>
                                        <option value="Delay">Delay</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <input type="number" name="amount" placeholder="Claim Amount ($)" required>
                                    <button type="submit" class="btn-primary" style="width: 100%;">Submit Claim</button>
                                </form>
                            </div>
                        </div>
                        `;
        },
        notifications() {
            const list = app.data.notifications.length ? app.data.notifications.map(n => `
                <div style="display: flex; gap: 1rem; padding: 1rem; background: var(--bg-dark); border-radius: var(--radius-sm); align-items: flex-start;">
                    <i data-feather="${n.type === 'success' ? 'check-circle' : 'alert-circle'}" style="color: ${n.type === 'success' ? 'var(--secondary)' : 'var(--accent)'}; margin-top: 2px;"></i>
                    <div>
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.25rem;">${n.title}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">${n.message}</p>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.5rem;">${n.time}</span>
                    </div>
                </div>
            `).join('') : '<p style="text-align: center; color: var(--text-muted);">No new notifications.</p>';

            return `
                <div class="card" style="max-width: 600px; margin: 0 auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3>Notifications</h3>
                        ${app.data.notifications.length ? `<button onclick="app.data.notifications=[]; app.saveNotifications(); app.render('notifications');" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.85rem;">Clear All</button>` : ''}
                    </div>
                    <div style="margin-top: 1.5rem; display: grid; gap: 1rem;">
                        ${list}
                    </div>
                </div>
            `;
        },
        settings() {
            const isDark = app.theme === 'dark';
            return `
                <div class="card" style="max-width: 600px; margin: 0 auto;">
                    <h3>Application Settings</h3>
                    
                    <div style="margin-top: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border);">
                            <div>
                                <h4 style="font-size: 1rem;">Dark Mode</h4>
                                <p style="font-size: 0.85rem; color: var(--text-muted);">Use system theme preference</p>
                            </div>
                            <div onclick="app.toggleTheme()" style="width: 40px; height: 20px; background: ${isDark ? 'var(--primary)' : 'var(--border)'}; border-radius: 20px; position: relative; cursor: pointer; transition: background 0.3s;">
                                <div style="width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${isDark ? '22px' : '2px'}; transition: left 0.3s;"></div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border);">
                            <div>
                                <h4 style="font-size: 1rem;">Email Notifications</h4>
                                <p style="font-size: 0.85rem; color: var(--text-muted);">Receive updates via email</p>
                            </div>
                            <div style="width: 40px; height: 20px; background: var(--border); border-radius: 20px; position: relative; cursor: pointer;">
                                <div style="width: 16px; height: 16px; background: var(--text-muted); border-radius: 50%; position: absolute; top: 2px; left: 2px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },
        profile() {
            const user = app.user || { name: 'Guest', role: 'Visitor', username: 'guest', email: '' };
            const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'GU';

            return `
                <div class="card" style="max-width: 500px; margin: 0 auto; text-align: center;">
                    <div style="width: 100px; height: 100px; background: var(--bg-dark); border-radius: 50%; border: 3px solid var(--secondary); margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700;">
                        ${initials}
                    </div>
                    <h2 style="margin-bottom: 0.5rem;">${user.name}</h2>
                    <p style="color: var(--secondary); font-weight: 500; margin-bottom: 2rem;">${user.role}</p>
                    
                    <div style="text-align: left; background: var(--bg-dark); padding: 1.5rem; border-radius: var(--radius-sm); margin-bottom: 2rem;">
                        <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Username</label>
                        <div style="margin-bottom: 1rem;">${user.username}</div>

                        <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Email</label>
                        <div style="margin-bottom: 1rem;">${user.email || 'Not provided'}</div>
                    </div>

                    <button onclick="app.logout()" style="width: 100%; padding: 1rem; border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                        <i data-feather="log-out" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 0.5rem;"></i> Sign Out
                    </button>
                </div>
            `;
        },
        fleet() {
            return `
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                            <h3>Company Fleet</h3>
                            <span id="truck-count" style="color: var(--text-muted);">${app.data.trucks ? app.data.trucks.length : 0} Vehicles</span>
                        </div>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                        <th style="padding: 1rem;">Truck ID</th>
                                        <th style="padding: 1rem;">Type</th>
                                        <th style="padding: 1rem;">Capacity (ft³)</th>
                                        <th style="padding: 1rem;">Status</th>
                                        <th style="padding: 1rem;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="fleet-list">
                                    <!-- Trucks here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card" style="height: fit-content;">
                        <h3>Add New Vehicle</h3>
                        <form onsubmit="app.handleTruckSubmit(event)" style="margin-top: 1.5rem;">
                            <input type="text" name="truckId" placeholder="ID (e.g. T-105)" required>
                            <select name="type">
                                <option value="26ft Box Truck">26ft Box Truck</option>
                                <option value="16ft Box Truck">16ft Box Truck</option>
                                <option value="Sprinter Van">Sprinter Van</option>
                                <option value="Trailer">Trailer</option>
                            </select>
                            <input type="number" name="capacity" placeholder="Capacity (ft³)" required>
                            <button type="submit" class="btn-primary" style="width: 100%;">Add Vehicle</button>
                        </form>
                    </div>
                </div>
            `;
        }
    },

    // Data Store
    data: {
        quotes: [],
        schedule: [], // Deprecated: Derived from quotes
        inventory: [],
        claims: [],
        notifications: [],
        trucks: []
    },

    // Utilities
    loadNotifications() {
        // Now handled via API
        // this.renderNotificationsBadge();
    },

    saveNotifications() {
        localStorage.setItem('swift_notifications', JSON.stringify(this.data.notifications));
        this.renderNotificationsBadge();
    },

    addNotification(title, message, type = 'info') {
        const newNotif = {
            id: Date.now(),
            title,
            message,
            type,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false
        };
        this.data.notifications.unshift(newNotif);
        this.saveNotifications();

        // Optional: Show toast or alert? For now just log
        console.log('New Notification:', title);
    },

    renderNotificationsBadge() {
        // Find notification icon and add dot if unread exists
        // Implementation omitted for brevity as UI doesn't explicitly support it yet
    },

    // Feature Logic
    initQuotes() {
        this.renderQuotesTable();
    },

    renderQuotesTable() {
        const tbody = document.getElementById('quotes-table-body');
        if (!tbody) return;

        tbody.innerHTML = this.data.quotes.map(q => {
            const truckSelect = `
                <select onchange="app.assignTruck('${q._id}', this.value)" style="padding: 0.25rem; font-size: 0.8rem; background: var(--bg-dark); border: 1px solid var(--border); color: white; border-radius: 4px;">
                    <option value="">Assign Truck...</option>
                    ${this.data.trucks.map(t => `<option value="${t.truckId}" ${q.truckId === t.truckId ? 'selected' : ''}>${t.truckId}</option>`).join('')}
                </select>
            `;

            return `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 1rem; font-weight: 500;">${q.name}</td>
                    <td style="padding: 1rem; color: var(--text-muted);">${q.origin} &rarr; ${q.dest}</td>
                    <td style="padding: 1rem;">${q.date}</td>
                    <td style="padding: 1rem;">$${q.amount}</td>
                    <td style="padding: 1rem;"><span style="padding: 0.25rem 0.5rem; background: ${q.status === 'Approved' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(217, 70, 239, 0.2)'}; color: ${q.status === 'Approved' ? 'var(--secondary)' : 'var(--accent)'}; border-radius: 4px; font-size: 0.75rem;">${q.status}</span></td>
                    <td style="padding: 1rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${q.status === 'Approved' ? truckSelect : ''}
                            <div style="display: flex; gap: 0.5rem;">
                                ${q.status === 'Pending' ? `<button onclick="app.approveQuote('${q._id}')" class="icon-btn" style="width: 30px; height: 30px; color: var(--secondary);" title="Approve"><i data-feather="check"></i></button>` : ''}
                                <button onclick="app.deleteQuote('${q._id}')" class="icon-btn" style="width: 30px; height: 30px; color: #ef4444;" title="Delete"><i data-feather="trash-2"></i></button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        feather.replace();
    },

    async assignTruck(quoteId, truckId) {
        try {
            const res = await fetch(`/api/quotes/${quoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ truckId })
            });
            const updated = await res.json();

            const idx = this.data.quotes.findIndex(q => q._id === quoteId);
            if (idx !== -1) {
                this.data.quotes[idx] = updated;
            }
            this.addNotification('Truck Assigned', `Truck ${truckId || 'None'} assigned to ${updated.name}`, 'success');
            // No need to full re-render here if we just want to update the local state, 
            // but for simplicity and showing the result in schedule:
            this.renderQuotesTable();
        } catch (err) {
            console.error('Error assigning truck', err);
        }
    },

    async approveQuote(id) {
        try {
            const res = await fetch(`/api/quotes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Approved' })
            });
            const updated = await res.json();

            // Update local state
            const idx = this.data.quotes.findIndex(q => q._id === id);
            if (idx !== -1) {
                this.data.quotes[idx] = updated;
                this.addNotification('Quote Approved', `Quote for ${updated.name} has been approved.`, 'success');
            }

            this.renderQuotesTable();
        } catch (err) {
            console.error('Error approving quote', err);
        }
    },

    async deleteQuote(id) {
        if (!confirm('Are you sure you want to delete this quote?')) return;

        try {
            await fetch(`/api/quotes/${id}`, { method: 'DELETE' });

            // Remove from local state
            this.data.quotes = this.data.quotes.filter(q => q._id !== id);
            this.renderQuotesTable();
        } catch (err) {
            console.error('Error deleting quote', err);
        }
    },

    toggleQuoteModal() {
        const modal = document.getElementById('quote-modal');
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    },

    async handleQuoteSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newQuote = {
            name: formData.get('name'),
            origin: formData.get('origin'),
            dest: formData.get('dest'),
            date: formData.get('date'),
            amount: formData.get('amount')
        };

        try {
            const res = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newQuote)
            });
            const savedQuote = await res.json();

            this.data.quotes.unshift(savedQuote);
            this.toggleQuoteModal();
            this.renderQuotesTable();
        } catch (err) {
            console.error('Error saving quote', err);
        }
    },

    initSchedule() {
        const list = document.getElementById('schedule-list');
        if (!list) return;

        // Filter approved quotes
        const scheduledMoves = this.data.quotes.filter(q => q.status === 'Approved');

        if (scheduledMoves.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No upcoming scheduled moves.</p>';
            return;
        }

        list.innerHTML = scheduledMoves.map(item => `
                        <div style="background: var(--bg-dark); padding: 1rem; border-radius: var(--radius-sm); border-left: 4px solid var(--primary); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin-bottom: 0.25rem;">${item.name}</h4>
                                <p style="color: var(--text-muted); font-size: 0.875rem;">
                                    <i data-feather="map-pin" style="width:14px;height:14px;"></i> ${item.origin} &rarr; ${item.dest}
                                </p>
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    <span style="font-size: 0.75rem; padding: 2px 6px; background: rgba(56, 189, 248, 0.1); color: var(--secondary); border-radius: 4px;">
                                        Truck: ${item.truckId || 'Not Assigned'}
                                    </span>
                                    <span style="font-size: 0.75rem; padding: 2px 6px; background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border-radius: 4px;">Crew: 3</span>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; color: var(--secondary);">${item.date}</div>
                                <div style="color: var(--text-muted); font-size: 0.875rem;">09:00 AM</div>
                            </div>
                        </div>
                        `).join('');
        feather.replace();
    },

    initInventory() {
        this.renderInventory();
    },

    renderInventory() {
        const tbody = document.getElementById('inventory-list');
        const count = document.getElementById('total-items');
        if (!tbody) return;

        count.textContent = `${this.data.inventory.length} Items`;

        tbody.innerHTML = this.data.inventory.map(item => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 0.75rem 0.5rem; font-weight: 500;">${item.item}</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--text-muted); font-size: 0.9rem;">${item.category}</td>
                            <td style="padding: 0.75rem 0.5rem;">${item.volume}</td>
                            <td style="padding: 0.75rem 0.5rem; text-align: right;">
                                <button onclick="app.removeInventory('${item._id}')" style="background: none; border: none; color: #ef4444; cursor: pointer;"><i data-feather="trash-2" style="width: 16px; height: 16px;"></i></button>
                            </td>
                        </tr>
                        `).join('');
        feather.replace();
    },

    async handleInventorySubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newItem = {
            item: formData.get('item'),
            category: formData.get('category'),
            volume: formData.get('volume')
        };

        try {
            const res = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            const savedItem = await res.json();

            this.data.inventory.push(savedItem);
            e.target.reset();
            this.renderInventory();
        } catch (err) {
            console.error('Error saving inventory', err);
        }
    },

    async removeInventory(id) {
        try {
            await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
            this.data.inventory = this.data.inventory.filter(i => i._id !== id);
            this.renderInventory();
        } catch (err) {
            console.error('Error deleting item', err);
        }
    },

    initClaims() {
        const tbody = document.getElementById('claims-list');
        if (!tbody) return;

        tbody.innerHTML = this.data.claims.map(c => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 1rem; color: var(--primary); font-family: monospace;">${c._id ? c._id.substring(0, 8) : 'Pending'}</td>
                            <td style="padding: 1rem;">${c.name}</td>
                            <td style="padding: 1rem;">${c.type}</td>
                            <td style="padding: 1rem;">$${c.amount}</td>
                            <td style="padding: 1rem;">
                                <span style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px; font-size: 0.75rem;">${c.status}</span>
                            </td>
                        </tr>
                        `).join('');
    },

    toggleClaimModal() {
        const modal = document.getElementById('claim-modal');
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    },

    async handleClaimSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newClaim = {
            name: formData.get('name'),
            type: formData.get('type'),
            amount: formData.get('amount')
        };

        try {
            const res = await fetch('/api/claims', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newClaim)
            });
            const savedClaim = await res.json();

            this.data.claims.push(savedClaim);

            // Update Stats
            if (this.data.stats) this.data.stats.claims++;

            this.addNotification('Claim Filed', `New claim filed for ${savedClaim.name} ($${savedClaim.amount}).`, 'alert');
            this.toggleClaimModal();
            this.initClaims(); // Re-render
        } catch (err) {
            console.error('Error saving claim', err);
        }
    },

    initCalculator() {
        const distanceInput = document.getElementById('calc-distance');
        const sizeInput = document.getElementById('calc-size');
        const result = document.getElementById('calc-result');

        const calculate = () => {
            const distance = parseFloat(distanceInput.value) || 0;
            const sizeMultiplier = parseInt(sizeInput.value) || 1;
            const baseRate = 100;
            const perMile = 2.5;

            const total = baseRate + (distance * perMile * sizeMultiplier);
            result.textContent = '$' + total.toFixed(2);
        };

        distanceInput.addEventListener('input', calculate);
        sizeInput.addEventListener('change', calculate);
    },

    // Fleet Methods
    initFleet() {
        this.renderFleet();
    },

    renderFleet() {
        const tbody = document.getElementById('fleet-list');
        const count = document.getElementById('truck-count');
        if (!tbody) return;

        count.textContent = `${this.data.trucks.length} Vehicles`;

        tbody.innerHTML = this.data.trucks.map(t => `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 1rem; font-weight: 500;">${t.truckId}</td>
                <td style="padding: 1rem; color: var(--text-muted);">${t.type}</td>
                <td style="padding: 1rem;">${t.capacity}</td>
                <td style="padding: 1rem;">
                    <span style="padding: 0.25rem 0.5rem; background: ${t.status === 'Available' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${t.status === 'Available' ? '#10b981' : '#ef4444'}; border-radius: 4px; font-size: 0.75rem;">
                        ${t.status}
                    </span>
                </td>
                <td style="padding: 1rem;">
                    <button onclick="app.removeTruck('${t._id}')" style="background: none; border: none; color: #ef4444; cursor: pointer;">
                        <i data-feather="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        feather.replace();
    },

    async handleTruckSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newTruck = {
            truckId: formData.get('truckId'),
            type: formData.get('type'),
            capacity: formData.get('capacity')
        };

        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTruck)
            });

            if (!res.ok) {
                const errData = await res.json();
                this.addNotification('Error', errData.error || 'Failed to add vehicle', 'alert');
                return;
            }

            const saved = await res.json();
            this.data.trucks.push(saved);
            e.target.reset();
            this.addNotification('Success', `Vehicle ${saved.truckId} added to fleet`, 'success');
            this.renderFleet();
        } catch (err) {
            console.error('Error saving truck', err);
            this.addNotification('Error', 'Connection error. Is the server running?', 'alert');
        }
    },

    async removeTruck(id) {
        if (!confirm('Are you sure you want to decommission this vehicle?')) return;
        try {
            await fetch(`/api/trucks/${id}`, { method: 'DELETE' });
            this.data.trucks = this.data.trucks.filter(t => t._id !== id);
            this.renderFleet();
        } catch (err) {
            console.error('Error deleting truck', err);
        }
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

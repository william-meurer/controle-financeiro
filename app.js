/* ==========================================================================
   ANTIGRAVITY FINANCE PRO - CORE APPLICATION LOGIC (2026)
   Workflow Executivo Mensal & Bento Grid Dashboard
   ========================================================================== */

const DEFAULT_INITIAL_DATA = {
    currentMonth: "2026-07",
    months: {
        "2026-07": {
            label: "Julho 2026",
            incomes: [],
            closed: false,
            transactions: []
        }
    }
};

const firebaseConfig = {
  apiKey: "AIzaSyCr5aLy8OTt_GaBD6eRRi3eXQ43ZcvpI0E",
  authDomain: "controle-financeiro-1cb16.firebaseapp.com",
  projectId: "controle-financeiro-1cb16",
  storageBucket: "controle-financeiro-1cb16.firebasestorage.app",
  messagingSenderId: "130133712189",
  appId: "1:130133712189:web:6501b96e321c9893df7954"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let appState = {
    currentMonthKey: "2026-07",
    data: null,
    isPrivacyMode: true,
    theme: "light",
    isAuthenticated: false,
    sortByValueDesc: false
};
let itemToDeleteId = null;

document.addEventListener("DOMContentLoaded", () => {
    initIcons();
    setupAuth();
    initTheme();
    setupEventListeners();
    
    const icon = document.getElementById("privacy-icon");
    if (icon && appState.isPrivacyMode) {
        icon.setAttribute("data-lucide", "eye-off");
        document.getElementById("privacy-toggle-btn").classList.add("active");
        initIcons();
    }
});

function initTheme() {
    const savedTheme = localStorage.getItem("antigravity_finance_pro_theme");
    if (savedTheme) {
        appState.theme = savedTheme;
    } else {
        appState.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', appState.theme);
    const icon = document.getElementById('theme-icon');
    if (icon) {
        if (appState.theme === 'dark') {
            icon.setAttribute('data-lucide', 'moon');
        } else {
            icon.setAttribute('data-lucide', 'sun');
        }
        initIcons();
    }
}

function toggleTheme() {
    appState.theme = appState.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem("antigravity_finance_pro_theme", appState.theme);
    applyTheme();
    showToast(`Modo ${appState.theme === 'dark' ? 'Escuro' : 'Claro'} ativado`, 'info');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';
    
    toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    initIcons();
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// 1. AUTHENTICATION & LOGIN
function setupAuth() {
    // Força o logout imediato sempre que a página for carregada ou receber refresh
    auth.signOut().catch(error => console.error("Erro ao forçar logout:", error));

    const loginBtn = document.getElementById("login-btn");
    const loginError = document.getElementById("login-error");
    const logoutBtn = document.getElementById("logout-btn");

    if(loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("email-input").value.trim();
            const password = document.getElementById("password-input").value;
            
            if (!email || !password) {
                loginError.textContent = "Preencha e-mail e senha.";
                loginError.classList.remove("hidden");
                return;
            }

            try {
                loginBtn.textContent = "AGUARDE...";
                loginBtn.style.opacity = "0.7";
                await auth.signInWithEmailAndPassword(email, password);
                loginBtn.textContent = "ENTRAR";
                loginBtn.style.opacity = "1";
            } catch (error) {
                loginBtn.textContent = "ENTRAR";
                loginBtn.style.opacity = "1";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    loginError.textContent = "E-mail ou senha incorretos.";
                } else {
                    loginError.textContent = "Erro: " + error.message;
                }
                loginError.classList.remove("hidden");
                console.error(error);
            }
        });
    }

    if(logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            auth.signOut();
            document.getElementById("tools-popover").classList.add("hidden");
        });
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            appState.isAuthenticated = true;
            document.getElementById("login-screen").classList.add("hidden");
            document.getElementById("main-app").classList.remove("hidden");
            loadStateFromStorage();
        } else {
            appState.isAuthenticated = false;
            appState.data = null;
            document.getElementById("login-screen").classList.remove("hidden");
            document.getElementById("main-app").classList.add("hidden");
        }
    });

}

// 2. STORAGE (Firestore)
async function loadStateFromStorage() {
    if (!auth.currentUser) return;
    try {
        const docRef = db.collection('users').doc(auth.currentUser.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            appState.data = doc.data();
            
            // Auto-migração caso o Firestore esteja vazio mas o usuário tenha dados antigos no PC
            let hasAnyTx = false;
            for (let m in appState.data.months) {
                if (appState.data.months[m].transactions.length > 0) hasAnyTx = true;
            }
            if (!hasAnyTx) {
                const local = localStorage.getItem("antigravity_finance_pro_data");
                if (local) {
                    const parsed = JSON.parse(local);
                    let localHasAnyTx = false;
                    for (let m in parsed.months) {
                        if (parsed.months[m].transactions && parsed.months[m].transactions.length > 0) localHasAnyTx = true;
                    }
                    if (localHasAnyTx) {
                        appState.data = parsed;
                        await saveStateToStorage();
                    }
                }
            }

            // Migração de income para incomes array (para o Roadmap)
            let migratedIncome = false;
            for (let m in appState.data.months) {
                const mData = appState.data.months[m];
                if (mData.income !== undefined) {
                    mData.incomes = [
                        { id: 'inc-legacy-' + Date.now(), desc: 'Renda / Orçamento Mês', amount: Number(mData.income), date: '', received: true }
                    ];
                    delete mData.income;
                    migratedIncome = true;
                }
                if (!mData.incomes) mData.incomes = [];
            }
            if (migratedIncome) await saveStateToStorage();

            // Migração category+type → nature
            const didMigrateNature = migrateToNatureField();
            if (didMigrateNature) await saveStateToStorage();

            if (!appState.data.months[appState.currentMonthKey]) {
                const keys = Object.keys(appState.data.months).sort();
                appState.currentMonthKey = keys[keys.length - 1] || "2026-07";
            }
        } else {
            const local = localStorage.getItem("antigravity_finance_pro_data");
            if (local) {
                appState.data = JSON.parse(local);
            } else {
                appState.data = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
            }
            const didMigrateNature = migrateToNatureField();
            await saveStateToStorage();
        }
        renderApp();
    } catch (e) {
        console.error("Erro ao carregar dados", e);
        showToast("Erro ao carregar do banco de dados.", "error");
    }
}

function migrateToNatureField() {
    if (!appState.data || !appState.data.months) return false;
    let migrated = false;
    for (let monthKey in appState.data.months) {
        const mData = appState.data.months[monthKey];
        if (!mData.transactions) continue;
        mData.transactions.forEach(tx => {
            if (tx.nature) return; // Already migrated
            migrated = true;
            if (tx.type === "Débito Automático" || tx.category === "Débitos Automáticos") {
                tx.nature = "subscription";
            } else if (tx.type === "Parcelado") {
                tx.nature = "installment";
            } else {
                tx.nature = "fixed";
            }
        });
    }
    return migrated;
}

async function saveStateToStorage() {
    if (!auth.currentUser || !appState.data) return;
    try {
        await db.collection('users').doc(auth.currentUser.uid).set(appState.data);
    } catch (e) {
        console.error("Erro ao salvar dados", e);
        showToast("Sem permissão para salvar.", "error");
    }
}

// 3. EVENT LISTENERS
function setupEventListeners() {
    // Navigation
    document.getElementById("prev-month-btn").addEventListener("click", () => navigateMonth(-1));
    document.getElementById("next-month-btn").addEventListener("click", () => navigateMonth(1));

    // Top Actions
    document.getElementById("close-month-btn").addEventListener("click", openCloseMonthModal);
    if(document.getElementById("add-income-btn")) document.getElementById("add-income-btn").addEventListener("click", () => openAddIncomeModal());
    
    // Privacy & Theme State
    document.getElementById("privacy-toggle-btn").addEventListener("click", togglePrivacyMode);
    document.getElementById("theme-toggle-btn")?.addEventListener("click", toggleTheme);
    
    // Tools Popover
    document.getElementById("tools-menu-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        document.getElementById("tools-popover").classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
        const popover = document.getElementById("tools-popover");
        const menuBtn = document.getElementById("tools-menu-btn");
        if (popover && !popover.classList.contains("hidden")) {
            if (!popover.contains(e.target) && !menuBtn.contains(e.target)) {
                popover.classList.add("hidden");
            }
        }
    });

    // Modals Close
    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
        });
    });

    // Form Submits
    document.getElementById("transaction-form").addEventListener("submit", handleTransactionSubmit);
    document.getElementById("delete-tx-btn").addEventListener("click", handleDeleteTransaction);
    if(document.getElementById("add-income-form")) document.getElementById("add-income-form").addEventListener("submit", handleAddIncomeSubmit);
    if(document.getElementById("delete-inc-btn")) document.getElementById("delete-inc-btn").addEventListener("click", handleDeleteIncome);
    document.getElementById("notes-form").addEventListener("submit", handleNotesSubmit);
    document.getElementById("confirm-close-month-btn").addEventListener("click", executeMonthlyClosing);
    
    // Dynamic modal form fields
    document.getElementById("tx-nature").addEventListener("change", (e) => {
        document.getElementById("tx-end-date-group").style.display = (e.target.value === "installment") ? "block" : "none";
    });

    document.getElementById("export-json-btn").addEventListener("click", exportBackupJSON);
    document.getElementById("export-csv-btn").addEventListener("click", exportCurrentMonthCSV);
    document.getElementById("import-json-file").addEventListener("change", importBackupJSON);
    document.getElementById("btn-confirm-delete").addEventListener("click", executeDeleteTransaction);

    // Alertar antes de recarregar se houver algum modal aberto (edição em andamento)
    window.addEventListener('beforeunload', (e) => {
        const txModal = document.getElementById("transaction-modal");
        const incModal = document.getElementById("income-modal");
        const notModal = document.getElementById("notes-modal");
        
        const isEditing = (txModal && !txModal.classList.contains("hidden")) || 
                          (incModal && !incModal.classList.contains("hidden")) || 
                          (notModal && !notModal.classList.contains("hidden"));
        
        if (isEditing) {
            e.preventDefault();
            e.returnValue = ''; // Faz o navegador mostrar o popup de "Deseja sair?"
        }
    });
}

function navigateMonth(direction) {
    const keys = Object.keys(appState.data.months).sort();
    const idx = keys.indexOf(appState.currentMonthKey);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < keys.length) {
        appState.currentMonthKey = keys[newIdx];
        renderApp();
    } else {
        showToast("Não há registros adicionais.", "info");
    }
}

function togglePrivacyMode() {
    appState.isPrivacyMode = !appState.isPrivacyMode;
    const btn = document.getElementById("privacy-toggle-btn");
    const icon = document.getElementById("privacy-icon");
    
    if (appState.isPrivacyMode) {
        btn.classList.add("active");
        icon.setAttribute("data-lucide", "eye-off");
    } else {
        btn.classList.remove("active");
        icon.setAttribute("data-lucide", "eye");
    }
    
    initIcons();
    applyPrivacyMask();
}

function formatCurrency(val) {
    if (appState.isPrivacyMode) return "R$ ••••";
    return `R$ ${Number(val).toLocaleString("pt-BR", {minimumFractionDigits: 2})}`;
}

function applyPrivacyMask() {
    // Re-render everything to update values
    renderApp();
}

// 4. MAIN RENDER
function renderApp() {
    if (!appState.isAuthenticated) return;

    const currentMonthData = appState.data.months[appState.currentMonthKey];
    if (!currentMonthData) return;

    // Header
    const monthLabel = document.getElementById("current-month-label");
    if (monthLabel) monthLabel.textContent = currentMonthData.label;

    const fechamentoMonthLabel = document.getElementById("fechamento-month-label");
    if (fechamentoMonthLabel) fechamentoMonthLabel.textContent = currentMonthData.label;
    
    const keys = Object.keys(appState.data.months).sort();
    const currIdx = keys.indexOf(appState.currentMonthKey);
    
    const prevBtn = document.getElementById("prev-month-btn");
    if (currIdx > 0) {
        prevBtn.style.opacity = "1";
        prevBtn.title = appState.data.months[keys[currIdx - 1]].label;
    } else {
        prevBtn.style.opacity = "0.3";
        prevBtn.title = "Mês Anterior (Indisponível)";
    }
    
    const nextBtn = document.getElementById("next-month-btn");
    if (currIdx < keys.length - 1) {
        nextBtn.style.opacity = "1";
        nextBtn.title = appState.data.months[keys[currIdx + 1]].label;
    } else {
        nextBtn.style.opacity = "0.3";
        nextBtn.title = "Próximo Mês (Indisponível)";
    }

    // KPIs — Assinaturas (subscription) NÃO entram no cálculo de Saídas/Saldo
    const incomes = currentMonthData.incomes || [];
    const totalIncomeReceived = incomes.filter(i => i.received).reduce((acc, i) => acc + Number(i.amount), 0);
    
    // Apenas transações que NÃO são assinaturas contam para saídas
    const realExpenses = currentMonthData.transactions.filter(tx => tx.ok && tx.nature !== "subscription");
    const totalExpenses = realExpenses.reduce((acc, tx) => acc + Number(tx.amount), 0);
    const leftover = totalIncomeReceived - totalExpenses;

    // Display
    document.getElementById("kpi-income").textContent = formatCurrency(totalIncomeReceived);
    document.getElementById("kpi-expenses").textContent = formatCurrency(totalExpenses);
    document.getElementById("kpi-leftover").textContent = formatCurrency(leftover);

    const saldoCard = document.getElementById("saldo-card");
    if (saldoCard) {
        if (leftover < 0) {
            saldoCard.classList.add("highlight-red");
        } else {
            saldoCard.classList.remove("highlight-red");
        }
    }

    // Tables & Timeline
    renderBentoTables(currentMonthData.transactions);
    renderIncomesRoadmap(incomes);
    
    initIcons();
}

function renderIncomesRoadmap(incomes) {
    const tbody = document.querySelector("#incomes-table tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    
    let receivedCount = 0;

    incomes.forEach(inc => {
        if(inc.received) receivedCount++;
        
        const tr = document.createElement("tr");
        if (inc.received) tr.classList.add("row-paid"); // Mesmo estilo verde
        
        const statusHtml = `
            <label class="switch">
                <input type="checkbox" ${inc.received ? "checked" : ""} onchange="toggleIncomeReceived('${inc.id}')">
                <span class="slider"></span>
            </label>
        `;
        
        const actionsHtml = `
            <div class="action-buttons">
                <button class="icon-btn-small" onclick="openAddIncomeModal('${inc.id}')" title="Editar"><i data-lucide="edit-2"></i></button>
            </div>
        `;
        
        tr.innerHTML = `
            <td>${statusHtml}</td>
            <td><strong>${inc.desc}</strong></td>
            <td>${inc.date ? new Date(inc.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
            <td class="font-bold text-green">${formatCurrency(inc.amount)}</td>
            <td>${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    const countLabel = document.getElementById("incomes-count");
    if(countLabel) countLabel.textContent = `${receivedCount} / ${incomes.length}`;
}

window.toggleIncomeReceived = function(id) {
    const currentMonthData = appState.data.months[appState.currentMonthKey];
    const inc = (currentMonthData.incomes || []).find(i => i.id === id);
    if (inc) {
        inc.received = !inc.received;
        saveStateToStorage();
        renderApp();
    }
};

function renderBentoTables(transactions) {
    const mainTableBody = document.querySelector("#main-expenses-table tbody");
    const autoTableBody = document.querySelector("#auto-expenses-table tbody");
    
    mainTableBody.innerHTML = "";
    autoTableBody.innerHTML = "";

    // Separar transações por natureza
    const mainTxs = transactions.filter(tx => tx.nature !== "subscription");
    const subTxs = transactions.filter(tx => tx.nature === "subscription");

    // Ordenar contas principais se ativo
    let sortedMainTxs = [...mainTxs];
    if (appState.sortByValueDesc) {
        sortedMainTxs.sort((a, b) => Number(b.amount) - Number(a.amount));
    }

    let paidCount = 0;
    const totalMain = sortedMainTxs.length;

    // Render Main Expenses
    sortedMainTxs.forEach(tx => {
        if (tx.ok) paidCount++;

        const tr = document.createElement("tr");
        if (tx.ok) {
            tr.classList.add("row-paid");
            const toggle = document.getElementById("hide-paid-toggle");
            if (toggle && toggle.checked) tr.classList.add("row-hidden");
        }

        const statusHtml = `
            <label class="switch">
                <input type="checkbox" ${tx.ok ? "checked" : ""} onchange="toggleTxPaid('${tx.id}')">
                <span class="slider"></span>
            </label>
        `;

        const notesActive = (tx.notes && tx.notes.trim() !== "") ? 'style="color: var(--teal);"' : '';
        const actionsHtml = `
            <div class="action-buttons">
                <button class="icon-btn-small" onclick="openNotesModal('${tx.id}')" title="Anotações / Links" ${notesActive}><i data-lucide="file-text"></i></button>
                <button class="icon-btn-small" onclick="openEditModal('${tx.id}')" title="Editar"><i data-lucide="edit-2"></i></button>
            </div>
        `;

        const terminoLabel = tx.endDate ? `Fim: ${formatMonthYear(tx.endDate)}` : (tx.nature === "installment" ? "—" : "Recorrente");

        tr.innerHTML = `
            <td>${statusHtml}</td>
            <td><strong>${tx.desc}</strong></td>
            <td><span class="badge ${tx.nature === 'installment' ? 'badge-purple' : 'badge-primary'}">${tx.nature === 'installment' ? 'Parcelamento' : 'Conta Fixa'}</span></td>
            <td>${terminoLabel}</td>
            <td class="font-bold">${formatCurrency(tx.amount)}</td>
            <td>${actionsHtml}</td>
        `;
        mainTableBody.appendChild(tr);
    });

    // Render Subscriptions (simplified — no status toggle)
    let subTotal = 0;
    subTxs.forEach(tx => {
        subTotal += Number(tx.amount);
        const tr = document.createElement("tr");

        const notesActive = (tx.notes && tx.notes.trim() !== "") ? 'style="color: var(--teal);"' : '';
        const actionsHtml = `
            <div class="action-buttons" style="justify-content: flex-end;">
                <button class="icon-btn-small" onclick="openNotesModal('${tx.id}')" title="Anotações / Links" ${notesActive}><i data-lucide="file-text"></i></button>
                <button class="icon-btn-small" onclick="openEditModal('${tx.id}')" title="Editar"><i data-lucide="edit-2"></i></button>
            </div>
        `;

        tr.innerHTML = `
            <td><strong>${tx.desc}</strong></td>
            <td class="font-bold">${formatCurrency(tx.amount)}</td>
            <td>${actionsHtml}</td>
        `;
        autoTableBody.appendChild(tr);
    });

    // Update counters
    document.getElementById("closing-paid-count").textContent = `${paidCount} / ${totalMain}`;
    
    const subTotalEl = document.getElementById("subscriptions-total");
    if (subTotalEl) subTotalEl.textContent = formatCurrency(subTotal);
}

function formatMonthYear(yyyymm) {
    if (!yyyymm) return "";
    const [year, month] = yyyymm.split("-");
    return `${month}/${year}`;
}

window.toggleHidePaid = function() {
    const isHidden = document.getElementById("hide-paid-toggle").checked;
    // Apenas afeta a seção de Saídas (main-expenses-table), não as assinaturas
    document.querySelectorAll("#main-expenses-table .row-paid").forEach(row => {
        if (isHidden) {
            row.classList.add("row-hidden");
        } else {
            row.classList.remove("row-hidden");
        }
    });
};

window.toggleSortByValue = function() {
    appState.sortByValueDesc = !appState.sortByValueDesc;
    const btn = document.getElementById("sort-by-value-btn");
    if (btn) {
        btn.classList.toggle("active", appState.sortByValueDesc);
    }
    renderApp();
};

window.toggleTxPaid = function(id) {
    const tx = appState.data.months[appState.currentMonthKey].transactions.find(t => t.id === id);
    if (tx) {
        tx.ok = !tx.ok;
        saveStateToStorage();
        renderApp();
    }
};


// 6. MODALS LOGIC
window.openAddModal = function(defaultNature = "fixed") {
    document.getElementById("modal-title").textContent = defaultNature === "subscription" ? "Nova Assinatura" : "Nova Conta";
    document.getElementById("tx-id").value = "";
    document.getElementById("tx-desc").value = "";
    document.getElementById("tx-amount").value = "";
    document.getElementById("tx-nature").value = defaultNature;
    document.getElementById("tx-end-date").value = "";
    
    document.getElementById("tx-end-date-group").style.display = (defaultNature === "installment") ? "block" : "none";
    document.getElementById("delete-tx-btn").style.display = "none";
    document.getElementById("transaction-modal").classList.remove("hidden");
};
window.openEditModal = function(id) {
    const tx = appState.data.months[appState.currentMonthKey].transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById("modal-title").textContent = "Editar Lançamento";
    document.getElementById("tx-id").value = tx.id;
    document.getElementById("tx-desc").value = tx.desc;
    document.getElementById("tx-amount").value = tx.amount;
    document.getElementById("tx-nature").value = tx.nature || "fixed";
    document.getElementById("tx-end-date").value = tx.endDate || "";
    
    document.getElementById("tx-end-date-group").style.display = (tx.nature === "installment") ? "block" : "none";
    document.getElementById("delete-tx-btn").style.display = "inline-flex";
    document.getElementById("transaction-modal").classList.remove("hidden");
};

function handleDeleteTransaction() {
    const id = document.getElementById("tx-id").value;
    if (!id) return;

    itemToDeleteId = id;
    const tx = appState.data.months[appState.currentMonthKey].transactions.find(t => t.id === id);
    document.getElementById("delete-confirm-name").textContent = tx ? tx.desc : "";
    document.getElementById("delete-confirm-modal").classList.remove("hidden");
}

window.executeDeleteTransaction = function() {
    if (!itemToDeleteId) return;
    const currentTxs = appState.data.months[appState.currentMonthKey].transactions;
    appState.data.months[appState.currentMonthKey].transactions = currentTxs.filter(t => t.id !== itemToDeleteId);
    saveStateToStorage();
    document.getElementById("delete-confirm-modal").classList.add("hidden");
    document.getElementById("transaction-modal").classList.add("hidden");
    itemToDeleteId = null;
    renderApp();
};

function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("tx-id").value;
    const desc = document.getElementById("tx-desc").value.trim();
    const amount = parseFloat(document.getElementById("tx-amount").value);
    const nature = document.getElementById("tx-nature").value;
    const endDate = document.getElementById("tx-end-date").value;

    if (!desc || isNaN(amount)) return;

    const currentTxs = appState.data.months[appState.currentMonthKey].transactions;
    if (id) {
        const tx = currentTxs.find(t => t.id === id);
        if (tx) {
            tx.desc = desc;
            tx.amount = amount;
            tx.nature = nature;
            tx.endDate = nature === "installment" ? endDate : "";
        }
    } else {
        // Novo lançamento
        currentTxs.push({
            id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 4),
            desc,
            amount,
            nature,
            endDate: nature === "installment" ? endDate : "",
            ok: false
        });
    }
    
    saveStateToStorage();
    document.getElementById("transaction-modal").classList.add("hidden");
    renderApp();
}

// Income Management
window.openAddIncomeModal = function(id = null) {
    const modal = document.getElementById("add-income-modal");
    if(!modal) return;
    
    if (id) {
        const inc = appState.data.months[appState.currentMonthKey].incomes.find(i => i.id === id);
        if (inc) {
            document.getElementById("income-modal-title").textContent = "Editar Entrada";
            document.getElementById("inc-id").value = inc.id;
            document.getElementById("inc-desc").value = inc.desc;
            document.getElementById("inc-amount").value = inc.amount;
            document.getElementById("inc-date").value = inc.date || "";
            document.getElementById("delete-inc-btn").style.display = "inline-flex";
        }
    } else {
        document.getElementById("income-modal-title").textContent = "Nova Entrada";
        document.getElementById("inc-id").value = "";
        document.getElementById("inc-desc").value = "";
        document.getElementById("inc-amount").value = "";
        document.getElementById("inc-date").value = "";
        document.getElementById("delete-inc-btn").style.display = "none";
    }
    
    modal.classList.remove("hidden");
};

function handleAddIncomeSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("inc-id").value;
    const desc = document.getElementById("inc-desc").value.trim();
    const amount = parseFloat(document.getElementById("inc-amount").value);
    const date = document.getElementById("inc-date").value;
    
    if (!desc || isNaN(amount)) return;
    
    let incomes = appState.data.months[appState.currentMonthKey].incomes;
    if(!incomes) incomes = [];

    if (id) {
        const inc = incomes.find(i => i.id === id);
        if (inc) {
            inc.desc = desc;
            inc.amount = amount;
            inc.date = date;
        }
    } else {
        incomes.push({
            id: "inc-" + Date.now() + Math.random().toString(36).substr(2, 4),
            desc,
            amount,
            date,
            received: false
        });
    }
    
    appState.data.months[appState.currentMonthKey].incomes = incomes;
    saveStateToStorage();
    document.getElementById("add-income-modal").classList.add("hidden");
    renderApp();
}

window.handleDeleteIncome = function() {
    const id = document.getElementById("inc-id").value;
    if (!id) return;
    
    const incomes = appState.data.months[appState.currentMonthKey].incomes;
    appState.data.months[appState.currentMonthKey].incomes = incomes.filter(i => i.id !== id);
    
    saveStateToStorage();
    document.getElementById("add-income-modal").classList.add("hidden");
    renderApp();
};

// Funções de PIN removidas, substituídas pelo Login com Google

window.openNotesModal = function(id) {
    const tx = appState.data.months[appState.currentMonthKey].transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById("notes-tx-id").value = tx.id;
    document.getElementById("notes-tx-desc").textContent = `Conta: ${tx.desc}`;
    document.getElementById("notes-input").value = tx.notes || "";
    document.getElementById("notes-modal").classList.remove("hidden");
};

function handleNotesSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("notes-tx-id").value;
    const notes = document.getElementById("notes-input").value;
    
    const tx = appState.data.months[appState.currentMonthKey].transactions.find(t => t.id === id);
    if (tx) {
        tx.notes = notes;
        saveStateToStorage();
        document.getElementById("notes-modal").classList.add("hidden");
        renderApp();
    }
}

// 7. FECHAMENTO MENSAL
function openCloseMonthModal() {
    const currentKey = appState.currentMonthKey;
    const [year, month] = currentKey.split("-").map(Number);
    
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    const nextLabel = `${["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][nextMonth - 1]} ${nextYear}`;

    document.getElementById("closing-current-month-name").textContent = appState.data.months[currentKey].label;
    document.getElementById("closing-next-month-name").textContent = nextLabel;
    document.getElementById("close-month-modal").classList.remove("hidden");
}

function executeMonthlyClosing() {
    const currentKey = appState.currentMonthKey;
    const currentMonthData = appState.data.months[currentKey];
    const [year, month] = currentKey.split("-").map(Number);

    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    const nextKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    const nextLabel = `${["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][nextMonth - 1]} ${nextYear}`;

    currentMonthData.closed = true;

    if (!appState.data.months[nextKey]) {
        const nextTransactions = [];
        
        currentMonthData.transactions.forEach(tx => {
            if (tx.endDate && tx.endDate === currentKey) return; // Terminou

            nextTransactions.push({
                ...tx,
                id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 4),
                ok: false
            });
        });

        appState.data.months[nextKey] = {
            label: nextLabel,
            incomes: [],
            closed: false,
            transactions: nextTransactions
        };
    }

    appState.currentMonthKey = nextKey;
    saveStateToStorage();
    document.getElementById("close-month-modal").classList.add("hidden");
    renderApp();
}

// 8. BACKUP & RESTORE
function exportBackupJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.data, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `backup_financeiro_${appState.currentMonthKey}.json`);
    document.body.appendChild(dl); dl.click(); dl.remove();
}

function exportCurrentMonthCSV() {
    const currentMonthData = appState.data.months[appState.currentMonthKey];
    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    csv += "Status;Descricao;Natureza;Termino;Valor\r\n";

    currentMonthData.transactions.forEach(tx => {
        const natureLabel = tx.nature === "subscription" ? "Assinatura" : (tx.nature === "installment" ? "Parcelamento" : "Conta Fixa");
        const row = [
            tx.ok ? "PAGO" : "PENDENTE", `"${tx.desc}"`, `"${natureLabel}"`,
            `"${tx.endDate || ""}"`, tx.amount.toFixed(2).replace(".", ",")
        ];
        csv += row.join(";") + "\r\n";
    });

    const dl = document.createElement("a");
    dl.setAttribute("href", encodeURI(csv));
    dl.setAttribute("download", `planilha_mes_${appState.currentMonthKey}.csv`);
    document.body.appendChild(dl); dl.click(); dl.remove();
}

function importBackupJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const imported = JSON.parse(evt.target.result);
            if (imported && imported.months) {
                appState.data = imported;
                const keys = Object.keys(appState.data.months).sort();
                appState.currentMonthKey = keys[keys.length - 1];
                saveStateToStorage();
                renderApp();
                showToast("Backup restaurado com sucesso!", "success");
            }
        } catch (err) { showToast("Arquivo JSON inválido.", "error"); }
    };
    reader.readAsText(file);
}



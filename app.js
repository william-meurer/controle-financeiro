/* ==========================================================================
   ANTIGRAVITY FINANCE PRO - CORE APPLICATION LOGIC (2026)
   Workflow Executivo Mensal & Bento Grid Dashboard
   ========================================================================== */

const DEFAULT_INITIAL_DATA = {
    currentMonth: "2026-07",
    months: {
        "2026-07": {
            label: "Julho 2026",
            income: 0.00,
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
    isAuthenticated: false
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
    const loginBtn = document.getElementById("login-btn");
    const loginError = document.getElementById("login-error");
    const logoutBtn = document.getElementById("logout-btn");

    if(loginBtn) {
        loginBtn.addEventListener("click", async () => {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                await auth.signInWithPopup(provider);
            } catch (error) {
                loginError.textContent = "Erro ao fazer login. Tente novamente.";
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
            loadStateFromStorage(); // Agora busca do firestore
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
            if (!appState.data.months[appState.currentMonthKey]) {
                const keys = Object.keys(appState.data.months).sort();
                appState.currentMonthKey = keys[keys.length - 1] || "2026-07";
            }
        } else {
            appState.data = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
            await saveStateToStorage();
        }
        renderApp();
    } catch (e) {
        console.error("Erro ao carregar dados", e);
        showToast("Erro ao carregar do banco de dados.", "error");
    }
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
    document.getElementById("edit-income-btn").addEventListener("click", openIncomeModal);
    
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
    document.getElementById("income-form").addEventListener("submit", handleIncomeSubmit);
    document.getElementById("notes-form").addEventListener("submit", handleNotesSubmit);
    document.getElementById("confirm-close-month-btn").addEventListener("click", executeMonthlyClosing);
    
    // Dynamic modal form fields
    document.getElementById("tx-type").addEventListener("change", (e) => {
        document.getElementById("tx-parcela-group").style.display = (e.target.value === "Parcelado" || e.target.value === "Fixo") ? "flex" : "none";
    });

    // Export / Import
    document.getElementById("export-json-btn").addEventListener("click", exportBackupJSON);
    document.getElementById("export-csv-btn").addEventListener("click", exportCurrentMonthCSV);
    document.getElementById("import-json-file").addEventListener("change", importBackupJSON);
    document.getElementById("btn-confirm-delete").addEventListener("click", executeDeleteTransaction);
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

    // KPIs
    const totalIncome = currentMonthData.income;
    const totalExpenses = currentMonthData.transactions.filter(tx => tx.ok).reduce((acc, tx) => acc + Number(tx.amount), 0);
    const leftover = totalIncome - totalExpenses;

    document.getElementById("kpi-income").textContent = formatCurrency(totalIncome);
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
    
    initIcons();
}

function renderBentoTables(transactions) {
    const mainTableBody = document.querySelector("#main-expenses-table tbody");
    const autoTableBody = document.querySelector("#auto-expenses-table tbody");
    
    mainTableBody.innerHTML = "";
    autoTableBody.innerHTML = "";

    let paidCount = 0;
    let paidTotal = 0;

    transactions.forEach(tx => {
        if (tx.type === "Variável") return; // Ignora se sobrou algum variável antigo

        if (tx.ok) {
            paidCount++;
            paidTotal += Number(tx.amount);
        }

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

        if (tx.type === "Débito Automático" || tx.category === "Débitos Automáticos") {
            tr.innerHTML = `
                <td>${statusHtml}</td>
                <td><strong>${tx.desc}</strong></td>
                <td><span class="badge badge-purple">${tx.category}</span></td>
                <td>Automático</td>
                <td class="font-bold">${formatCurrency(tx.amount)}</td>
                <td>${actionsHtml}</td>
            `;
            autoTableBody.appendChild(tr);
        } else {
            tr.innerHTML = `
                <td>${statusHtml}</td>
                <td><strong>${tx.desc}</strong></td>
                <td><span class="badge badge-primary">${tx.category}</span></td>
                <td>${tx.parcela || (tx.endDate ? `Fim: ${formatMonthYear(tx.endDate)}` : "Contínua")}</td>
                <td class="font-bold">${formatCurrency(tx.amount)}</td>
                <td>${actionsHtml}</td>
            `;
            mainTableBody.appendChild(tr);
        }
    });

    document.getElementById("closing-paid-count").textContent = `${paidCount} / ${transactions.filter(t => t.type !== 'Variável').length}`;
}

function formatMonthYear(yyyymm) {
    if (!yyyymm) return "";
    const [year, month] = yyyymm.split("-");
    return `${month}/${year}`;
}

window.toggleHidePaid = function() {
    const isHidden = document.getElementById("hide-paid-toggle").checked;
    document.querySelectorAll(".row-paid").forEach(row => {
        if (isHidden) {
            row.classList.add("row-hidden");
        } else {
            row.classList.remove("row-hidden");
        }
    });
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
window.openAddModal = function(defaultCategory = "Despesas Fixas", defaultType = "Fixo") {
    document.getElementById("modal-title").textContent = "Nova Conta / Débito";
    document.getElementById("tx-id").value = "";
    document.getElementById("tx-desc").value = "";
    document.getElementById("tx-amount").value = "";
    document.getElementById("tx-category").value = defaultCategory;
    document.getElementById("tx-type").value = defaultType;
    document.getElementById("tx-end-date").value = "";
    document.getElementById("tx-parcela-text").value = "";
    
    document.getElementById("tx-parcela-group").style.display = (defaultType === "Parcelado" || defaultType === "Fixo") ? "flex" : "none";
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
    document.getElementById("tx-category").value = tx.category;
    document.getElementById("tx-type").value = tx.type;
    document.getElementById("tx-end-date").value = tx.endDate || "";
    document.getElementById("tx-parcela-text").value = tx.parcela || "";
    
    document.getElementById("tx-parcela-group").style.display = (tx.type === "Parcelado" || tx.type === "Fixo") ? "flex" : "none";
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
    const category = document.getElementById("tx-category").value;
    const type = document.getElementById("tx-type").value;
    const endDate = document.getElementById("tx-end-date").value;
    const parcela = document.getElementById("tx-parcela-text").value.trim();

    if (!desc || isNaN(amount)) return;

    const currentTxs = appState.data.months[appState.currentMonthKey].transactions;
    if (id) {
        const tx = currentTxs.find(t => t.id === id);
        if (tx) {
            tx.desc = desc;
            tx.amount = amount;
            tx.category = category;
            tx.type = type;
            tx.endDate = endDate;
            tx.parcela = parcela;
        }
    } else {
        // Novo lançamento
        currentTxs.push({
            id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 4),
            desc,
            amount,
            category,
            type,
            endDate,
            parcela,
            ok: false
        });
    }
    
    saveStateToStorage();
    document.getElementById("transaction-modal").classList.add("hidden");
    renderApp();
}

function openIncomeModal() {
    document.getElementById("income-amount-input").value = appState.data.months[appState.currentMonthKey].income;
    document.getElementById("income-modal").classList.remove("hidden");
}

function handleIncomeSubmit(e) {
    e.preventDefault();
    const val = parseFloat(document.getElementById("income-amount-input").value);
    if (!isNaN(val)) {
        appState.data.months[appState.currentMonthKey].income = val;
        saveStateToStorage();
        document.getElementById("income-modal").classList.add("hidden");
        renderApp();
    }
}

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
            if (tx.type === "Variável") return;
            if (tx.endDate && tx.endDate === currentKey) return; // Terminou

            let newParcela = tx.parcela;
            if (newParcela && newParcela.includes("/")) {
                newParcela = newParcela.replace(/(\d+)\/(\d+)/, (match, p1, p2) => {
                    const currentP = parseInt(p1);
                    const totalP = parseInt(p2);
                    return currentP < totalP ? `${currentP + 1}/${totalP}` : match;
                });
            }

            nextTransactions.push({
                ...tx,
                id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 4),
                parcela: newParcela,
                ok: false
            });
        });

        appState.data.months[nextKey] = {
            label: nextLabel,
            income: currentMonthData.income,
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
    csv += "Status;Descricao;Categoria;Tipo;Parcela;Termino;Valor\r\n";

    currentMonthData.transactions.forEach(tx => {
        if(tx.type === "Variável") return;
        const row = [
            tx.ok ? "PAGO" : "PENDENTE", `"${tx.desc}"`, `"${tx.category}"`, `"${tx.type}"`,
            `"${tx.parcela || ""}"`, `"${tx.endDate || ""}"`, tx.amount.toFixed(2).replace(".", ",")
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



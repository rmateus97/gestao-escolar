// --- GUARDIÃO DE AUTENTICAÇÃO ---
// Este código é executado primeiro. Se não houver token, o usuário é enviado para o login.
const accessToken = localStorage.getItem('accessToken');
if (!accessToken) {
    window.location.href = 'login.html';
}

// Configuração da API
const API_BASE = 'http://localhost:3000'; 

// Estado da aplicação
let currentTab = 'professores';
let editingId = null;
let deleteCallback = null;
let currentTurmaId = null;

// Elementos DOM
const elements = {
    // Tabs
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Professores
    professorModal: document.getElementById('professor-modal'),
    professorForm: document.getElementById('professor-form'),
    professorModalTitle: document.getElementById('professor-modal-title'),
    professorTable: document.getElementById('professores-tbody'),
    searchProfessores: document.getElementById('search-professores'),
    addProfessorBtn: document.getElementById('add-professor'),
    closeProfessorModal: document.getElementById('close-professor-modal'),
    cancelProfessorBtn: document.getElementById('cancel-professor'),
    
    // Alunos
    alunoModal: document.getElementById('aluno-modal'),
    alunoForm: document.getElementById('aluno-form'),
    alunoModalTitle: document.getElementById('aluno-modal-title'),
    alunoTable: document.getElementById('alunos-tbody'),
    searchAlunos: document.getElementById('search-alunos'),
    addAlunoBtn: document.getElementById('add-aluno'),
    closeAlunoModal: document.getElementById('close-aluno-modal'),
    cancelAlunoBtn: document.getElementById('cancel-aluno'),
    
    // Turmas
    turmaModal: document.getElementById('turma-modal'),
    turmaForm: document.getElementById('turma-form'),
    closeTurmaModal: document.getElementById('close-turma-modal'),
    cancelTurmaBtn: document.getElementById('cancel-turma'),
    novaTurmaBtn: document.getElementById('nova-turma-btn'),
    alunoTurmaSelect: document.getElementById('aluno-turma'),
    professorTurmaSelect: document.getElementById('professor-turma'),
    
    // Views
    turmasView: document.getElementById('turmas-view'),
    alunosView: document.getElementById('alunos-view'),
    turmasGrid: document.getElementById('turmas-grid'),
    viewAllAlunosBtn: document.getElementById('view-all-alunos'),
    backToTurmasBtn: document.getElementById('back-to-turmas'),
    alunosViewTitle: document.getElementById('alunos-view-title'),
    
    // Modal de confirmação
    confirmModal: document.getElementById('confirm-modal'),
    confirmMessage: document.getElementById('confirm-message'),
    closeConfirmModal: document.getElementById('close-confirm-modal'),
    cancelDeleteBtn: document.getElementById('cancel-delete'),
    confirmDeleteBtn: document.getElementById('confirm-delete'),
    
    // Loading e Toast
    loading: document.getElementById('loading'),
    toastContainer: document.getElementById('toast-container')
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    switchTab('professores'); // Garante que a aba de professores seja carregada ao iniciar
    setupFormMasks();
});

// Event Listeners
function initializeEventListeners() {
    // Listener para o botão de Logout (adicione o botão no seu index.html)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Tabs
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    // Professores
    elements.addProfessorBtn.addEventListener('click', () => openProfessorModal());
    elements.closeProfessorModal.addEventListener('click', () => closeProfessorModal());
    elements.cancelProfessorBtn.addEventListener('click', () => closeProfessorModal());
    elements.professorForm.addEventListener('submit', handleProfessorSubmit);
    elements.searchProfessores.addEventListener('input', debounce(searchProfessores, 300));
    
    // Alunos
    elements.addAlunoBtn.addEventListener('click', () => openAlunoModal());
    elements.closeAlunoModal.addEventListener('click', () => closeAlunoModal());
    elements.cancelAlunoBtn.addEventListener('click', () => closeAlunoModal());
    elements.alunoForm.addEventListener('submit', handleAlunoSubmit);
    elements.searchAlunos.addEventListener('input', debounce(searchAlunos, 300));
    
    // Turmas
    elements.novaTurmaBtn.addEventListener('click', () => openTurmaModal());
    elements.closeTurmaModal.addEventListener('click', () => closeTurmaModal());
    elements.cancelTurmaBtn.addEventListener('click', () => closeTurmaModal());
    elements.turmaForm.addEventListener('submit', handleTurmaSubmit);
    
    // Views
    elements.viewAllAlunosBtn.addEventListener('click', () => showAlunosView());
    elements.backToTurmasBtn.addEventListener('click', () => showTurmasView());
    
    // Modal de confirmação
    elements.closeConfirmModal.addEventListener('click', () => closeConfirmModal());
    elements.cancelDeleteBtn.addEventListener('click', () => closeConfirmModal());
    elements.confirmDeleteBtn.addEventListener('click', () => executeDelete());
    
    // Fechar modais clicando fora
    window.addEventListener('click', (e) => {
        if (e.target === elements.professorModal) closeProfessorModal();
        if (e.target === elements.alunoModal) closeAlunoModal();
        if (e.target === elements.turmaModal) closeTurmaModal();
        if (e.target === elements.confirmModal) closeConfirmModal();
    });
}

// Função de Logout
function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Máscaras para campos
function setupFormMasks() {
    // Máscara para CPF
    document.querySelectorAll('input[name="cpf"]').forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = value;
        });
    });
    
    // Máscara para CEP
    document.querySelectorAll('input[name*="cep"]').forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = value;
        });
    });
    
    // Máscara para telefone
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) { 
                value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
            } else {
                value = value.replace(/^(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
            }
            e.target.value = value;
        });
    });
}

// Navegação entre abas
function switchTab(tabName) {
    currentTab = tabName;
    elements.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });
    if (tabName === 'professores') {
        loadProfessores();
    } else if (tabName === 'alunos') {
        showTurmasView();
        loadTurmas();
    }
}

// Utilitários
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    elements.loading.style.display = 'flex';
}

function hideLoading() {
    elements.loading.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatCPF(cpf) {
    if (!cpf) return '-';
    const cleanCpf = cpf.replace(/\D/g, '');
    return cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// API Calls - Versão SEGURA que envia o Token
async function apiCall(endpoint, options = {}) {
    showLoading();
    try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            logout(); // Segurança extra: se o token sumir, desloga
            return;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Adiciona o token ao cabeçalho
            ...options.headers
        };

        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        
        // Se o token for inválido/expirado, o servidor retornará 401 ou 403
        if (response.status === 401 || response.status === 403) {
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'error');
            setTimeout(logout, 2000);
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro de comunicação com o servidor.' }));
            throw new Error(errorData.error);
        }

        if (response.headers.get("content-type")?.includes("application/json")) {
            return response.json();
        }
    } catch (error) {
        console.error('API Call Error:', error);
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}


// ===== TURMAS =====

async function loadTurmas() {
    try {
        const turmas = await apiCall('/api/turmas');
        renderTurmas(turmas);
    } catch (error) {
        console.error('Erro ao carregar turmas:', error);
    }
}

async function loadTurmasSelect() {
    try {
        const turmas = await apiCall('/api/turmas');
        const select = elements.alunoTurmaSelect;
        select.innerHTML = '<option value="">Selecione uma turma...</option>';
        turmas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma.id;
            option.textContent = `${turma.nome} - ${turma.serie}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar turmas para select:', error);
    }
}

async function loadProfessorSelect() {
    try {
        const professores = await apiCall('/api/professores');
        const select = elements.professorTurmaSelect;
        select.innerHTML = '<option value="">Selecione um professor...</option>';
        professores.forEach(professor => {
            const option = document.createElement('option');
            option.value = professor.id;
            option.textContent = `${professor.nome_completo} - ${professor.disciplinas}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar os professores para select:', error);
    }
}

function renderTurmas(turmas) {
    if (turmas.length === 0) {
        elements.turmasGrid.innerHTML = `
            <div class="empty-turmas">
                <i class="fas fa-school"></i>
                <h3>Nenhuma turma cadastrada</h3>
                <p>Crie uma turma ao cadastrar um aluno ou utilize o botão "Nova Turma"</p>
            </div>
        `;
        return;
    }

    elements.turmasGrid.innerHTML = turmas.map(turma => `
        <div class="turma-card" onclick="showAlunosByTurma(${turma.id}, '${turma.nome}')">
            <h4>${turma.nome}</h4>
            <div class="turma-info">
                <span class="turma-serie">${turma.serie}</span>
                <span class="turma-professor">${turma.professor || 'Sem Professor'}</span> 
                <span class="turma-ano">${turma.ano}</span>
            </div>
            <div class="turma-stats">
                <span class="alunos-count">
                    <i class="fas fa-users"></i>
                    <span id="count-turma-${turma.id}">0</span> alunos
                </span>
                <div class="turma-actions" onclick="event.stopPropagation()">

                    <button class="btn btn-icon btn-secondary" onclick="downloadTurmaPDF(${turma.id})" title="Baixar Relatório em PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>

                    <button class="btn btn-icon btn-edit" onclick="editTurma(${turma.id})" title="Editar turma">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-delete" onclick="deleteTurma(${turma.id}, '${turma.nome}')" title="Excluir turma">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    turmas.forEach(turma => {
        loadAlunosCount(turma.id);
    });
}

async function loadAlunosCount(turmaId) {
    try {
        const alunos = await apiCall(`/api/alunos/turma/${turmaId}`);
        const countElement = document.getElementById(`count-turma-${turmaId}`);
        if (countElement) {
            countElement.textContent = alunos.length;
        }
    } catch (error) {
        console.error('Erro ao carregar contagem de alunos:', error);
    }
}

function openTurmaModal(turma = null) {
    editingId = turma ? turma.id : null;
    elements.turmaForm.reset();
    
    if (turma) {
        document.getElementById('turma-nome').value = turma.nome;
        document.getElementById('turma-serie').value = turma.serie;
        document.getElementById('turma-ano').value = turma.ano;
        loadProfessorSelect().then(() => {
            const professorOption = Array.from(elements.professorTurmaSelect.options).find(
                option => option.textContent.startsWith(turma.professor + ' -')
            );
            if (professorOption) {
                elements.professorTurmaSelect.value = professorOption.value;
            } else {
                elements.professorTurmaSelect.value = '';
            }
        });
    } else {
        document.getElementById('turma-ano').value = new Date().getFullYear();
        loadProfessorSelect();
    }
    
    elements.turmaModal.style.display = 'block';
}

function closeTurmaModal() {
    elements.turmaModal.style.display = 'none';
    editingId = null;
}

async function handleTurmaSubmit(e) {
    e.preventDefault();
    const formData = new FormData(elements.turmaForm);
    const data = Object.fromEntries(formData.entries());

    const selectedProfessorId = elements.professorTurmaSelect.value;
    if (selectedProfessorId) {
        try {
            const professor = await apiCall(`/api/professores/${selectedProfessorId}`);
            data.professor = professor.nome_completo;
        } catch (error) {
            console.error('Erro ao obter nome do professor:', error);
            showToast('Erro ao obter nome do professor para a turma.', 'error');
            return;
        }
    } else {
        data.professor = null;
    }
    
    delete data.turma_id;
    
    try {
        if (editingId) {
            await apiCall(`/api/turmas/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Turma atualizada com sucesso!', 'success');
        } else {
            const result = await apiCall('/api/turmas', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Turma criada com sucesso!', 'success');
            if (elements.alunoModal.style.display === 'block') {
                await loadTurmasSelect();
                elements.alunoTurmaSelect.value = result.id;
            }
        }
        
        closeTurmaModal();
        loadTurmas();
        loadTurmasSelect();
        loadProfessorSelect();
    } catch (error) {
        console.error('Erro ao salvar turma:', error);
    }
}

async function editTurma(id) {
    try {
        const turma = await apiCall(`/api/turmas/${id}`);
        openTurmaModal(turma);
    } catch (error) {
        console.error('Erro ao carregar turma:', error);
    }
}

function deleteTurma(id, nome) {
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir a turma "${nome}"?`;
    deleteCallback = () => executeTurmaDelete(id);
    elements.confirmModal.style.display = 'block';
}

async function executeTurmaDelete(id) {
    try {
        await apiCall(`/api/turmas/${id}`, { method: 'DELETE' });
        showToast('Turma excluída com sucesso!', 'success');
        loadTurmas();
        loadTurmasSelect();
        loadProfessorSelect();
    } catch (error) {
        console.error('Erro ao excluir turma:', error);
    }
}

async function downloadTurmaPDF(turmaId) {
    showLoading();
    try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            logout(); // Se não houver token, desloga.
            return;
        }

        const response = await fetch(`${API_BASE}/api/turmas/${turmaId}/pdf`, {
            method: 'GET',
            headers: {
                // Envia o token de autorização para passar pela segurança do servidor
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Se o servidor retornar um erro (ex: turma não encontrada), mostra a mensagem
            const errorData = await response.json();
            throw new Error(errorData.error || 'Não foi possível gerar o PDF.');
        }

        // Pega o nome do arquivo do cabeçalho da resposta enviado pelo servidor
        const disposition = response.headers.get('content-disposition');
        let filename = 'relatorio_turma.pdf'; // Nome padrão
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        // Converte a resposta do PDF em um "blob" (um tipo de arquivo no navegador)
        const blob = await response.blob();

        // Cria um link temporário na memória para o arquivo
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename; // Define o nome do arquivo para o download
        
        // Simula o clique no link para iniciar o download
        document.body.appendChild(a);
        a.click();
        
        // Limpa o link da memória
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error('Erro ao baixar o PDF:', error);
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ===== VIEWS =====

function showTurmasView() {
    elements.turmasView.style.display = 'block';
    elements.alunosView.style.display = 'none';
    currentTurmaId = null;
    loadTurmas();
}

function showAlunosView(turmaId = null, turmaNome = null) {
    elements.turmasView.style.display = 'none';
    elements.alunosView.style.display = 'block';
    
    if (turmaId) {
        currentTurmaId = turmaId;
        elements.alunosViewTitle.textContent = `Alunos de ${turmaNome}`;
        loadAlunosByTurma(turmaId);
    } else {
        currentTurmaId = null;
        elements.alunosViewTitle.textContent = 'Todos os Alunos';
        loadAlunos();
    }
}

function showAlunosByTurma(turmaId, turmaNome) {
    showAlunosView(turmaId, turmaNome);
}

// ===== PROFESSORES =====

async function loadProfessores() {
    try {
        const professores = await apiCall('/api/professores');
        renderProfessores(professores);
    } catch (error) {
        console.error('Erro ao carregar professores:', error);
    }
}

function renderProfessores(professores) {
    if (professores.length === 0) {
        elements.professorTable.innerHTML = `
            <tr><td colspan="7" class="empty-state"><i class="fas fa-chalkboard-teacher"></i><h3>Nenhum professor cadastrado</h3><p>Clique em "Novo Professor" para começar</p></td></tr>
        `;
        return;
    }
    
    elements.professorTable.innerHTML = professores.map(professor => `
        <tr>
            <td>${professor.nome_completo}</td>
            <td>${formatCPF(professor.cpf)}</td>
            <td>${professor.email_institucional}</td>
            <td>${professor.telefone}</td>
            <td>${professor.disciplinas}</td>
            <td><span class="status-badge status-${professor.status.toLowerCase()}">${professor.status}</span></td>
            <td class="actions">
                <button class="btn btn-edit" onclick="editProfessor(${professor.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn btn-delete" onclick="deleteProfessor(${professor.id}, '${professor.nome_completo}')"><i class="fas fa-trash"></i> Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function searchProfessores() {
    const termo = elements.searchProfessores.value.trim();
    try {
        let professores;
        if (termo) {
            professores = await apiCall(`/api/professores/buscar/${encodeURIComponent(termo)}`);
        } else {
            professores = await apiCall('/api/professores');
        }
        renderProfessores(professores);
    } catch (error) {
        console.error('Erro ao buscar professores:', error);
    }
}

function openProfessorModal(professor = null) {
    editingId = professor ? professor.id : null;
    elements.professorModalTitle.textContent = professor ? 'Editar Professor' : 'Novo Professor';
    elements.professorForm.reset();
    
    if (professor) {
        Object.keys(professor).forEach(key => {
            const input = document.querySelector(`#professor-form [name="${key}"]`);
            if (input) {
                if (key.includes('data_nascimento') || key.includes('data_admissao')) {
                    input.value = professor[key] ? new Date(professor[key]).toISOString().split('T')[0] : '';
                } else {
                    input.value = professor[key] || '';
                }
            }
        });
    }
    elements.professorModal.style.display = 'block';
}

function closeProfessorModal() {
    elements.professorModal.style.display = 'none';
    editingId = null;
}

async function handleProfessorSubmit(e) {
    e.preventDefault();
    const formData = new FormData(elements.professorForm);
    const data = Object.fromEntries(formData.entries());
    
    try {
        if (editingId) {
            await apiCall(`/api/professores/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showToast('Professor atualizado com sucesso!', 'success');
        } else {
            await apiCall('/api/professores', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('Professor cadastrado com sucesso!', 'success');
        }
        closeProfessorModal();
        loadProfessores();
        loadProfessorSelect();
    } catch (error) {
        console.error('Erro ao salvar professor:', error);
    }
}

async function editProfessor(id) {
    try {
        const professor = await apiCall(`/api/professores/${id}`);
        openProfessorModal(professor);
    } catch (error) {
        console.error('Erro ao carregar professor:', error);
    }
}

function deleteProfessor(id, nome) {
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir o professor "${nome}"?`;
    deleteCallback = () => executeProfessorDelete(id);
    elements.confirmModal.style.display = 'block';
}

async function executeProfessorDelete(id) {
    try {
        await apiCall(`/api/professores/${id}`, { method: 'DELETE' });
        showToast('Professor excluído com sucesso!', 'success');
        loadProfessores();
    } catch (error) {
        console.error('Erro ao excluir professor:', error);
    }
}


// ===== ALUNOS =====

async function loadAlunos() {
    try {
        const alunos = await apiCall('/api/alunos');
        renderAlunos(alunos);
    } catch (error) {
        console.error('Erro ao carregar alunos:', error);
    }
}

async function loadAlunosByTurma(turmaId) {
    try {
        const alunos = await apiCall(`/api/alunos/turma/${turmaId}`);
        renderAlunos(alunos);
    } catch (error) {
        console.error('Erro ao carregar alunos da turma:', error);
    }
}

function renderAlunos(alunos) {
    if (alunos.length === 0) {
        elements.alunoTable.innerHTML = `
            <tr><td colspan="6" class="empty-state"><i class="fas fa-user-graduate"></i><h3>Nenhum aluno encontrado</h3><p>Clique em "Novo Aluno" para começar</p></td></tr>
        `;
        return;
    }
    elements.alunoTable.innerHTML = alunos.map(aluno => `
        <tr>
            <td>${aluno.nome_completo}</td>
            <td>${formatCPF(aluno.cpf)}</td>
            <td>${aluno.turma_nome || 'Sem turma'}</td>
            <td>${aluno.nome_responsavel}</td>
            <td><span class="status-badge status-${aluno.status.toLowerCase()}">${aluno.status}</span></td>
            <td class="actions">
                <button class="btn btn-edit" onclick="editAluno(${aluno.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn btn-delete" onclick="deleteAluno(${aluno.id}, '${aluno.nome_completo}')"><i class="fas fa-trash"></i> Excluir</button>
            </td>
        </tr>
    `).join('');
}

async function searchAlunos() {
    const termo = elements.searchAlunos.value.trim();
    try {
        let alunos;
        if (termo) {
            alunos = await apiCall(`/api/alunos/buscar/${encodeURIComponent(termo)}`);
        } else if (currentTurmaId) {
            alunos = await apiCall(`/api/alunos/turma/${currentTurmaId}`);
        } else {
            alunos = await apiCall('/api/alunos');
        }
        renderAlunos(alunos);
    } catch (error) {
        console.error('Erro ao buscar alunos:', error);
    }
}

async function openAlunoModal(aluno = null) {
    editingId = aluno ? aluno.id : null;
    elements.alunoModalTitle.textContent = aluno ? 'Editar Aluno' : 'Novo Aluno';
    
    await loadTurmasSelect(); 
    
    elements.alunoForm.reset();
    
    if (aluno) {
        Object.keys(aluno).forEach(key => {
            const input = document.querySelector(`#aluno-form [name="${key}"]`);
            if (input) {
                if (key.includes('data_nascimento')) {
                    input.value = aluno[key] ? new Date(aluno[key]).toISOString().split('T')[0] : '';
                } else if (key === 'turma_id') {
                    elements.alunoTurmaSelect.value = aluno[key] || '';
                } else {
                    input.value = aluno[key] || '';
                }
            }
        });
    } else {
        document.getElementById('aluno-ano-ingresso').value = new Date().getFullYear();
    }
    
    elements.alunoModal.style.display = 'block';
}

function closeAlunoModal() {
    elements.alunoModal.style.display = 'none';
    editingId = null;
}

async function handleAlunoSubmit(e) {
    e.preventDefault();
    const formData = new FormData(elements.alunoForm);
    const data = Object.fromEntries(formData.entries());
    data.turma_id = data.turma_id === '' ? null : parseInt(data.turma_id, 10);
    
    try {
        if (editingId) {
            await apiCall(`/api/alunos/${editingId}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Aluno atualizado com sucesso!', 'success');
        } else {
            await apiCall('/api/alunos', { method: 'POST', body: JSON.stringify(data) });
            showToast('Aluno cadastrado com sucesso!', 'success');
        }
        closeAlunoModal();
        if (currentTurmaId) {
            loadAlunosByTurma(currentTurmaId);
        } else {
            loadAlunos();
        }
        loadTurmas();
    } catch (error) {
        console.error('Erro ao salvar aluno:', error);
    }
}

async function editAluno(id) {
    try {
        const aluno = await apiCall(`/api/alunos/${id}`);
        await openAlunoModal(aluno);
    } catch (error) {
        console.error('Erro ao carregar aluno:', error);
    }
}

function deleteAluno(id, nome) {
    elements.confirmMessage.textContent = `Tem certeza que deseja excluir o aluno "${nome}"?`;
    deleteCallback = () => executeAlunoDelete(id);
    elements.confirmModal.style.display = 'block';
}

async function executeAlunoDelete(id) {
    try {
        await apiCall(`/api/alunos/${id}`, { method: 'DELETE' });
        showToast('Aluno excluído com sucesso!', 'success');
        if (currentTurmaId) {
            loadAlunosByTurma(currentTurmaId);
        } else {
            loadAlunos();
        }
        loadTurmas();
    } catch (error) {
        console.error('Erro ao excluir aluno:', error);
    }
}

// ===== MODAL DE CONFIRMAÇÃO =====

function closeConfirmModal() {
    elements.confirmModal.style.display = 'none';
    deleteCallback = null;
}

function executeDelete() {
    if (deleteCallback) {
        deleteCallback();
        closeConfirmModal();
    }
}
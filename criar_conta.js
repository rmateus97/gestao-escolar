document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.querySelector('.register-form');
    const toastContainer = document.getElementById('toast-container');

    function showToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        if(toastContainer) toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;

            if (password !== confirmPassword) {
                showToast('As senhas não coincidem.');
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/registrar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: name, email: email, senha: password })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error);

                showToast('Conta criada com sucesso! Redirecionando para login...', 'success');
                setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            } catch (error) {
                showToast(error.message || 'Erro ao criar conta.');
            }
        });
    }
});
// ============================================================
// AUTHENTICATION MODULE
// ============================================================
(function() {
    'use strict';

    console.log('🔐 Auth module loading...');

    // Get DOM elements
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userDisplayName = document.getElementById('userDisplayName');
    const userEmail = document.getElementById('userEmail');
    const usernameEditBtn = document.getElementById('usernameEditBtn');
    const usernameModal = document.getElementById('usernameModal');
    const usernameModalClose = document.getElementById('usernameModalClose');
    const newUsernameInput = document.getElementById('newUsernameInput');
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');

    // ============================================================
    // UI FUNCTIONS
    // ============================================================
    function showApp() {
        console.log('📱 Showing main app');
        loginScreen.style.display = 'none';
        mainApp.classList.add('active');
        loginError.textContent = '';
        
        updateUserDisplay();
        
        // Notify app.js that user is logged in
        if (window.onUserLoggedIn) {
            window.onUserLoggedIn();
        }
    }

    function showLogin() {
        console.log('🔐 Showing login screen');
        loginScreen.style.display = 'flex';
        mainApp.classList.remove('active');
        loginError.textContent = '';
        if (userDisplayName) userDisplayName.textContent = '';
        if (userEmail) userEmail.textContent = '';
    }

    function updateUserDisplay() {
        if (!window.currentUser) return;
        
        const displayName = window.currentUser.displayName || window.currentUser.email || 'User';
        if (userDisplayName) userDisplayName.textContent = displayName;
        if (userEmail) userEmail.textContent = window.currentUser.email || '';
    }

    // ============================================================
    // USERNAME EDIT FUNCTIONS
    // ============================================================
    function openUsernameModal() {
        if (!window.currentUser) {
            alert('Please login first');
            return;
        }
        
        const currentName = window.currentUser.displayName || '';
        newUsernameInput.value = currentName;
        usernameModal.classList.add('active');
        setTimeout(() => newUsernameInput.focus(), 100);
    }

    function closeUsernameModal() {
        usernameModal.classList.remove('active');
        newUsernameInput.value = '';
    }

    function saveUsername() {
        if (!window.currentUser) {
            alert('Please login first');
            return;
        }
        
        const newName = newUsernameInput.value.trim();
        if (!newName) {
            alert('Please enter a username');
            return;
        }
        
        if (newName.length > 30) {
            alert('Username must be 30 characters or less');
            return;
        }
        
        saveUsernameBtn.disabled = true;
        saveUsernameBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        window.currentUser.updateProfile({
            displayName: newName
        }).then(function() {
            console.log('✅ Username updated to:', newName);
            updateUserDisplay();
            closeUsernameModal();
            alert('✅ Username updated successfully!');
        }).catch(function(error) {
            console.error('❌ Error updating username:', error);
            alert('Error updating username: ' + error.message);
        }).finally(function() {
            saveUsernameBtn.disabled = false;
            saveUsernameBtn.innerHTML = '<i class="fas fa-save"></i> Save Username';
        });
    }

    // ============================================================
    // AUTH FUNCTIONS
    // ============================================================
    function loginUser(email, password) {
        console.log('🔑 Logging in:', email);
        loginError.textContent = 'Logging in...';
        loginError.style.color = '#2563eb';
        loginBtn.disabled = true;
        signupBtn.disabled = true;
        
        window.auth.signInWithEmailAndPassword(email, password)
            .then(function(userCredential) {
                console.log('✅ Login successful:', userCredential.user.email);
                window.currentUser = userCredential.user;
                loginError.textContent = '';
                loginBtn.disabled = false;
                signupBtn.disabled = false;
                showApp();
            })
            .catch(function(error) {
                console.error('❌ Login error:', error.message);
                loginError.textContent = error.message;
                loginError.style.color = '#dc2626';
                loginBtn.disabled = false;
                signupBtn.disabled = false;
            });
    }

    function signUpUser(email, password) {
        console.log('📝 Signing up:', email);
        loginError.textContent = 'Creating account...';
        loginError.style.color = '#2563eb';
        loginBtn.disabled = true;
        signupBtn.disabled = true;
        
        window.auth.createUserWithEmailAndPassword(email, password)
            .then(function(userCredential) {
                console.log('✅ Signup successful:', userCredential.user.email);
                window.currentUser = userCredential.user;
                loginError.textContent = '';
                loginBtn.disabled = false;
                signupBtn.disabled = false;
                showApp();
                // Open username modal after signup
                setTimeout(openUsernameModal, 500);
            })
            .catch(function(error) {
                console.error('❌ Signup error:', error.message);
                loginError.textContent = error.message;
                loginError.style.color = '#dc2626';
                loginBtn.disabled = false;
                signupBtn.disabled = false;
            });
    }

    function logoutUser() {
        console.log('🚪 Logging out...');
        window.auth.signOut()
            .then(function() {
                console.log('✅ Logout successful');
                window.currentUser = null;
                showLogin();
                if (window.clearUserData) {
                    window.clearUserData();
                }
            })
            .catch(function(error) {
                console.error('❌ Logout error:', error.message);
            });
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    loginBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        
        if (!email || !password) {
            loginError.textContent = 'Email and password required';
            return;
        }
        
        loginUser(email, password);
    });

    signupBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        
        if (!email || !password) {
            loginError.textContent = 'Email and password required';
            return;
        }
        
        if (password.length < 6) {
            loginError.textContent = 'Password must be at least 6 characters';
            return;
        }
        
        signUpUser(email, password);
    });

    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            logoutUser();
        }
    });

    usernameEditBtn.addEventListener('click', function(e) {
        e.preventDefault();
        openUsernameModal();
    });

    usernameModalClose.addEventListener('click', closeUsernameModal);

    usernameModal.addEventListener('click', function(e) {
        if (e.target === usernameModal) {
            closeUsernameModal();
        }
    });

    saveUsernameBtn.addEventListener('click', function(e) {
        e.preventDefault();
        saveUsername();
    });

    newUsernameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveUsername();
        } else if (e.key === 'Escape') {
            closeUsernameModal();
        }
    });

    // Enter key support for login
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && loginScreen.style.display !== 'none') {
            loginBtn.click();
        }
    });

    // ============================================================
    // AUTH STATE LISTENER
    // ============================================================
    window.auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log('👤 Auth state: User logged in -', user.email);
            window.currentUser = user;
            showApp();
        } else {
            console.log('👤 Auth state: No user');
            window.currentUser = null;
            showLogin();
        }
    });

    // Expose functions globally
    window.logoutUser = logoutUser;
    window.showApp = showApp;
    window.showLogin = showLogin;
    window.openUsernameModal = openUsernameModal;

    // Check if user is already logged in
    if (window.auth.currentUser) {
        window.currentUser = window.auth.currentUser;
        showApp();
    }

    console.log('✅ Auth module loaded');

})();
// ============================================================
// MAIN APPLICATION MODULE
// ============================================================
(function() {
    'use strict';

    console.log('📊 App module loading...');

    // ============================================================
    // DOM REFS
    // ============================================================
    const companyContainer = document.getElementById('companyContainer');
    const newCompanyName = document.getElementById('newCompanyName');
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    const noteDate = document.getElementById('noteDate');
    const noteContent = document.getElementById('noteContent');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const clearNoteBtn = document.getElementById('clearNoteBtn');
    const notesContainer = document.getElementById('notesContainer');
    const billModal = document.getElementById('billModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const companyCount = document.getElementById('companyCount');
    const notesCount = document.getElementById('notesCount');
    const syncStatus = document.getElementById('syncStatus');

    // Payment section DOM refs
    const paymentContainer = document.getElementById('paymentContainer');
    const newPaymentPerson = document.getElementById('newPaymentPerson');
    const newPaymentAmount = document.getElementById('newPaymentAmount');
    const newPaymentPurpose = document.getElementById('newPaymentPurpose');
    const newPaymentDate = document.getElementById('newPaymentDate');
    const newPaymentReceipt = document.getElementById('newPaymentReceipt');
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const paymentCount = document.getElementById('paymentCount');

    const today = new Date().toISOString().split('T')[0];
    if (noteDate) noteDate.value = today;
    if (newPaymentDate) newPaymentDate.value = today;

    // ============================================================
    // STATE
    // ============================================================
    let currentUser = null;
    let userData = null;
    let isEditingNote = false;
    let editingNoteId = null;
    let isLoading = false;
    let dataLoaded = false;
    let isEditingTransaction = false;
    let editingTransactionData = null;
    let isEditingPayment = false;
    let editingPaymentId = null;
    let expandedCompany = null;
    let expandedPerson = null;
    let unsubscribe = null;
    let isUpdating = false;

    // ============================================================
    // NAVIGATION
    // ============================================================
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            navTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('tab-' + tabId).classList.add('active');
        });
    });

    // ============================================================
    // HELPERS
    // ============================================================
    function formatRupees(amount) {
        if (amount === undefined || amount === null || isNaN(amount)) return 'Rs 0.00';
        return 'Rs ' + Number(amount).toFixed(2);
    }

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function generateId() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    function getNoteTitle(content) {
        if (!content) return 'Untitled';
        const lines = content.split('\n');
        const firstLine = lines[0].trim();
        return firstLine || 'Untitled';
    }

    function getNotePreview(content) {
        if (!content) return '';
        const lines = content.split('\n');
        if (lines.length <= 1) return content.substring(0, 50) + (content.length > 50 ? '...' : '');
        const preview = lines.slice(0, 2).join(' ');
        return preview.substring(0, 60) + (preview.length > 60 ? '...' : '');
    }

    function updateSyncStatus(synced) {
        if (syncStatus) {
            if (synced) {
                syncStatus.innerHTML = '<i class="fas fa-cloud-upload-alt synced"></i>';
            } else {
                syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#dc2626;"></i>';
            }
        }
    }

    function showLoading(container) {
        if (container) {
            container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Loading...</div>';
        }
    }

    function showError(container, message) {
        if (container) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>' + message + '</p></div>';
        }
    }

    // ============================================================
    // FIRESTORE REAL-TIME LISTENER
    // ============================================================
    function setupRealtimeListener() {
        if (!currentUser) return;
        
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        console.log('📡 Setting up real-time listener for:', currentUser.email);
        
        const docRef = window.db.collection('users').doc(currentUser.uid);
        
        unsubscribe = docRef.onSnapshot(function(doc) {
            // Don't update if we're already updating to avoid loops
            if (isUpdating) return;
            
            if (doc.exists) {
                const data = doc.data();
                if (!data.companies) data.companies = [];
                if (!data.notes) data.notes = [];
                if (!data.payments) data.payments = [];
                
                userData = data;
                dataLoaded = true;
                
                renderAll();
                updateSyncStatus(true);
                console.log('✅ Real-time update received');
            }
        }, function(error) {
            console.error('❌ Real-time listener error:', error);
            updateSyncStatus(false);
        });
    }

    // ============================================================
    // FIRESTORE DATA FUNCTIONS
    // ============================================================
    function getUserDocRef() {
        if (!currentUser) {
            console.log('❌ No current user for Firestore');
            return null;
        }
        return window.db.collection('users').doc(currentUser.uid);
    }

    async function loadUserData() {
        if (!currentUser) {
            console.log('❌ Cannot load data - no current user');
            return null;
        }

        if (isLoading) {
            console.log('⏳ Already loading data...');
            return userData;
        }

        isLoading = true;
        console.log('📥 Loading user data for:', currentUser.email);

        try {
            const docRef = getUserDocRef();
            if (!docRef) {
                isLoading = false;
                return null;
            }

            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                if (!data.companies) data.companies = [];
                if (!data.notes) data.notes = [];
                if (!data.payments) data.payments = [];
                userData = data;
                dataLoaded = true;
                console.log('✅ Data loaded successfully. Companies:', data.companies.length, 'Notes:', data.notes.length, 'Payments:', data.payments.length);
                
                setupRealtimeListener();
                renderAll();
                
                return data;
            } else {
                console.log('📝 Creating new user document');
                const newData = { companies: [], notes: [], payments: [] };
                await docRef.set(newData);
                userData = newData;
                dataLoaded = true;
                console.log('✅ New user data created');
                
                setupRealtimeListener();
                renderAll();
                
                return newData;
            }
        } catch (err) {
            console.error('❌ loadUserData error:', err);
            showError(companyContainer, 'Error loading data: ' + err.message);
            showError(notesContainer, 'Error loading data: ' + err.message);
            return null;
        } finally {
            isLoading = false;
        }
    }

    async function saveUserData(data) {
        if (!currentUser) {
            console.log('❌ Cannot save - no current user');
            return false;
        }

        // Set updating flag to prevent listener from triggering re-render
        isUpdating = true;
        
        try {
            const docRef = getUserDocRef();
            if (!docRef) {
                isUpdating = false;
                return false;
            }
            
            // Update local data immediately
            userData = data;
            
            // Re-render UI immediately
            renderAll();
            updateSyncStatus(true);
            
            // Save to Firestore in background
            await docRef.set(data, { merge: true });
            console.log('✅ Data saved successfully');
            
            isUpdating = false;
            return true;
        } catch (err) {
            console.error('❌ saveUserData error:', err);
            updateSyncStatus(false);
            isUpdating = false;
            return false;
        }
    }

    // ============================================================
    // RENDER FUNCTIONS
    // ============================================================
    function renderAll() {
        if (!userData) {
            console.log('⚠️ No user data to render');
            return;
        }
        console.log('🔄 Rendering all data...');
        renderCompanies(userData.companies || []);
        renderNotes(userData.notes || []);
        renderPayments(userData.payments || []);
        if (companyCount) companyCount.textContent = (userData.companies || []).length;
        if (notesCount) notesCount.textContent = (userData.notes || []).length;
        if (paymentCount) paymentCount.textContent = (userData.payments || []).length;
    }

    // ============================================================
    // PAYMENT FUNCTIONS
    // ============================================================
    function renderPayments(payments) {
        if (!paymentContainer) return;
        
        if (!payments || payments.length === 0) {
            paymentContainer.innerHTML = '<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><p>No payments yet.<br>Add your first payment above!</p></div>';
            return;
        }

        const groupedPayments = {};
        payments.forEach(payment => {
            const person = payment.person || 'Unknown';
            if (!groupedPayments[person]) {
                groupedPayments[person] = [];
            }
            groupedPayments[person].push(payment);
        });

        let html = '';
        const sortedPersons = Object.keys(groupedPayments).sort();
        
        sortedPersons.forEach(person => {
            const personPayments = groupedPayments[person];
            const totalAmount = personPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const isExpanded = expandedPerson === person;
            
            const sortedPayments = personPayments.slice().sort((a, b) => {
                if (a.date && b.date) {
                    return b.date.localeCompare(a.date);
                }
                return 0;
            });

            html += '<div class="payment-group">';
            html += '<div class="payment-group-header" onclick="window.togglePaymentGroup(\'' + person + '\')">';
            html += '<span class="payment-person-name"><i class="fas fa-user"></i> ' + escHtml(person) + '</span>';
            html += '<span class="payment-total">Total: ' + formatRupees(totalAmount) + ' <i class="fas fa-chevron-' + (isExpanded ? 'up' : 'down') + '" style="font-size:12px;margin-left:4px;"></i></span>';
            html += '</div>';
            
            if (isExpanded) {
                html += '<div class="payment-group-items">';
                
                html += '<div class="payment-inline-form">';
                html += '<div class="payment-inline-row">';
                html += '<input type="number" id="inline_amount_' + person.replace(/\s/g, '_') + '" placeholder="Amount" class="inline-amount" step="0.01">';
                html += '<input type="date" id="inline_date_' + person.replace(/\s/g, '_') + '" value="' + today + '" class="inline-date">';
                html += '<input type="text" id="inline_purpose_' + person.replace(/\s/g, '_') + '" placeholder="Purpose" class="inline-purpose">';
                html += '<button class="btn-add-inline" onclick="window.addInlinePayment(\'' + person + '\')"><i class="fas fa-plus"></i> Add</button>';
                html += '</div>';
                html += '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">Add a new payment to ' + escHtml(person) + '</div>';
                html += '</div>';
                
                sortedPayments.forEach(payment => {
                    const receiptCount = payment.receipts ? payment.receipts.length : 0;
                    
                    html += '<div class="payment-item">';
                    html += '<div class="payment-header">';
                    html += '<span class="payment-amount">' + formatRupees(payment.amount) + '</span>';
                    html += '<span class="payment-date"><i class="fas fa-calendar-alt"></i> ' + (payment.date || 'N/A') + '</span>';
                    html += '</div>';
                    html += '<div class="payment-details">';
                    html += '<span class="payment-purpose"><i class="fas fa-tag"></i> ' + escHtml(payment.purpose || 'No purpose') + '</span>';
                    if (receiptCount > 0) {
                        html += '<span class="payment-receipts" onclick="event.stopPropagation();window.viewPaymentReceipts(\'' + payment.id + '\')"><i class="fas fa-paperclip"></i> ' + receiptCount + ' receipt(s)</span>';
                    }
                    html += '</div>';
                    html += '<div class="payment-actions">';
                    html += '<button class="btn-sm primary" onclick="event.stopPropagation();window.editPayment(\'' + payment.id + '\')"><i class="fas fa-edit"></i> Edit</button>';
                    html += '<button class="btn-sm danger" onclick="event.stopPropagation();window.deletePayment(\'' + payment.id + '\')" style="background:#fef2f2;color:#dc2626;"><i class="fas fa-trash"></i> Delete</button>';
                    html += '</div>';
                    html += '</div>';
                });
                
                html += '</div>';
            }
            
            html += '</div>';
        });
        
        paymentContainer.innerHTML = html;
    }

    window.togglePaymentGroup = function(person) {
        if (expandedPerson === person) {
            expandedPerson = null;
        } else {
            expandedPerson = person;
        }
        renderAll();
    };

    window.addInlinePayment = function(person) {
        if (!userData) {
            alert('Please login first');
            return;
        }

        const personKey = person.replace(/\s/g, '_');
        const amountInput = document.getElementById('inline_amount_' + personKey);
        const dateInput = document.getElementById('inline_date_' + personKey);
        const purposeInput = document.getElementById('inline_purpose_' + personKey);

        const amount = parseFloat(amountInput.value);
        const date = dateInput ? dateInput.value : today;
        const purpose = purposeInput ? purposeInput.value.trim() : '';

        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        const payments = userData.payments || [];
        const id = generateId();
        const payment = {
            id: id,
            person: person,
            amount: amount,
            purpose: purpose || 'No purpose',
            date: date
        };

        payments.push(payment);
        userData.payments = payments;
        
        // Update UI immediately
        renderAll();
        expandedPerson = person;
        renderAll();
        
        // Save to Firestore
        saveUserData(userData).then(() => {
            amountInput.value = '';
            purposeInput.value = '';
        });
    };

    window.viewPaymentReceipts = function(paymentId) {
        if (!userData) return;
        const payments = userData.payments || [];
        let payment = null;
        for (let i = 0; i < payments.length; i++) {
            if (payments[i].id === paymentId) {
                payment = payments[i];
                break;
            }
        }
        if (!payment) return;

        modalTitle.textContent = '📎 Receipts - ' + payment.person;
        let html = '<div class="modal-details">';
        html += '<p><strong>Date:</strong> ' + (payment.date || 'N/A') + '</p>';
        html += '<p><strong>Amount:</strong> ' + formatRupees(payment.amount) + '</p>';
        html += '<p><strong>Purpose:</strong> ' + escHtml(payment.purpose || 'No purpose') + '</p>';
        
        const receipts = payment.receipts || [];
        if (receipts.length > 0) {
            html += '<p><strong>Receipts (' + receipts.length + '):</strong></p>';
            for (let i = 0; i < receipts.length; i++) {
                html += '<img src="' + receipts[i] + '" alt="Receipt ' + (i+1) + '" style="margin-top:6px;max-width:100%;border-radius:8px;border:1px solid #e2e8f0;">';
            }
        } else {
            html += '<p><strong>Receipts:</strong> No receipts uploaded</p>';
        }
        html += '</div>';
        modalBody.innerHTML = html;
        billModal.classList.add('active');
    };

    addPaymentBtn.addEventListener('click', function() {
        if (!userData) {
            alert('Please login first');
            return;
        }

        const person = newPaymentPerson.value.trim();
        const amount = parseFloat(newPaymentAmount.value);
        const purpose = newPaymentPurpose.value.trim();
        const date = newPaymentDate.value;
        const fileInput = document.getElementById('newPaymentReceipt');

        if (!person) {
            alert('Please enter a person/company name');
            return;
        }
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        if (!date) {
            alert('Please select a date');
            return;
        }

        const payments = userData.payments || [];
        
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const receiptPromises = [];
            const receiptDataArray = [];
            
            for (let i = 0; i < fileInput.files.length; i++) {
                receiptPromises.push(new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        receiptDataArray.push(e.target.result);
                        resolve();
                    };
                    reader.readAsDataURL(fileInput.files[i]);
                }));
            }
            
            Promise.all(receiptPromises).then(() => {
                savePayment(person, amount, purpose, date, receiptDataArray);
            });
        } else {
            savePayment(person, amount, purpose, date, []);
        }
    });

    function savePayment(person, amount, purpose, date, receiptDataArray) {
        const payments = userData.payments || [];
        
        if (isEditingPayment && editingPaymentId) {
            let found = false;
            for (let i = 0; i < payments.length; i++) {
                if (payments[i].id === editingPaymentId) {
                    payments[i].person = person;
                    payments[i].amount = amount;
                    payments[i].purpose = purpose || 'No purpose';
                    payments[i].date = date;
                    if (receiptDataArray && receiptDataArray.length > 0) {
                        if (!payments[i].receipts) payments[i].receipts = [];
                        payments[i].receipts = payments[i].receipts.concat(receiptDataArray);
                    }
                    found = true;
                    break;
                }
            }
            if (found) {
                userData.payments = payments;
                renderAll();
                resetPaymentForm();
                saveUserData(userData);
            }
        } else {
            const id = generateId();
            const payment = {
                id: id,
                person: person,
                amount: amount,
                purpose: purpose || 'No purpose',
                date: date
            };
            if (receiptDataArray && receiptDataArray.length > 0) {
                payment.receipts = receiptDataArray;
            }
            payments.push(payment);
            userData.payments = payments;
            renderAll();
            resetPaymentForm();
            saveUserData(userData);
        }
    }

    function resetPaymentForm() {
        newPaymentPerson.value = '';
        newPaymentAmount.value = '';
        newPaymentPurpose.value = '';
        newPaymentDate.value = today;
        if (newPaymentReceipt) newPaymentReceipt.value = '';
        isEditingPayment = false;
        editingPaymentId = null;
        addPaymentBtn.innerHTML = '<i class="fas fa-plus"></i> Add Payment';
    }

    window.editPayment = function(paymentId) {
        if (!userData) return;
        const payments = userData.payments || [];
        let payment = null;
        for (let i = 0; i < payments.length; i++) {
            if (payments[i].id === paymentId) {
                payment = payments[i];
                break;
            }
        }
        if (!payment) return;

        newPaymentPerson.value = payment.person || '';
        newPaymentAmount.value = payment.amount || '';
        newPaymentPurpose.value = payment.purpose || '';
        newPaymentDate.value = payment.date || today;

        isEditingPayment = true;
        editingPaymentId = paymentId;
        addPaymentBtn.innerHTML = '<i class="fas fa-save"></i> Update Payment';
        
        const paymentForm = document.querySelector('.payment-input');
        if (paymentForm) {
            paymentForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    window.deletePayment = function(paymentId) {
        if (!confirm('Delete this payment?')) return;
        if (!userData) return;

        const payments = userData.payments || [];
        const newPayments = payments.filter(p => p.id !== paymentId);
        userData.payments = newPayments;
        renderAll();
        saveUserData(userData);
    };

    // ============================================================
    // COMPANY FUNCTIONS - Expandable
    // ============================================================
    window.toggleCompany = function(idx) {
        if (expandedCompany === idx) {
            expandedCompany = null;
        } else {
            expandedCompany = idx;
        }
        renderAll();
    };

    function renderCompanies(companies) {
        if (!companyContainer) return;
        
        if (!companies || companies.length === 0) {
            companyContainer.innerHTML = '<div class="empty-state"><i class="fas fa-store"></i><p>No companies yet.<br>Add your first company above!</p></div>';
            return;
        }

        let html = '';
        for (let idx = 0; idx < companies.length; idx++) {
            const comp = companies[idx];
            const transactions = comp.transactions || [];
            let totalReceived = 0;
            let totalDues = 0;
            
            for (let j = 0; j < transactions.length; j++) {
                const t = transactions[j];
                totalReceived += Number(t.received || 0);
                totalDues += Number(t.due || 0);
            }
            const totalAmount = totalReceived + totalDues;
            const isExpanded = expandedCompany === idx;
            
            html += '<div class="company-item" data-index="' + idx + '">';
            
            html += '<span class="company-delete" onclick="event.stopPropagation();window.deleteCompany(' + idx + ')" title="Delete Company">';
            html += '<i class="fas fa-trash-alt"></i>';
            html += '</span>';
            
            html += '<div class="company-header" onclick="window.toggleCompany(' + idx + ')" style="cursor:pointer;">';
            html += '<span class="company-name"><i class="fas fa-store-alt"></i> ' + escHtml(comp.name) + '</span>';
            html += '<div class="company-stats">';
            html += '<span class="stat received">Received: ' + formatRupees(totalReceived) + '</span>';
            html += '<span class="stat due">Due: ' + formatRupees(totalDues) + '</span>';
            html += '<span class="stat total">Total: ' + formatRupees(totalAmount) + '</span>';
            html += '<span class="stat toggle-icon">';
            html += '<i class="fas fa-chevron-' + (isExpanded ? 'up' : 'down') + '"></i>';
            html += '</span>';
            html += '</div></div>';
            
            html += '<div class="company-actions">';
            html += '<button class="btn-sm primary" onclick="event.stopPropagation();window.toggleBillUpload(' + idx + ')"><i class="fas fa-receipt"></i> Add Transaction</button>';
            html += '</div>';
            
            html += '<div id="billUpload_' + idx + '" class="bill-upload">';
            html += '<div class="amount-group">';
            html += '<span class="label-icon" style="color:#16a34a;font-size:10px;">Received</span>';
            html += '<span class="currency-label">Rs</span>';
            html += '<input type="number" id="received_' + idx + '" placeholder="0.00" min="0" step="0.01">';
            html += '</div>';
            html += '<div class="amount-group">';
            html += '<span class="label-icon" style="color:#dc2626;font-size:10px;">Due</span>';
            html += '<span class="currency-label">Rs</span>';
            html += '<input type="number" id="due_' + idx + '" placeholder="0.00" min="0" step="0.01">';
            html += '</div>';
            html += '<input type="date" id="date_' + idx + '" value="' + today + '">';
            html += '<input type="file" id="billFile_' + idx + '" accept="image/*" capture="environment" multiple>';
            html += '<button class="btn-add" onclick="window.addTransaction(' + idx + ')"><i class="fas fa-check"></i> Add</button>';
            html += '<button class="btn-cancel" onclick="window.toggleBillUpload(' + idx + ')">Cancel</button>';
            html += '</div>';
            
            if (isExpanded) {
                html += '<div class="transactions-container expanded">';
                html += '<div class="transactions-list">';
                
                if (transactions.length === 0) {
                    html += '<span class="no-transactions">No transactions yet. Add your first transaction!</span>';
                } else {
                    for (let i = transactions.length - 1; i >= 0; i--) {
                        const t = transactions[i];
                        const dateStr = t.date ? ' ' + t.date : '';
                        const billCount = t.bills ? t.bills.length : 0;
                        const billIcon = billCount > 0 ? ' 📎(' + billCount + ')' : '';
                        const receivedStr = t.received ? formatRupees(t.received) : '';
                        const dueStr = t.due ? formatRupees(t.due) : '';
                        let displayStr = '';
                        if (receivedStr && dueStr) {
                            displayStr = '<span class="received-amount">' + receivedStr + '</span> + <span class="due-amount">' + dueStr + '</span>';
                        } else if (receivedStr) {
                            displayStr = '<span class="received-amount">' + receivedStr + '</span>';
                        } else if (dueStr) {
                            displayStr = '<span class="due-amount">' + dueStr + '</span>';
                        }
                        html += '<span class="transaction-tag" onclick="window.viewTransaction(' + idx + ', \'' + t.id + '\')">' +
                            displayStr + dateStr + billIcon +
                            '<span class="remove" onclick="event.stopPropagation();window.removeTransaction(' + idx + ', \'' + t.id + '\')"><i class="fas fa-times-circle"></i></span>' +
                            '<span class="edit" onclick="event.stopPropagation();window.editTransaction(' + idx + ', \'' + t.id + '\')" style="color:#2563eb;cursor:pointer;font-size:10px;margin-left:2px;"><i class="fas fa-edit"></i></span>' +
                            '</span>';
                    }
                }
                
                html += '</div></div>';
            } else {
                html += '<div class="transactions-container collapsed" onclick="window.toggleCompany(' + idx + ')" style="cursor:pointer;">';
                if (transactions.length === 0) {
                    html += '<span class="transaction-count">No transactions</span>';
                } else {
                    html += '<span class="transaction-count">' + transactions.length + ' transaction(s) - Click to view</span>';
                }
                html += '</div>';
            }
            
            html += '</div>';
        }
        companyContainer.innerHTML = html;
    }

    window.deleteCompany = function(idx) {
        if (!userData) {
            alert('Please login first');
            return;
        }
        
        const companies = userData.companies || [];
        if (!companies[idx]) {
            alert('Company not found');
            return;
        }
        
        const companyName = companies[idx].name;
        const transactionCount = (companies[idx].transactions || []).length;
        
        const message = 'Are you sure you want to delete "' + companyName + '"?\n\n' +
                        'This will permanently delete:\n' +
                        '• Company: ' + companyName + '\n' +
                        '• ' + transactionCount + ' transaction(s)\n\n' +
                        'This action cannot be undone!';
        
        if (!confirm(message)) {
            return;
        }
        
        if (!confirm('⚠️ FINAL WARNING: Delete "' + companyName + '" permanently?')) {
            return;
        }
        
        companies.splice(idx, 1);
        userData.companies = companies;
        renderAll();
        saveUserData(userData);
    };

    // ============================================================
    // TRANSACTION FUNCTIONS
    // ============================================================
    window.toggleBillUpload = function(idx) {
        const el = document.getElementById('billUpload_' + idx);
        if (el) {
            el.classList.toggle('active');
            if (!el.classList.contains('active')) {
                isEditingTransaction = false;
                editingTransactionData = null;
                const addBtn = el.querySelector('.btn-add');
                if (addBtn) {
                    addBtn.innerHTML = '<i class="fas fa-check"></i> Add';
                    addBtn.removeAttribute('data-edit');
                }
            }
        }
    };

    window.editTransaction = function(compIdx, transId) {
        if (!userData) {
            alert('Please login first');
            return;
        }
        
        const companies = userData.companies || [];
        if (!companies[compIdx]) {
            alert('Company not found');
            return;
        }
        
        const transactions = companies[compIdx].transactions || [];
        let transaction = null;
        let transIndex = -1;
        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].id === transId) {
                transaction = transactions[i];
                transIndex = i;
                break;
            }
        }
        
        if (!transaction) {
            alert('Transaction not found');
            return;
        }
        
        isEditingTransaction = true;
        editingTransactionData = {
            compIdx: compIdx,
            transIndex: transIndex,
            transaction: transaction
        };
        
        const uploadEl = document.getElementById('billUpload_' + compIdx);
        if (uploadEl) {
            uploadEl.classList.add('active');
        }
        
        const receivedInput = document.getElementById('received_' + compIdx);
        const dueInput = document.getElementById('due_' + compIdx);
        const dateInput = document.getElementById('date_' + compIdx);
        
        if (receivedInput) receivedInput.value = transaction.received || '';
        if (dueInput) dueInput.value = transaction.due || '';
        if (dateInput) dateInput.value = transaction.date || today;
        
        const addBtn = uploadEl ? uploadEl.querySelector('.btn-add') : null;
        if (addBtn) {
            addBtn.innerHTML = '<i class="fas fa-save"></i> Update';
            addBtn.setAttribute('data-edit', 'true');
        }
        
        if (uploadEl) {
            uploadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    window.addTransaction = function(idx) {
        if (!userData) {
            alert('Please login first');
            return;
        }
        
        const companies = userData.companies || [];
        if (!companies[idx]) {
            alert('Company not found');
            return;
        }
        
        const receivedInput = document.getElementById('received_' + idx);
        const dueInput = document.getElementById('due_' + idx);
        const dateInput = document.getElementById('date_' + idx);
        const fileInput = document.getElementById('billFile_' + idx);
        const addBtn = document.getElementById('billUpload_' + idx)?.querySelector('.btn-add');
        
        const received = parseFloat(receivedInput.value) || 0;
        const due = parseFloat(dueInput.value) || 0;
        
        if (received <= 0 && due <= 0) {
            alert('Please enter at least one amount (Received or Due)');
            return;
        }
        
        const date = dateInput ? dateInput.value : today;
        
        if (addBtn && addBtn.getAttribute('data-edit') === 'true' && isEditingTransaction && editingTransactionData) {
            const { compIdx, transIndex, transaction } = editingTransactionData;
            
            if (compIdx === idx) {
                const updatedTransaction = {
                    id: transaction.id,
                    date: date,
                    received: received > 0 ? received : 0,
                    due: due > 0 ? due : 0,
                    bills: transaction.bills || []
                };
                
                if (fileInput && fileInput.files && fileInput.files.length > 0) {
                    const billPromises = [];
                    for (let i = 0; i < fileInput.files.length; i++) {
                        billPromises.push(new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                resolve(e.target.result);
                            };
                            reader.readAsDataURL(fileInput.files[i]);
                        }));
                    }
                    
                    Promise.all(billPromises).then((billDataArray) => {
                        if (!updatedTransaction.bills) updatedTransaction.bills = [];
                        updatedTransaction.bills = updatedTransaction.bills.concat(billDataArray);
                        applyTransactionUpdate(idx, transIndex, updatedTransaction);
                    });
                } else {
                    applyTransactionUpdate(idx, transIndex, updatedTransaction);
                }
                return;
            }
        }
        
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const billPromises = [];
            const billDataArray = [];
            
            for (let i = 0; i < fileInput.files.length; i++) {
                billPromises.push(new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        billDataArray.push(e.target.result);
                        resolve();
                    };
                    reader.readAsDataURL(fileInput.files[i]);
                }));
            }
            
            Promise.all(billPromises).then(() => {
                saveTransaction(idx, received, due, date, billDataArray);
            });
        } else {
            saveTransaction(idx, received, due, date, []);
        }
    };

    function applyTransactionUpdate(idx, transIndex, updatedTransaction) {
        const companies = userData.companies || [];
        if (!companies[idx]) return;
        if (!companies[idx].transactions) companies[idx].transactions = [];
        
        companies[idx].transactions[transIndex] = updatedTransaction;
        renderAll();
        resetTransactionForm(idx);
        isEditingTransaction = false;
        editingTransactionData = null;
        saveUserData(userData);
    }

    function saveTransaction(idx, received, due, date, billDataArray) {
        const companies = userData.companies || [];
        if (!companies[idx]) return;
        if (!companies[idx].transactions) companies[idx].transactions = [];
        
        const id = generateId();
        const transaction = { 
            id: id, 
            date: date,
            received: received > 0 ? received : 0,
            due: due > 0 ? due : 0
        };
        
        if (billDataArray && billDataArray.length > 0) {
            transaction.bills = billDataArray;
        }
        
        companies[idx].transactions.push(transaction);
        expandedCompany = idx;
        renderAll();
        resetTransactionForm(idx);
        saveUserData(userData);
    }

    function resetTransactionForm(idx) {
        const uploadEl = document.getElementById('billUpload_' + idx);
        if (uploadEl) uploadEl.classList.remove('active');
        
        const receivedInput = document.getElementById('received_' + idx);
        if (receivedInput) receivedInput.value = '';
        
        const dueInput = document.getElementById('due_' + idx);
        if (dueInput) dueInput.value = '';
        
        const fileInput = document.getElementById('billFile_' + idx);
        if (fileInput) fileInput.value = '';
        
        const addBtn = uploadEl ? uploadEl.querySelector('.btn-add') : null;
        if (addBtn) {
            addBtn.innerHTML = '<i class="fas fa-check"></i> Add';
            addBtn.removeAttribute('data-edit');
        }
        
        isEditingTransaction = false;
        editingTransactionData = null;
    }

    window.removeTransaction = function(compIdx, transId) {
        if (!confirm('Remove this transaction?')) return;
        if (!userData) return;
        
        const companies = userData.companies || [];
        if (!companies[compIdx]) return;
        
        const newTransactions = companies[compIdx].transactions.filter(t => t.id !== transId);
        companies[compIdx].transactions = newTransactions;
        renderAll();
        saveUserData(userData);
    };

    window.viewTransaction = function(compIdx, transId) {
        if (!userData) {
            alert('Please login first');
            return;
        }
        const companies = userData.companies || [];
        if (!companies[compIdx]) return;
        
        const transactions = companies[compIdx].transactions || [];
        let transaction = null;
        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].id === transId) {
                transaction = transactions[i];
                break;
            }
        }
        if (!transaction) return;
        
        modalTitle.textContent = 'Transaction Details - ' + companies[compIdx].name;
        let html = '<div class="modal-details">';
        html += '<p><strong>Date:</strong> ' + (transaction.date || 'N/A') + '</p>';
        html += '<p><strong>Company:</strong> ' + escHtml(companies[compIdx].name) + '</p>';
        if (transaction.received) {
            html += '<p><strong>Received:</strong> <span style="color:#16a34a;font-weight:600;">' + formatRupees(transaction.received) + '</span></p>';
        }
        if (transaction.due) {
            html += '<p><strong>Due:</strong> <span style="color:#dc2626;font-weight:600;">' + formatRupees(transaction.due) + '</span></p>';
        }
        
        const bills = transaction.bills || [];
        if (bills.length > 0) {
            html += '<p><strong>Bills (' + bills.length + '):</strong></p>';
            for (let i = 0; i < bills.length; i++) {
                html += '<img src="' + bills[i] + '" alt="Bill Image ' + (i+1) + '" style="margin-top:6px;">';
            }
        } else {
            html += '<p><strong>Bills:</strong> No bills uploaded</p>';
        }
        html += '</div>';
        modalBody.innerHTML = html;
        billModal.classList.add('active');
    };

    window.closeBillModal = function() {
        billModal.classList.remove('active');
    };

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', window.closeBillModal);
    }

    billModal.addEventListener('click', function(e) {
        if (e.target === billModal) {
            window.closeBillModal();
        }
    });

    // ============================================================
    // ADD COMPANY
    // ============================================================
    addCompanyBtn.addEventListener('click', function() {
        const name = newCompanyName.value.trim();
        if (!name) {
            alert('Please enter a company name');
            return;
        }
        if (!userData) {
            alert('Please login first');
            return;
        }
        
        userData.companies = userData.companies || [];
        userData.companies.push({ name: name, transactions: [] });
        newCompanyName.value = '';
        renderAll();
        saveUserData(userData);
    });

    // ============================================================
    // NOTE FUNCTIONS
    // ============================================================
    function renderNotes(notes) {
        console.log('📝 Rendering notes:', notes);
        if (!notesContainer) return;
        
        if (!notes || notes.length === 0) {
            notesContainer.innerHTML = '<div class="no-notes"><i class="fas fa-sticky-note"></i><p>No notes yet.<br>Create your first note above!</p></div>';
            return;
        }

        const sortedNotes = notes.slice().sort((a, b) => {
            if (a.date && b.date) {
                return b.date.localeCompare(a.date);
            }
            return 0;
        });
        
        let html = '';
        for (let i = 0; i < sortedNotes.length; i++) {
            const note = sortedNotes[i];
            const displayDate = note.date || 'No date';
            const title = getNoteTitle(note.content);
            const preview = getNotePreview(note.content);
            const noteId = note.id || 'note_' + i;
            
            html += '<div class="note-item" data-id="' + noteId + '" onclick="window.viewFullNote(\'' + noteId + '\')">' +
                '<div class="note-content">' +
                '<div class="note-date"><i class="fas fa-calendar-alt"></i> ' + displayDate + '</div>' +
                '<div class="note-title">' + escHtml(title) + '</div>' +
                '<div class="note-preview">' + escHtml(preview) + '</div>' +
                '</div>' +
                '<div class="note-actions" onclick="event.stopPropagation();">' +
                '<button class="edit" onclick="window.editNote(\'' + noteId + '\')" title="Edit"><i class="fas fa-edit"></i></button>' +
                '<button class="delete" onclick="window.deleteNote(\'' + noteId + '\')" title="Delete"><i class="fas fa-trash-alt"></i></button>' +
                '</div>' +
                '</div>';
        }
        notesContainer.innerHTML = html;
        console.log('✅ Notes rendered:', sortedNotes.length);
    }

    window.viewFullNote = function(noteId) {
        if (!userData) return;
        const notes = userData.notes || [];
        let note = null;
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].id === noteId) {
                note = notes[i];
                break;
            }
        }
        if (!note) return;

        modalTitle.textContent = '📝 Full Note';
        let html = '<div class="modal-details">';
        html += '<p><strong>Date:</strong> ' + (note.date || 'N/A') + '</p>';
        html += '<div style="background:#f8fafc;padding:16px;border-radius:12px;margin-top:12px;white-space:pre-wrap;font-size:14px;line-height:1.6;max-height:400px;overflow-y:auto;">' + escHtml(note.content) + '</div>';
        html += '</div>';
        modalBody.innerHTML = html;
        billModal.classList.add('active');
    };

    function getNoteById(notes, noteId) {
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].id === noteId) {
                return notes[i];
            }
        }
        return null;
    }

    window.editNote = function(noteId) {
        if (!userData) {
            alert('Please login first');
            return;
        }
        const notes = userData.notes || [];
        const note = getNoteById(notes, noteId);
        if (!note) return;
        
        noteDate.value = note.date || today;
        noteContent.value = note.content || '';
        noteContent.focus();
        
        isEditingNote = true;
        editingNoteId = noteId;
        saveNoteBtn.innerHTML = '<i class="fas fa-edit"></i> Update';
        
        const inputArea = document.querySelector('.note-input');
        if (inputArea) {
            inputArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    window.deleteNote = function(noteId) {
        if (!confirm('Delete this note?')) return;
        if (!userData) return;
        
        const notes = userData.notes || [];
        const newNotes = notes.filter(note => note.id !== noteId);
        userData.notes = newNotes;
        renderAll();
        saveUserData(userData);
    };

    saveNoteBtn.addEventListener('click', function() {
        if (!userData) {
            alert('Please login first');
            return;
        }
        
        const date = noteDate.value;
        const content = noteContent.value.trim();
        
        if (!content) {
            alert('Please write some content');
            return;
        }
        if (!date) {
            alert('Please select a date');
            return;
        }
        
        const notes = userData.notes || [];
        
        if (isEditingNote && editingNoteId) {
            let found = false;
            for (let i = 0; i < notes.length; i++) {
                if (notes[i].id === editingNoteId) {
                    notes[i].date = date;
                    notes[i].content = content;
                    found = true;
                    break;
                }
            }
            if (found) {
                userData.notes = notes;
                renderAll();
                resetNoteForm();
                saveUserData(userData);
            }
        } else {
            const noteId = generateId();
            notes.push({ id: noteId, date: date, content: content });
            userData.notes = notes;
            renderAll();
            resetNoteForm();
            saveUserData(userData);
        }
    });

    function resetNoteForm() {
        noteContent.value = '';
        noteDate.value = today;
        isEditingNote = false;
        editingNoteId = null;
        saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }

    clearNoteBtn.addEventListener('click', function() {
        if (noteContent.value.trim() || noteDate.value !== today) {
            if (confirm('Clear the current note input?')) {
                resetNoteForm();
            }
        }
    });

    // ============================================================
    // USER LOGIN HANDLER
    // ============================================================
    window.onUserLoggedIn = async function() {
        console.log('👤 onUserLoggedIn called');
        currentUser = window.auth.currentUser;
        
        if (!currentUser) {
            console.log('❌ No current user in onUserLoggedIn');
            return;
        }
        
        console.log('✅ User logged in:', currentUser.email);
        
        showLoading(companyContainer);
        showLoading(notesContainer);
        showLoading(paymentContainer);
        
        await loadUserData();
    };

    window.setCurrentUser = function(user) {
        currentUser = user;
        console.log('👤 Current user set:', user ? user.email : 'null');
    };

    window.clearUserData = function() {
        console.log('🧹 Clearing user data');
        
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        
        currentUser = null;
        userData = null;
        dataLoaded = false;
        isEditingNote = false;
        editingNoteId = null;
        isEditingTransaction = false;
        editingTransactionData = null;
        isEditingPayment = false;
        editingPaymentId = null;
        expandedCompany = null;
        expandedPerson = null;
        resetNoteForm();
        resetPaymentForm();
        showLoading(companyContainer);
        showLoading(notesContainer);
        showLoading(paymentContainer);
        if (companyCount) companyCount.textContent = '0';
        if (notesCount) notesCount.textContent = '0';
        if (paymentCount) paymentCount.textContent = '0';
        updateSyncStatus(false);
    };

    // ============================================================
    // INITIALIZATION
    // ============================================================
    console.log('🚀 Initializing app...');

    const initialUser = window.auth.currentUser;
    if (initialUser) {
        console.log('👤 User already logged in:', initialUser.email);
        currentUser = initialUser;
        showLoading(companyContainer);
        showLoading(notesContainer);
        showLoading(paymentContainer);
        
        setTimeout(() => {
            loadUserData();
        }, 300);
    } else {
        console.log('👤 No user logged in initially');
        showLoading(companyContainer);
        showLoading(notesContainer);
        showLoading(paymentContainer);
    }

    window.auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log('👤 Auth state changed - user logged in:', user.email);
            currentUser = user;
            
            if (!dataLoaded) {
                showLoading(companyContainer);
                showLoading(notesContainer);
                showLoading(paymentContainer);
                loadUserData();
            }
        } else {
            console.log('👤 Auth state changed - user logged out');
            window.clearUserData();
        }
    });

    console.log('✅ App module loaded');

})();
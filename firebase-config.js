// ====================================================
// FIREBASE CONFIGURATION
// ====================================================
const firebaseConfig = {
    apiKey: "AIzaSyAtyfVoC-z7aM2_sqGJz1Z7LEnvi58kRdA",
    authDomain: "daily-expense-tracker-00.firebaseapp.com",
    projectId: "daily-expense-tracker-00",
    storageBucket: "daily-expense-tracker-00.firebasestorage.app",
    messagingSenderId: "773669079508",
    appId: "1:773669079508:web:6257d6dcbfac68104b6e41",
    measurementId: "G-64JE4F4C8M"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services - MAKE THEM GLOBAL
window.auth = firebase.auth();
window.db = firebase.firestore();

// Enable offline persistence
window.db.enablePersistence({ synchronizeTabs: true })
    .then(function() {
        console.log('✅ Firestore persistence enabled');
    })
    .catch(function(err) {
        console.warn('⚠️ Firestore persistence warning:', err.message);
    });

// Set up auth state listener
window.auth.onAuthStateChanged(function(user) {
    if (user) {
        console.log('👤 Firebase auth: User signed in -', user.email);
        // Store user info globally
        window.currentUser = user;
    } else {
        console.log('👤 Firebase auth: User signed out');
        window.currentUser = null;
    }
});

console.log('✅ Firebase initialized');
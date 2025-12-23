// ANKI iOS WebApp - Main Application
class AnkiApp {
    constructor() {
        this.currentView = 'decks';
        this.currentDeck = null;
        this.isReviewing = false;
        this.reviewQueue = [];
        this.currentCardIndex = 0;
        this.cardStartTime = null;
        this.undoStack = [];
        this.editors = {};
        this.touchStart = { x: 0, y: 0 };
        this.touchEnd = { x: 0, y: 0 };
        
        this.init();
    }

    async init() {
        try {
            // Initialize storage
            await storage.init();
            
            // Initialize scheduler
            scheduler.init();
            
            // Initialize editor
            editor.init();
            
            // Initialize review system
            review.init();
            
            // Initialize browser
            browser.init();
            
            // Initialize deck manager
            deckManager.init();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup gestures
            this.setupGestures();
            
            // Setup service worker
            this.setupServiceWorker();
            
            // Hide loading screen
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            
            console.log('Anki iOS WebApp initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize app. Please refresh.');
        }
    }

    async loadInitialData() {
        // Load decks
        const decks = await storage.getAllDecks();
        deckManager.renderDecks(decks);
        
        // Load counts
        await this.updateCounts();
        
        // Load settings
        await this.loadSettings();
        
        // Check for review cards
        const dueCount = await storage.getDueCount();
        if (dueCount > 0) {
            document.getElementById('review-badge').textContent = dueCount;
        }
    }

    async updateCounts() {
        const dueCount = await storage.getDueCount();
        const newCount = await storage.getNewCount();
        const learningCount = await storage.getLearningCount();
        
        document.getElementById('due-count').textContent = dueCount;
        document.getElementById('new-count').textContent = newCount;
        document.getElementById('learning-count').textContent = learningCount;
    }

    async loadSettings() {
        const settings = await storage.getSettings();
        if (settings) {
            // Apply theme
            if (settings.theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            }
            
            // Apply font size
            document.documentElement.style.fontSize = this.getFontSize(settings.fontSize);
            
            // Update form values
            document.getElementById('new-cards-day').value = settings.newCardsPerDay || 20;
            document.getElementById('max-reviews-day').value = settings.maxReviewsPerDay || 200;
            document.getElementById('learning-steps').value = settings.learningSteps || '1 10';
            document.getElementById('dark-mode').checked = settings.theme === 'dark';
            document.getElementById('font-size').value = settings.fontSize || 'medium';
        }
    }

    getFontSize(size) {
        const sizes = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'x-large': '20px'
        };
        return sizes[size] || '16px';
    }

    setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // Menu toggle
        document.getElementById('menu-toggle').addEventListener('click', () => {
            // Toggle sidebar (to be implemented)
        });

        // Sync button
        document.getElementById('sync-button').addEventListener('click', () => {
            sync.sync();
        });

        // Add button
        document.getElementById('add-button').addEventListener('click', () => {
            this.showAddCardModal();
        });

        // Create deck button
        document.getElementById('create-deck-btn').addEventListener('click', () => {
            deckManager.showCreateDeckModal();
        });

        // Undo button
        document.getElementById('undo-btn').addEventListener('click', () => {
            review.undo();
        });

        // More options button
        document.getElementById('more-options-btn').addEventListener('click', (e) => {
            this.showCardOptionsMenu(e.currentTarget);
        });

        // Answer buttons
        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ease = parseInt(e.currentTarget.dataset.ease);
                review.answerCard(ease);
            });
        });

        // Flag card button
        document.getElementById('flag-card-btn').addEventListener('click', () => {
            review.toggleFlag();
        });

        // Mark card button
        document.getElementById('mark-card-btn').addEventListener('click', () => {
            review.toggleMark();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Modal overlay
        document.getElementById('modal-overlay').addEventListener('click', () => {
            this.closeAllModals();
        });

        // Settings changes
        document.getElementById('dark-mode').addEventListener('change', (e) => {
            this.toggleDarkMode(e.target.checked);
        });

        document.getElementById('font-size').addEventListener('change', (e) => {
            this.changeFontSize(e.target.value);
        });

        document.getElementById('new-cards-day').addEventListener('change', (e) => {
            this.saveSetting('newCardsPerDay', parseInt(e.target.value));
        });

        document.getElementById('max-reviews-day').addEventListener('change', (e) => {
            this.saveSetting('maxReviewsPerDay', parseInt(e.target.value));
        });

        document.getElementById('learning-steps').addEventListener('change', (e) => {
            this.saveSetting('learningSteps', e.target.value);
        });

        // Data management buttons
        document.getElementById('export-data-btn').addEventListener('click', () => {
            sync.exportData();
        });

        document.getElementById('import-data-btn').addEventListener('click', () => {
            sync.importData();
        });

        document.getElementById('clear-data-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                storage.clearAllData();
                location.reload();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    setupGestures() {
        const card = document.getElementById('question-card');
        
        card.addEventListener('touchstart', (e) => {
            this.touchStart.x = e.touches[0].clientX;
            this.touchStart.y = e.touches[0].clientY;
            card.classList.add('dragging');
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!this.touchStart.x || !this.touchStart.y) return;
            
            this.touchEnd.x = e.touches[0].clientX;
            this.touchEnd.y = e.touches[0].clientY;
            
            const dx = this.touchEnd.x - this.touchStart.x;
            const dy = this.touchEnd.y - this.touchStart.y;
            
            // Move card with finger
            const scale = Math.min(Math.abs(dx) / 100, 1);
            const rotate = (dx / 100) * 20;
            
            card.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rotate}deg)`;
            card.style.opacity = 1 - scale * 0.5;
            
            // Update gesture hint color
            this.updateGestureHint(dx, dy);
        }, { passive: true });

        card.addEventListener('touchend', () => {
            card.classList.remove('dragging');
            card.style.transform = '';
            card.style.opacity = '';
            
            const dx = this.touchEnd.x - this.touchStart.x;
            const dy = this.touchEnd.y - this.touchStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 50) { // Minimum swipe distance
                this.handleSwipe(dx, dy);
            }
            
            // Reset gesture hints
            this.resetGestureHints();
            
            // Reset touch positions
            this.touchStart = { x: 0, y: 0 };
            this.touchEnd = { x: 0, y: 0 };
        });
    }

    handleSwipe(dx, dy) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        if (absDx > absDy) {
            // Horizontal swipe
            if (dx > 0) {
                // Swipe right - Easy
                review.answerCard(4);
                document.getElementById('question-card').classList.add('swipe-right');
            } else {
                // Swipe left - Again
                review.answerCard(1);
                document.getElementById('question-card').classList.add('swipe-left');
            }
        } else {
            // Vertical swipe
            if (dy > 0) {
                // Swipe down - Hard
                review.answerCard(2);
                document.getElementById('question-card').classList.add('swipe-down');
            } else {
                // Swipe up - Good
                review.answerCard(3);
                document.getElementById('question-card').classList.add('swipe-up');
            }
        }
        
        // Reset animation after it completes
        setTimeout(() => {
            document.getElementById('question-card').className = 'card';
        }, 300);
    }

    updateGestureHint(dx, dy) {
        const gestureItems = document.querySelectorAll('.gesture-item');
        gestureItems.forEach(item => item.style.opacity = '0.3');
        
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        if (absDx > absDy) {
            if (dx > 0) {
                // Right swipe - Easy
                gestureItems[3].style.opacity = '1';
            } else {
                // Left swipe - Again
                gestureItems[0].style.opacity = '1';
            }
        } else {
            if (dy > 0) {
                // Down swipe - Hard
                gestureItems[1].style.opacity = '1';
            } else {
                // Up swipe - Good
                gestureItems[2].style.opacity = '1';
            }
        }
    }

    resetGestureHints() {
        const gestureItems = document.querySelectorAll('.gesture-item');
        gestureItems.forEach(item => item.style.opacity = '1');
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Update header title
        const titles = {
            'decks': 'Decks',
            'review': 'Review',
            'browser': 'Browse',
            'stats': 'Stats',
            'settings': 'More'
        };
        document.getElementById('page-title').textContent = titles[view];
        
        // Show/hide views
        document.querySelectorAll('.view').forEach(viewEl => {
            viewEl.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Update current view
        this.currentView = view;
        
        // Load view-specific data
        switch(view) {
            case 'review':
                review.startReviewSession();
                break;
            case 'browser':
                browser.loadCards();
                break;
            case 'stats':
                this.loadStats();
                break;
        }
    }

    showAddCardModal() {
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById('add-card-modal').classList.add('active');
        
        // Load decks for dropdown
        deckManager.loadDecksForSelect();
        
        // Initialize editor if not already done
        if (!this.editors.front) {
            this.editors.front = editor.createEditor('front-editor');
            this.editors.back = editor.createEditor('back-editor');
        }
    }

    showCardOptionsMenu(button) {
        const rect = button.getBoundingClientRect();
        const menu = document.getElementById('context-menu');
        
        menu.innerHTML = `
            <div class="context-menu-item" data-action="bury">Bury Card</div>
            <div class="context-menu-item" data-action="suspend">Suspend Card</div>
            <div class="context-menu-item" data-action="edit">Edit Card</div>
            <div class="context-menu-item" data-action="delete">Delete Card</div>
        `;
        
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;
        menu.classList.add('active');
        
        // Close menu when clicking elsewhere
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== button) {
                    menu.classList.remove('active');
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 100);
        
        // Handle menu actions
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleCardAction(action);
                menu.classList.remove('active');
            });
        });
    }

    async handleCardAction(action) {
        const currentCard = review.getCurrentCard();
        if (!currentCard) return;
        
        switch(action) {
            case 'bury':
                await storage.buryCard(currentCard.id);
                review.loadNextCard();
                break;
            case 'suspend':
                await storage.suspendCard(currentCard.id);
                review.loadNextCard();
                break;
            case 'edit':
                // To be implemented
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete this card?')) {
                    await storage.deleteCard(currentCard.id);
                    review.loadNextCard();
                }
                break;
        }
    }

    async loadStats() {
        const stats = await storage.getStatistics();
        
        // Update basic stats
        document.getElementById('total-reviewed').textContent = stats.totalReviewed;
        document.getElementById('avg-time').textContent = `${stats.avgTime}s`;
        
        // Update trends
        document.getElementById('review-trend').textContent = 
            stats.reviewTrend >= 0 ? `+${stats.reviewTrend}%` : `${stats.reviewTrend}%`;
        document.getElementById('time-trend').textContent = 
            stats.timeTrend >= 0 ? `+${stats.timeTrend}%` : `${stats.timeTrend}%`;
        
        // Load deck stats
        const deckStats = await storage.getDeckStatistics();
        const deckStatsList = document.getElementById('deck-stats-list');
        deckStatsList.innerHTML = '';
        
        deckStats.forEach(stat => {
            const item = document.createElement('div');
            item.className = 'deck-stat-item';
            item.innerHTML = `
                <span class="deck-stat-name">${stat.name}</span>
                <span class="deck-stat-value">${stat.cards} cards, ${stat.avgEase}% ease</span>
            `;
            deckStatsList.appendChild(item);
        });
        
        // Render chart
        this.renderReviewChart(stats.dailyReviews);
    }

    renderReviewChart(dailyReviews) {
        const ctx = document.getElementById('review-chart').getContext('2d');
        
        // Destroy existing chart if any
        if (this.reviewChart) {
            this.reviewChart.destroy();
        }
        
        const labels = dailyReviews.map(day => day.date);
        const data = dailyReviews.map(day => day.count);
        
        this.reviewChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cards Reviewed',
                    data: data,
                    borderColor: 'rgb(10, 132, 255)',
                    backgroundColor: 'rgba(10, 132, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(142, 142, 147)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(142, 142, 147)'
                        }
                    }
                }
            }
        });
    }

    handleKeyboardShortcuts(e) {
        // Only handle shortcuts when not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Space or Enter to show answer
        if ((e.code === 'Space' || e.code === 'Enter') && this.currentView === 'review') {
            e.preventDefault();
            review.showAnswer();
        }
        
        // Number keys for answering
        if (e.code >= 'Digit1' && e.code <= 'Digit4' && this.currentView === 'review') {
            const ease = parseInt(e.code.replace('Digit', ''));
            review.answerCard(ease);
        }
        
        // Escape to close modals
        if (e.code === 'Escape') {
            this.closeAllModals();
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('modal-overlay').classList.remove('active');
        document.getElementById('context-menu').classList.remove('active');
    }

    toggleDarkMode(enabled) {
        if (enabled) {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.saveSetting('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            this.saveSetting('theme', 'light');
        }
    }

    changeFontSize(size) {
        document.documentElement.style.fontSize = this.getFontSize(size);
        this.saveSetting('fontSize', size);
    }

    async saveSetting(key, value) {
        await storage.saveSetting(key, value);
    }

    setupServiceWorker() {
        // Check for updates every hour
        setInterval(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(reg => {
                    if (reg) {
                        reg.update();
                    }
                });
            }
        }, 3600000);
    }

    showError(message) {
        // Create error toast
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: var(--danger-color);
            color: white;
            padding: var(--space-md) var(--space-lg);
            border-radius: var(--radius-md);
            z-index: 9999;
            box-shadow: var(--shadow-lg);
        `;
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AnkiApp();
});

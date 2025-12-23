// ANKI iOS - Main Application
class AnkiApp {
    constructor() {
        this.currentView = 'decks';
        this.currentDeck = null;
        this.isReviewing = false;
        this.reviewCards = [];
        this.currentCardIndex = 0;
        this.cardStartTime = null;
        this.undoStack = [];
        this.editors = {};
        
        // Initialize when DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            console.log('Initializing Anki iOS...');
            
            // Initialize storage
            await storage.init();
            await storage.initializeDefaultData();
            
            // Load initial data
            await this.loadDecks();
            await this.updateStats();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Hide loading screen
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('app').style.display = 'flex';
            }, 500);
            
            console.log('Anki iOS initialized successfully');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize app. Please refresh.');
        }
    }

    async loadDecks() {
        try {
            const decks = await storage.getAllDecks();
            const decksList = document.getElementById('decks-list');
            decksList.innerHTML = '';
            
            if (decks.length === 0) {
                decksList.innerHTML = '<div class="empty-state">No decks yet. Create your first deck!</div>';
                return;
            }
            
            let totalNew = 0;
            let totalLearning = 0;
            let totalReview = 0;
            
            for (const deck of decks) {
                const deckElement = document.createElement('div');
                deckElement.className = 'deck-item';
                deckElement.dataset.deckId = deck.id;
                
                const newCount = deck.stats?.new || 0;
                const learningCount = deck.stats?.learning || 0;
                const reviewCount = deck.stats?.review || 0;
                
                totalNew += newCount;
                totalLearning += learningCount;
                totalReview += reviewCount;
                
                deckElement.innerHTML = `
                    <div class="deck-info">
                        <div class="deck-name">${deck.name}</div>
                        <div class="deck-stats">
                            <span class="stat new">${newCount} new</span>
                            <span class="stat learn">${learningCount} learn</span>
                            <span class="stat review">${reviewCount} review</span>
                        </div>
                    </div>
                    <div class="deck-actions">
                        <button class="icon-button small" onclick="app.studyDeck(${deck.id})">
                            <span class="icon">▶</span>
                        </button>
                    </div>
                `;
                
                deckElement.addEventListener('click', (e) => {
                    if (!e.target.closest('.deck-actions')) {
                        this.openDeckOptions(deck.id);
                    }
                });
                
                decksList.appendChild(deckElement);
            }
            
            // Update total counts
            document.getElementById('due-count').textContent = totalReview;
            document.getElementById('new-count').textContent = totalNew;
            document.getElementById('learning-count').textContent = totalLearning;
            
        } catch (error) {
            console.error('Error loading decks:', error);
        }
    }

    async updateStats() {
        try {
            const decks = await storage.getAllDecks();
            let totalCards = 0;
            let totalDue = 0;
            
            for (const deck of decks) {
                const counts = await storage.getCardCounts(deck.id);
                totalCards += counts.total;
                totalDue += counts.review;
            }
            
            // Update review badge
            const reviewBadge = document.getElementById('review-badge');
            if (totalDue > 0) {
                reviewBadge.textContent = totalDue;
                reviewBadge.style.display = 'flex';
            } else {
                reviewBadge.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    setupEventListeners() {
        // Navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // Add button
        document.getElementById('add-button').addEventListener('click', () => {
            this.showAddCardModal();
        });

        // Create deck button
        document.getElementById('create-deck-btn').addEventListener('click', () => {
            this.showCreateDeckModal();
        });

        // Sync button
        document.getElementById('sync-button').addEventListener('click', () => {
            this.sync();
        });

        // Menu toggle
        document.getElementById('menu-toggle').addEventListener('click', () => {
            this.toggleSidebar();
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

        // Save card button
        document.getElementById('save-card-btn').addEventListener('click', () => {
            this.saveCard();
        });

        // Card type selector
        document.getElementById('card-type').addEventListener('change', (e) => {
            this.toggleCardFields(e.target.value);
        });

        // Answer buttons
        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ease = parseInt(e.currentTarget.dataset.ease);
                this.answerCard(ease);
            });
        });

        // Undo button
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undoAnswer();
        });

        // More options button
        document.getElementById('more-options-btn').addEventListener('click', (e) => {
            this.showCardOptions(e.currentTarget);
        });

        // Flag card button
        document.getElementById('flag-card-btn').addEventListener('click', () => {
            this.toggleFlag();
        });

        // Mark card button
        document.getElementById('mark-card-btn').addEventListener('click', () => {
            this.toggleMark();
        });

        // Settings
        document.getElementById('dark-mode').addEventListener('change', (e) => {
            this.toggleDarkMode(e.target.checked);
        });

        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-data-btn').addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('clear-data-btn').addEventListener('click', () => {
            if (confirm('Are you sure? This will delete ALL data.')) {
                storage.clearAllData().then(() => {
                    location.reload();
                });
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcut(e);
        });

        // Touch gestures for card swiping
        this.setupCardGestures();
    }

    setupCardGestures() {
        const card = document.getElementById('question-card');
        let startX, startY, endX, endY;
        
        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            card.classList.add('dragging');
        }, { passive: true });
        
        card.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            endX = e.touches[0].clientX;
            endY = e.touches[0].clientY;
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            
            // Move card with finger
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            const maxDistance = 100;
            const ratio = Math.min(distance / maxDistance, 1);
            
            card.style.transform = `translate(calc(-50% + ${diffX}px), calc(-50% + ${diffY}px)) rotate(${diffX * 0.05}deg)`;
            card.style.opacity = 1 - ratio * 0.5;
            
            // Update gesture hints
            this.updateGestureHint(diffX, diffY);
        }, { passive: true });
        
        card.addEventListener('touchend', () => {
            card.classList.remove('dragging');
            card.style.transform = '';
            card.style.opacity = '';
            
            if (!startX || !startY || !endX || !endY) return;
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            const distance = Math.sqrt(diffX * diffX + diffY * diffY);
            
            if (distance > 50) {
                this.handleSwipe(diffX, diffY);
            }
            
            this.resetGestureHints();
            startX = startY = endX = endY = null;
        });
    }

    handleSwipe(diffX, diffY) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        
        if (absX > absY) {
            // Horizontal swipe
            if (diffX > 0) {
                // Swipe right - Easy
                this.answerCard(4);
            } else {
                // Swipe left - Again
                this.answerCard(1);
            }
        } else {
            // Vertical swipe
            if (diffY > 0) {
                // Swipe down - Hard
                this.answerCard(2);
            } else {
                // Swipe up - Good
                this.answerCard(3);
            }
        }
    }

    updateGestureHint(diffX, diffY) {
        const gestures = document.querySelectorAll('.gesture-item');
        gestures.forEach(g => g.style.opacity = '0.3');
        
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        
        if (absX > absY) {
            if (diffX > 0) {
                gestures[3].style.opacity = '1'; // Easy
            } else {
                gestures[0].style.opacity = '1'; // Again
            }
        } else {
            if (diffY > 0) {
                gestures[1].style.opacity = '1'; // Hard
            } else {
                gestures[2].style.opacity = '1'; // Good
            }
        }
    }

    resetGestureHints() {
        const gestures = document.querySelectorAll('.gesture-item');
        gestures.forEach(g => g.style.opacity = '1');
    }

    async switchView(view) {
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
            'settings': 'Settings'
        };
        document.getElementById('page-title').textContent = titles[view];
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        
        // Show selected view
        document.getElementById(`${view}-view`).classList.add('active');
        this.currentView = view;
        
        // Load view-specific data
        switch(view) {
            case 'decks':
                await this.loadDecks();
                break;
            case 'review':
                if (this.currentDeck) {
                    await this.startReview();
                }
                break;
            case 'browser':
                await this.loadBrowser();
                break;
            case 'stats':
                await this.loadStats();
                break;
        }
    }

    async showAddCardModal() {
        // Load decks for dropdown
        const decks = await storage.getAllDecks();
        const deckSelect = document.getElementById('card-deck');
        deckSelect.innerHTML = decks.map(deck => 
            `<option value="${deck.id}">${deck.name}</option>`
        ).join('');
        
        // Load models for card type
        const models = await storage.getAllModels();
        const typeSelect = document.getElementById('card-type');
        typeSelect.innerHTML = models.map(model => 
            `<option value="${model.id}">${model.name}</option>`
        ).join('');
        
        // Show modal
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById('add-card-modal').classList.add('active');
        
        // Initialize editors
        this.initEditors();
    }

    initEditors() {
        // Simple textareas for now - in production you'd use Quill.js
        this.editors = {
            front: document.getElementById('front-editor'),
            back: document.getElementById('back-editor'),
            cloze: document.getElementById('cloze-text')
        };
    }

    toggleCardFields(cardType) {
        const cardFields = document.getElementById('card-fields');
        const clozeFields = document.getElementById('cloze-fields');
        
        if (cardType === 'cloze' || cardType === '3') {
            cardFields.style.display = 'none';
            clozeFields.style.display = 'block';
        } else {
            cardFields.style.display = 'block';
            clozeFields.style.display = 'none';
        }
    }

    async saveCard() {
        try {
            const deckId = parseInt(document.getElementById('card-deck').value);
            const modelId = parseInt(document.getElementById('card-type').value);
            const tags = document.getElementById('card-tags').value.split(',').map(t => t.trim());
            
            let fields = {};
            let noteData = {};
            
            // Get model to understand field structure
            const model = await storage.getModel(modelId);
            
            if (model.name.includes('Cloze')) {
                const clozeText = document.getElementById('cloze-text').value;
                fields = { Text: clozeText, Extra: '' };
            } else {
                const front = this.editors.front?.value || document.getElementById('front-editor').value;
                const back = this.editors.back?.value || document.getElementById('back-editor').value;
                fields = { Front: front, Back: back };
            }
            
            // Create note
            noteData = {
                modelId: modelId,
                deckId: deckId,
                fields: fields,
                tags: tags
            };
            
            const noteId = await storage.createNote(noteData);
            
            // Create card(s) based on model templates
            for (const template of model.templates) {
                const cardData = {
                    deckId: deckId,
                    noteId: noteId,
                    cardType: 0, // New
                    queue: 0, // New queue
                    due: Math.floor(Date.now() / 86400000),
                    interval: 0,
                    easeFactor: 2500,
                    reps: 0,
                    lapses: 0,
                    left: 0
                };
                
                await storage.createCard(cardData);
            }
            
            // Update deck stats
            await storage.updateDeckStats(deckId);
            
            // Close modal and reset form
            this.closeAllModals();
            this.showToast('Card added successfully');
            
            // Reload decks to update counts
            await this.loadDecks();
            await this.updateStats();
            
        } catch (error) {
            console.error('Error saving card:', error);
            this.showError('Failed to save card');
        }
    }

    async studyDeck(deckId) {
        this.currentDeck = deckId;
        const deck = await storage.getDeck(deckId);
        document.getElementById('review-deck-name').textContent = deck.name;
        await this.switchView('review');
    }

    async startReview() {
        try {
            this.reviewCards = await storage.getDueCards(this.currentDeck);
            this.currentCardIndex = 0;
            this.undoStack = [];
            
            if (this.reviewCards.length === 0) {
                document.getElementById('question-content').innerHTML = 
                    '<div class="empty-review">No cards to review!</div>';
                return;
            }
            
            await this.showNextCard();
            
        } catch (error) {
            console.error('Error starting review:', error);
            this.showError('Failed to load review cards');
        }
    }

    async showNextCard() {
        if (this.currentCardIndex >= this.reviewCards.length) {
            document.getElementById('question-content').innerHTML = 
                '<div class="review-complete">Review complete! 🎉</div>';
            document.getElementById('answer-card').classList.add('hidden');
            return;
        }
        
        const card = this.reviewCards[this.currentCardIndex];
        const note = await storage.getNote(card.noteId);
        const model = await storage.getModel(note.modelId);
        
        // Show question
        let questionHtml = '';
        if (model.name.includes('Cloze')) {
            // Simple cloze handling - in production use proper cloze parsing
            const text = note.fields.Text || '';
            questionHtml = text.replace(/\{\{c\d+::(.+?)\}\}/g, '[...]');
        } else {
            questionHtml = note.fields.Front || '';
        }
        
        document.getElementById('question-content').innerHTML = questionHtml;
        document.getElementById('answer-content').innerHTML = note.fields.Back || '';
        
        // Reset UI
        document.getElementById('answer-card').classList.add('hidden');
        document.getElementById('question-card').style.display = 'block';
        
        // Update progress
        document.getElementById('review-progress').textContent = 
            `${this.currentCardIndex + 1}/${this.reviewCards.length}`;
        
        // Start timer
        this.cardStartTime = Date.now();
    }

    showAnswer() {
        document.getElementById('answer-card').classList.remove('hidden');
        
        // Calculate time taken
        const timeTaken = Date.now() - this.cardStartTime;
        document.getElementById('card-time').textContent = `${Math.round(timeTaken / 1000)}s`;
        
        // Show next interval for each button
        const currentCard = this.reviewCards[this.currentCardIndex];
        [1, 2, 3, 4].forEach(ease => {
            const interval = scheduler.nextInterval(currentCard, ease);
            const intervalStr = scheduler.formatInterval(interval);
            document.querySelector(`.answer-btn[data-ease="${ease}"]`).title = 
                `Next: ${intervalStr}`;
        });
    }

    async answerCard(ease) {
        const card = this.reviewCards[this.currentCardIndex];
        const timeTaken = Date.now() - this.cardStartTime;
        
        // Schedule card
        const result = scheduler.schedule(card, ease, timeTaken);
        
        // Save previous state for undo
        this.undoStack.push({
            cardId: card.id,
            previousState: result.previousState,
            ease: ease
        });
        
        // Update card in database
        await storage.updateCard(card.id, result.card);
        
        // Add review log
        await storage.addReviewLog({
            cardId: card.id,
            ease: ease,
            interval: result.card.interval,
            lastInterval: result.previousState.interval || 0,
            easeFactor: result.card.easeFactor,
            timeTaken: timeTaken
        });
        
        // Move to next card
        this.currentCardIndex++;
        await this.showNextCard();
        
        // Update deck stats
        await storage.updateDeckStats(this.currentDeck);
        await this.updateStats();
        
        // Haptic feedback (simulated)
        this.hapticFeedback();
    }

    async undoAnswer() {
        if (this.undoStack.length === 0) return;
        
        const lastAction = this.undoStack.pop();
        
        // Revert card to previous state
        await storage.updateCard(lastAction.cardId, lastAction.previousState);
        
        // Go back to previous card
        this.currentCardIndex = Math.max(0, this.currentCardIndex - 1);
        await this.showNextCard();
        
        // Update stats
        await storage.updateDeckStats(this.currentDeck);
        await this.updateStats();
        
        this.showToast('Undo successful');
    }

    async toggleFlag() {
        const card = this.reviewCards[this.currentCardIndex];
        if (!card) return;
        
        const newFlags = card.flags === 0 ? 1 : 0;
        await storage.updateCard(card.id, { flags: newFlags });
        
        this.showToast(newFlags ? 'Card flagged' : 'Card unflagged');
    }

    async toggleMark() {
        const card = this.reviewCards[this.currentCardIndex];
        if (!card) return;
        
        // Use bit 1 for marked (assuming flag uses bit 0)
        const isMarked = (card.flags & 2) === 2;
        const newFlags = isMarked ? card.flags & ~2 : card.flags | 2;
        
        await storage.updateCard(card.id, { flags: newFlags });
        
        this.showToast(isMarked ? 'Card unmarked' : 'Card marked');
    }

    showCardOptions(button) {
        // Create context menu
        const menu = document.getElementById('context-menu');
        menu.innerHTML = `
            <div class="context-item" data-action="bury">Bury Card</div>
            <div class="context-item" data-action="suspend">Suspend Card</div>
            <div class="context-item" data-action="edit">Edit Card</div>
            <div class="context-item" data-action="delete">Delete Card</div>
        `;
        
        const rect = button.getBoundingClientRect();
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;
        menu.classList.add('active');
        
        // Handle clicks
        menu.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;
                await this.handleCardAction(action);
                menu.classList.remove('active');
            });
        });
        
        // Close on outside click
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== button) {
                    menu.classList.remove('active');
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    async handleCardAction(action) {
        const card = this.reviewCards[this.currentCardIndex];
        if (!card) return;
        
        switch(action) {
            case 'bury':
                await storage.updateCard(card.id, { queue: -2 });
                this.showToast('Card buried');
                break;
            case 'suspend':
                await storage.updateCard(card.id, { queue: -1 });
                this.showToast('Card suspended');
                break;
            case 'edit':
                // Would open edit modal
                break;
            case 'delete':
                if (confirm('Delete this card?')) {
                    await storage.deleteCard(card.id);
                    this.showToast('Card deleted');
                }
                break;
        }
        
        // Reload review
        await this.startReview();
    }

    async showCreateDeckModal() {
        const name = prompt('Enter deck name:');
        if (name && name.trim()) {
            try {
                await storage.createDeck(name.trim());
                await this.loadDecks();
                this.showToast('Deck created');
            } catch (error) {
                this.showError('Failed to create deck');
            }
        }
    }

    async sync() {
        // Simple sync - just update stats
        await this.loadDecks();
        await this.updateStats();
        this.showToast('Synced');
    }

    toggleDarkMode(enabled) {
        document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
        storage.saveSetting('theme', enabled ? 'dark' : 'light');
    }

    async exportData() {
        try {
            const data = await storage.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `anki-export-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showToast('Data exported');
        } catch (error) {
            this.showError('Export failed');
        }
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                await storage.importData(text);
                this.showToast('Data imported successfully');
                location.reload();
            } catch (error) {
                this.showError('Import failed');
            }
        };
        
        input.click();
    }

    handleKeyboardShortcut(e) {
        // Don't trigger in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case ' ':
            case 'Enter':
                if (this.currentView === 'review') {
                    e.preventDefault();
                    this.showAnswer();
                }
                break;
            case '1':
                if (this.currentView === 'review') this.answerCard(1);
                break;
            case '2':
                if (this.currentView === 'review') this.answerCard(2);
                break;
            case '3':
                if (this.currentView === 'review') this.answerCard(3);
                break;
            case '4':
                if (this.currentView === 'review') this.answerCard(4);
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.undoAnswer();
                }
                break;
            case 'Escape':
                this.closeAllModals();
                break;
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        document.getElementById('modal-overlay').classList.remove('active');
        document.getElementById('context-menu').classList.remove('active');
    }

    showToast(message) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showError(message) {
        const error = document.createElement('div');
        error.className = 'toast error';
        error.textContent = `Error: ${message}`;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(error);
        
        setTimeout(() => {
            error.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => error.remove(), 300);
        }, 5000);
    }

    hapticFeedback() {
        // Simple vibration for mobile
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    toggleSidebar() {
        // Would toggle sidebar in full implementation
        console.log('Toggle sidebar');
    }

    async loadBrowser() {
        // Load cards for browser
        const cards = await storage.getAllCards();
        const results = document.getElementById('browser-results');
        results.innerHTML = '';
        
        for (const card of cards.slice(0, 50)) { // Limit to 50
            const note = await storage.getNote(card.noteId);
            const deck = await storage.getDeck(card.deckId);
            
            const cardElement = document.createElement('div');
            cardElement.className = 'browser-card';
            cardElement.innerHTML = `
                <div class="browser-card-content">
                    ${Object.values(note.fields)[0]?.substring(0, 100)}...
                </div>
                <div class="browser-card-meta">
                    <span>${deck?.name || 'Unknown'}</span>
                    <span>Due: ${scheduler.formatInterval(card.interval)}</span>
                </div>
            `;
            
            results.appendChild(cardElement);
        }
    }

    async loadStats() {
        // Simple stats display
        const decks = await storage.getAllDecks();
        const statsList = document.getElementById('deck-stats-list');
        statsList.innerHTML = '';
        
        for (const deck of decks) {
            const statElement = document.createElement('div');
            statElement.className = 'deck-stat-item';
            statElement.innerHTML = `
                <span class="deck-stat-name">${deck.name}</span>
                <span class="deck-stat-value">
                    ${deck.stats?.total || 0} cards
                </span>
            `;
            statsList.appendChild(statElement);
        }
    }
}

// Create global app instance
window.app = new AnkiApp();

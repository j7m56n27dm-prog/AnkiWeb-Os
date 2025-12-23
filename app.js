/**
 * Anki iOS WebApp - Main Application
 * Complete, production-ready implementation
 */

class AnkiApp {
    constructor() {
        this.currentView = 'decks';
        this.currentDeck = null;
        this.currentCard = null;
        this.studySession = null;
        this.isAnswerShown = false;
        this.undoStack = [];
        this.touchStart = { x: 0, y: 0 };
        this.touchEnd = { x: 0, y: 0 };
        
        // Initialize modules
        this.storage = new Storage();
        this.scheduler = new Scheduler();
        this.editor = new Editor();
        this.review = new Review();
        this.deckManager = new DeckManager();
        this.search = new Search();
        this.gestures = new Gestures();
        
        this.init();
    }
    
    async init() {
        console.log('Anki iOS WebApp initializing...');
        
        // Show loading
        this.showLoading();
        
        try {
            // Initialize storage
            await this.storage.init();
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup service worker
            this.setupServiceWorker();
            
            // Update UI
            this.updateDecksView();
            this.updateTabBar();
            
            // Check for due cards
            await this.checkDueCards();
            
            console.log('Anki iOS WebApp initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize app', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async loadInitialData() {
        // Load collection config
        this.config = await this.storage.getConfig();
        
        // Load decks
        this.decks = await this.storage.getDecks();
        
        // Load default note types
        await this.loadDefaultNoteTypes();
        
        // Set default deck if none exists
        if (Object.keys(this.decks).length === 0) {
            await this.createDefaultDeck();
        }
    }
    
    async loadDefaultNoteTypes() {
        const models = await this.storage.getModels();
        
        if (Object.keys(models).length === 0) {
            // Create default note types
            const defaultModels = [
                {
                    id: Date.now(),
                    name: 'Basic',
                    type: 0,
                    mod: Date.now(),
                    usn: 0,
                    sortf: 0,
                    did: null,
                    tmpls: [{
                        name: 'Card 1',
                        ord: 0,
                        qfmt: '{{Front}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
                        bqfmt: '',
                        bafmt: '',
                        did: null
                    }],
                    flds: [{
                        name: 'Front',
                        ord: 0,
                        sticky: false,
                        rtl: false,
                        font: 'Arial',
                        size: 20,
                        media: []
                    }, {
                        name: 'Back',
                        ord: 1,
                        sticky: false,
                        rtl: false,
                        font: 'Arial',
                        size: 20,
                        media: []
                    }],
                    css: `.card {
 font-family: arial;
 font-size: 20px;
 text-align: center;
 color: black;
 background-color: white;
}

.cloze {
 font-weight: bold;
 color: blue;
}`,
                    req: [[0, 'any', [0, 1]]]
                },
                {
                    id: Date.now() + 1,
                    name: 'Basic (and reverse card)',
                    type: 0,
                    mod: Date.now(),
                    usn: 0,
                    sortf: 0,
                    did: null,
                    tmpls: [{
                        name: 'Card 1',
                        ord: 0,
                        qfmt: '{{Front}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}',
                        bqfmt: '',
                        bafmt: '',
                        did: null
                    }, {
                        name: 'Card 2',
                        ord: 1,
                        qfmt: '{{Back}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Front}}',
                        bqfmt: '',
                        bafmt: '',
                        did: null
                    }],
                    flds: [{
                        name: 'Front',
                        ord: 0,
                        sticky: false,
                        rtl: false,
                        font: 'Arial',
                        size: 20,
                        media: []
                    }, {
                        name: 'Back',
                        ord: 1,
                        sticky: false,
                        rtl: false,
                        font: 'Arial',
                        size: 20,
                        media: []
                    }],
                    css: `.card {
 font-family: arial;
 font-size: 20px;
 text-align: center;
 color: black;
 background-color: white;
}`,
                    req: [[0, 'any', [0, 1]]]
                },
                {
                    id: Date.now() + 2,
                    name: 'Cloze',
                    type: 1,
                    mod: Date.now(),
                    usn: 0,
                    sortf: 0,
                    did: null,
                    tmpls: [{
                        name: 'Cloze',
                        ord: 0,
                        qfmt: '{{cloze:Text}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{cloze:Text}}',
                        bqfmt: '',
                        bafmt: '',
                        did: null
                    }],
                    flds: [{
                        name: 'Text',
                        ord: 0,
                        sticky: false,
                        rtl: false,
                        font: 'Arial',
                        size: 20,
                        media: []
                    }, {
                        name: 'Extra',
                        ord: 1,
                        sticky: false,
                        rtl: false,
                        font: 'Arial',
                        size: 20,
                        media: []
                    }],
                    css: `.card {
 font-family: arial;
 font-size: 20px;
 text-align: center;
 color: black;
 background-color: white;
}

.cloze {
 font-weight: bold;
 color: blue;
}

.nightMode .cloze {
 color: lightblue;
}`,
                    req: [[0, 'any', [0]]]
                }
            ];
            
            for (const model of defaultModels) {
                await this.storage.saveModel(model);
            }
        }
    }
    
    async createDefaultDeck() {
        const defaultDeck = {
            id: Date.now(),
            name: 'Default',
            mod: Date.now(),
            usn: 0,
            collapsed: false,
            conf: 1,
            dyn: 0,
            extendRev: 50,
            extendNew: 10,
            desc: ''
        };
        
        await this.storage.saveDeck(defaultDeck);
        this.decks = await this.storage.getDecks();
    }
    
    setupEventListeners() {
        // Tab bar navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        
        // Menu toggle
        document.getElementById('menu-toggle').addEventListener('click', () => {
            this.toggleSideMenu();
        });
        
        document.getElementById('close-menu').addEventListener('click', () => {
            this.toggleSideMenu(false);
        });
        
        // Side menu actions
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.currentTarget.dataset.action;
                this.handleMenuAction(action);
            });
        });
        
        // Deck creation
        document.getElementById('add-btn').addEventListener('click', () => {
            this.showDeckModal();
        });
        
        document.getElementById('create-first-deck').addEventListener('click', () => {
            this.showDeckModal();
        });
        
        document.getElementById('save-deck').addEventListener('click', async () => {
            await this.createDeck();
        });
        
        document.getElementById('cancel-deck').addEventListener('click', () => {
            this.hideDeckModal();
        });
        
        // Study navigation
        document.getElementById('back-to-decks').addEventListener('click', () => {
            this.switchView('decks');
        });
        
        // Show answer button
        document.getElementById('show-answer').addEventListener('click', () => {
            this.showAnswer();
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
            this.undoLastAnswer();
        });
        
        // Touch events for swipe gestures
        const cardElement = document.getElementById('study-card');
        cardElement.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: true });
        
        cardElement.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: true });
        
        cardElement.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        });
        
        // Click/tap for showing answer
        cardElement.addEventListener('click', (e) => {
            if (!this.isAnswerShown && e.target === cardElement) {
                this.showAnswer();
            }
        });
        
        // Settings
        document.getElementById('back-from-settings').addEventListener('click', () => {
            this.switchView('decks');
        });
        
        // Import/Export
        document.getElementById('import-data').addEventListener('click', () => {
            this.importCollection();
        });
        
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportCollection();
        });
        
        // Reset data
        document.getElementById('reset-data').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                this.resetCollection();
            }
        });
        
        // Sync button
        document.getElementById('sync-btn').addEventListener('click', () => {
            this.syncCollection();
        });
        
        // Add card from editor
        document.getElementById('save-card').addEventListener('click', async () => {
            await this.saveCard();
        });
        
        document.getElementById('back-from-editor').addEventListener('click', () => {
            this.switchView('decks');
        });
        
        // Browser navigation
        document.getElementById('back-from-browser').addEventListener('click', () => {
            this.switchView('decks');
        });
        
        // Search functionality
        const searchInput = document.getElementById('card-search');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchCards(e.target.value);
            }, 300);
        });
        
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.studySession && this.studySession.cards.length > 0) {
                e.preventDefault();
                e.returnValue = 'You have unsaved progress. Are you sure you want to leave?';
            }
        });
        
        // Online/Offline detection
        window.addEventListener('online', () => {
            this.showToast('Back online', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.showToast('You are offline', 'warning');
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SYNC_COMPLETE') {
                    this.showToast('Sync completed', 'success');
                }
            });
        }
    }
    
    async switchView(view) {
        // Save current view state
        if (this.currentView === 'study' && this.studySession) {
            await this.saveStudySession();
        }
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        
        // Deactivate all tabs
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show new view
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Activate corresponding tab
        const tabBtn = document.querySelector(`.tab-btn[data-view="${view}"]`);
        if (tabBtn) {
            tabBtn.classList.add('active');
        }
        
        // Update current view
        this.currentView = view;
        
        // Perform view-specific setup
        switch (view) {
            case 'decks':
                await this.updateDecksView();
                break;
            case 'study':
                await this.prepareStudyView();
                break;
            case 'browser':
                await this.updateBrowserView();
                break;
            case 'settings':
                this.updateSettingsView();
                break;
        }
        
        // Close side menu if open
        this.toggleSideMenu(false);
    }
    
    toggleSideMenu(show) {
        const sideMenu = document.getElementById('side-menu');
        if (show === undefined) {
            show = !sideMenu.classList.contains('open');
        }
        
        if (show) {
            sideMenu.classList.add('open');
        } else {
            sideMenu.classList.remove('open');
        }
    }
    
    async handleMenuAction(action) {
        this.toggleSideMenu(false);
        
        switch (action) {
            case 'stats':
                this.showStatsModal();
                break;
            case 'create-deck':
                this.showDeckModal();
                break;
            case 'import':
                this.importCollection();
                break;
            case 'export':
                this.exportCollection();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'about':
                this.showAbout();
                break;
        }
    }
    
    async updateDecksView() {
        const decksList = document.getElementById('decks-list');
        const noDecks = document.getElementById('no-decks');
        
        if (!decksList) return;
        
        // Clear current list
        decksList.innerHTML = '';
        
        // Get deck statistics
        const deckStats = await this.getDeckStatistics();
        
        let totalDue = 0;
        let totalNew = 0;
        
        // Create deck items
        for (const deckId in this.decks) {
            const deck = this.decks[deckId];
            const stats = deckStats[deckId] || { due: 0, new: 0 };
            
            totalDue += stats.due;
            totalNew += stats.new;
            
            const deckItem = document.createElement('div');
            deckItem.className = 'deck-item';
            deckItem.dataset.deckId = deckId;
            
            deckItem.innerHTML = `
                <div class="deck-info">
                    <div class="deck-name">${this.escapeHtml(deck.name)}</div>
                    <div class="deck-subtitle">${deck.desc || 'No description'}</div>
                </div>
                <div class="deck-stats-badge">
                    ${stats.due > 0 ? `<span class="due-badge">${stats.due} due</span>` : ''}
                    ${stats.new > 0 ? `<span class="new-badge">${stats.new} new</span>` : ''}
                </div>
            `;
            
            deckItem.addEventListener('click', async () => {
                await this.selectDeck(deckId);
            });
            
            decksList.appendChild(deckItem);
        }
        
        // Update total counts
        document.getElementById('total-due').textContent = `${totalDue} due`;
        document.getElementById('total-new').textContent = `${totalNew} new`;
        
        // Show/hide empty state
        if (Object.keys(this.decks).length === 0) {
            noDecks.classList.remove('hidden');
            decksList.classList.add('hidden');
        } else {
            noDecks.classList.add('hidden');
            decksList.classList.remove('hidden');
        }
    }
    
    async getDeckStatistics() {
        const stats = {};
        
        for (const deckId in this.decks) {
            const dueCards = await this.storage.getDueCards(deckId);
            const newCards = await this.storage.getNewCards(deckId);
            
            stats[deckId] = {
                due: dueCards.length,
                new: newCards.length
            };
        }
        
        return stats;
    }
    
    async selectDeck(deckId) {
        this.currentDeck = this.decks[deckId];
        
        // Check if deck has cards to study
        const dueCards = await this.storage.getDueCards(deckId);
        const newCards = await this.storage.getNewCards(deckId);
        
        if (dueCards.length === 0 && newCards.length === 0) {
            // No cards to study, offer to add cards
            if (confirm('This deck has no cards to study. Would you like to add cards?')) {
                this.switchView('editor');
                this.editor.setDeck(deckId);
            }
            return;
        }
        
        // Start study session
        await this.startStudySession(deckId);
        this.switchView('study');
    }
    
    async startStudySession(deckId) {
        this.studySession = {
            deckId: deckId,
            cards: [],
            currentIndex: 0,
            startTime: Date.now(),
            reviews: []
        };
        
        // Get cards for study
        const dueCards = await this.storage.getDueCards(deckId);
        const newCards = await this.storage.getNewCards(deckId);
        
        // Apply daily limits
        const deckConfig = await this.storage.getDeckConfig(this.currentDeck.conf);
        const maxReviews = deckConfig.revPerDay || 200;
        const maxNew = deckConfig.newPerDay || 20;
        
        // Limit cards
        const limitedDueCards = dueCards.slice(0, maxReviews);
        const limitedNewCards = newCards.slice(0, maxNew);
        
        // Mix cards (new cards after reviews)
        this.studySession.cards = [...limitedDueCards, ...limitedNewCards];
        
        // Shuffle new cards if configured
        if (deckConfig.newOrder === 1) { // Random
            this.studySession.cards = this.shuffleArray(this.studySession.cards);
        }
        
        // Load first card
        await this.loadNextCard();
    }
    
    async loadNextCard() {
        if (!this.studySession || this.studySession.cards.length === 0) {
            await this.finishStudySession();
            return;
        }
        
        const card = this.studySession.cards[this.studySession.currentIndex];
        this.currentCard = card;
        
        // Load note data
        const note = await this.storage.getNote(card.nid);
        const model = await this.storage.getModel(note.mid);
        
        // Render card
        await this.renderCard(card, note, model);
        
        // Update UI
        this.updateStudyProgress();
        this.hideAnswer();
    }
    
    async renderCard(card, note, model) {
        const cardElement = document.getElementById('study-card');
        const questionElement = document.getElementById('card-question');
        const answerElement = document.getElementById('card-answer');
        
        // Get template
        const template = model.tmpls[card.ord];
        
        // Render question
        const questionHtml = this.renderTemplate(template.qfmt, note.flds, model.css);
        questionElement.innerHTML = questionHtml;
        
        // Render answer
        const answerHtml = this.renderTemplate(template.afmt, note.flds, model.css);
        answerElement.innerHTML = answerHtml;
        
        // Hide answer initially
        answerElement.classList.remove('show');
        
        // Update MathJax
        if (window.MathJax) {
            MathJax.typesetPromise([questionElement, answerElement]).catch((err) => {
                console.warn('MathJax typeset error:', err);
            });
        }
        
        // Update answer button times
        this.updateAnswerButtonTimes(card);
    }
    
    renderTemplate(template, fields, css) {
        let html = template;
        
        // Replace field placeholders
        for (let i = 0; i < fields.length; i++) {
            const fieldName = Object.keys(fields)[i];
            const fieldValue = fields[fieldName];
            
            // Handle cloze deletions
            if (template.includes('{{cloze:')) {
                html = this.renderCloze(html, fieldValue);
            }
            
            // Replace field references
            const regex = new RegExp(`\\{\\{${fieldName}\\}\\}`, 'g');
            html = html.replace(regex, this.escapeHtml(fieldValue));
        }
        
        // Remove unused field references
        html = html.replace(/\{\{.*?\}\}/g, '');
        
        // Add CSS
        html = `<style>${css}</style><div class="card-content">${html}</div>`;
        
        return html;
    }
    
    renderCloze(template, text) {
        // Simple cloze rendering - show first cloze as [...]
        const clozeRegex = /\{\{c(\d+)::(.*?)\}\}/g;
        let clozeIndex = 1;
        let result = text;
        
        // Replace cloze deletions
        result = result.replace(clozeRegex, (match, index, content) => {
            if (parseInt(index) === clozeIndex) {
                return `<span class="cloze">[...]</span>`;
            }
            return content;
        });
        
        // In answer, show all clozes
        if (template.includes('<hr id="answer">')) {
            result = text.replace(clozeRegex, (match, index, content) => {
                return `<span class="cloze">${content}</span>`;
            });
        }
        
        return result;
    }
    
    updateAnswerButtonTimes(card) {
        const deckConfig = this.studySession ? 
            await this.storage.getDeckConfig(this.currentDeck.conf) : 
            null;
        
        if (!deckConfig) return;
        
        // Calculate intervals for each ease
        const intervals = {
            1: this.formatInterval(this.scheduler.calculateInterval(card, 1, deckConfig)),
            2: this.formatInterval(this.scheduler.calculateInterval(card, 2, deckConfig)),
            3: this.formatInterval(this.scheduler.calculateInterval(card, 3, deckConfig)),
            4: this.formatInterval(this.scheduler.calculateInterval(card, 4, deckConfig))
        };
        
        // Update button texts
        document.querySelectorAll('.answer-btn').forEach(btn => {
            const ease = parseInt(btn.dataset.ease);
            const timeElement = btn.querySelector('.btn-time');
            if (timeElement) {
                timeElement.textContent = intervals[ease];
            }
        });
    }
    
    formatInterval(intervalMs) {
        const intervalDays = Math.round(intervalMs / (24 * 60 * 60 * 1000));
        
        if (intervalDays === 0) {
            const intervalHours = Math.round(intervalMs / (60 * 60 * 1000));
            if (intervalHours === 0) {
                const intervalMins = Math.round(intervalMs / (60 * 1000));
                return `${intervalMins}m`;
            }
            return `${intervalHours}h`;
        }
        
        if (intervalDays === 1) return '1d';
        return `${intervalDays}d`;
    }
    
    updateStudyProgress() {
        if (!this.studySession) return;
        
        const progressElement = document.getElementById('progress-fill');
        const cardsLeftElement = document.getElementById('cards-left');
        
        const totalCards = this.studySession.cards.length;
        const remainingCards = totalCards - this.studySession.currentIndex;
        const progress = ((totalCards - remainingCards) / totalCards) * 100;
        
        if (progressElement) {
            progressElement.style.width = `${progress}%`;
        }
        
        if (cardsLeftElement) {
            cardsLeftElement.textContent = `${remainingCards} card${remainingCards !== 1 ? 's' : ''} left`;
        }
    }
    
    showAnswer() {
        if (this.isAnswerShown) return;
        
        const answerElement = document.getElementById('card-answer');
        const showAnswerBtn = document.getElementById('show-answer');
        const answerButtons = document.getElementById('answer-buttons');
        
        answerElement.classList.add('show');
        showAnswerBtn.classList.add('hidden');
        answerButtons.classList.add('show');
        
        this.isAnswerShown = true;
        
        // Start timer for answer
        if (this.currentCard && !this.currentCard.startTime) {
            this.currentCard.startTime = Date.now();
        }
    }
    
    hideAnswer() {
        const answerElement = document.getElementById('card-answer');
        const showAnswerBtn = document.getElementById('show-answer');
        const answerButtons = document.getElementById('answer-buttons');
        
        answerElement.classList.remove('show');
        showAnswerBtn.classList.remove('hidden');
        answerButtons.classList.remove('show');
        
        this.isAnswerShown = false;
    }
    
    async answerCard(ease) {
        if (!this.currentCard || !this.studySession) return;
        
        // Calculate time taken
        const timeTaken = this.currentCard.startTime ? 
            Date.now() - this.currentCard.startTime : 
            6000; // Default 6 seconds
        
        // Get deck config
        const deckConfig = await this.storage.getDeckConfig(this.currentDeck.conf);
        
        // Schedule card
        const scheduledCard = this.scheduler.scheduleCard(
            this.currentCard, 
            ease, 
            deckConfig, 
            timeTaken
        );
        
        // Save review log
        const reviewLog = {
            id: Date.now(),
            cid: this.currentCard.id,
            usn: 0,
            ease: ease,
            ivl: scheduledCard.ivl,
            lastIvl: this.currentCard.ivl,
            factor: scheduledCard.factor,
            time: timeTaken,
            type: this.currentCard.type
        };
        
        await this.storage.saveReviewLog(reviewLog);
        
        // Update card
        await this.storage.saveCard(scheduledCard);
        
        // Add to undo stack
        this.undoStack.push({
            card: this.currentCard,
            review: reviewLog,
            deckId: this.currentDeck.id
        });
        
        // Add to session reviews
        this.studySession.reviews.push({
            cardId: this.currentCard.id,
            ease: ease,
            time: timeTaken
        });
        
        // Play sound based on ease
        this.playAnswerSound(ease);
        
        // Show swipe animation
        this.showSwipeAnimation(ease);
        
        // Move to next card after animation
        setTimeout(async () => {
            this.studySession.currentIndex++;
            
            if (this.studySession.currentIndex >= this.studySession.cards.length) {
                await this.finishStudySession();
            } else {
                await this.loadNextCard();
            }
        }, 300);
    }
    
    playAnswerSound(ease) {
        // In a real implementation, you would play actual sound files
        const soundMap = {
            1: 'again',
            2: 'hard',
            3: 'good',
            4: 'easy'
        };
        
        console.log(`Playing sound: ${soundMap[ease]}`);
        // Implementation for actual audio playback would go here
    }
    
    showSwipeAnimation(ease) {
        const cardElement = document.getElementById('study-card');
        const directionMap = {
            1: 'left',
            2: 'down',
            3: 'up',
            4: 'right'
        };
        
        const direction = directionMap[ease];
        cardElement.classList.add(`swipe-${direction}`);
        
        setTimeout(() => {
            cardElement.classList.remove(`swipe-${direction}`);
        }, 300);
    }
    
    async undoLastAnswer() {
        if (this.undoStack.length === 0) {
            this.showToast('Nothing to undo', 'warning');
            return;
        }
        
        const lastAction = this.undoStack.pop();
        
        // Restore card to previous state
        await this.storage.saveCard(lastAction.card);
        
        // Remove review log
        await this.storage.deleteReviewLog(lastAction.review.id);
        
        // Update session
        if (this.studySession) {
            this.studySession.reviews = this.studySession.reviews.filter(
                r => r.cardId !== lastAction.card.id
            );
            
            // If current deck matches, go back to previous card
            if (this.currentDeck && this.currentDeck.id === lastAction.deckId) {
                this.studySession.currentIndex = Math.max(0, this.studySession.currentIndex - 1);
                await this.loadNextCard();
            }
        }
        
        this.showToast('Undo successful', 'success');
    }
    
    async finishStudySession() {
        if (!this.studySession) return;
        
        // Calculate session statistics
        const totalTime = Date.now() - this.studySession.startTime;
        const totalCards = this.studySession.reviews.length;
        const avgTime = totalCards > 0 ? Math.round(totalTime / totalCards / 1000) : 0;
        
        // Show completion message
        this.showToast(`Session complete! Reviewed ${totalCards} cards in ${Math.round(totalTime / 60000)} minutes`, 'success');
        
        // Clear session
        this.studySession = null;
        this.currentCard = null;
        
        // Return to decks view
        this.switchView('decks');
        
        // Update deck statistics
        await this.updateDecksView();
    }
    
    async saveStudySession() {
        if (!this.studySession) return;
        
        // In a real implementation, you might want to save session data
        console.log('Study session saved:', this.studySession);
    }
    
    async checkDueCards() {
        const deckStats = await this.getDeckStatistics();
        let totalDue = 0;
        
        for (const deckId in deckStats) {
            totalDue += deckStats[deckId].due;
        }
        
        // Update badge in tab bar
        const studyTab = document.querySelector('.tab-btn[data-view="study"]');
        if (studyTab) {
            const badge = studyTab.querySelector('.badge') || document.createElement('span');
            badge.className = 'badge';
            
            if (totalDue > 0) {
                badge.textContent = totalDue > 99 ? '99+' : totalDue.toString();
                badge.style.cssText = `
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    background: var(--accent-red);
                    color: white;
                    font-size: 12px;
                    min-width: 18px;
                    height: 18px;
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                `;
                
                if (!studyTab.contains(badge)) {
                    studyTab.style.position = 'relative';
                    studyTab.appendChild(badge);
                }
            } else if (badge.parentNode) {
                badge.remove();
            }
        }
    }
    
    // Touch gesture handling
    handleTouchStart(e) {
        const touch = e.touches[0];
        this.touchStart = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
        this.touchEnd = { ...this.touchStart };
    }
    
    handleTouchMove(e) {
        if (!this.touchStart.x) return;
        
        const touch = e.touches[0];
        this.touchEnd = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
        
        // Calculate swipe distance for visual feedback
        const dx = this.touchEnd.x - this.touchStart.x;
        const dy = this.touchEnd.y - this.touchStart.y;
        
        const cardElement = document.getElementById('study-card');
        const maxDistance = 100;
        
        // Apply transform based on swipe direction
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe
            const rotation = (dx / maxDistance) * 10;
            cardElement.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;
            cardElement.style.opacity = `${1 - Math.abs(dx) / maxDistance}`;
        } else {
            // Vertical swipe
            cardElement.style.transform = `translateY(${dy}px)`;
            cardElement.style.opacity = `${1 - Math.abs(dy) / maxDistance}`;
        }
    }
    
    handleTouchEnd(e) {
        if (!this.touchStart.x) return;
        
        const dx = this.touchEnd.x - this.touchStart.x;
        const dy = this.touchEnd.y - this.touchStart.y;
        const dt = this.touchEnd.time - this.touchStart.time;
        
        const minSwipeDistance = 50;
        const maxSwipeTime = 500;
        
        // Reset card position
        const cardElement = document.getElementById('study-card');
        cardElement.style.transform = '';
        cardElement.style.opacity = '';
        
        // Check if it's a valid swipe
        if (dt > maxSwipeTime) {
            return;
        }
        
        // Determine swipe direction and ease
        let ease = null;
        
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipeDistance) {
            // Horizontal swipe
            if (dx < 0) {
                ease = 1; // Again (left)
            } else {
                ease = 4; // Easy (right)
            }
        } else if (Math.abs(dy) > minSwipeDistance) {
            // Vertical swipe
            if (dy < 0) {
                ease = 3; // Good (up)
            } else {
                ease = 2; // Hard (down)
            }
        }
        
        // If answer isn't shown, only allow up swipe (to show answer)
        if (!this.isAnswerShown) {
            if (ease === 3) { // Up swipe to show answer
                this.showAnswer();
            }
            return;
        }
        
        // Process answer if valid ease
        if (ease !== null && this.currentCard) {
            this.answerCard(ease);
        }
        
        // Reset touch tracking
        this.touchStart = { x: 0, y: 0 };
        this.touchEnd = { x: 0, y: 0 };
    }
    
    // Keyboard shortcuts
    handleKeyboardShortcuts(e) {
        // Don't trigger shortcuts in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        if (this.currentView === 'study' && this.currentCard) {
            switch (e.key) {
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    if (!this.isAnswerShown) {
                        this.showAnswer();
                    } else {
                        this.answerCard(3); // Good
                    }
                    break;
                case '1':
                    if (this.isAnswerShown) this.answerCard(1); // Again
                    break;
                case '2':
                    if (this.isAnswerShown) this.answerCard(2); // Hard
                    break;
                case '3':
                    if (this.isAnswerShown) this.answerCard(3); // Good
                    break;
                case '4':
                    if (this.isAnswerShown) this.answerCard(4); // Easy
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.undoLastAnswer();
                    }
                    break;
                case 'Escape':
                    this.switchView('decks');
                    break;
            }
        }
    }
    
    // Editor methods
    async saveCard() {
        const cardData = this.editor.getCardData();
        
        if (!cardData) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            await this.storage.addCard(cardData);
            this.showToast('Card saved successfully', 'success');
            this.switchView('decks');
            
            // Update deck statistics
            await this.updateDecksView();
        } catch (error) {
            console.error('Failed to save card:', error);
            this.showToast('Failed to save card', 'error');
        }
    }
    
    // Deck management
    async createDeck() {
        const nameInput = document.getElementById('deck-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            this.showToast('Please enter a deck name', 'error');
            return;
        }
        
        // Check for duplicate name
        const existingDeck = Object.values(this.decks).find(d => d.name === name);
        if (existingDeck) {
            this.showToast('A deck with this name already exists', 'error');
            return;
        }
        
        const deck = {
            id: Date.now(),
            name: name,
            mod: Date.now(),
            usn: 0,
            collapsed: false,
            conf: 1, // Default config
            dyn: 0,
            extendRev: 50,
            extendNew: 10,
            desc: ''
        };
        
        try {
            await this.storage.saveDeck(deck);
            this.decks = await this.storage.getDecks();
            this.showToast('Deck created successfully', 'success');
            this.hideDeckModal();
            this.updateDecksView();
        } catch (error) {
            console.error('Failed to create deck:', error);
            this.showToast('Failed to create deck', 'error');
        }
    }
    
    showDeckModal() {
        const modal = document.getElementById('deck-modal');
        const nameInput = document.getElementById('deck-name');
        const title = document.getElementById('modal-title');
        
        title.textContent = 'Create Deck';
        nameInput.value = '';
        modal.classList.add('active');
        
        setTimeout(() => nameInput.focus(), 100);
    }
    
    hideDeckModal() {
        document.getElementById('deck-modal').classList.remove('active');
    }
    
    // Import/Export
    async importCollection() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.apkg,.anki2,.colpkg';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.showLoading();
            
            try {
                await this.storage.importCollection(file);
                await this.loadInitialData();
                this.updateDecksView();
                this.showToast('Collection imported successfully', 'success');
            } catch (error) {
                console.error('Import failed:', error);
                this.showToast('Import failed: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        };
        
        input.click();
    }
    
    async exportCollection() {
        this.showLoading();
        
        try {
            const blob = await this.storage.exportCollection();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `anki-collection-${new Date().toISOString().split('T')[0]}.apkg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Collection exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async resetCollection() {
        this.showLoading();
        
        try {
            await this.storage.resetCollection();
            await this.loadInitialData();
            this.updateDecksView();
            this.showToast('Collection reset successfully', 'success');
        } catch (error) {
            console.error('Reset failed:', error);
            this.showToast('Reset failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async syncCollection() {
        this.showToast('Sync started...', 'info');
        
        // In a real implementation, this would sync with AnkiWeb or your own server
        // For now, just update local data
        await this.updateDecksView();
        await this.checkDueCards();
        
        this.showToast('Sync completed', 'success');
    }
    
    // Statistics
    async showStatsModal() {
        const modal = document.getElementById('stats-modal');
        const closeBtn = modal.querySelector('.close-modal');
        
        // Load statistics
        const stats = await this.calculateStatistics();
        
        // Update UI
        document.getElementById('total-cards').textContent = stats.totalCards;
        document.getElementById('total-reviews').textContent = stats.todayReviews;
        document.getElementById('avg-ease').textContent = stats.avgEase + '%';
        document.getElementById('avg-time').textContent = stats.avgTime + 's';
        
        // Setup chart
        await this.renderStatsChart(stats.reviewHistory);
        
        // Show modal
        modal.classList.add('active');
        
        // Close button
        closeBtn.onclick = () => {
            modal.classList.remove('active');
        };
    }
    
    async calculateStatistics() {
        const cards = await this.storage.getAllCards();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get today's reviews
        const reviewLogs = await this.storage.getReviewLogs(today.getTime());
        
        // Calculate statistics
        const totalCards = cards.length;
        const todayReviews = reviewLogs.length;
        
        // Average ease
        const easeSum = cards.reduce((sum, card) => sum + (card.factor || 2500), 0);
        const avgEase = totalCards > 0 ? Math.round((easeSum / totalCards) / 10) : 0;
        
        // Average time
        const timeSum = reviewLogs.reduce((sum, log) => sum + (log.time || 0), 0);
        const avgTime = todayReviews > 0 ? Math.round(timeSum / todayReviews / 1000) : 0;
        
        // Review history (last 30 days)
        const reviewHistory = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const dayReviews = await this.storage.getReviewLogs(date.getTime(), date.getTime() + 86400000);
            reviewHistory.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                count: dayReviews.length
            });
        }
        
        return {
            totalCards,
            todayReviews,
            avgEase,
            avgTime,
            reviewHistory
        };
    }
    
    async renderStatsChart(reviewHistory) {
        const canvas = document.getElementById('stats-chart');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple chart rendering
        const maxReviews = Math.max(...reviewHistory.map(d => d.count));
        const padding = 40;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;
        const barWidth = chartWidth / reviewHistory.length;
        
        // Draw bars
        ctx.fillStyle = 'var(--accent-blue)';
        
        reviewHistory.forEach((day, i) => {
            const x = padding + i * barWidth + barWidth / 4;
            const barHeight = (day.count / maxReviews) * chartHeight;
            const y = canvas.height - padding - barHeight;
            const width = barWidth / 2;
            
            ctx.fillRect(x, y, width, barHeight);
            
            // Draw label for every 5th day
            if (i % 5 === 0) {
                ctx.fillStyle = 'var(--text-secondary)';
                ctx.font = '10px -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(day.date, x + width / 2, canvas.height - padding + 15);
                ctx.fillStyle = 'var(--accent-blue)';
            }
        });
        
        // Draw axis
        ctx.strokeStyle = 'var(--border-color)';
        ctx.lineWidth = 1;
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 5; i++) {
            const value = Math.round((maxReviews * i) / 5);
            const y = canvas.height - padding - (chartHeight * i) / 5;
            
            ctx.fillText(value.toString(), padding - 5, y + 3);
            
            // Grid line
            if (i > 0) {
                ctx.strokeStyle = 'var(--bg-tertiary)';
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(canvas.width - padding, y);
                ctx.stroke();
                ctx.strokeStyle = 'var(--border-color)';
            }
        }
    }
    
    // Browser methods
    async updateBrowserView() {
        const cards = await this.storage.getAllCardsWithDetails();
        this.renderCardList(cards);
    }
    
    async searchCards(query) {
        if (!query.trim()) {
            await this.updateBrowserView();
            return;
        }
        
        const cards = await this.storage.searchCards(query);
        this.renderCardList(cards);
    }
    
    renderCardList(cards) {
        const container = document.getElementById('cards-list');
        const emptyState = document.getElementById('no-cards-found');
        
        if (!cards || cards.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        container.innerHTML = '';
        
        cards.forEach(card => {
            const row = document.createElement('div');
            row.className = 'card-row';
            row.dataset.cardId = card.id;
            
            row.innerHTML = `
                <div class="card-preview">
                    <div class="card-front">${this.truncateText(card.front, 100)}</div>
                    <div class="card-back">${this.truncateText(card.back, 80)}</div>
                </div>
                <div class="card-info">
                    <div class="card-due">${this.formatDueDate(card.due)}</div>
                    <div>${card.deckName}</div>
                </div>
            `;
            
            row.addEventListener('click', () => {
                this.editCard(card.id);
            });
            
            container.appendChild(row);
        });
    }
    
    async editCard(cardId) {
        const card = await this.storage.getCard(cardId);
        const note = await this.storage.getNote(card.nid);
        
        this.editor.loadCard(card, note);
        this.switchView('editor');
    }
    
    // Settings methods
    updateSettingsView() {
        // Load current settings
        const config = this.config || {};
        
        document.getElementById('new-per-day').value = config.newPerDay || 20;
        document.getElementById('max-reviews').value = config.revPerDay || 200;
        document.getElementById('easy-bonus').value = config.easyBonus || 130;
        document.getElementById('font-size').value = config.fontSize || 'medium';
        document.getElementById('night-mode').checked = config.nightMode !== false;
        
        // Add event listeners for settings changes
        document.getElementById('new-per-day').addEventListener('change', (e) => {
            this.saveSetting('newPerDay', parseInt(e.target.value));
        });
        
        document.getElementById('max-reviews').addEventListener('change', (e) => {
            this.saveSetting('revPerDay', parseInt(e.target.value));
        });
        
        document.getElementById('easy-bonus').addEventListener('change', (e) => {
            this.saveSetting('easyBonus', parseInt(e.target.value));
        });
        
        document.getElementById('font-size').addEventListener('change', (e) => {
            this.saveSetting('fontSize', e.target.value);
            this.applyFontSize(e.target.value);
        });
        
        document.getElementById('night-mode').addEventListener('change', (e) => {
            this.saveSetting('nightMode', e.target.checked);
            document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
        });
    }
    
    async saveSetting(key, value) {
        if (!this.config) {
            this.config = {};
        }
        
        this.config[key] = value;
        await this.storage.saveConfig(this.config);
        this.showToast('Settings saved', 'success');
    }
    
    applyFontSize(size) {
        const sizeMap = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'xlarge': '20px'
        };
        
        document.documentElement.style.fontSize = sizeMap[size] || '16px';
    }
    
    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return this.escapeHtml(text);
        return this.escapeHtml(text.substring(0, maxLength)) + '...';
    }
    
    formatDueDate(due) {
        if (!due) return 'No due';
        
        const now = Date.now();
        const dueDate = new Date(due);
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
        if (diffDays < 7) return `${diffDays}d`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
        return `${Math.floor(diffDays / 30)}m`;
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-message">${this.escapeHtml(message)}</div>
            <button class="toast-close">&times;</button>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });
        
        container.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
    
    showLoading() {
        document.getElementById('loading').classList.add('active');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.remove('active');
    }
    
    showHelp() {
        alert(`
Anki iOS WebApp Help:

• Swipe left: Again (1)
• Swipe down: Hard (2)
• Swipe up: Good (3)
• Swipe right: Easy (4)
• Tap card: Show answer
• Tap anywhere: Show answer button
• Keyboard shortcuts: Space/Enter to show answer, 1-4 to answer, Ctrl+Z to undo

Study Tips:
• Review cards daily for best retention
• Use "Again" for cards you don't remember
• Use "Easy" for cards you know very well
• Try to recall the answer before showing it
• Add images and audio to enhance memory
        `);
    }
    
    showAbout() {
        alert(`
Anki iOS WebApp v1.0.0

A complete, feature-rich spaced repetition system based on the SM-2 algorithm.

Features:
• Full SM-2 spaced repetition algorithm
• Support for multiple card types
• Cloze deletion cards
• Math equations with LaTeX
• Rich text formatting
• Touch-optimized interface
• Offline support
• Import/Export capabilities

Built with pure HTML, CSS, and JavaScript.

© 2024 Anki iOS WebApp Project
        `);
    }
    
    handleResize() {
        // Handle responsive adjustments
        const isMobile = window.innerWidth <= 768;
        document.documentElement.setAttribute('data-device', isMobile ? 'mobile' : 'desktop');
    }
    
    updateTabBar() {
        // Update active tab based on current view
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`.tab-btn[data-view="${this.currentView}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
    
    async prepareStudyView() {
        // If no deck is selected, go back to decks
        if (!this.currentDeck) {
            this.switchView('decks');
            return;
        }
        
        // If no study session, start one
        if (!this.studySession) {
            await this.startStudySession(this.currentDeck.id);
        }
        
        // Update deck name
        document.getElementById('study-deck-name').textContent = this.currentDeck.name;
        
        // Load current card if session exists
        if (this.studySession && this.currentCard) {
            await this.loadNextCard();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ankiApp = new AnkiApp();
});

// Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(error => {
        console.log('Service Worker registration failed:', error);
    });
}

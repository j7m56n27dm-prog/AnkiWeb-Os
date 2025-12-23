// ANKI iOS WebApp - IndexedDB Storage
class Storage {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('anki-ios', 1);
            
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isInitialized = true;
                console.log('IndexedDB initialized successfully');
                resolve();
                
                // Check for existing data or create default deck
                this.ensureDefaultData();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                this.createObjectStores(db);
            };
        });
    }

    createObjectStores(db) {
        // Decks store
        if (!db.objectStoreNames.contains('decks')) {
            const decksStore = db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
            decksStore.createIndex('name', 'name', { unique: false });
            decksStore.createIndex('parentId', 'parentId', { unique: false });
        }
        
        // Cards store
        if (!db.objectStoreNames.contains('cards')) {
            const cardsStore = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
            cardsStore.createIndex('nid', 'nid', { unique: false });
            cardsStore.createIndex('did', 'did', { unique: false });
            cardsStore.createIndex('queue', 'queue', { unique: false });
            cardsStore.createIndex('due', 'due', { unique: false });
            cardsStore.createIndex('type', 'type', { unique: false });
        }
        
        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
            const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
            notesStore.createIndex('mid', 'mid', { unique: false });
            notesStore.createIndex('did', 'did', { unique: false });
            notesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
        
        // Models store
        if (!db.objectStoreNames.contains('models')) {
            const modelsStore = db.createObjectStore('models', { keyPath: 'id', autoIncrement: true });
            modelsStore.createIndex('name', 'name', { unique: true });
        }
        
        // Revlog store
        if (!db.objectStoreNames.contains('revlog')) {
            const revlogStore = db.createObjectStore('revlog', { keyPath: 'id', autoIncrement: true });
            revlogStore.createIndex('cid', 'cid', { unique: false });
            revlogStore.createIndex('time', 'time', { unique: false });
        }
        
        // Config store
        if (!db.objectStoreNames.contains('config')) {
            const configStore = db.createObjectStore('config', { keyPath: 'key' });
        }
        
        // Tags store
        if (!db.objectStoreNames.contains('tags')) {
            const tagsStore = db.createObjectStore('tags', { keyPath: 'tag' });
        }
    }

    async ensureDefaultData() {
        // Check if default deck exists
        const defaultDeck = await this.getDeckByName('Default');
        if (!defaultDeck) {
            await this.createDeck({
                name: 'Default',
                description: 'Default deck',
                config: {
                    newCardsPerDay: 20,
                    reviewsPerDay: 200,
                    learningSteps: '1 10',
                    graduatingInterval: 1,
                    easyInterval: 4,
                    startingEase: 2.5
                },
                created: Date.now(),
                modified: Date.now()
            });
        }
        
        // Check if default models exist
        const defaultModels = await this.getAllModels();
        if (defaultModels.length === 0) {
            await this.createDefaultModels();
        }
        
        // Load default settings if not exist
        const settings = await this.getSettings();
        if (!settings) {
            await this.saveSettings({
                theme: 'dark',
                fontSize: 'medium',
                newCardsPerDay: 20,
                maxReviewsPerDay: 200,
                learningSteps: '1 10'
            });
        }
    }

    async createDefaultModels() {
        const models = [
            {
                name: 'Basic',
                flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
                tmpls: [{
                    name: 'Card 1',
                    qfmt: '{{Front}}',
                    afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}'
                }],
                css: `.card {
                    font-family: arial;
                    font-size: 20px;
                    text-align: center;
                    color: black;
                    background-color: white;
                }`
            },
            {
                name: 'Basic (and reverse card)',
                flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
                tmpls: [
                    {
                        name: 'Card 1',
                        qfmt: '{{Front}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}'
                    },
                    {
                        name: 'Card 2',
                        qfmt: '{{Back}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Front}}'
                    }
                ],
                css: `.card {
                    font-family: arial;
                    font-size: 20px;
                    text-align: center;
                    color: black;
                    background-color: white;
                }`
            },
            {
                name: 'Basic (optional reverse card)',
                flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }, { name: 'Add Reverse', ord: 2 }],
                tmpls: [
                    {
                        name: 'Card 1',
                        qfmt: '{{Front}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}'
                    },
                    {
                        name: 'Card 2',
                        qfmt: '{{#Add Reverse}}{{Back}}{{/Add Reverse}}',
                        afmt: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Front}}'
                    }
                ],
                css: `.card {
                    font-family: arial;
                    font-size: 20px;
                    text-align: center;
                    color: black;
                    background-color: white;
                }`
            },
            {
                name: 'Cloze',
                flds: [{ name: 'Text', ord: 0 }, { name: 'Extra', ord: 1 }],
                tmpls: [{
                    name: 'Cloze',
                    qfmt: '{{cloze:Text}}',
                    afmt: '{{cloze:Text}}<br>\n{{Extra}}'
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
                }`
            }
        ];
        
        for (const model of models) {
            await this.createModel(model);
        }
    }

    // Deck operations
    async createDeck(deck) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            const request = store.add(deck);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async updateDeck(id, updates) {
        return new Promise(async (resolve, reject) => {
            const deck = await this.getDeck(id);
            if (!deck) {
                reject(new Error('Deck not found'));
                return;
            }
            
            const updatedDeck = { ...deck, ...updates, modified: Date.now() };
            
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            const request = store.put(updatedDeck);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteDeck(id) {
        return new Promise(async (resolve, reject) => {
            // First, delete all cards in the deck
            const cards = await this.getCardsByDeck(id);
            for (const card of cards) {
                await this.deleteCard(card.id);
            }
            
            // Then delete the deck
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getDeck(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readonly');
            const store = transaction.objectStore('decks');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getDeckByName(name) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readonly');
            const store = transaction.objectStore('decks');
            const index = store.index('name');
            const request = index.get(name);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllDecks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readonly');
            const store = transaction.objectStore('decks');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getDecksWithStats() {
        const decks = await this.getAllDecks();
        const decksWithStats = [];
        
        for (const deck of decks) {
            const stats = await this.getDeckStats(deck.id);
            decksWithStats.push({
                ...deck,
                stats: stats
            });
        }
        
        return decksWithStats;
    }

    async getDeckStats(deckId) {
        const today = Math.floor(Date.now() / 86400000);
        
        const [due, newCount, learning] = await Promise.all([
            this.getDueCount(deckId),
            this.getNewCount(deckId),
            this.getLearningCount(deckId)
        ]);
        
        return {
            due: due,
            new: newCount,
            learning: learning,
            total: due + newCount + learning
        };
    }

    // Card operations
    async createCard(cardData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.add(cardData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async createNoteAndCards(noteData, model) {
        // Create note
        const note = {
            mid: model.id,
            tags: noteData.tags || [],
            fields: noteData.fields,
            sfld: noteData.fields[0], // First field for searching
            created: Date.now(),
            modified: Date.now()
        };
        
        const noteId = await this.createNote(note);
        
        // Create cards based on model templates
        const cards = [];
        for (const template of model.tmpls) {
            // Check if card should be created (for optional reverse cards)
            if (template.qfmt.includes('{{#') && !this.shouldCreateCard(template.qfmt, note.fields)) {
                continue;
            }
            
            const card = {
                nid: noteId,
                did: noteData.did || 1,
                ord: template.ord || 0,
                queue: 0, // New
                type: 0, // New
                ivl: 0,
                factor: 2500, // Starting ease 2.5 * 1000
                reps: 0,
                lapses: 0,
                left: 0,
                due: Math.floor(Date.now() / 86400000),
                odue: 0,
                odid: 0,
                flags: 0,
                data: ''
            };
            
            const cardId = await this.createCard(card);
            cards.push({ ...card, id: cardId });
        }
        
        return { noteId, cards };
    }

    shouldCreateCard(template, fields) {
        // Check if card should be created based on conditional template
        const conditionMatch = template.match(/\{\{#(.+?)\}\}/);
        if (!conditionMatch) return true;
        
        const conditionField = conditionMatch[1];
        const fieldIndex = Object.keys(fields).indexOf(conditionField);
        if (fieldIndex === -1) return true;
        
        return !!fields[conditionField];
    }

    async updateCard(id, updates) {
        return new Promise(async (resolve, reject) => {
            const card = await this.getCard(id);
            if (!card) {
                reject(new Error('Card not found'));
                return;
            }
            
            const updatedCard = { ...card, ...updates, mod: Date.now() };
            
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.put(updatedCard);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteCard(id) {
        return new Promise(async (resolve, reject) => {
            // Get card to find note
            const card = await this.getCard(id);
            if (!card) {
                resolve();
                return;
            }
            
            // Delete card
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.delete(id);
            
            request.onsuccess = async () => {
                // Check if note has any other cards
                const otherCards = await this.getCardsByNote(card.nid);
                if (otherCards.length === 0) {
                    // Delete note if no cards left
                    await this.deleteNote(card.nid);
                }
                resolve();
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getCard(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getCardsByDeck(deckId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('did');
            const request = index.getAll(deckId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getCardsByNote(noteId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('nid');
            const request = index.getAll(noteId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getDueCards(deckId, limit = 100) {
        const today = Math.floor(Date.now() / 86400000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('did');
            
            const cards = [];
            const request = index.openCursor(deckId);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && cards.length < limit) {
                    const card = cursor.value;
                    if (card.due <= today && card.queue >= 0) {
                        cards.push(card);
                    }
                    cursor.continue();
                } else {
                    resolve(cards);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getNewCards(deckId, limit = 20) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('did');
            
            const cards = [];
            const request = index.openCursor(deckId);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && cards.length < limit) {
                    const card = cursor.value;
                    if (card.queue === 0) { // New cards
                        cards.push(card);
                    }
                    cursor.continue();
                } else {
                    resolve(cards);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getLearningCards(deckId) {
        const today = Math.floor(Date.now() / 86400000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('did');
            
            const cards = [];
            const request = index.openCursor(deckId);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const card = cursor.value;
                    if ((card.queue === 1 || card.queue === 3) && card.due <= today) {
                        cards.push(card);
                    }
                    cursor.continue();
                } else {
                    resolve(cards);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getDueCount(deckId = null) {
        const today = Math.floor(Date.now() / 86400000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            
            let count = 0;
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const card = cursor.value;
                    if ((deckId === null || card.did === deckId) && 
                        card.due <= today && 
                        card.queue >= 0 && 
                        card.queue !== 0) {
                        count++;
                    }
                    cursor.continue();
                } else {
                    resolve(count);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getNewCount(deckId = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            
            let count = 0;
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const card = cursor.value;
                    if ((deckId === null || card.did === deckId) && card.queue === 0) {
                        count++;
                    }
                    cursor.continue();
                } else {
                    resolve(count);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getLearningCount(deckId = null) {
        const today = Math.floor(Date.now() / 86400000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            
            let count = 0;
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const card = cursor.value;
                    if ((deckId === null || card.did === deckId) && 
                        (card.queue === 1 || card.queue === 3) && 
                        card.due <= today) {
                        count++;
                    }
                    cursor.continue();
                } else {
                    resolve(count);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Note operations
    async createNote(note) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.add(note);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Model operations
    async createModel(model) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readwrite');
            const store = transaction.objectStore('models');
            const request = store.add(model);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllModels() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getModel(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Review log operations
    async addReviewLog(log) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readwrite');
            const store = transaction.objectStore('revlog');
            const request = store.add({
                ...log,
                time: Date.now()
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getReviewLogs(cardId, limit = 100) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readonly');
            const store = transaction.objectStore('revlog');
            const index = store.index('cid');
            
            const logs = [];
            const request = index.openCursor(IDBKeyRange.only(cardId));
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && logs.length < limit) {
                    logs.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(logs);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Settings operations
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async saveSettings(settings) {
        const transaction = this.db.transaction(['config'], 'readwrite');
        const store = transaction.objectStore('config');
        
        for (const [key, value] of Object.entries(settings)) {
            store.put({ key, value });
        }
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    // Tag operations
    async getAllTags() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tags'], 'readonly');
            const store = transaction.objectStore('tags');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result.map(item => item.tag));
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Card management operations
    async buryCard(cardId) {
        return this.updateCard(cardId, { queue: -2 }); // Buried
    }

    async suspendCard(cardId) {
        return this.updateCard(cardId, { queue: -1 }); // Suspended
    }

    async toggleFlag(cardId) {
        const card = await this.getCard(cardId);
        if (!card) return;
        
        const newFlags = card.flags === 0 ? 1 : 0;
        return this.updateCard(cardId, { flags: newFlags });
    }

    async toggleMark(cardId) {
        const card = await this.getCard(cardId);
        if (!card) return;
        
        // Use bit 0x01 for marked
        const newMarked = (card.flags & 1) === 0;
        const newFlags = newMarked ? card.flags | 1 : card.flags & ~1;
        
        return this.updateCard(cardId, { flags: newFlags });
    }

    // Statistics
    async getStatistics(days = 7) {
        const since = Date.now() - days * 86400000;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readonly');
            const store = transaction.objectStore('revlog');
            const index = store.index('time');
            
            const logs = [];
            const request = index.openCursor(IDBKeyRange.lowerBound(since));
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    logs.push(cursor.value);
                    cursor.continue();
                } else {
                    // Calculate statistics
                    const total = logs.length;
                    const avgTime = total > 0 
                        ? Math.round(logs.reduce((sum, log) => sum + (log.time || 0), 0) / total) / 1000
                        : 0;
                    
                    // Calculate daily reviews
                    const dailyReviews = {};
                    logs.forEach(log => {
                        const date = new Date(log.time).toLocaleDateString();
                        dailyReviews[date] = (dailyReviews[date] || 0) + 1;
                    });
                    
                    const dailyReviewsArray = Object.entries(dailyReviews)
                        .map(([date, count]) => ({ date, count }))
                        .sort((a, b) => a.date.localeCompare(b.date));
                    
                    resolve({
                        totalReviewed: total,
                        avgTime: avgTime.toFixed(1),
                        reviewTrend: 0, // Would need historical data
                        timeTrend: 0, // Would need historical data
                        dailyReviews: dailyReviewsArray
                    });
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getDeckStatistics() {
        const decks = await this.getAllDecks();
        const stats = [];
        
        for (const deck of decks) {
            const cards = await this.getCardsByDeck(deck.id);
            const reviewLogs = await this.getReviewLogsForDeck(deck.id);
            
            const avgEase = reviewLogs.length > 0
                ? Math.round(reviewLogs.reduce((sum, log) => sum + (log.factor || 2500), 0) / reviewLogs.length / 10) / 100
                : 2.5;
            
            stats.push({
                name: deck.name,
                cards: cards.length,
                avgEase: avgEase.toFixed(2)
            });
        }
        
        return stats;
    }

    async getReviewLogsForDeck(deckId) {
        const cards = await this.getCardsByDeck(deckId);
        const allLogs = [];
        
        for (const card of cards) {
            const logs = await this.getReviewLogs(card.id);
            allLogs.push(...logs);
        }
        
        return allLogs;
    }

    // Export/Import
    async exportData() {
        const data = {
            version: 1,
            timestamp: Date.now(),
            decks: await this.getAllDecks(),
            cards: await this.getAllCards(),
            notes: await this.getAllNotes(),
            models: await this.getAllModels(),
            revlog: await this.getAllRevlogs(),
            config: await this.getSettings(),
            tags: await this.getAllTags()
        };
        
        return data;
    }

    async importData(data) {
        // Validate data
        if (!data.version || data.version !== 1) {
            throw new Error('Invalid data format');
        }
        
        // Clear existing data
        await this.clearAllData();
        
        // Import data
        const transaction = this.db.transaction(
            ['decks', 'cards', 'notes', 'models', 'revlog', 'config', 'tags'],
            'readwrite'
        );
        
        // Import decks
        if (data.decks) {
            const decksStore = transaction.objectStore('decks');
            data.decks.forEach(deck => decksStore.add(deck));
        }
        
        // Import cards
        if (data.cards) {
            const cardsStore = transaction.objectStore('cards');
            data.cards.forEach(card => cardsStore.add(card));
        }
        
        // Import notes
        if (data.notes) {
            const notesStore = transaction.objectStore('notes');
            data.notes.forEach(note => notesStore.add(note));
        }
        
        // Import models
        if (data.models) {
            const modelsStore = transaction.objectStore('models');
            data.models.forEach(model => modelsStore.add(model));
        }
        
        // Import revlog
        if (data.revlog) {
            const revlogStore = transaction.objectStore('revlog');
            data.revlog.forEach(log => revlogStore.add(log));
        }
        
        // Import config
        if (data.config) {
            const configStore = transaction.objectStore('config');
            Object.entries(data.config).forEach(([key, value]) => {
                configStore.put({ key, value });
            });
        }
        
        // Import tags
        if (data.tags) {
            const tagsStore = transaction.objectStore('tags');
            data.tags.forEach(tag => tagsStore.add({ tag }));
        }
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    async clearAllData() {
        const stores = ['decks', 'cards', 'notes', 'models', 'revlog', 'config', 'tags'];
        const transaction = this.db.transaction(stores, 'readwrite');
        
        stores.forEach(storeName => {
            const store = transaction.objectStore(storeName);
            store.clear();
        });
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    // Helper methods
    async getAllCards() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllRevlogs() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readonly');
            const store = transaction.objectStore('revlog');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Search
    async searchCards(query, deckId = null) {
        // Simple search implementation
        // In a real app, this would be more sophisticated
        const allNotes = await this.getAllNotes();
        const matchingNotes = allNotes.filter(note => {
            const text = JSON.stringify(note.fields).toLowerCase();
            return text.includes(query.toLowerCase());
        });
        
        const cards = [];
        for (const note of matchingNotes) {
            const noteCards = await this.getCardsByNote(note.id);
            cards.push(...noteCards.filter(card => deckId === null || card.did === deckId));
        }
        
        return cards;
    }
}

// Export storage instance
const storage = new Storage();

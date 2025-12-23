// ANKI iOS - Storage System (IndexedDB)
class Storage {
    constructor() {
        this.db = null;
        this.version = 4;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AnkiIOS', this.version);
            
            request.onerror = (e) => {
                console.error('IndexedDB error:', e.target.error);
                reject(e.target.error);
            };
            
            request.onsuccess = (e) => {
                this.db = e.target.result;
                console.log('Database opened successfully');
                resolve();
            };
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                console.log('Database upgrade needed');
                
                // Decks jadvali
                if (!db.objectStoreNames.contains('decks')) {
                    const decksStore = db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
                    decksStore.createIndex('name', 'name', { unique: true });
                    decksStore.createIndex('parentId', 'parentId');
                    decksStore.createIndex('created', 'created');
                }
                
                // Cards jadvali
                if (!db.objectStoreNames.contains('cards')) {
                    const cardsStore = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                    cardsStore.createIndex('deckId', 'deckId');
                    cardsStore.createIndex('due', 'due');
                    cardsStore.createIndex('queue', 'queue');
                    cardsStore.createIndex('cardType', 'cardType');
                    cardsStore.createIndex('noteId', 'noteId');
                }
                
                // Notes jadvali
                if (!db.objectStoreNames.contains('notes')) {
                    const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
                    notesStore.createIndex('modelId', 'modelId');
                    notesStore.createIndex('deckId', 'deckId');
                    notesStore.createIndex('tags', 'tags', { multiEntry: true });
                }
                
                // Models jadvali
                if (!db.objectStoreNames.contains('models')) {
                    const modelsStore = db.createObjectStore('models', { keyPath: 'id', autoIncrement: true });
                    modelsStore.createIndex('name', 'name', { unique: true });
                }
                
                // Revlog jadvali
                if (!db.objectStoreNames.contains('revlog')) {
                    const revlogStore = db.createObjectStore('revlog', { keyPath: 'id', autoIncrement: true });
                    revlogStore.createIndex('cardId', 'cardId');
                    revlogStore.createIndex('reviewTime', 'reviewTime');
                }
                
                // Settings jadvali
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                // Tags jadvali
                if (!db.objectStoreNames.contains('tags')) {
                    db.createObjectStore('tags', { keyPath: 'tag' });
                }
                
                // Media jadvali
                if (!db.objectStoreNames.contains('media')) {
                    db.createObjectStore('media', { keyPath: 'filename' });
                }
            };
        });
    }

    // === DECK OPERATIONS ===
    async createDeck(name, parentId = null) {
        const deck = {
            name: name,
            parentId: parentId,
            created: Date.now(),
            modified: Date.now(),
            config: {
                newCardsPerDay: 20,
                reviewsPerDay: 100,
                learningSteps: [1, 10],
                graduatingInterval: 1,
                easyInterval: 4,
                startingEase: 2500,
                hardInterval: 1.2,
                easyBonus: 1.3,
                intervalModifier: 1.0,
                maxInterval: 36500,
                buryNew: true,
                buryReviews: true
            },
            stats: {
                new: 0,
                learn: 0,
                review: 0,
                total: 0
            }
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            const request = store.add(deck);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllDecks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readonly');
            const store = transaction.objectStore('decks');
            const request = store.getAll();
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getDeck(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readonly');
            const store = transaction.objectStore('decks');
            const request = store.get(id);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
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
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteDeck(id) {
        // First delete all cards in the deck
        await this.deleteCardsByDeck(id);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // === CARD OPERATIONS ===
    async createCard(cardData) {
        const card = {
            deckId: cardData.deckId,
            noteId: cardData.noteId,
            cardType: cardData.cardType || 0, // 0: new, 1: learning, 2: review, 3: relearning
            queue: cardData.queue || 0, // 0: new, 1: learning, 2: review, -1: suspended, -2: buried
            due: cardData.due || 0,
            interval: cardData.interval || 0,
            easeFactor: cardData.easeFactor || 2500,
            reps: cardData.reps || 0,
            lapses: cardData.lapses || 0,
            left: cardData.left || 0,
            odue: cardData.odue || 0,
            odid: cardData.odid || 0,
            flags: cardData.flags || 0,
            data: cardData.data || '',
            created: Date.now(),
            modified: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.add(card);
            
            request.onsuccess = async (e) => {
                const cardId = e.target.result;
                // Update deck stats
                await this.updateDeckStats(card.deckId);
                resolve(cardId);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getCard(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.get(id);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async updateCard(id, updates) {
        return new Promise(async (resolve, reject) => {
            const card = await this.getCard(id);
            if (!card) {
                reject(new Error('Card not found'));
                return;
            }
            
            const updatedCard = { ...card, ...updates, modified: Date.now() };
            
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.put(updatedCard);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteCard(id) {
        return new Promise(async (resolve, reject) => {
            const card = await this.getCard(id);
            if (!card) {
                resolve();
                return;
            }
            
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.delete(id);
            
            request.onsuccess = async () => {
                await this.updateDeckStats(card.deckId);
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteCardsByDeck(deckId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const index = store.index('deckId');
            const request = index.openCursor(IDBKeyRange.only(deckId));
            
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getCardsByDeck(deckId, limit = 1000) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('deckId');
            
            const cards = [];
            const request = index.openCursor(IDBKeyRange.only(deckId));
            
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && cards.length < limit) {
                    cards.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(cards);
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getDueCards(deckId) {
        const today = Math.floor(Date.now() / 86400000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const deckIndex = store.index('deckId');
            
            const dueCards = [];
            const request = deckIndex.openCursor(IDBKeyRange.only(deckId));
            
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const card = cursor.value;
                    // Card is due if:
                    // 1. It's in learning queue (1) and due today
                    // 2. It's in review queue (2) and due <= today
                    // 3. It's new (0) - will be shown as new cards
                    if ((card.queue === 1 && card.due <= today) ||
                        (card.queue === 2 && card.due <= today) ||
                        (card.queue === 0)) {
                        dueCards.push(card);
                    }
                    cursor.continue();
                } else {
                    resolve(dueCards);
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getCardCounts(deckId) {
        const today = Math.floor(Date.now() / 86400000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const deckIndex = store.index('deckId');
            
            let newCount = 0;
            let learningCount = 0;
            let reviewCount = 0;
            
            const request = deckIndex.openCursor(IDBKeyRange.only(deckId));
            
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const card = cursor.value;
                    if (card.queue === 0) newCount++;
                    else if (card.queue === 1 && card.due <= today) learningCount++;
                    else if (card.queue === 2 && card.due <= today) reviewCount++;
                    cursor.continue();
                } else {
                    resolve({
                        new: newCount,
                        learning: learningCount,
                        review: reviewCount,
                        total: newCount + learningCount + reviewCount
                    });
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async updateDeckStats(deckId) {
        const counts = await this.getCardCounts(deckId);
        await this.updateDeck(deckId, { stats: counts });
        return counts;
    }

    // === NOTE OPERATIONS ===
    async createNote(noteData) {
        const note = {
            modelId: noteData.modelId || 1,
            deckId: noteData.deckId || 1,
            fields: noteData.fields || {},
            tags: noteData.tags || [],
            created: Date.now(),
            modified: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.add(note);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.get(id);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getNotesByDeck(deckId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const index = store.index('deckId');
            const request = index.getAll(IDBKeyRange.only(deckId));
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // === MODEL OPERATIONS ===
    async createModel(modelData) {
        const model = {
            name: modelData.name,
            fields: modelData.fields || [],
            templates: modelData.templates || [],
            css: modelData.css || '',
            created: Date.now(),
            modified: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readwrite');
            const store = transaction.objectStore('models');
            const request = store.add(model);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getModel(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.get(id);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllModels() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.getAll();
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // === REVIEW LOG OPERATIONS ===
    async addReviewLog(logData) {
        const log = {
            cardId: logData.cardId,
            ease: logData.ease, // 1: Again, 2: Hard, 3: Good, 4: Easy
            interval: logData.interval || 0,
            lastInterval: logData.lastInterval || 0,
            easeFactor: logData.easeFactor || 2500,
            timeTaken: logData.timeTaken || 0,
            reviewTime: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readwrite');
            const store = transaction.objectStore('revlog');
            const request = store.add(log);
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getReviewLogs(cardId, limit = 100) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readonly');
            const store = transaction.objectStore('revlog');
            const index = store.index('cardId');
            
            const logs = [];
            const request = index.openCursor(IDBKeyRange.only(cardId));
            
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && logs.length < limit) {
                    logs.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(logs);
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // === SETTINGS OPERATIONS ===
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            
            request.onsuccess = (e) => {
                const result = e.target.result;
                resolve(result ? result.value : null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllSettings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.getAll();
            
            request.onsuccess = (e) => {
                const settings = {};
                e.target.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // === UTILITY METHODS ===
    async initializeDefaultData() {
        // Create default deck if none exists
        const decks = await this.getAllDecks();
        if (decks.length === 0) {
            await this.createDeck('Default');
        }
        
        // Create default models
        const models = await this.getAllModels();
        if (models.length === 0) {
            await this.createDefaultModels();
        }
        
        // Initialize default settings
        const settings = await this.getAllSettings();
        if (!settings.theme) {
            await this.saveSetting('theme', 'dark');
            await this.saveSetting('newCardsPerDay', 20);
            await this.saveSetting('reviewsPerDay', 100);
            await this.saveSetting('learningSteps', '1 10');
            await this.saveSetting('fontSize', 'medium');
        }
    }

    async createDefaultModels() {
        const models = [
            {
                name: 'Basic',
                fields: ['Front', 'Back'],
                templates: [
                    {
                        name: 'Card 1',
                        front: '{{Front}}',
                        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}'
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
                name: 'Basic (and reverse card)',
                fields: ['Front', 'Back'],
                templates: [
                    {
                        name: 'Card 1',
                        front: '{{Front}}',
                        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}'
                    },
                    {
                        name: 'Card 2',
                        front: '{{Back}}',
                        back: '{{FrontSide}}\n\n<hr id="answer">\n\n{{Front}}'
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
                fields: ['Text', 'Extra'],
                templates: [
                    {
                        name: 'Cloze',
                        front: '{{cloze:Text}}',
                        back: '{{cloze:Text}}<br>\n{{Extra}}'
                    }
                ],
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

    async exportData() {
        const data = {
            version: 1,
            timestamp: Date.now(),
            decks: await this.getAllDecks(),
            cards: await this.getAllCards(),
            notes: await this.getAllNotes(),
            models: await this.getAllModels(),
            revlog: await this.getAllRevlog(),
            settings: await this.getAllSettings()
        };
        
        return JSON.stringify(data, null, 2);
    }

    async importData(jsonData) {
        const data = JSON.parse(jsonData);
        
        // Clear existing data
        await this.clearAllData();
        
        // Import data
        const transaction = this.db.transaction(
            ['decks', 'cards', 'notes', 'models', 'revlog', 'settings'],
            'readwrite'
        );
        
        // Import each table
        if (data.decks) {
            const store = transaction.objectStore('decks');
            data.decks.forEach(deck => store.add(deck));
        }
        
        if (data.cards) {
            const store = transaction.objectStore('cards');
            data.cards.forEach(card => store.add(card));
        }
        
        if (data.notes) {
            const store = transaction.objectStore('notes');
            data.notes.forEach(note => store.add(note));
        }
        
        if (data.models) {
            const store = transaction.objectStore('models');
            data.models.forEach(model => store.add(model));
        }
        
        if (data.revlog) {
            const store = transaction.objectStore('revlog');
            data.revlog.forEach(log => store.add(log));
        }
        
        if (data.settings) {
            const store = transaction.objectStore('settings');
            Object.entries(data.settings).forEach(([key, value]) => {
                store.put({ key, value });
            });
        }
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    async clearAllData() {
        const stores = ['decks', 'cards', 'notes', 'models', 'revlog', 'settings', 'tags', 'media'];
        const transaction = this.db.transaction(stores, 'readwrite');
        
        stores.forEach(storeName => {
            const store = transaction.objectStore(storeName);
            store.clear();
        });
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    // Helper methods for getAll
    async getAllCards() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.getAll();
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllRevlog() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readonly');
            const store = transaction.objectStore('revlog');
            const request = store.getAll();
            
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Global storage instance
const storage = new Storage();

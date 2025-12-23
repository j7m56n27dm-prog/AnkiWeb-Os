/**
 * Anki iOS WebApp - Storage Module
 * Complete IndexedDB implementation with Anki .apkg compatibility
 */

class Storage {
    constructor() {
        this.db = null;
        this.dbName = 'anki-ios-webapp';
        this.dbVersion = 1;
        this.collection = null;
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(new Error('Failed to open database'));
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                
                // Load or create collection
                this.loadCollection().then(resolve).catch(reject);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };
        });
    }
    
    createObjectStores(db) {
        // Collection metadata
        if (!db.objectStoreNames.contains('col')) {
            db.createObjectStore('col', { keyPath: 'id' });
        }
        
        // Notes
        if (!db.objectStoreNames.contains('notes')) {
            const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
            noteStore.createIndex('guid', 'guid', { unique: true });
            noteStore.createIndex('mid', 'mid', { unique: false });
            noteStore.createIndex('usn', 'usn', { unique: false });
        }
        
        // Cards
        if (!db.objectStoreNames.contains('cards')) {
            const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
            cardStore.createIndex('nid', 'nid', { unique: false });
            cardStore.createIndex('did', 'did', { unique: false });
            cardStore.createIndex('due', 'due', { unique: false });
            cardStore.createIndex('queue', 'queue', { unique: false });
            cardStore.createIndex('type', 'type', { unique: false });
        }
        
        // Reviews
        if (!db.objectStoreNames.contains('revlog')) {
            const revlogStore = db.createObjectStore('revlog', { keyPath: 'id' });
            revlogStore.createIndex('cid', 'cid', { unique: false });
            revlogStore.createIndex('time', 'time', { unique: false });
        }
        
        // Models (note types)
        if (!db.objectStoreNames.contains('models')) {
            db.createObjectStore('models', { keyPath: 'id' });
        }
        
        // Decks
        if (!db.objectStoreNames.contains('decks')) {
            db.createObjectStore('decks', { keyPath: 'id' });
        }
        
        // Deck configurations
        if (!db.objectStoreNames.contains('deck_configs')) {
            db.createObjectStore('deck_configs', { keyPath: 'id' });
        }
        
        // Tags
        if (!db.objectStoreNames.contains('tags')) {
            db.createObjectStore('tags', { keyPath: 'name' });
        }
    }
    
    async loadCollection() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['col'], 'readonly');
            const store = transaction.objectStore('col');
            const request = store.get(1);
            
            request.onsuccess = (event) => {
                this.collection = event.target.result;
                
                if (!this.collection) {
                    // Create default collection
                    this.createDefaultCollection().then(resolve).catch(reject);
                } else {
                    resolve(this.collection);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to load collection'));
            };
        });
    }
    
    async createDefaultCollection() {
        this.collection = {
            id: 1,
            crt: Date.now(),
            mod: Date.now(),
            scm: Date.now(),
            ver: 11,
            dty: 0,
            usn: 0,
            ls: 0,
            conf: {
                nextPos: 1,
                estTimes: true,
                activeDecks: [],
                sortType: "noteFld",
                timeLim: 0,
                sortBackwards: false,
                addToCur: true,
                curDeck: 1,
                newBury: true,
                newSpread: 0,
                dueCounts: true,
                curModel: null,
                collapseTime: 1200
            },
            models: {},
            decks: {},
            dconf: {},
            tags: {}
        };
        
        // Create default deck configuration
        const defaultConfig = {
            id: 1,
            name: 'Default',
            mod: Date.now(),
            usn: 0,
            new: {
                deltas: [1, 10],
                separate: true,
                order: 1, // 0 = show new cards in order added, 1 = show new cards in random order
                perDay: 20,
                bury: true,
                initialFactor: 2500,
                ints: [1, 4, 7],
                previewDelay: 10
            },
            rev: {
                perDay: 200,
                ease4: 1.3,
                fuzz: 0.05,
                ivlFct: 1,
                maxIvl: 36500,
                bury: true,
                minSpace: 1,
                hardFactor: 1.2
            },
            lapse: {
                deltas: [10],
                leechAction: 1,
                leechFails: 8,
                minInt: 1,
                mult: 0
            },
            timer: 0,
            maxTaken: 60,
            autoplay: true,
            replay: true
        };
        
        this.collection.dconf[1] = defaultConfig;
        
        await this.saveCollection();
        return this.collection;
    }
    
    async saveCollection() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['col'], 'readwrite');
            const store = transaction.objectStore('col');
            const request = store.put(this.collection);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => {
                reject(new Error('Failed to save collection'));
            };
        });
    }
    
    // Note operations
    async saveNote(note) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            
            // Update modification time
            note.mod = Date.now();
            
            const request = store.put(note);
            
            request.onsuccess = () => {
                // Update collection mod time
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save note'));
            };
        });
    }
    
    async getNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.get(id);
            
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                reject(new Error('Failed to get note'));
            };
        });
    }
    
    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readwrite');
            const store = transaction.objectStore('notes');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to delete note'));
            };
        });
    }
    
    // Card operations
    async saveCard(card) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            
            // Update modification time
            card.mod = Date.now();
            
            const request = store.put(card);
            
            request.onsuccess = () => {
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save card'));
            };
        });
    }
    
    async getCard(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.get(id);
            
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                reject(new Error('Failed to get card'));
            };
        });
    }
    
    async getDueCards(deckId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('due');
            const now = Date.now();
            
            // Get cards with due date <= now and queue = 2 (review) or 3 (day learning relearn)
            const request = index.openCursor();
            const dueCards = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const card = cursor.value;
                    
                    if (card.did == deckId && 
                        (card.queue === 2 || card.queue === 3) && 
                        card.due <= now) {
                        dueCards.push(card);
                    }
                    
                    if (card.due > now) {
                        // Cards are sorted by due date, so we can stop
                        resolve(dueCards);
                    } else {
                        cursor.continue();
                    }
                } else {
                    resolve(dueCards);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to get due cards'));
            };
        });
    }
    
    async getNewCards(deckId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const index = store.index('queue');
            
            // Get cards with queue = 0 (new)
            const request = index.openCursor(IDBKeyRange.only(0));
            const newCards = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const card = cursor.value;
                    if (card.did == deckId) {
                        newCards.push(card);
                    }
                    cursor.continue();
                } else {
                    resolve(newCards);
                }
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to get new cards'));
            };
        });
    }
    
    async getAllCards() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readonly');
            const store = transaction.objectStore('cards');
            const request = store.getAll();
            
            request.onsuccess = (event) => resolve(event.target.result || []);
            request.onerror = (event) => {
                reject(new Error('Failed to get all cards'));
            };
        });
    }
    
    async getAllCardsWithDetails() {
        const cards = await this.getAllCards();
        const decks = await this.getDecks();
        const notes = await this.getAllNotes();
        
        return cards.map(card => {
            const deck = decks[card.did];
            const note = notes.find(n => n.id === card.nid);
            
            return {
                ...card,
                deckName: deck ? deck.name : 'Unknown',
                front: note ? note.flds[0] : '',
                back: note ? note.flds[1] : ''
            };
        });
    }
    
    async searchCards(query) {
        const allNotes = await this.getAllNotes();
        const searchTerms = query.toLowerCase().split(' ');
        
        // Filter notes based on search terms
        const matchingNotes = allNotes.filter(note => {
            const searchableText = Object.values(note.flds).join(' ').toLowerCase();
            return searchTerms.every(term => searchableText.includes(term));
        });
        
        // Get cards for matching notes
        const matchingNoteIds = new Set(matchingNotes.map(n => n.id));
        const allCards = await this.getAllCards();
        
        return allCards
            .filter(card => matchingNoteIds.has(card.nid))
            .map(card => {
                const note = matchingNotes.find(n => n.id === card.nid);
                const deck = this.collection.decks[card.did];
                
                return {
                    ...card,
                    deckName: deck ? deck.name : 'Unknown',
                    front: note ? note.flds[0] : '',
                    back: note ? note.flds[1] : ''
                };
            });
    }
    
    async deleteCard(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cards'], 'readwrite');
            const store = transaction.objectStore('cards');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to delete card'));
            };
        });
    }
    
    // Review log operations
    async saveReviewLog(review) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readwrite');
            const store = transaction.objectStore('revlog');
            const request = store.put(review);
            
            request.onsuccess = () => {
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save review log'));
            };
        });
    }
    
    async getReviewLogs(startTime, endTime) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readonly');
            const store = transaction.objectStore('revlog');
            const index = store.index('time');
            
            const range = startTime !== undefined ? 
                IDBKeyRange.bound(startTime, endTime || Date.now()) : 
                null;
            
            const request = range ? index.getAll(range) : index.getAll();
            
            request.onsuccess = (event) => resolve(event.target.result || []);
            request.onerror = (event) => {
                reject(new Error('Failed to get review logs'));
            };
        });
    }
    
    async deleteReviewLog(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['revlog'], 'readwrite');
            const store = transaction.objectStore('revlog');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to delete review log'));
            };
        });
    }
    
    // Model operations
    async saveModel(model) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readwrite');
            const store = transaction.objectStore('models');
            
            model.mod = Date.now();
            const request = store.put(model);
            
            request.onsuccess = () => {
                this.collection.models[model.id] = model;
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save model'));
            };
        });
    }
    
    async getModel(id) {
        // Check cache first
        if (this.collection.models[id]) {
            return this.collection.models[id];
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.get(id);
            
            request.onsuccess = (event) => {
                const model = event.target.result;
                if (model) {
                    this.collection.models[id] = model;
                }
                resolve(model);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to get model'));
            };
        });
    }
    
    async getModels() {
        // Return cached models
        return this.collection.models;
    }
    
    // Deck operations
    async saveDeck(deck) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            
            deck.mod = Date.now();
            const request = store.put(deck);
            
            request.onsuccess = () => {
                this.collection.decks[deck.id] = deck;
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save deck'));
            };
        });
    }
    
    async getDeck(id) {
        // Check cache first
        if (this.collection.decks[id]) {
            return this.collection.decks[id];
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readonly');
            const store = transaction.objectStore('decks');
            const request = store.get(id);
            
            request.onsuccess = (event) => {
                const deck = event.target.result;
                if (deck) {
                    this.collection.decks[id] = deck;
                }
                resolve(deck);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to get deck'));
            };
        });
    }
    
    async getDecks() {
        // Return cached decks
        return this.collection.decks;
    }
    
    async deleteDeck(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['decks'], 'readwrite');
            const store = transaction.objectStore('decks');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                delete this.collection.decks[id];
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to delete deck'));
            };
        });
    }
    
    // Deck config operations
    async saveDeckConfig(config) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['deck_configs'], 'readwrite');
            const store = transaction.objectStore('deck_configs');
            
            config.mod = Date.now();
            const request = store.put(config);
            
            request.onsuccess = () => {
                this.collection.dconf[config.id] = config;
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save deck config'));
            };
        });
    }
    
    async getDeckConfig(id) {
        // Check cache first
        if (this.collection.dconf[id]) {
            return this.collection.dconf[id];
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['deck_configs'], 'readonly');
            const store = transaction.objectStore('deck_configs');
            const request = store.get(id);
            
            request.onsuccess = (event) => {
                const config = event.target.result;
                if (config) {
                    this.collection.dconf[id] = config;
                }
                resolve(config);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to get deck config'));
            };
        });
    }
    
    // Tag operations
    async saveTag(tag) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tags'], 'readwrite');
            const store = transaction.objectStore('tags');
            const request = store.put(tag);
            
            request.onsuccess = () => {
                this.collection.tags[tag.name] = tag;
                this.collection.mod = Date.now();
                this.saveCollection().then(resolve).catch(reject);
            };
            
            request.onerror = (event) => {
                reject(new Error('Failed to save tag'));
            };
        });
    }
    
    async getTags() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tags'], 'readonly');
            const store = transaction.objectStore('tags');
            const request = store.getAll();
            
            request.onsuccess = (event) => resolve(event.target.result || []);
            request.onerror = (event) => {
                reject(new Error('Failed to get tags'));
            };
        });
    }
    
    // Collection operations
    async getConfig() {
        return this.collection.conf;
    }
    
    async saveConfig(config) {
        this.collection.conf = { ...this.collection.conf, ...config };
        this.collection.mod = Date.now();
        await this.saveCollection();
    }
    
    // Card addition (high-level)
    async addCard(cardData) {
        const { deckId, modelId, fields, tags } = cardData;
        
        // Create note
        const note = {
            id: Date.now(),
            guid: this.generateGuid(),
            mid: modelId,
            mod: Date.now(),
            usn: 0,
            tags: tags || [],
            flds: fields,
            sfld: fields[0], // First field for sorting
            csum: this.calculateChecksum(fields[0]),
            flags: 0,
            data: ''
        };
        
        // Save note
        await this.saveNote(note);
        
        // Get model to determine number of cards
        const model = await this.getModel(modelId);
        
        // Create cards based on model templates
        const cards = [];
        for (let i = 0; i < model.tmpls.length; i++) {
            const card = {
                id: Date.now() + i + 1,
                nid: note.id,
                did: deckId,
                ord: i,
                mod: Date.now(),
                usn: 0,
                type: 0, // New card
                queue: 0, // New queue
                due: this.calculateDueForNewCard(),
                ivl: 0,
                factor: model.new ? model.new.initialFactor || 2500 : 2500,
                reps: 0,
                lapses: 0,
                left: 0,
                odue: 0,
                odid: 0,
                flags: 0,
                data: ''
            };
            
            cards.push(card);
            await this.saveCard(card);
        }
        
        // Update tags
        if (tags && tags.length > 0) {
            for (const tagName of tags) {
                await this.saveTag({
                    name: tagName,
                    usn: 0,
                    collapsed: false
                });
            }
        }
        
        return { note, cards };
    }
    
    // Helper methods
    generateGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    calculateChecksum(text) {
        // Simple checksum for sorting
        let sum = 0;
        for (let i = 0; i < text.length; i++) {
            sum = (sum << 5) - sum + text.charCodeAt(i);
            sum |= 0; // Convert to 32-bit integer
        }
        return sum;
    }
    
    calculateDueForNewCard() {
        // New cards get a random due date in the future
        // This helps distribute them evenly
        const now = Date.now();
        const maxOffset = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        return now + Math.floor(Math.random() * maxOffset);
    }
    
    async getAllNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notes'], 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.getAll();
            
            request.onsuccess = (event) => resolve(event.target.result || []);
            request.onerror = (event) => {
                reject(new Error('Failed to get all notes'));
            };
        });
    }
    
    // Import/Export
    async exportCollection() {
        // Gather all data
        const exportData = {
            collection: this.collection,
            notes: await this.getAllNotes(),
            cards: await this.getAllCards(),
            revlogs: await this.getReviewLogs(),
            models: Object.values(await this.getModels()),
            decks: Object.values(await this.getDecks()),
            deck_configs: Object.values(this.collection.dconf),
            tags: await this.getTags()
        };
        
        // Create JSON string
        const json = JSON.stringify(exportData, null, 2);
        
        // Create blob
        return new Blob([json], { type: 'application/json' });
    }
    
    async importCollection(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);
                    
                    // Clear existing data
                    await this.resetCollection();
                    
                    // Import data
                    this.collection = importData.collection;
                    
                    // Save all data
                    await this.saveCollection();
                    
                    // Import notes
                    for (const note of importData.notes) {
                        await this.saveNote(note);
                    }
                    
                    // Import cards
                    for (const card of importData.cards) {
                        await this.saveCard(card);
                    }
                    
                    // Import review logs
                    for (const revlog of importData.revlogs) {
                        await this.saveReviewLog(revlog);
                    }
                    
                    // Import models
                    for (const model of importData.models) {
                        await this.saveModel(model);
                    }
                    
                    // Import decks
                    for (const deck of importData.decks) {
                        await this.saveDeck(deck);
                    }
                    
                    // Import deck configs
                    for (const config of importData.deck_configs) {
                        await this.saveDeckConfig(config);
                    }
                    
                    // Import tags
                    for (const tag of importData.tags) {
                        await this.saveTag(tag);
                    }
                    
                    resolve();
                } catch (error) {
                    reject(new Error('Invalid import file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read import file'));
            };
            
            reader.readAsText(file);
        });
    }
    
    async resetCollection() {
        // Clear all object stores
        const objectStores = [
            'notes', 'cards', 'revlog', 'models', 
            'decks', 'deck_configs', 'tags'
        ];
        
        for (const storeName of objectStores) {
            await this.clearObjectStore(storeName);
        }
        
        // Reset collection
        this.collection = null;
        await this.createDefaultCollection();
    }
    
    async clearObjectStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => {
                reject(new Error(`Failed to clear ${storeName}`));
            };
        });
    }
    
    // Backup and restore
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup-${timestamp}`;
        
        // Create backup in a separate database
        const backupDB = await this.createBackupDatabase(backupName);
        
        // Copy all data
        await this.copyDataToBackup(backupDB);
        
        return backupName;
    }
    
    async createBackupDatabase(name) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(name, this.dbVersion);
            
            request.onerror = (event) => {
                reject(new Error('Failed to create backup database'));
            };
            
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            
            request.onupgradeneeded = (event) => {
                this.createObjectStores(event.target.result);
            };
        });
    }
    
    async copyDataToBackup(backupDB) {
        // Implementation would copy all data from main DB to backup DB
        // This is a simplified version
        console.log('Creating backup...');
    }
    
    // Utility methods for the app
    async getCardCounts(deckId) {
        const dueCards = await this.getDueCards(deckId);
        const newCards = await this.getNewCards(deckId);
        
        return {
            due: dueCards.length,
            new: newCards.length,
            total: dueCards.length + newCards.length
        };
    }
    
    async getNextCard(deckId) {
        // Get due cards first
        const dueCards = await this.getDueCards(deckId);
        if (dueCards.length > 0) {
            return dueCards[0];
        }
        
        // Then new cards
        const newCards = await this.getNewCards(deckId);
        if (newCards.length > 0) {
            return newCards[0];
        }
        
        return null;
    }
    
    // Transaction helper
    async transaction(storeNames, mode, operation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeNames, mode);
            const stores = {};
            
            for (const storeName of storeNames) {
                stores[storeName] = transaction.objectStore(storeName);
            }
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
            
            operation(stores, transaction);
        });
    }
}

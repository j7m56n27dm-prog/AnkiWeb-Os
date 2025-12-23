// ANKI iOS WebApp - Spaced Repetition Scheduler (SM-2 Algorithm)
class Scheduler {
    constructor() {
        this.config = {
            learningSteps: [1, 10], // in minutes
            graduatingInterval: 1, // days
            easyInterval: 4, // days
            startingEase: 2.5,
            hardIntervalModifier: 1.2,
            easyBonus: 1.3,
            maximumInterval: 36500,
            lapsePenalty: 0, // new interval multiplier (0 = reset to learning)
            minimumEase: 1.3,
            leechThreshold: 8,
            leechAction: 'suspend', // or 'tag'
            newCardsPerDay: 20,
            reviewsPerDay: 200,
            maximumReviewsPerDay: 9999,
            buryNew: false,
            buryReviews: false,
            buryInterdayLearning: false
        };
    }

    init() {
        // Load configuration from storage
        this.loadConfig();
    }

    async loadConfig() {
        const savedConfig = await storage.getSettings();
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
            
            // Parse learning steps
            if (typeof this.config.learningSteps === 'string') {
                this.config.learningSteps = this.config.learningSteps.split(' ').map(Number);
            }
        }
    }

    // Main scheduling function - called when a card is answered
    scheduleCard(card, ease, timeTaken) {
        const now = Date.now();
        const today = Math.floor(now / 86400000); // days since epoch
        
        // Save previous state for undo
        const previousState = { ...card };
        
        // Update card based on current state and ease
        switch (card.queue) {
            case 0: // New card
                this.handleNewCard(card, ease, today);
                break;
            case 1: // Learning card
            case 3: // Relearning card
                this.handleLearningCard(card, ease, today);
                break;
            case 2: // Review card
                this.handleReviewCard(card, ease, today);
                break;
        }
        
        // Update reps and lapses
        card.reps = (card.reps || 0) + 1;
        if (ease === 1) { // Again
            card.lapses = (card.lapses || 0) + 1;
        }
        
        // Update modification time
        card.mod = now;
        
        // Check for leech
        if (card.lapses >= this.config.leechThreshold) {
            this.handleLeech(card);
        }
        
        // Return updated card and previous state for undo
        return {
            updatedCard: card,
            previousState: previousState,
            reviewLog: {
                cid: card.id,
                ease: ease,
                ivl: card.ivl,
                lastIvl: previousState.ivl || 0,
                factor: card.factor,
                time: timeTaken,
                type: card.type
            }
        };
    }

    handleNewCard(card, ease, today) {
        switch (ease) {
            case 1: // Again
                card.queue = 1; // Learning
                card.type = 1; // Learning
                card.left = this.config.learningSteps.length;
                card.due = today;
                card.ivl = 0;
                break;
            case 2: // Hard (not typically shown for new cards)
            case 3: // Good
                card.queue = 2; // Review
                card.type = 2; // Review
                card.left = 0;
                card.due = today + this.config.graduatingInterval;
                card.ivl = this.config.graduatingInterval;
                card.factor = this.config.startingEase;
                break;
            case 4: // Easy
                card.queue = 2; // Review
                card.type = 2; // Review
                card.left = 0;
                card.due = today + this.config.easyInterval;
                card.ivl = this.config.easyInterval;
                card.factor = this.config.startingEase;
                break;
        }
    }

    handleLearningCard(card, ease, today) {
        if (ease === 1) { // Again
            // Reset learning steps
            card.left = this.config.learningSteps.length;
            card.due = today;
        } else {
            // Move to next step or graduate
            card.left = Math.max(0, (card.left || 1) - 1);
            
            if (card.left === 0) {
                // Graduate from learning
                card.queue = 2; // Review
                card.type = 2; // Review
                
                if (card.ivl === 0) {
                    // First graduation
                    card.ivl = this.config.graduatingInterval;
                    card.due = today + card.ivl;
                } else {
                    // From relearning
                    card.due = today + card.ivl;
                }
            } else {
                // Next learning step
                const stepIndex = this.config.learningSteps.length - card.left;
                const stepMinutes = this.config.learningSteps[stepIndex];
                card.due = today + (stepMinutes / 1440); // Convert minutes to days
            }
        }
    }

    handleReviewCard(card, ease, today) {
        let interval = card.ivl || 1;
        
        switch (ease) {
            case 1: // Again
                // Lapse - reset to learning
                card.queue = 1; // Learning
                card.type = 1; // Learning
                card.left = this.config.learningSteps.length;
                card.ivl = 0;
                card.due = today;
                
                // Reduce ease factor
                card.factor = Math.max(
                    this.config.minimumEase,
                    (card.factor || this.config.startingEase) - 0.2
                );
                break;
                
            case 2: // Hard
                interval = Math.ceil(interval * this.config.hardIntervalModifier);
                card.factor = Math.max(
                    this.config.minimumEase,
                    (card.factor || this.config.startingEase) - 0.15
                );
                card.due = today + interval;
                card.ivl = interval;
                break;
                
            case 3: // Good
                interval = Math.ceil(interval * (card.factor || this.config.startingEase));
                card.due = today + interval;
                card.ivl = interval;
                break;
                
            case 4: // Easy
                interval = Math.ceil(interval * (card.factor || this.config.startingEase) * this.config.easyBonus);
                card.factor = Math.min(
                    2.5,
                    (card.factor || this.config.startingEase) + 0.15
                );
                card.due = today + interval;
                card.ivl = interval;
                break;
        }
        
        // Cap interval at maximum
        card.ivl = Math.min(card.ivl, this.config.maximumInterval);
        
        // Update due date if not set by lapse
        if (ease !== 1) {
            card.due = today + card.ivl;
        }
    }

    handleLeech(card) {
        switch (this.config.leechAction) {
            case 'suspend':
                card.queue = -1; // Suspended
                break;
            case 'tag':
                // Add leech tag
                if (!card.tags) card.tags = [];
                if (!card.tags.includes('leech')) {
                    card.tags.push('leech');
                }
                break;
        }
    }

    // Calculate next due date for a card
    calculateNextDue(card, ease) {
        const today = Math.floor(Date.now() / 86400000);
        const testCard = { ...card };
        this.scheduleCard(testCard, ease, 0);
        return testCard.due;
    }

    // Get interval in human readable format
    getIntervalString(interval) {
        if (interval < 1) {
            const minutes = Math.round(interval * 1440);
            if (minutes < 60) {
                return `${minutes}m`;
            } else {
                const hours = Math.round(minutes / 60);
                return `${hours}h`;
            }
        } else if (interval < 30) {
            return `${Math.round(interval)}d`;
        } else if (interval < 365) {
            const months = Math.round(interval / 30);
            return `${months}mo`;
        } else {
            const years = Math.round(interval / 365);
            return `${years}y`;
        }
    }

    // Calculate daily review forecast
    calculateForecast(cards) {
        const forecast = {};
        const today = Math.floor(Date.now() / 86400000);
        
        cards.forEach(card => {
            if (card.due <= today) {
                forecast.today = (forecast.today || 0) + 1;
            } else {
                const daysUntilDue = card.due - today;
                if (daysUntilDue <= 7) {
                    forecast.thisWeek = (forecast.thisWeek || 0) + 1;
                }
                if (daysUntilDue <= 30) {
                    forecast.thisMonth = (forecast.thisMonth || 0) + 1;
                }
            }
        });
        
        return forecast;
    }

    // Generate review order (mix new and review cards)
    generateReviewOrder(newCards, reviewCards, limit) {
        const order = [];
        let newIndex = 0;
        let reviewIndex = 0;
        
        // Mix new and review cards (1 new for every 5 reviews)
        while (order.length < limit && (newIndex < newCards.length || reviewIndex < reviewCards.length)) {
            // Add review card if available and we haven't exceeded the ratio
            if (reviewIndex < reviewCards.length && (order.length % 6 !== 0 || newIndex >= newCards.length)) {
                order.push(reviewCards[reviewIndex]);
                reviewIndex++;
            }
            // Add new card if available
            else if (newIndex < newCards.length) {
                order.push(newCards[newIndex]);
                newIndex++;
            }
            // Otherwise add remaining review cards
            else if (reviewIndex < reviewCards.length) {
                order.push(reviewCards[reviewIndex]);
                reviewIndex++;
            }
        }
        
        return order;
    }

    // Calculate retention rate
    calculateRetention(reviewLogs) {
        if (!reviewLogs.length) return 100;
        
        const lastWeek = Date.now() - 7 * 86400000;
        const recentLogs = reviewLogs.filter(log => log.time > lastWeek);
        
        if (!recentLogs.length) return 100;
        
        const remembered = recentLogs.filter(log => log.ease >= 3).length;
        return Math.round((remembered / recentLogs.length) * 100);
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
}

// Export scheduler instance
const scheduler = new Scheduler();

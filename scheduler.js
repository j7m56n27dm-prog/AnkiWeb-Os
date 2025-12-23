// ANKI iOS - SM-2 Scheduler
class Scheduler {
    constructor() {
        // Default settings (Anki defaults)
        this.config = {
            learningSteps: [1, 10], // minutes
            relearningSteps: [10],
            graduatingInterval: 1, // days
            easyInterval: 4,
            startingEase: 2.5,
            hardInterval: 1.2,
            easyBonus: 1.3,
            intervalModifier: 1.0,
            maximumInterval: 36500,
            minimumEase: 1.3,
            lapsePenalty: 0,
            leechThreshold: 8,
            leechAction: 'suspend',
            newCardsPerDay: 20,
            reviewsPerDay: 200,
            maximumReviewsPerDay: 9999,
            buryNew: true,
            buryReviews: true,
            buryInterdayLearning: false
        };
    }

    // Main scheduling function
    schedule(card, ease, timeTaken) {
        const today = Math.floor(Date.now() / 86400000);
        const previousState = { ...card };
        
        // Convert ease factor from 2500 format to 2.5
        const easeFactor = (card.easeFactor || 2500) / 1000;
        
        switch (card.queue) {
            case 0: // New card
                return this._scheduleNewCard(card, ease, today, easeFactor);
            case 1: // Learning
            case 3: // Relearning
                return this._scheduleLearningCard(card, ease, today, easeFactor);
            case 2: // Review
                return this._scheduleReviewCard(card, ease, today, easeFactor);
            default:
                return { card, previousState };
        }
    }

    _scheduleNewCard(card, ease, today, easeFactor) {
        const previousState = { ...card };
        
        switch (ease) {
            case 1: // Again
                card.queue = 1; // Learning
                card.cardType = 1;
                card.left = this.config.learningSteps.length;
                card.due = today;
                card.interval = 0;
                break;
                
            case 2: // Hard (not shown for new cards in Anki, but handle it)
            case 3: // Good
                card.queue = 2; // Review
                card.cardType = 2;
                card.left = 0;
                card.due = today + this.config.graduatingInterval;
                card.interval = this.config.graduatingInterval;
                card.easeFactor = Math.max(1300, Math.round(easeFactor * 1000));
                break;
                
            case 4: // Easy
                card.queue = 2; // Review
                card.cardType = 2;
                card.left = 0;
                card.due = today + this.config.easyInterval;
                card.interval = this.config.easyInterval;
                card.easeFactor = Math.max(1300, Math.round(easeFactor * 1000));
                break;
        }
        
        card.reps = (card.reps || 0) + 1;
        if (ease === 1) card.lapses = (card.lapses || 0) + 1;
        
        return { card, previousState };
    }

    _scheduleLearningCard(card, ease, today, easeFactor) {
        const previousState = { ...card };
        
        if (ease === 1) { // Again
            // Reset learning steps
            card.left = card.queue === 3 ? 
                this.config.relearningSteps.length : 
                this.config.learningSteps.length;
            card.due = today;
        } else {
            // Move to next step or graduate
            card.left = Math.max(0, (card.left || 1) - 1);
            
            if (card.left === 0) {
                // Graduate from learning
                card.queue = 2; // Review
                card.cardType = 2;
                
                if (card.interval === 0) {
                    // First graduation
                    card.interval = this.config.graduatingInterval;
                    card.due = today + card.interval;
                } else {
                    // From relearning
                    card.due = today + card.interval;
                }
            } else {
                // Next learning step
                const steps = card.queue === 3 ? 
                    this.config.relearningSteps : 
                    this.config.learningSteps;
                const stepIndex = steps.length - card.left;
                const stepMinutes = steps[stepIndex];
                card.due = today + (stepMinutes / 1440); // Convert minutes to days
            }
        }
        
        card.reps = (card.reps || 0) + 1;
        if (ease === 1) card.lapses = (card.lapses || 0) + 1;
        
        return { card, previousState };
    }

    _scheduleReviewCard(card, ease, today, easeFactor) {
        const previousState = { ...card };
        let interval = card.interval || 1;
        
        switch (ease) {
            case 1: // Again
                // Lapse
                card.queue = 3; // Relearning
                card.cardType = 3;
                card.left = this.config.relearningSteps.length;
                card.interval = Math.max(1, Math.floor(interval * this.config.lapsePenalty));
                card.due = today;
                
                // Reduce ease factor
                const newEase = easeFactor - 0.2;
                card.easeFactor = Math.max(1300, Math.round(newEase * 1000));
                break;
                
            case 2: // Hard
                interval = Math.max(1, Math.ceil(interval * this.config.hardInterval));
                card.due = today + interval;
                card.interval = interval;
                
                // Slightly reduce ease factor
                const hardEase = easeFactor - 0.15;
                card.easeFactor = Math.max(1300, Math.round(hardEase * 1000));
                break;
                
            case 3: // Good
                interval = Math.ceil(interval * easeFactor * this.config.intervalModifier);
                card.due = today + interval;
                card.interval = interval;
                break;
                
            case 4: // Easy
                interval = Math.ceil(interval * easeFactor * this.config.intervalModifier * this.config.easyBonus);
                card.due = today + interval;
                card.interval = interval;
                
                // Increase ease factor
                const easyEase = easeFactor + 0.15;
                card.easeFactor = Math.min(2500, Math.round(easyEase * 1000));
                break;
        }
        
        // Cap interval
        card.interval = Math.min(card.interval, this.config.maximumInterval);
        
        // Update reps
        card.reps = (card.reps || 0) + 1;
        if (ease === 1) card.lapses = (card.lapses || 0) + 1;
        
        // Check for leech
        if (card.lapses >= this.config.leechThreshold) {
            this._handleLeech(card);
        }
        
        return { card, previousState };
    }

    _handleLeech(card) {
        if (this.config.leechAction === 'suspend') {
            card.queue = -1; // Suspended
        }
        // Could also tag the card here
    }

    // Calculate next interval for display
    nextInterval(card, ease) {
        const testCard = { ...card };
        const result = this.schedule(testCard, ease, 0);
        return result.card.interval;
    }

    // Get interval in human readable format
    formatInterval(interval) {
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
    forecast(cards) {
        const forecast = {};
        const today = Math.floor(Date.now() / 86400000);
        
        for (const card of cards) {
            if (card.due <= today && card.queue >= 0) {
                forecast.today = (forecast.today || 0) + 1;
            } else if (card.due > today) {
                const days = card.due - today;
                if (days <= 7) {
                    forecast.week = (forecast.week || 0) + 1;
                }
                if (days <= 30) {
                    forecast.month = (forecast.month || 0) + 1;
                }
            }
        }
        
        return forecast;
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// Global scheduler instance
const scheduler = new Scheduler();

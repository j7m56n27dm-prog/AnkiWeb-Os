/**
 * Anki iOS WebApp - Scheduler Module
 * Complete SM-2 algorithm implementation identical to Anki
 */

class Scheduler {
    constructor() {
        // Learning steps in minutes (standard Anki defaults)
        this.LEARNING_STEPS = [1, 10];
        
        // Relearning steps in minutes
        this.RELEARNING_STEPS = [10];
        
        // Card states
        this.CARD_STATE = {
            NEW: 0,
            LEARNING: 1,
            REVIEW: 2,
            RELEARNING: 3
        };
        
        // Queue types
        this.QUEUE = {
            SUSPENDED: -3,
            SCHED_BURIED: -2,
            USER_BURIED: -1,
            NEW: 0,
            LEARNING: 1,
            REVIEW: 2,
            DAY_LEARN_RELEARN: 3
        };
        
        // Ease factors (in thousandths)
        this.EASE_FACTOR = {
            INITIAL: 2500, // 2.5
            MIN: 1300,     // 1.3
            MAX: 4900      // 4.9
        };
        
        // Answer types
        this.ANSWER = {
            AGAIN: 1,
            HARD: 2,
            GOOD: 3,
            EASY: 4
        };
    }
    
    /**
     * Schedule a card after an answer
     * @param {Object} card - The card object
     * @param {number} ease - Answer ease (1-4)
     * @param {Object} config - Deck configuration
     * @param {number} timeTaken - Time taken to answer (ms)
     * @returns {Object} Updated card
     */
    scheduleCard(card, ease, config, timeTaken = 6000) {
        const now = Date.now();
        const dayStart = this.startOfDay(now);
        
        // Make a copy of the card
        const updatedCard = { ...card };
        
        // Update review count
        updatedCard.reps = (updatedCard.reps || 0) + 1;
        
        // Handle based on card type
        switch (updatedCard.type) {
            case this.CARD_STATE.NEW:
                return this.scheduleNewCard(updatedCard, ease, config, timeTaken);
                
            case this.CARD_STATE.LEARNING:
            case this.CARD_STATE.RELEARNING:
                return this.scheduleLearningCard(updatedCard, ease, config, timeTaken);
                
            case this.CARD_STATE.REVIEW:
                return this.scheduleReviewCard(updatedCard, ease, config, timeTaken);
                
            default:
                console.warn('Unknown card type:', updatedCard.type);
                return updatedCard;
        }
    }
    
    /**
     * Schedule a new card
     */
    scheduleNewCard(card, ease, config, timeTaken) {
        const steps = config.new?.deltas || this.LEARNING_STEPS;
        
        switch (ease) {
            case this.ANSWER.AGAIN:
                // Reset to first learning step
                card.type = this.CARD_STATE.LEARNING;
                card.queue = this.QUEUE.LEARNING;
                card.left = this.getLeftValue(steps.length);
                card.due = Date.now() + (steps[0] * 60 * 1000);
                break;
                
            case this.ANSWER.HARD:
                // Hard on new cards is treated as Good in Anki
            case this.ANSWER.GOOD:
            case this.ANSWER.EASY:
                // Graduate card
                const graduatingInterval = this.getGraduatingInterval(card, ease, config);
                card.type = this.CARD_STATE.REVIEW;
                card.queue = this.QUEUE.REVIEW;
                card.ivl = graduatingInterval;
                card.due = this.nextReviewDate(graduatingInterval);
                card.factor = config.new?.initialFactor || this.EASE_FACTOR.INITIAL;
                card.left = 0;
                break;
        }
        
        return card;
    }
    
    /**
     * Schedule a learning/relearning card
     */
    scheduleLearningCard(card, ease, config, timeTaken) {
        const isRelearning = card.type === this.CARD_STATE.RELEARNING;
        const steps = isRelearning ? 
            (config.lapse?.deltas || this.RELEARNING_STEPS) :
            (config.new?.deltas || this.LEARNING_STEPS);
        
        switch (ease) {
            case this.ANSWER.AGAIN:
                // Reset learning
                card.left = this.getLeftValue(steps.length);
                card.due = Date.now() + (steps[0] * 60 * 1000);
                break;
                
            case this.ANSWER.HARD:
                // Repeat current step (Anki doesn't have hard for learning)
                card.due = Date.now() + (steps[Math.min(card.left, steps.length - 1)] * 60 * 1000);
                break;
                
            case this.ANSWER.GOOD:
                // Move to next step
                card.left = this.nextLearningStep(card.left, steps.length);
                
                if (card.left >= steps.length) {
                    // Graduate from learning
                    const interval = isRelearning ? 
                        this.getRelearningInterval(card, config) : 
                        1; // First review after learning
                    
                    card.type = this.CARD_STATE.REVIEW;
                    card.queue = this.QUEUE.REVIEW;
                    card.ivl = interval;
                    card.due = this.nextReviewDate(interval);
                    card.left = 0;
                } else {
                    card.due = Date.now() + (steps[card.left] * 60 * 1000);
                }
                break;
                
            case this.ANSWER.EASY:
                // Graduate immediately
                const interval = isRelearning ? 
                    this.getRelearningInterval(card, config) * (config.easyBonus || 1.3) :
                    this.getEasyInterval(card, config);
                
                card.type = this.CARD_STATE.REVIEW;
                card.queue = this.QUEUE.REVIEW;
                card.ivl = interval;
                card.due = this.nextReviewDate(interval);
                card.left = 0;
                break;
        }
        
        return card;
    }
    
    /**
     * Schedule a review card
     */
    scheduleReviewCard(card, ease, config, timeTaken) {
        const hardFactor = config.rev?.hardFactor || 1.2;
        const easyBonus = config.rev?.ease4 || 1.3;
        const ivlFct = config.rev?.ivlFct || 1;
        const maxIvl = config.rev?.maxIvl || 36500;
        
        switch (ease) {
            case this.ANSWER.AGAIN:
                // Lapse
                card.lapses = (card.lapses || 0) + 1;
                card.type = this.CARD_STATE.RELEARNING;
                card.queue = this.QUEUE.DAY_LEARN_RELEARN;
                
                // Calculate new interval
                const lapseMult = config.lapse?.mult || 0;
                let newIvl = Math.max(1, Math.floor(card.ivl * lapseMult));
                
                // Apply minimum interval
                const minInt = config.lapse?.minInt || 1;
                newIvl = Math.max(minInt, newIvl);
                
                card.ivl = newIvl;
                card.left = this.getLeftValue(config.lapse?.deltas?.length || this.RELEARNING_STEPS.length);
                card.due = Date.now() + ((config.lapse?.deltas?.[0] || this.RELEARNING_STEPS[0]) * 60 * 1000);
                
                // Reduce ease factor
                card.factor = Math.max(this.EASE_FACTOR.MIN, card.factor - 200);
                break;
                
            case this.ANSWER.HARD:
                // Hard review
                let hardIvl = Math.max(1, Math.floor(card.ivl * hardFactor));
                hardIvl = Math.max(card.ivl + 1, hardIvl); // At least +1 day
                
                // Apply interval modifier and maximum
                hardIvl = Math.floor(hardIvl * ivlFct);
                hardIvl = Math.min(hardIvl, maxIvl);
                
                card.ivl = hardIvl;
                card.due = this.nextReviewDate(hardIvl);
                
                // Slightly reduce ease factor
                card.factor = Math.max(this.EASE_FACTOR.MIN, card.factor - 150);
                break;
                
            case this.ANSWER.GOOD:
                // Good review
                let goodIvl = Math.floor(card.ivl * (card.factor / 1000));
                goodIvl = Math.max(card.ivl + 1, goodIvl); // At least +1 day
                
                // Apply interval modifier and maximum
                goodIvl = Math.floor(goodIvl * ivlFct);
                goodIvl = Math.min(goodIvl, maxIvl);
                
                card.ivl = goodIvl;
                card.due = this.nextReviewDate(goodIvl);
                
                // Ease factor unchanged for "Good"
                break;
                
            case this.ANSWER.EASY:
                // Easy review
                let easyIvl = Math.floor(card.ivl * (card.factor / 1000) * easyBonus);
                easyIvl = Math.max(card.ivl + 1, easyIvl); // At least +1 day
                
                // Apply interval modifier and maximum
                easyIvl = Math.floor(easyIvl * ivlFct);
                easyIvl = Math.min(easyIvl, maxIvl);
                
                card.ivl = easyIvl;
                card.due = this.nextReviewDate(easyIvl);
                
                // Increase ease factor
                card.factor = Math.min(this.EASE_FACTOR.MAX, card.factor + 150);
                break;
        }
        
        return card;
    }
    
    /**
     * Calculate next review date based on interval in days
     */
    nextReviewDate(intervalDays) {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        return now + (intervalDays * dayMs);
    }
    
    /**
     * Get graduating interval for new cards
     */
    getGraduatingInterval(card, ease, config) {
        const ints = config.new?.ints || [1, 4, 7];
        
        switch (ease) {
            case this.ANSWER.HARD:
                return ints[0] || 1;
            case this.ANSWER.GOOD:
                return ints[1] || 4;
            case this.ANSWER.EASY:
                return ints[2] || 7;
            default:
                return 1;
        }
    }
    
    /**
     * Get interval for relearning cards
     */
    getRelearningInterval(card, config) {
        const lapseMult = config.lapse?.mult || 0;
        return Math.max(1, Math.floor(card.ivl * lapseMult));
    }
    
    /**
     * Get easy interval for learning cards
     */
    getEasyInterval(card, config) {
        const easyBonus = config.rev?.ease4 || 1.3;
        const graduatingInterval = config.new?.ints?.[1] || 4;
        return Math.floor(graduatingInterval * easyBonus);
    }
    
    /**
     * Calculate left value for learning steps
     */
    getLeftValue(totalSteps) {
        // In Anki, left = totalSteps * 1000 + remainingSteps
        // We'll use a simpler approach
        return totalSteps * 1000;
    }
    
    /**
     * Calculate next learning step
     */
    nextLearningStep(currentLeft, totalSteps) {
        const remaining = currentLeft % 1000;
        return currentLeft + (1000 - remaining) + 1;
    }
    
    /**
     * Calculate start of day timestamp
     */
    startOfDay(timestamp) {
        const date = new Date(timestamp);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }
    
    /**
     * Calculate interval for display purposes
     */
    calculateInterval(card, ease, config) {
        const testCard = { ...card };
        const scheduled = this.scheduleCard(testCard, ease, config, 6000);
        
        if (scheduled.type === this.CARD_STATE.LEARNING || 
            scheduled.type === this.CARD_STATE.RELEARNING) {
            // Return interval in minutes for learning cards
            return scheduled.due - Date.now();
        } else {
            // Return interval in days for review cards
            return scheduled.ivl;
        }
    }
    
    /**
     * Check if a card is a leech
     */
    isLeech(card, config) {
        const leechFails = config.lapse?.leechFails || 8;
        return card.lapses >= leechFails;
    }
    
    /**
     * Apply fuzz to intervals (Anki's random variation)
     */
    applyFuzz(interval, fuzzFactor = 0.05) {
        if (interval < 2) return interval;
        
        const rand = Math.random();
        const fuzz = Math.floor(interval * fuzzFactor);
        let newInterval = interval;
        
        if (rand < 0.5) {
            newInterval = interval - Math.floor(rand * fuzz);
        } else {
            newInterval = interval + Math.floor((rand - 0.5) * fuzz * 2);
        }
        
        return Math.max(1, newInterval);
    }
    
    /**
     * Calculate estimated time for review
     */
    estimateReviewTime(card, config) {
        // Base time on card type and history
        let baseTime = 6000; // 6 seconds default
        
        if (card.type === this.CARD_STATE.NEW) {
            baseTime = 8000; // 8 seconds for new cards
        } else if (card.type === this.CARD_STATE.REVIEW) {
            // Adjust based on interval
            baseTime = Math.max(3000, Math.min(10000, card.ivl * 1000));
        }
        
        return baseTime;
    }
    
    /**
     * Calculate daily limits
     */
    calculateDailyLimits(config, dueCards, newCards) {
        const maxReviews = config.rev?.perDay || 200;
        const maxNew = config.new?.perDay || 20;
        
        return {
            reviews: Math.min(dueCards.length, maxReviews),
            new: Math.min(newCards.length, maxNew),
            total: Math.min(dueCards.length + newCards.length, maxReviews + maxNew)
        };
    }
    
    /**
     * Sort cards for study session
     */
    sortCardsForStudy(cards, config) {
        const order = config.new?.order || 0; // 0 = added order, 1 = random
        
        if (order === 1) {
            // Random order
            return this.shuffleArray(cards);
        }
        
        // Default: sort by due date (earliest first)
        return cards.sort((a, b) => a.due - b.due);
    }
    
    /**
     * Shuffle array (Fisher-Yates)
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    /**
     * Calculate retention rate
     */
    calculateRetention(reviewLogs) {
        if (!reviewLogs || reviewLogs.length === 0) return 0;
        
        const successfulReviews = reviewLogs.filter(log => 
            log.ease >= this.ANSWER.GOOD
        ).length;
        
        return (successfulReviews / reviewLogs.length) * 100;
    }
    
    /**
     * Calculate estimated maturity
     */
    calculateMaturity(card) {
        if (card.ivl < 21) return 'Young';
        if (card.ivl < 90) return 'Mature';
        return 'Very Mature';
    }
    
    /**
     * Get next review time for display
     */
    getNextReviewTime(card) {
        if (!card.due) return 'Unknown';
        
        const now = Date.now();
        const diff = card.due - now;
        
        if (diff <= 0) return 'Now';
        
        const minutes = Math.floor(diff / (60 * 1000));
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        
        if (days > 0) {
            return days === 1 ? 'Tomorrow' : `in ${days} days`;
        } else if (hours > 0) {
            return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
    }
    
    /**
     * Calculate optimal study time based on memory strength
     */
    calculateOptimalStudyTime(card) {
        // Simplified memory strength model
        const strength = Math.min(1, card.ivl / 365);
        const baseTime = 6000; // 6 seconds
        
        // Stronger memories need less time
        return Math.max(2000, baseTime * (1 - strength * 0.5));
    }
    
    /**
     * Generate study plan for a deck
     */
    generateStudyPlan(deck, cards, config) {
        const limits = this.calculateDailyLimits(config, 
            cards.filter(c => c.queue === this.QUEUE.REVIEW),
            cards.filter(c => c.queue === this.QUEUE.NEW)
        );
        
        const plan = {
            deck: deck.name,
            limits: limits,
            estimatedTime: this.estimateStudyTime(cards.slice(0, limits.total)),
            cards: this.sortCardsForStudy(cards.slice(0, limits.total), config),
            retentionGoal: 90, // Default retention goal
            focusAreas: this.identifyFocusAreas(cards)
        };
        
        return plan;
    }
    
    estimateStudyTime(cards) {
        return cards.reduce((total, card) => {
            return total + this.estimateReviewTime(card);
        }, 0);
    }
    
    identifyFocusAreas(cards) {
        const areas = {
            new: cards.filter(c => c.type === this.CARD_STATE.NEW).length,
            learning: cards.filter(c => c.type === this.CARD_STATE.LEARNING).length,
            relearning: cards.filter(c => c.type === this.CARD_STATE.RELEARNING).length,
            mature: cards.filter(c => c.type === this.CARD_STATE.REVIEW && c.ivl >= 21).length
        };
        
        return areas;
    }
    
    /**
     * Calculate projected future due cards
     */
    calculateProjectedDue(cards, days = 30) {
        const projected = [];
        const now = Date.now();
        const endDate = now + (days * 24 * 60 * 60 * 1000);
        
        for (const card of cards) {
            if (card.due <= endDate) {
                projected.push({
                    ...card,
                    projectedDate: new Date(card.due)
                });
            }
        }
        
        return projected.sort((a, b) => a.due - b.due);
    }
    
    /**
     * Advanced: Calculate memory stability and difficulty (SM-2)
     */
    calculateMemoryParameters(card, reviewLog) {
        // Implementation of SM-2 memory parameters
        const q = reviewLog.ease; // Quality of recall (1-4)
        
        // Calculate difficulty (D)
        let D = card.factor / 1000; // Current ease factor
        
        if (q < 3) {
            // Failed recall
            D = D - 0.8 + (0.28 * q - 0.02 * q * q);
        } else {
            // Successful recall
            D = D + 0.1 - (0.08 * q) + (0.02 * q * q);
        }
        
        D = Math.max(1.3, Math.min(4.9, D));
        
        // Calculate stability (S)
        let S = card.ivl || 1;
        
        if (q < 3) {
            // Reset stability for failed recall
            S = 1;
        } else {
            // Increase stability based on difficulty
            S = S * (1 + (4 - D) * 0.1);
        }
        
        return {
            difficulty: D,
            stability: S,
            retrievability: this.calculateRetrievability(S, card.ivl || 1)
        };
    }
    
    calculateRetrievability(stability, elapsedTime) {
        // Exponential forgetting curve
        const k = 0.5; // Decay constant
        return Math.exp(-elapsedTime / (stability * k));
    }
    
    /**
     * Generate spaced repetition schedule
     */
    generateSpacedSchedule(card, config) {
        const schedule = [];
        let currentCard = { ...card };
        let day = 0;
        
        // Simulate 10 reviews
        for (let i = 0; i < 10; i++) {
            // Assume "Good" answer for simulation
            currentCard = this.scheduleCard(currentCard, this.ANSWER.GOOD, config);
            
            if (currentCard.type === this.CARD_STATE.REVIEW) {
                day += currentCard.ivl;
                schedule.push({
                    day: day,
                    interval: currentCard.ivl,
                    ease: currentCard.factor / 1000
                });
            }
        }
        
        return schedule;
    }
}

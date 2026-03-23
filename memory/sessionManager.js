/**
 * Astra A0 — Session Memory Manager
 * Maintains session-based symptom accumulation with auto-expiry.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

class SessionManager {
    constructor() {
        this.sessions = new Map();
        // Periodic cleanup of expired sessions
        this._cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
        if (this._cleanupTimer.unref) this._cleanupTimer.unref();
    }

    /**
     * Get or create a session.
     */
    _getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                symptoms: new Set(),
                language: null,
                history: [],
                lastActive: Date.now(),
                turnCount: 0,
                createdAt: Date.now()
            });
        }
        const session = this.sessions.get(sessionId);
        session.lastActive = Date.now();
        return session;
    }

    /**
     * Add symptoms to session (deduplication handled by Set).
     */
    addSymptoms(sessionId, symptoms, language) {
        const session = this._getSession(sessionId);
        for (const s of symptoms) {
            session.symptoms.add(s.toLowerCase().trim());
        }
        if (language) session.language = language;
        session.turnCount++;
        return this.getSymptoms(sessionId);
    }

    /**
     * Get all accumulated symptoms for a session.
     */
    getSymptoms(sessionId) {
        const session = this._getSession(sessionId);
        return Array.from(session.symptoms);
    }

    /**
     * Get session language.
     */
    getLanguage(sessionId) {
        const session = this._getSession(sessionId);
        return session.language || 'english';
    }

    /**
     * Add a message to conversation history.
     */
    addToHistory(sessionId, role, message) {
        const session = this._getSession(sessionId);
        session.history.push({
            role,
            message,
            timestamp: Date.now()
        });
        // Keep only last 20 messages
        if (session.history.length > 20) {
            session.history = session.history.slice(-20);
        }
    }

    /**
     * Get conversation history.
     */
    getHistory(sessionId) {
        const session = this._getSession(sessionId);
        return session.history;
    }

    /**
     * Get turn count for session.
     */
    getTurnCount(sessionId) {
        const session = this._getSession(sessionId);
        return session.turnCount;
    }

    /**
     * Reset a session (new conversation).
     */
    reset(sessionId) {
        this.sessions.delete(sessionId);
    }

    /**
     * Check if session exists.
     */
    hasSession(sessionId) {
        return this.sessions.has(sessionId);
    }

    /**
     * Cleanup expired sessions.
     */
    _cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastActive > SESSION_TTL_MS) {
                this.sessions.delete(id);
            }
        }
    }

    /**
     * Get stats for monitoring.
     */
    getStats() {
        return {
            activeSessions: this.sessions.size,
            sessions: Array.from(this.sessions.entries()).map(([id, s]) => ({
                id: id.substr(0, 8) + '...',
                symptoms: Array.from(s.symptoms),
                turns: s.turnCount,
                language: s.language
            }))
        };
    }

    destroy() {
        clearInterval(this._cleanupTimer);
        this.sessions.clear();
    }
}

// Singleton
module.exports = new SessionManager();

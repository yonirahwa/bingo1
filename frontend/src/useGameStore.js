/**
 * useGameStore.js — central game state (Zustand-lite via React context)
 * We use a simple module singleton so any component can import it.
 * Updated via socket events in App.jsx.
 */
import { useState, useCallback } from 'react';

export function createInitialState() {
    return {
        phase: 'lobby',  // 'lobby' | 'playing' | 'ended'
        timer: 40,
        balance: 0,
        totalTaken: 0,
        takenCards: {},       // { [cardId]: { userName } }
        calledNumbers: [],
        winPot: 0,
        myCards: [],       // [cardId, ...]
        suspendedCards: [],
        winners: [],
        cards: [],       // all 400 bingo cards
        playerCount: 0,
        myMarks: {},       // { [cardId]: Set<number> }
        latestNumber: null,
        stake: 20,         // Current stake value from backend
        maintenanceMode: false,
    };
}

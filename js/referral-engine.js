/**
 * NEXUS P2P - Referral & Rewards Engine
 * Tracks contact invitations towards a 20-contact milestone and unlocks
 * promotional items and bonus vouchers offered by participating regional stores.
 */
class ReferralEngine {
    constructor(storageEngine) {
        this.storage = storageEngine;
        this.rewardsList = [
            { id: 'rew_1', title: 'Funda Protectora Hi-Fi Pro', storeName: 'TechZone Store', requiredInvites: 20, icon: '🎁', value: '$15.00' },
            { id: 'rew_2', title: 'Cupón Envío Gratis Express', storeName: 'Express Courier P2P', requiredInvites: 10, icon: '🚚', value: '$15.00' },
            { id: 'rew_3', title: 'Cargador Rápido USB-C 25W', storeName: 'Gadget Store Sur', requiredInvites: 20, icon: '🔌', value: '$25.00' }
        ];
    }

    getState() {
        return this.storage.getReferralState();
    }

    addReferral() {
        const state = this.storage.incrementReferral();
        this.logReferralEvent(`🎉 ¡Nuevo contacto invitado! Progreso: ${state.invitedCount}/20 contactos.`);
        return state;
    }

    getRewards() {
        const state = this.getState();
        return this.rewardsList.map(rew => ({
            ...rew,
            isUnlocked: state.invitedCount >= rew.requiredInvites
        }));
    }

    logReferralEvent(text) {
        console.log(`[REFERRAL ENGINE] ${text}`);
        const consoleEl = document.getElementById('consoleBody');
        if (consoleEl) {
            const div = document.createElement('div');
            div.className = 'console-log';
            div.style.color = '#f59e0b';
            div.textContent = `[REFERRAL PROGRAM] ${text}`;
            consoleEl.appendChild(div);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }
}

window.referralEngine = new ReferralEngine(window.buyerStorage);

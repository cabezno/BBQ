/**
 * NEXUS P2P - Storage Engine (SQLite / IndexedDB Simulation)
 * Guarantees 100% data sovereignty. Each device/node is the sole owner of its database.
 */
class LocalStorageEngine {
    constructor(nodeId) {
        this.nodeId = nodeId || 'p2p_buyer_7721';
        this.dbKey = `nexus_sqlite_db_${this.nodeId}`;
        this.initDatabase();
    }

    initDatabase() {
        if (!localStorage.getItem(this.dbKey)) {
            const initialData = {
                nodeId: this.nodeId,
                profile: {
                    name: this.nodeId === 'p2p_store_techzone' ? 'TechZone Store' : 
                          this.nodeId === 'p2p_courier_express' ? 'Express Courier P2P' : 'Usuario Comprador',
                    role: this.nodeId.includes('store') ? 'merchant' : 
                          this.nodeId.includes('courier') ? 'logistics' : 'buyer',
                    region: 'metrosur',
                    bio: 'Nodo P2P operando sin servidores centrales.'
                },
                contacts: [],
                products: [
                    { id: 'prod_1', name: 'Auriculares Hi-Fi Wireless Pro', price: 100, stock: 12, category: 'Tech', image: '🎧', shippingFee: 15 },
                    { id: 'prod_2', name: 'Smartwatch AMOLED V2', price: 180, stock: 8, category: 'Tech', image: '⌚', shippingFee: 15 },
                    { id: 'prod_3', name: 'Cargador Solar Portátil 20000mAh', price: 45, stock: 25, category: 'Gadgets', image: '🔋', shippingFee: 8 }
                ],
                chats: [],
                escrowTransactions: [],
                referralState: {
                    invitedCount: 0,
                    target: 20,
                    unlockedRewards: []
                }
            };
            localStorage.setItem(this.dbKey, JSON.stringify(initialData));
        }
    }

    getDatabase() {
        return JSON.parse(localStorage.getItem(this.dbKey));
    }

    saveDatabase(data) {
        try {
            localStorage.setItem(this.dbKey, JSON.stringify(data));
            return true;
        } catch (e) {
            // Evita el fallo silencioso por QuotaExceededError (ej: imágenes muy grandes).
            console.error('[STORAGE] No se pudo guardar (¿almacenamiento lleno?):', e);
            if (typeof window !== 'undefined' && window.bbqToast) {
                window.bbqToast('⚠️ No se pudo guardar (almacenamiento lleno)');
            }
            return false;
        }
    }

    // --- PRODUCTS QUERY API ---
    getProducts() {
        return this.getDatabase().products || [];
    }

    saveProduct(product) {
        const db = this.getDatabase();
        const existingIndex = db.products.findIndex(p => p.id === product.id);
        if (existingIndex >= 0) {
            db.products[existingIndex] = product;
        } else {
            db.products.push(product);
        }
        this.saveDatabase(db);
    }

    // --- CHAT MESSAGES QUERY API ---
    getChatMessages(contactId) {
        const db = this.getDatabase();
        const chat = db.chats.find(c => c.contactId === contactId);
        return chat ? chat.messages : [];
    }

    appendChatMessage(contactId, message) {
        const db = this.getDatabase();
        let chat = db.chats.find(c => c.contactId === contactId);
        if (!chat) {
            chat = { contactId, messages: [] };
            db.chats.push(chat);
        }
        chat.messages.push(message);
        this.saveDatabase(db);
    }

    // --- ESCROW TRANSACTION LOG API ---
    saveEscrowTransaction(tx) {
        const db = this.getDatabase();
        db.escrowTransactions.push(tx);
        this.saveDatabase(db);
    }

    getEscrowTransactions() {
        return this.getDatabase().escrowTransactions || [];
    }

    // --- REFERRALS STATE API ---
    getReferralState() {
        return this.getDatabase().referralState;
    }

    incrementReferral() {
        const db = this.getDatabase();
        db.referralState.invitedCount++;
        this.saveDatabase(db);
        return db.referralState;
    }

    // --- PROFILE, STORE & AI CONFIG API ---
    getUserProfile() {
        const db = this.getDatabase();
        return db.userProfile || {
            name: '',
            status: 'Disponible en BBQ',
            phone: '',
            p2pId: this.nodeId,
            avatar: '👤',
            region: 'metrosur',
            isVerified: false
        };
    }

    saveUserProfile(profile) {
        const db = this.getDatabase();
        db.userProfile = profile;
        return this.saveDatabase(db);
    }

    getUserStore() {
        const db = this.getDatabase();
        return db.userStore || {
            id: `store_${this.nodeId}`,
            name: 'Mi Tienda P2P',
            category: 'Electrónica & Servicios',
            region: 'metrosur',
            bio: 'Tienda local con catálogo autónomo por P2P.',
            icon: '🏪',
            products: db.products || []
        };
    }

    saveUserStore(store) {
        const db = this.getDatabase();
        db.userStore = store;
        if (store.products) {
            db.products = store.products;
        }
        this.saveDatabase(db);
    }

    getAiConfig() {
        const db = this.getDatabase();
        return db.aiConfig || {
            engine: 'gemini_api', // wasm_local | gemini_api | openai_api | claude_api | deepseek_api | ollama_local | custom_api
            accessLevel: 3, // 1: Solo Lectura Pública | 2: Asistente Ventas | 3: Gestión Autónoma Pedidos | 4: Administrador Total
            apiKey: '',
            endpointUrl: 'https://api.openai.com/v1/chat/completions',
            systemPrompt: 'Eres el asistente virtual autónomo de la tienda. Atiendes consultas de inventario, stock y costos de envío de forma rápida y cordial.',
            autoReplyEnabled: true
        };
    }

    saveAiConfig(config) {
        const db = this.getDatabase();
        db.aiConfig = config;
        this.saveDatabase(db);
    }

    // --- CALLS LOG API ---
    getCalls() {
        const db = this.getDatabase();
        if (!db.calls || db.calls.length === 0) {
            db.calls = [
                {
                    id: 'call_1',
                    contactId: 'p2p_store_techzone',
                    contactName: 'TechZone Store 🏬',
                    contactAvatar: '🏬',
                    type: 'incoming', // incoming | outgoing | missed
                    timestamp: new Date(Date.now() - 1200000).toISOString()
                },
                {
                    id: 'call_2',
                    contactId: 'p2p_courier_express',
                    contactName: 'Express Courier P2P 🚚',
                    contactAvatar: '🚚',
                    type: 'outgoing',
                    timestamp: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: 'call_3',
                    contactId: 'p2p_contact_juan',
                    contactName: 'Juan Pérez 👨‍💼',
                    contactAvatar: '👨‍💼',
                    type: 'incoming',
                    timestamp: new Date(Date.now() - 172800000).toISOString()
                }
            ];
            this.saveDatabase(db);
        }
        // Return sorted by most recent first
        return db.calls.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    addCall(callObj) {
        const db = this.getDatabase();
        if (!db.calls) db.calls = [];
        db.calls.unshift(callObj);
        this.saveDatabase(db);
    }

    // --- COMMUNITIES LOG API ---
    getCommunities() {
        const db = this.getDatabase();
        if (!db.communities || db.communities.length === 0) {
            db.communities = [
                {
                    id: 'comm_1',
                    name: 'Comerciantes Zona Metro Sur 🏬',
                    category: 'Comerciantes',
                    description: '148 tiendas locales compartiendo stock, promociones y logística P2P.',
                    icon: '🏬',
                    bgColor: '#8b5cf6',
                    membersCount: 148,
                    region: 'metrosur'
                },
                {
                    id: 'comm_2',
                    name: 'Red de Couriers Autónomos 🚚',
                    category: 'Logistics',
                    description: 'Tarifas en tiempo real, rutas inteligentes y entregas por QR Google Wallet.',
                    icon: '🚚',
                    bgColor: '#06b6d4',
                    membersCount: 82,
                    region: 'metrosur'
                },
                {
                    id: 'comm_3',
                    name: 'Club de Tecno & Audio P2P 🎧',
                    category: 'Comunidad',
                    description: 'Entusiastas del audio Hi-Fi y lanzamientos tecnológicos sin intermediarios.',
                    icon: '🎧',
                    bgColor: '#ec4899',
                    membersCount: 230,
                    region: 'centro'
                }
            ];
            this.saveDatabase(db);
        }
        return db.communities;
    }

    addCommunity(commObj) {
        const db = this.getDatabase();
        if (!db.communities) db.communities = [];
        db.communities.unshift(commObj);
        this.saveDatabase(db);
    }

    // --- SEARCH HISTORY API ---
    getSearchHistory() {
        const db = this.getDatabase();
        return db.searchHistory || ['Auriculares Hi-Fi', 'Smartwatch', 'Courier Express', 'TechZone Store'];
    }

    saveSearchQuery(query) {
        if (!query || query.trim().length < 2) return;
        const db = this.getDatabase();
        if (!db.searchHistory) db.searchHistory = [];
        const clean = query.trim();
        db.searchHistory = db.searchHistory.filter(q => q.toLowerCase() !== clean.toLowerCase());
        db.searchHistory.unshift(clean);
        if (db.searchHistory.length > 8) db.searchHistory.pop();
        this.saveDatabase(db);
    }

    clearSearchHistory() {
        const db = this.getDatabase();
        db.searchHistory = [];
        this.saveDatabase(db);
    }

    // --- PERSONALIZED STORE & PRODUCT SUGGESTIONS API ---
    getPersonalizedStoreSuggestions() {
        const history = this.getSearchHistory().map(h => h.toLowerCase());
        const stores = this.getStoresRankedByVisits();

        if (history.length === 0) {
            return stores.map(s => ({ ...s, matchReason: '🔥 Tendencia en tu zona' }));
        }

        return stores.map(st => {
            let matchedKeyword = null;
            const fullStr = `${st.name} ${st.category} ${st.sellsText} ${st.marqueeText}`.toLowerCase();
            
            for (const h of history) {
                if (fullStr.includes(h)) {
                    matchedKeyword = h;
                    break;
                }
            }

            return {
                ...st,
                matchReason: matchedKeyword ? `💡 Sugerido por búsqueda: "${matchedKeyword}"` : '🔥 Recomendado para ti'
            };
        });
    }

    // --- STORE VISITS & RANKING ALGORITHM API ---
    recordStoreVisit(storeId) {
        const db = this.getDatabase();
        if (!db.storeVisits) db.storeVisits = {};
        db.storeVisits[storeId] = (db.storeVisits[storeId] || 0) + 1;
        this.saveDatabase(db);
    }

    getStoresRankedByVisits() {
        const db = this.getDatabase();
        const visits = db.storeVisits || { 'p2p_store_techzone': 5, 'store_electro': 2 };

        const allStores = [
            {
                id: 'p2p_store_techzone',
                name: 'TechZone Store',
                category: 'Electrónica & Audio',
                sellsText: 'Auriculares Hi-Fi, Smartwatches, Cargadores Solares',
                icon: '🏬',
                region: 'metrosur',
                marqueeText: '🔥 30% OFF en Auriculares Hi-Fi Pro | 🚚 Envíos Gratis en compras > $50 | 🏪 Retiro $0 en Tienda',
                products: db.products || [],
                rating: '4.9 ★★★★★'
            },
            {
                id: 'store_electro',
                name: 'ElectroMarket P2P',
                category: 'Electrónica & Audio',
                sellsText: 'Parlantes Bluetooth, Micrófonos USB, Cables HDMI',
                icon: '⚡',
                region: 'centro',
                marqueeText: '⚡ Ofertón: Parlantes Bluetooth P2P con 20% de Descuento | 📦 Despacho el mismo día',
                products: [
                    { id: 'p_e1', name: 'Parlante Bluetooth BoomBox 30W', price: 75, stock: 10, category: 'Audio', image: '🔊' }
                ],
                rating: '4.7 ★★★★☆'
            },
            {
                id: 'store_audiophile',
                name: 'AudioPhile Express',
                category: 'Electrónica & Audio',
                sellsText: 'Auriculares Studio, Amplificadores DAC, Placas de Audio',
                icon: '🎧',
                region: 'metrosur',
                marqueeText: '🎧 ¡Nuevo Stock! Amplificadores DAC Portátiles en Escrow Garantizado',
                products: [
                    { id: 'p_a1', name: 'Amplificador DAC USB-C Hi-Res', price: 120, stock: 5, category: 'Audio', image: '📻' }
                ],
                rating: '4.8 ★★★★★'
            },
            {
                id: 'store_fashion',
                name: 'EcoFashion Store',
                category: 'Indumentaria & Calzado',
                sellsText: 'Zapatillas Urbanas, Camperas Recicladas, Accesorios',
                icon: '👟',
                region: 'centro',
                marqueeText: '🌱 2x1 en Zapatillas Urbanas Sustentables | 🚲 Envíos en EcoBike $10',
                products: [
                    { id: 'p_f1', name: 'Zapatillas Eco Runner Pro', price: 90, stock: 15, category: 'Calzado', image: '👟' }
                ],
                rating: '4.6 ★★★★☆'
            }
        ];

        // Sort by user visits count descending
        return allStores.map(st => ({
            ...st,
            visitCount: visits[st.id] || 0
        })).sort((a, b) => b.visitCount - a.visitCount);
    }
    // --- STATUSES / INSTAGRAM STORIES API ---

    getStatuses() {
        const db = this.getDatabase();
        if (!db.statuses) {
            db.statuses = [];
            this.saveDatabase(db);
        }
        return db.statuses;
    }

    saveStatus(statusObj) {
        const db = this.getDatabase();
        if (!db.statuses) db.statuses = [];
        db.statuses.unshift(statusObj);
        return this.saveDatabase(db);
    }

    // Agrupa los estados por autor: si ya existe un perfil del autor, agrega el slide;
    // si no, crea el perfil. Así todos tus estados quedan bajo una sola burbuja (como WhatsApp).
    addStatusSlide(author, slide) {
        const db = this.getDatabase();
        if (!db.statuses) db.statuses = [];
        let st = db.statuses.find(s => s.authorId === author.authorId);
        if (st) {
            st.slides.push(slide);
            st.timestamp = new Date().toISOString();
            // Mover el perfil al frente (más reciente primero)
            db.statuses = [st, ...db.statuses.filter(s => s !== st)];
        } else {
            st = {
                id: 'status_' + author.authorId + '_' + Date.now(),
                authorId: author.authorId,
                authorName: author.authorName,
                authorAvatar: author.authorAvatar,
                timestamp: new Date().toISOString(),
                slides: [slide]
            };
            db.statuses.unshift(st);
        }
        return this.saveDatabase(db) ? st : false;
    }

    // Une estados separados del mismo autor en un solo perfil (migra los ya publicados).
    consolidateStatuses() {
        const db = this.getDatabase();
        if (!db || !db.statuses || db.statuses.length === 0) return;
        const byAuthor = {};
        const order = [];
        for (const s of db.statuses) {
            if (!byAuthor[s.authorId]) {
                byAuthor[s.authorId] = { ...s, slides: [...(s.slides || [])] };
                order.push(s.authorId);
            } else {
                byAuthor[s.authorId].slides.push(...(s.slides || []));
                if (new Date(s.timestamp) > new Date(byAuthor[s.authorId].timestamp)) {
                    byAuthor[s.authorId].timestamp = s.timestamp;
                }
            }
        }
        const merged = order.map(a => byAuthor[a]);
        if (merged.length !== db.statuses.length) {
            db.statuses = merged;
            this.saveDatabase(db);
        }
    }
}

// Storage engine initialization is now handled by p2p-node.js
// Each device gets a single LocalStorageEngine with a unique device ID.
// Backward-compatible aliases (buyerStorage, merchantStorage, etc.) are set there.


/**
 * NEXUS P2P - Logistics & Shipping Node Engine
 * Operates as a specialized P2P service provider node exposing rate tables
 * and receiving delivery orders linked directly to merchant products.
 */
class LogisticsEngine {
    constructor(nodeId, storageEngine) {
        this.nodeId = nodeId || 'p2p_courier_express';
        this.storage = storageEngine;
        this.rateMatrix = [
            { id: 'zone_urban', zone: 'Zona Urbana Centro', maxKm: 15, fee: 8.00, estTime: '45 min' },
            { id: 'zone_metro_sur', zone: 'Zona Metro Sur', maxKm: 50, fee: 15.00, estTime: '2 hrs' },
            { id: 'zone_regional', zone: 'Interurbano Regional', maxKm: 150, fee: 28.00, estTime: '24 hrs' }
        ];
        this.activeDispatches = [
            {
                orderId: 'ORD-9912',
                buyerId: 'p2p_buyer_7721',
                merchantId: 'p2p_store_techzone',
                productName: 'Auriculares Hi-Fi Wireless Pro',
                productPrice: 100.00,
                shippingFee: 15.00,
                totalHeld: 115.00,
                status: 'AUTH_HOLD', // AUTH_HOLD | CAPTURED | EXPIRED
                createdAt: new Date().toISOString()
            }
        ];
    }

    calculateShippingFee(region) {
        const rate = this.rateMatrix.find(r => r.zone.toLowerCase().includes(region.toLowerCase())) || this.rateMatrix[1];
        return rate.fee;
    }

    getRateMatrix() {
        return this.rateMatrix;
    }

    getActiveDispatches() {
        return this.activeDispatches;
    }

    createDispatchOrder(buyerId, merchantId, product, shippingFee) {
        const order = {
            orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            buyerId,
            merchantId,
            productName: product.name,
            productPrice: product.price,
            shippingFee: shippingFee || 15.00,
            totalHeld: product.price + (shippingFee || 15.00),
            status: 'AUTH_HOLD',
            createdAt: new Date().toISOString()
        };
        this.activeDispatches.unshift(order);
        return order;
    }

    updateDispatchStatus(orderId, status) {
        const dispatch = this.activeDispatches.find(d => d.orderId === orderId);
        if (dispatch) {
            dispatch.status = status;
        }
    }
}

window.logisticsEngine = new LogisticsEngine('p2p_courier_express', window.logisticsStorage);

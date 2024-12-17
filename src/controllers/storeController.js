const pool = require('../connect/connection');
const Store = require('../models/stores');

class StoreController {
    // Obtener todas las tiendas
    async getAllStores() {
        const [stores] = await pool.execute('SELECT * FROM Stores');
        return stores.map(store => new Store(store.id_store, store.name_store));
    }

    // Obtener tienda por ID
    async getStoreById(id_store) {
        const [stores] = await pool.execute('SELECT * FROM Stores WHERE id_store = ?', [id_store]);
        
        if (stores.length === 0) return null;
        
        const store = stores[0];
        return new Store(store.id_store, store.name_store);
    }

    // Crear nueva tienda
    async createStore(storeData) {
        const store = new Store(storeData.id_store, storeData.name_store);

        const validationErrors = store.validate();
        if (validationErrors) {
            throw new Error(validationErrors.join(', '));
        }

        await pool.execute(
            'INSERT INTO Stores (id_store, name_store) VALUES (?, ?)', 
            [store.id_store, store.name_store]
        );

        return store;
    }

    // Actualizar tienda
    async updateStore(id_store, storeData) {
        await pool.execute(
            'UPDATE Stores SET name_store = ? WHERE id_store = ?', 
            [storeData.name_store, id_store]
        );

        return this.getStoreById(id_store);
    }

    // Eliminar tienda
    async deleteStore(id_store) {
        await pool.execute('DELETE FROM Stores WHERE id_store = ?', [id_store]);
        return true;
    }
}

module.exports = new StoreController();
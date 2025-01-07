class Store {
    constructor(id_store, name_store, hour_open_store) {
        this.id_store = id_store;
        this.name_store = name_store;
        this.hour_open_store = hour_open_store;
    }

    validate() {
        const errors = [];

        if (!this.id_store) {
            errors.push('El ID de la tienda es obligatorio');
        }

        if (!this.name_store) {
            errors.push('El nombre de la tienda es obligatorio');
        }

        if (!this.hour_open_store) {
            errors.push('La hora de apertura de la tienda es obligatoria');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Store;
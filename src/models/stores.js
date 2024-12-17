class Store {
    constructor(id_store, name_store) {
        this.id_store = id_store;
        this.name_store = name_store;
    }

    validate() {
        const errors = [];

        if (!this.id_store) {
            errors.push('El ID de la tienda es obligatorio');
        }

        if (!this.name_store) {
            errors.push('El nombre de la tienda es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Store;
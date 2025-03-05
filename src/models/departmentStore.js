class DepartmentStore {
    constructor(id_store_dep, id_store, id_department, min_opening, max_opening, min_closing, max_closing) {
        this.id_store_dep = id_store_dep;
        this.id_store = id_store;
        this.id_department = id_department;
        this.min_opening = min_opening;
        this.max_opening = max_opening;
        this.min_closing = min_closing;
        this.max_closing = max_closing;
    }

    validate() {
        const errors = [];

        if (!this.id_store) {
            errors.push('El ID de la tienda es obligatorio');
        }

        if (!this.id_department) {
            errors.push('El ID del departamento es obligatorio');
        }

        if (!this.min_opening) {
            errors.push('La apertura mínima es obligatoria');
        }

        if (!this.max_opening) {
            errors.push('La apertura máxima es obligatoria');
        }

        if (!this.min_closing) {
            errors.push('El cierre mínimo es obligatorio');
        }

        if (!this.max_closing) {
            errors.push('El cierre máximo es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = DepartmentStore;
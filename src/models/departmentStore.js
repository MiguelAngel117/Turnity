class DepartmentStore {
    constructor(id_store_dep, id_store, id_department, name_department = null) {
        this.id_store_dep = id_store_dep;
        this.id_store = id_store;
        this.id_department = id_department;
        this.name_department = name_department;
    }

    validate() {
        const errors = [];

        if (!this.id_store) {
            errors.push('El ID de la tienda es obligatorio');
        }

        if (!this.id_department) {
            errors.push('El ID del departamento es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = DepartmentStore;
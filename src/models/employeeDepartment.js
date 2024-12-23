class EmployeeDepartment {
    constructor(number_document, id_store_dep, id_position) {
        this.number_document = number_document;
        this.id_store_dep = id_store_dep;
        this.id_position = id_position;
    }

    validate() {
        const errors = [];
        if (!this.number_document) errors.push("Documento requerido");
        if (!this.id_store_dep) errors.push("Departamento-Tienda requerido");
        if (!this.id_position) errors.push("Cargo requerido");
        return errors.length ? errors : null;
    }
}

module.exports = EmployeeDepartment;
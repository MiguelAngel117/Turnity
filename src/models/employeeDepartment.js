class EmployeeDepartment {
    constructor(id_employee_dep, number_document, id_store_dep, id_position, working_day, contract) {
        this.id_employee_dep = id_employee_dep; 
        this.number_document = number_document;
        this.id_store_dep = id_store_dep;
        this.id_position = id_position;
        this.working_day = working_day;
        this.contract_date = contract
    }

    validate() {
        const errors = [];
        if (!this.number_document) errors.push("Documento requerido");
        if (!this.id_store_dep) errors.push("Departamento-Tienda requerido");
        if (!this.id_position) errors.push("Cargo requerido");
        if (!this.working_day) errors.push("Jornada requerida");
        if (!this.contract_date) errors.push("Fecha de contrato requerida");
        return errors.length ? errors : null;
    }
}

module.exports = EmployeeDepartment;
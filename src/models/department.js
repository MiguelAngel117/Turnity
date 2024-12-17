class Department {
    constructor(id_department, name_department, cod_ce_cost) {
        this.id_department = id_department;
        this.name_department = name_department;
        this.cod_ce_cost = cod_ce_cost;
    }

    validate() {
        const errors = [];

        if (!this.name_department) {
            errors.push('El nombre del departamento es obligatorio');
        }

        if (!this.cod_ce_cost) {
            errors.push('El código de centro de costo es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Department;
class Employee {
    constructor(
        number_document, 
        num_doc_manager, 
        first_names, 
        last_names, 
        working_day
    ) {
        this.number_document = number_document;
        this.num_doc_manager = num_doc_manager || null;
        this.first_names = first_names;
        this.last_names = last_names;
        this.working_day = working_day || null;
    }

    // Método para validar datos
    validate() {
        const errors = [];

        if (!this.number_document) {
            errors.push('El número de documento es obligatorio');
        }

        if (!this.first_names) {
            errors.push('Los nombres son obligatorios');
        }

        if (!this.last_names) {
            errors.push('Los apellidos son obligatorios');
        }

        return errors.length === 0 ? null : errors;
    }

    // Método para obtener nombre completo
    getFullName() {
        return `${this.first_names} ${this.last_names}`;
    }
}

module.exports = Employee;
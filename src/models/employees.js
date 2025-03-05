class Employee {
    constructor(
        number_document, 
        num_doc_manager, 
        full_name
    ) {
        this.number_document = number_document;
        this.num_doc_manager = num_doc_manager || null;
        this.full_name = full_name;
    }

    // Método para validar datos
    validate() {
        const errors = [];

        if (!this.number_document) {
            errors.push('El número de documento es obligatorio');
        }

        if (!this.full_name) {
            errors.push('Los nombres son obligatorios');
        }

        return errors.length === 0 ? null : errors;
    }

    // Método para obtener nombre completo
    getFullName() {
        return `${this.full_name}`;
    }
}

module.exports = Employee;
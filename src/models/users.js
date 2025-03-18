class User {
    constructor(number_document, alias_user, first_names, last_names, email, password, status_user = true, role_name = null) {
        this.number_document = number_document;
        this.alias_user = alias_user;
        this.first_names = first_names;
        this.last_names = last_names;
        this.email = email;
        this.password = password;
        this.status_user = status_user;
        this.role_name = role_name;
    }

    validate() {
        const errors = [];

        if (!this.number_document) {
            errors.push('El número de documento es obligatorio');
        }

        if (!this.alias_user) {
            errors.push('El alias de usuario es obligatorio');
        }

        if (!this.first_names) {
            errors.push('Los nombres son obligatorios');
        }

        if (!this.last_names) {
            errors.push('Los apellidos son obligatorios');
        }

        if (!this.email) {
            errors.push('El email es obligatorio');
        } else if (!this.validateEmail(this.email)) {
            errors.push('El formato de email no es válido');
        }

        if (!this.password) {
            errors.push('La contraseña es obligatoria');
        }

        return errors.length === 0 ? null : errors;
    }

    validateEmail(email) {
        const re = /\S+@\S+\.\S+/;
        return re.test(email);
    }
}

module.exports = User;
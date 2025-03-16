class Role {
    constructor(role_name, description) {
        this.role_name = role_name;
        this.description = description;
    }

    validate() {
        const errors = [];

        if (!this.role_name) {
            errors.push('El nombre del rol es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Role;
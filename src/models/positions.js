class Position {
    constructor(id_position, name_position) {
        this.id_position = id_position;
        this.name_position = name_position;
    }

    validate() {
        const errors = [];

        if (!this.id_position) {
            errors.push('El ID de la posición es obligatorio');
        }

        if (!this.name_position) {
            errors.push('El nombre de la posición es obligatorio');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Position;
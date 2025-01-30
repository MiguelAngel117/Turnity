class Shift {
    constructor(code_shift, hours, initial_hour, end_hour) {
        this.code_shift = code_shift;
        this.hours = hours;
        this.initial_hour = initial_hour;
        this.end_hour = end_hour;
    }

    validate() {
        const errors = [];

        if (!this.code_shift){
            errors.push('El código del turno es obligatorio');
        }

        if (this.hours === null || this.hours === undefined) {
            errors.push('Las horas del turno son obligatorias');
        }

        if (!this.initial_hour) {
            errors.push('La hora inicial del turno es obligatoria');
        }

        return errors.length === 0 ? null : errors;
    }
}

module.exports = Shift;
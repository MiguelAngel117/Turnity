class ShiftGenerator {
    constructor() {
        this.WORKING_DAYS = {
            FULL_TIME: 46,
            PART_TIME_36: 36,
            PART_TIME_24: 24,
            PART_TIME_16: 16
        };

        this.HOURS = {
            MIN_NUM_HOURS: 4,
            MAX_NUM_HOURS: 10
        }

        this.SUNDAYS_ALLOWED = {
            FOUR_WEEKS: 2,
            FIVE_WEEKS: 3
        }
    }

    isHoliday(date) {
        // Implementa tu lógica para determinar si una fecha es festiva.
        return false;
    }

    validateWeeklyHours(weeklyShifts, employee, numWeeks) {
        const validation = {
            isValid: false,
            data: null,
            errors: []
        };

        if (!Array.isArray(weeklyShifts)) {
            validation.errors.push({
                field: 'weeklyShifts',
                message: 'weeklyShifts debe ser un array válido',
                employeeId: employee?.number_document || 'Unknown'
            });
            return validation;
        }

        let totalHours = 0;
        let totalSundayWorkCount = 0;
        let hasWorkOnSaturday = false;

        // Procesar todos los turnos de todas las semanas
        for (let weekIndex = 0; weekIndex < weeklyShifts.length; weekIndex++) {
            const weeklyShift = weeklyShifts[weekIndex];
            
            if (!weeklyShift.shifts || !Array.isArray(weeklyShift.shifts)) {
                validation.errors.push({
                    field: `weeklyShifts[${weekIndex}].shifts`,
                    message: 'Los turnos deben ser un array válido',
                    employeeId: employee?.number_document || 'Unknown'
                });
                continue;
            }

            for (let shiftIndex = 0; shiftIndex < weeklyShift.shifts.length; shiftIndex++) {
                const shift = weeklyShift.shifts[shiftIndex];
                
                if (!shift || typeof shift.hours !== 'number' || !shift.shift_date) {
                    validation.errors.push({
                        field: `weeklyShifts[${weekIndex}].shifts[${shiftIndex}]`,
                        message: 'El turno debe incluir un número de horas válido y una fecha',
                        employeeId: employee?.number_document || 'Unknown'
                    });
                    continue;
                }

                const shiftDate = new Date(shift.shift_date);
                const shiftDay = shiftDate.getDay() + 1; // 7: Domingo, 6: Sábado

                // Validar horas del turno
                if (shift.hours !== 0 && (shift.hours < this.HOURS.MIN_NUM_HOURS || shift.hours > this.HOURS.MAX_NUM_HOURS)) {
                    validation.errors.push({
                        field: `weeklyShifts[${weekIndex}].shifts[${shiftIndex}]`,
                        message: `Las horas del turno deben ser 0 o estar entre ${this.HOURS.MIN_NUM_HOURS} y ${this.HOURS.MAX_NUM_HOURS} horas`,
                        employeeId: employee?.number_document || 'Unknown'
                    });
                }

                totalHours += shift.hours;

                if(employee.working_day === this.WORKING_DAYS.PART_TIME_36 || employee.working_day === this.WORKING_DAYS.FULL_TIME) {
                    // Verificar trabajo en sábado
                    if(shiftDay === 6 && shift.hours == 0) {
                        console.log('No Trabajo en sábado' + shift.shift_date
                        );
                        hasWorkOnSaturday = true;
                    }
                    
                    // Contar domingos trabajados
                    if (shiftDay === 7 && shift.hours > 0) {
                        totalSundayWorkCount++;
                    }
                } else if(employee.working_day === this.WORKING_DAYS.PART_TIME_16) {
                    if (shiftDay !== 6 && shiftDay !== 7 && !this.isHoliday(shiftDate) && shift.hours > 0) {
                        validation.errors.push({
                            field: `weeklyShifts[${weekIndex}].shifts[${shiftIndex}]`,
                            message: 'Los empleados de jornada de 16 horas solo pueden trabajar sábados, domingos o días festivos',
                            employeeId: employee.number_document
                        });
                    }
                }
            }
        }

        // Colección de todas las validaciones necesarias
        const validations = [];

        // Validar que haya al menos un sábado trabajado para empleados full-time y part-time 36
        if (employee.working_day === this.WORKING_DAYS.PART_TIME_36 || employee.working_day === this.WORKING_DAYS.FULL_TIME) {
            validations.push(() => {
                if (hasWorkOnSaturday) {
                    validation.errors.push({
                        field: 'weeklyShifts',
                        message: 'El empleado debe tener al menos un turno asignado el sábado',
                        employeeId: employee.number_document
                    });
                }
            });
        }

        // Validar límite de domingos según número de semanas
        validations.push(() => {
            const maxSundays = numWeeks === 5 ? this.SUNDAYS_ALLOWED.FIVE_WEEKS : this.SUNDAYS_ALLOWED.FOUR_WEEKS;
            if (totalSundayWorkCount > maxSundays) {
                validation.errors.push({
                    field: 'weeklyShifts',
                    message: `El empleado no puede trabajar más de ${maxSundays} domingos en ${numWeeks} semanas`,
                    employeeId: employee.number_document
                });
            }
        });

        // Validar total de horas
        validations.push(() => {
            if (totalHours > (employee.working_day * numWeeks)) {
                validation.errors.push({
                    field: 'totalHours',
                    message: `Las horas totales (${totalHours}) exceden la jornada laboral permitida (${employee.working_day * numWeeks} horas para ${numWeeks} semanas)`,
                    employeeId: employee.number_document
                });
            }
        });

        // Ejecutar todas las validaciones
        validations.forEach(validateFn => validateFn());

        validation.isValid = validation.errors.length === 0;
        validation.data = {
            totalHours,
            sundayWorkCount: totalSundayWorkCount,
            message: validation.isValid ? "Las horas son correctas" : "Se encontraron errores en la validación"
        };

        return validation;
    }

    async createShifts(storeId, departmentId, positionId, numWeeks, employeeShifts) {
        const response = {
            success: false,
            data: null,
            errors: [] 
        };

        try {
            if (!employeeShifts || !Array.isArray(employeeShifts)) {
                response.errors.push({
                    field: 'employeeShifts',
                    message: 'employeeShifts debe ser un array válido'
                });
                return response;
            }

            const validatedShifts = [];

            for (const employeeShift of employeeShifts) {
                if (!employeeShift.employee || !employeeShift.weeklyShifts) {
                    response.errors.push({
                        field: 'employeeShift',
                        message: 'Cada elemento debe tener employee y weeklyShifts',
                        employeeId: employeeShift?.employee?.number_document || 'Unknown'
                    });
                    continue;
                }

                // Validar todos los turnos semanales juntos para cada empleado
                const validation = this.validateWeeklyHours(
                    employeeShift.weeklyShifts,
                    employeeShift.employee,
                    numWeeks
                );

                if (!validation.isValid) {
                    response.errors.push(...validation.errors);
                    continue;
                }

                // Agregar los turnos validados
                employeeShift.weeklyShifts.forEach(weeklyShift => {
                    validatedShifts.push({
                        employeeId: employeeShift.employee.number_document,
                        week: weeklyShift.week,
                        shifts: weeklyShift.shifts,
                        totalHours: validation.data.totalHours,
                        sundayWorkCount: validation.data.sundayWorkCount
                    });
                });
            }

            if (response.errors.length > 0) {
                return response;
            }

            response.success = true;
            response.data = validatedShifts;

            return response;
        } catch (error) {
            response.errors.push({
                field: 'general',
                message: 'Error interno del servidor',
                details: error.message
            });
            return response;
        }
    }
}

module.exports = ShiftGenerator;
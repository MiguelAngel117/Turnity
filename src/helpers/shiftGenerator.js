class ShiftGenerator {
    listSpecialDays = ["X", "CUMPLEAÑOS", "VACACIONES", "INCAPACIDAD", "JURADO VOT", "DIA_FAMILIA", "LICENCIA", "DIA_DISFRUTE"];
    
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

    validateWeeklyHours(weeklyShift, employee, numWeeks) {
        const validation = {
            isValid: false,
            data: null,
            errors: []
        };

        // Verificar que los argumentos sean válidos
        if (!weeklyShift || !Array.isArray(weeklyShift.shifts)) {
            validation.errors.push({
                field: 'weeklyShift',
                message: 'Los turnos deben ser un array válido',
                employeeId: employee?.number_document || 'Unknown'
            });
            return validation;
        }

        // Si no se especifica working_day en la semana, usar el del empleado
        const workingDay = weeklyShift.working_day || employee.working_day;

        let totalHours = 0;
        let totalSundayWorkCount = 0;
        let hasWorkOnSaturday = false;

        for (let shiftIndex = 0; shiftIndex < weeklyShift.shifts.length; shiftIndex++) {
            const shift = weeklyShift.shifts[shiftIndex];
            
            if (!shift || typeof shift.hours !== 'number' || !shift.shift_date) {
                validation.errors.push({
                    field: `weeklyShift.shifts[${shiftIndex}]`,
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
                    field: `weeklyShift.shifts[${shiftIndex}]`,
                    message: `Las horas del turno deben ser 0 o estar entre ${this.HOURS.MIN_NUM_HOURS} y ${this.HOURS.MAX_NUM_HOURS} horas`,
                    employeeId: employee?.number_document || 'Unknown'
                });
            }

            totalHours += shift.hours;

            // Validaciones específicas por tipo de jornada
            if(workingDay === this.WORKING_DAYS.PART_TIME_36 || workingDay === this.WORKING_DAYS.FULL_TIME) {
                // Verificar trabajo en sábado
                if(shiftDay === 6) {
                    if(shift.hours > 0) {
                        hasWorkOnSaturday = true;
                    } else {
                        // CORRECCIÓN: Validar que los empleados de 36 y 46 horas trabajen todos los sábados
                        validation.errors.push({
                            field: `weeklyShift.shifts[${shiftIndex}]`,
                            message: 'Los empleados de jornada de 36 o 46 horas deben trabajar todos los sábados',
                            employeeId: employee.number_document
                        });
                    }
                }
                
                // Contar domingos trabajados
                if (shiftDay === 7 && shift.hours > 0) {
                    totalSundayWorkCount++;
                }
            } 
            else if(workingDay === this.WORKING_DAYS.PART_TIME_24) {
                // Los empleados de 24h deben trabajar todos los domingos
                if(shiftDay === 7 && shift.hours === 0) {
                    validation.errors.push({
                        field: `weeklyShift.shifts[${shiftIndex}]`,
                        message: 'Los empleados de jornada de 24 horas deben trabajar todos los domingos',
                        employeeId: employee.number_document
                    });
                }
            } 
            else if(workingDay === this.WORKING_DAYS.PART_TIME_16) {
                // Empleados de 16h solo pueden trabajar sábados, domingos o días festivos
                if (shiftDay !== 6 && shiftDay !== 7 && shift.hours > 0) {
                    validation.errors.push({
                        field: `weeklyShift.shifts[${shiftIndex}]`,
                        message: 'Los empleados de jornada de 16 horas solo pueden trabajar sábados, domingos o días festivos',
                        employeeId: employee.number_document
                    });
                }
            }
        }

        // Validaciones adicionales
        const validations = [];

        // Validar límite de domingos
        validations.push(() => {
            const maxSundays = numWeeks === 5 ? this.SUNDAYS_ALLOWED.FIVE_WEEKS : this.SUNDAYS_ALLOWED.FOUR_WEEKS;
            if (totalSundayWorkCount > maxSundays) {
                validation.errors.push({
                    field: 'weeklyShift',
                    message: `El empleado no puede trabajar más de ${maxSundays} domingos en ${numWeeks} semanas`,
                    employeeId: employee.number_document
                });
            }
        });

        // Validar horas por semana
        validations.push(() => {
            if (totalHours !== workingDay) {
                validation.errors.push({
                    field: 'totalHours',
                    message: `Las horas totales (${totalHours}) no coinciden con la jornada laboral permitida (${workingDay} horas)`,
                    employeeId: employee.number_document
                });
            }
        });

        // Ejecutar validaciones
        validations.forEach(validateFn => validateFn());

        validation.isValid = validation.errors.length === 0;
        validation.data = {
            totalHours,
            workingDay,
            sundayWorkCount: totalSundayWorkCount,
            workSaturday: hasWorkOnSaturday,
            message: validation.isValid ? "Las horas son correctas" : "Se encontraron errores en la validación"
        };

        return validation;
    }

    async createShifts(numWeeks, employeeShifts) {
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
            
            // CORRECCIÓN: Contadores para validar domingos por tipo de jornada
            const sundayWorkCountByEmployee = {};
            let counterFullTime = 0;

            for (const employeeShift of employeeShifts) {
                // Validar que exista el empleado
                if (!employeeShift.employee || !employeeShift.weeklyShifts) {
                    response.errors.push({
                        field: 'employeeShift',
                        message: 'Cada elemento debe tener employee y weeklyShifts',
                        employeeId: employeeShift?.employee?.number_document || 'Unknown'
                    });
                    continue;
                }
                
                const employeeId = employeeShift.employee.number_document;
                const workingDay = employeeShift.employee.working_day;
                
                // Inicializar contador para este empleado
                if (!sundayWorkCountByEmployee[employeeId]) {
                    sundayWorkCountByEmployee[employeeId] = {
                        totalSundays: 0,
                        workingDay: workingDay,
                        saturdayWorkCount: 0,
                        weeksCount: 0
                    };
                }

                // Validar cada semana individualmente
                for (const weeklyShift of employeeShift.weeklyShifts) {
                    let workingDayInWeek = weeklyShift.working_day || workingDay;
                    const validation = this.validateWeeklyHours(
                        weeklyShift,
                        employeeShift.employee,
                        numWeeks
                    );

                    if(workingDayInWeek === this.WORKING_DAYS.PART_TIME_36 || workingDayInWeek === this.WORKING_DAYS.FULL_TIME){
                        counterFullTime++;
                    }
                    
                    // Actualizar contadores para validaciones globales
                    if (validation.data) {
                        sundayWorkCountByEmployee[employeeId].totalSundays += validation.data.sundayWorkCount;
                        sundayWorkCountByEmployee[employeeId].weeksCount += 1;
                        if (validation.data.workSaturday) {
                            sundayWorkCountByEmployee[employeeId].saturdayWorkCount += 1;
                        }
                    }

                    if (!validation.isValid) {
                        response.errors.push(...validation.errors);
                        continue;
                    }

                    // Agregar los turnos validados
                    validatedShifts.push({
                        employeeId: employeeId,
                        week: weeklyShift.week,
                        shifts: weeklyShift.shifts,
                        workingDay: validation.data.workingDay,
                        totalHours: validation.data.totalHours,
                        sundayWorkCount: validation.data.sundayWorkCount
                    });
                }
            }
            
            // CORRECCIÓN: Validar que los empleados de 36 y 46 horas trabajen todos los sábados y los límites de domingos
            for (const employeeId in sundayWorkCountByEmployee) {
                const employeeData = sundayWorkCountByEmployee[employeeId];
                
                // Validar trabajo en sábados para empleados de 36 y 46 horas
                //-->Aca se tiene en cuenta si cambia de jornada nuevamente a una menor a 36horas
                if ((employeeData.workingDay === this.WORKING_DAYS.PART_TIME_36 || 
                     employeeData.workingDay === this.WORKING_DAYS.FULL_TIME) && 
                    employeeData.saturdayWorkCount !== employeeData.weeksCount && counterFullTime === employeeData.weeksCount) {
                        console.log(counterFullTime + " " + employeeData.weeksCount);
                    
                    response.errors.push({
                        field: 'general',
                        message: `El empleado con jornada de ${employeeData.workingDay} horas debe trabajar todos los sábados (${employeeData.saturdayWorkCount} de ${employeeData.weeksCount})`,
                        employeeId: employeeId
                    });
                }
                
                // Validar límite global de domingos
                const maxSundays = numWeeks === 5 ? this.SUNDAYS_ALLOWED.FIVE_WEEKS : this.SUNDAYS_ALLOWED.FOUR_WEEKS;
                if (employeeData.totalSundays > maxSundays) {
                    response.errors.push({
                        field: 'general',
                        message: `El empleado no puede trabajar más de ${maxSundays} domingos en ${numWeeks} semanas (actual: ${employeeData.totalSundays})`,
                        employeeId: employeeId
                    });
                }
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